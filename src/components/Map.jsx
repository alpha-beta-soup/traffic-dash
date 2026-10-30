import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

import CongestionLegend from './CongestionLegend';
import EventPopup from './EventPopup';
import LayersMenu from './LayersMenu';
import SitePopup, { DIRECTION_ORDER } from './SitePopup';
import useLatest from '../hooks/useLatest';
import {
  EMPTY, EVENT_LAYERS, SIGN_LAYERS, SIGN_PAGE_TIME, addLayers, signIcon, signImageId, trafficOpacity, trafficTiles,
} from '../map/layers';
import { TRAFFIC_REFRESH } from '../consts';
import {
  cameraCongestion, drawSignPage, filterCamerasByBbox, groupCameraSites, signPages, signSize,
} from '../utils';

// maplibre-gl 6 looks for its worker next to its own module, which isn't there once
// Vite has pre-bundled (dev) or bundled (build) it; so point it at the real file
maplibregl.setWorkerUrl(workerUrl);

const DEFAULT_LOCATION = [174.787, -41.272]; // Wellington
const DEFAULT_ZOOM = 11;
const REGION_HIGHLIGHTS = {
  Auckland: [174.7633, -36.8484],
  Hamilton: [175.2793, -37.7870],
  Wellington: [174.7762, -41.2865],
  Christchurch: [172.6362, -43.5321],
  Dunedin: [170.5028, -45.8788],
};
// Required by the NZTA terms of use: https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use
const NZTA_ATTRIBUTION = 'Cameras &amp; signs: <a href="https://www.journeys.nzta.govt.nz/" target="_blank" rel="noopener">Waka Kotahi NZ Transport Agency</a>';
// Every way of moving the map; all off while it's minimised
const INTERACTIONS = ['boxZoom', 'doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard', 'scrollZoom', 'touchPitch', 'touchZoomRotate'];
// Credits are left off the minimised map. Note: OpenStreetMap, OpenMapTiles and Mapbox ask for
// attribution wherever their data is shown; add a page-level credit if this is ever hosted.
const attributionControl = () => new maplibregl.AttributionControl({ compact: false, customAttribution: NZTA_ATTRIBUTION });

const toGeojson = items => ({
  type: 'FeatureCollection',
  features: items.map(({ lat, lon, ...properties }) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties,
  })),
});

export default function Map({
  styleUrl, traffic, cameras, signs, events, centre, congestion, isShown, minimised,
  layers, onBoundsChange, onSiteClick, onCongestion, onToggleMinimised, onLayersChange,
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const onBoundsChangeRef = useLatest(onBoundsChange);
  const onSiteClickRef = useLatest(onSiteClick);
  const onCongestionRef = useLatest(onCongestion);
  const camerasRef = useLatest(cameras);
  const eventsRef = useLatest(events);
  const congestionRef = useLatest(congestion);
  const minimisedRef = useLatest(minimised);
  const attributionRef = useRef(null);
  const expandedView = useRef(null); // The last settled full-size view
  // Set from minimising until the full-size view is back; the map's own resize events
  // in between mustn't count as the user's view
  const restoreView = useRef(null);
  const reportBoundsRef = useRef(null);
  const [hovered, setHovered] = useState(null); // { cameras, lngLat }: the site under the pointer
  const hoverKey = useRef(null);
  const [hoveredEvent, setHoveredEvent] = useState(null); // The road event under the pointer
  const [, setMoved] = useState(0);

  // Keep a hover popup on its icon if the map moves underneath it (e.g. scroll-zooming)
  useEffect(() => {
    const map = mapRef.current;
    if ((!hovered && !hoveredEvent) || !map) return undefined;
    const onMove = () => setMoved(n => n + 1);
    map.on('move', onMove);
    return () => map.off('move', onMove);
  }, [hovered, hoveredEvent]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center: DEFAULT_LOCATION,
      zoom: DEFAULT_ZOOM,
      attributionControl: false, // Added below, so it can be left off when minimised
    });
    mapRef.current = map;
    attributionRef.current = attributionControl();
    if (!minimisedRef.current) map.addControl(attributionRef.current);
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    // While minimised the grid keeps the cameras from the full-size view, which is remembered
    // here each time it settles (by the time minimising runs, the map may already have shrunk)
    const reportBounds = () => {
      if (minimisedRef.current || restoreView.current) return;
      expandedView.current = {
        center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), bounds: map.getBounds(),
      };
      onBoundsChangeRef.current(expandedView.current.bounds);
    };
    reportBoundsRef.current = reportBounds;
    // Once the map has settled (tiles loaded), match cameras in view to the traffic lines.
    // Only after it has moved or new traffic data has arrived: other redraws (signs changing
    // page, hover highlights) don't change the answer.
    let matchNeeded = true;
    const matchCongestion = () => {
      if (!matchNeeded || !traffic || !map.getSource('traffic')) return;
      matchNeeded = false;
      const inView = filterCamerasByBbox(camerasRef.current, map.getBounds());
      const features = map.querySourceFeatures('traffic', { sourceLayer: 'traffic' });
      onCongestionRef.current(cameraCongestion(inView, features), inView.map(camera => camera.id));
    };
    map.on('load', () => {
      addLayers(map, traffic);
      setLoaded(true);
      reportBounds();
    });
    map.on('moveend', () => { matchNeeded = true; reportBounds(); });
    map.on('sourcedata', (e) => { if (e.sourceId === 'traffic' && e.tile) matchNeeded = true; });
    map.on('idle', matchCongestion);

    // Hovering a site shows its cameras' recent footage, and which traffic segments its
    // congestion came from. mousemove rather than mouseenter, to catch moving straight
    // from one site to a neighbouring one.
    const siteIds = e => String(e.features[0].properties.cameraIds).split(',').map(Number);
    map.on('click', 'cameras', e => !minimisedRef.current && onSiteClickRef.current(siteIds(e)));
    map.on('mousemove', 'cameras', (e) => {
      const key = e.features[0].properties.cameraIds;
      if (minimisedRef.current || hoverKey.current === key) return;
      hoverKey.current = key;
      map.getCanvas().style.cursor = 'pointer';
      const ids = siteIds(e);
      const segments = ids.flatMap(id => congestionRef.current.get(id)?.segments ?? []);
      map.getSource('matched').setData({
        type: 'FeatureCollection',
        features: segments.map(coordinates => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
      });
      const siteCameras = camerasRef.current
        .filter(camera => ids.includes(camera.id))
        .sort((a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction));
      setHovered({ cameras: siteCameras, lngLat: e.features[0].geometry.coordinates });
    });
    map.on('mouseleave', 'cameras', () => {
      hoverKey.current = null;
      map.getCanvas().style.cursor = '';
      map.getSource('matched').setData(EMPTY);
      setHovered(null);
    });

    // Hovering a sign's icon shows the sign itself
    map.on('mousemove', 'signs', (e) => {
      if (minimisedRef.current) return;
      const { id } = e.features[0].properties;
      // Not when that sign is already showing in full
      if (map.getLayer('sign-full') && map.queryRenderedFeatures(e.point, { layers: ['sign-full'] })
        .some(f => f.properties.id === id)) return;
      map.getCanvas().style.cursor = 'pointer';
      map.setFilter('sign-expanded', ['==', ['get', 'id'], id]);
    });
    map.on('mouseleave', 'signs', () => {
      map.getCanvas().style.cursor = '';
      map.setFilter('sign-expanded', ['==', ['get', 'id'], -1]);
    });

    // Hovering a road event's icon shows its details
    map.on('mousemove', 'events', (e) => {
      if (minimisedRef.current) return;
      const { id } = e.features[0].properties;
      map.getCanvas().style.cursor = 'pointer';
      setHoveredEvent(current => (current?.id === id ? current : eventsRef.current.find(event => event.id === id) ?? null));
    });
    map.on('mouseleave', 'events', () => {
      map.getCanvas().style.cursor = '';
      setHoveredEvent(null);
    });

    // Traffic changes every few minutes: refetch the tiles (the server shares them between viewers)
    const refresh = setInterval(() => map.getSource('traffic')?.setTiles(trafficTiles()), TRAFFIC_REFRESH);

    return () => {
      clearInterval(refresh);
      setLoaded(false);
      mapRef.current = null;
      map.remove();
    };
  }, [styleUrl, traffic, onBoundsChangeRef, onSiteClickRef, onCongestionRef, camerasRef, eventsRef, congestionRef, minimisedRef]);

  // Minimised: show the same area in the smaller box, and stop all interaction.
  // Runs after React has resized the container, so the map can measure its new size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    INTERACTIONS.forEach(handler => map[handler][minimised ? 'disable' : 'enable']());
    if (minimised) map.removeControl(attributionRef.current);
    else if (!map.hasControl(attributionRef.current)) map.addControl(attributionRef.current);
    if (minimised) {
      const view = expandedView.current;
      restoreView.current = view;
      hoverKey.current = null;
      setHovered(null);
      setHoveredEvent(null);
      map.getSource('matched')?.setData(EMPTY);
      if (map.getLayer('sign-expanded')) map.setFilter('sign-expanded', ['==', ['get', 'id'], -1]);
      map.getCanvas().style.cursor = '';
      if (view) map.fitBounds(view.bounds, { animate: false, bearing: view.bearing, pitch: view.pitch });
    } else if (restoreView.current) {
      const { center, zoom, bearing, pitch } = restoreView.current;
      map.jumpTo({ center, zoom, bearing, pitch });
      restoreView.current = null;
      reportBoundsRef.current(); // The grid follows the map again
    }
  }, [minimised]);

  // Optional layers. The congestion lines are hidden by making them transparent, not with
  // 'visibility': that clears the source's tiles until the map next moves, and the card
  // borders and the congestion filter need that data.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded) return;
    map.setLayoutProperty('cameras', 'text-field', layers.labels ? ['get', 'name'] : '');
    SIGN_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.signs ? 'visible' : 'none'));
    EVENT_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.events ? 'visible' : 'none'));
    if (map.getLayer('traffic')) map.setPaintProperty('traffic', 'line-opacity', layers.traffic ? trafficOpacity : 0);
  }, [loaded, layers]);

  // Road events: their geometry (points, and lines for stretches of road), and a point each for the icon
  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current;
    const properties = ({ id, impact }) => ({ id, impact });
    map.getSource('events').setData({
      type: 'FeatureCollection',
      features: events.map(event => ({ type: 'Feature', geometry: event.geometry, properties: properties(event) })),
    });
    map.getSource('event-icons').setData(toGeojson(events.map(event => ({ lat: event.lat, lon: event.lon, ...properties(event) }))));
  }, [loaded, events]);

  useEffect(() => {
    if (!loaded) return;
    const sites = groupCameraSites(cameras).map(site => ({
      ...site,
      dim: !site.cameraIds.split(',').map(Number).some(isShown),
    }));
    mapRef.current.getSource('cameras').setData(toGeojson(sites));
  }, [loaded, cameras, isShown]);

  useEffect(() => {
    if (!loaded) return;
    const map = mapRef.current;
    const features = signs.flatMap((sign) => {
      const pages = signPages(sign.message);
      if (!pages.length) return [];
      const size = signSize(pages);
      const icons = pages.map((lines, page) => {
        const id = signImageId(pages, size, page);
        if (!map.hasImage(id)) map.addImage(id, drawSignPage(lines, size), { pixelRatio: 2 });
        return [`page${page}`, id];
      });
      // Travel-time signs list destinations with right-aligned minutes, e.g. "SH1 … 21"
      const travelTimes = pages.some(lines => lines.some(({ right }) => /^\d+$/.test(right)));
      return [{
        lat: sign.lat, lon: sign.lon, id: sign.id, name: sign.name, travelTimes, pages: pages.length, ...Object.fromEntries(icons),
      }];
    });
    map.getSource('signs').setData(toGeojson(features));
  }, [loaded, signs]);

  // Every multi-page sign steps to its next page together
  useEffect(() => {
    if (!loaded) return undefined;
    let tick = 0;
    const timer = setInterval(() => {
      tick += 1;
      ['sign-expanded', 'sign-full'].forEach(id => mapRef.current?.setLayoutProperty(id, 'icon-image', signIcon(tick)));
    }, SIGN_PAGE_TIME);
    return () => clearInterval(timer);
  }, [loaded]);

  useEffect(() => {
    if (centre) mapRef.current?.flyTo({ center: centre.lngLat, zoom: centre.zoom, curve: 6 ** 0.25 });
  }, [centre]);

  return (
    <Paper
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: minimised ? '100%' : 'auto',
        // The zoom controls go too: nothing on a minimised map responds
        '& .maplibregl-ctrl-top-right': { display: minimised ? 'none' : 'block' },
      }}
    >
      {!minimised && (
        <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {Object.entries(REGION_HIGHLIGHTS).map(([region, lngLat]) => (
            <Button
              key={region}
              variant="contained"
              size="small"
              sx={{ opacity: 0.85 }}
              onClick={() => mapRef.current?.flyTo({ center: lngLat, zoom: DEFAULT_ZOOM, curve: 6 ** 0.25 })}
            >
              {region}
            </Button>
          ))}
        </Box>
      )}
      <Box sx={{ position: 'absolute', zIndex: 2, top: 10, right: minimised ? 10 : 50, display: 'flex', gap: 0.5 }}>
        {!minimised && <LayersMenu layers={layers} onChange={onLayersChange} traffic={traffic} />}
        <Button variant="contained" size="small" onClick={onToggleMinimised} sx={{ opacity: 0.85 }}>
          {minimised ? 'Expand' : 'Minimise'}
        </Button>
      </Box>
      <Box
        ref={container}
        sx={{
          width: '100%',
          // Card-sized when minimised: fills its grid cell, and is at least as tall as a card's image
          height: minimised ? '100%' : '46.5vh',
          minHeight: minimised ? 'calc(25.5vh + 8px)' : undefined,
        }}
      />
      {traffic && layers.traffic && !minimised && <CongestionLegend />}
      {hovered && !minimised && mapRef.current && <SitePopup map={mapRef.current} {...hovered} />}
      {hoveredEvent && !minimised && mapRef.current && (
        <EventPopup map={mapRef.current} event={hoveredEvent} lngLat={[hoveredEvent.lon, hoveredEvent.lat]} />
      )}
    </Paper>
  );
}
