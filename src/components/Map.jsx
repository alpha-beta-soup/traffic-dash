import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Snackbar from '@mui/material/Snackbar';

import CityButtons from './CityButtons';
import CongestionLegend from './CongestionLegend';
import CountPopup from './CountPopup';
import CountsLegend from './CountsLegend';
import EventPopup from './EventPopup';
import LayersMenu from './LayersMenu';
import MapPopup from './MapPopup';
import SitePopup, { DIRECTION_ORDER } from './SitePopup';
import WarningDetails from './WarningDetails';
import useLatest from '../hooks/useLatest';
import {
  COUNT_DOTS, COUNT_LAYERS, EMPTY, EVENT_LAYERS, RAIN_LAYER, RAIN_REFRESH, SIGN_LAYERS, TRAFFIC_LAYERS, WARNING_LAYERS, WIND_LAYERS, WIND_REFRESH,
  addLayers, countFilters, greyWater, rainTiles, refreshWind, trafficOpacity, trafficTiles,
} from '../map/layers';
import {
  addSignHover, hideExpandedSign, setSigns, startSignPaging,
} from '../map/signs';
import maplibregl, { mapControls, mapControlsDark } from '../map/maplibre';
import { TOUCH as TOUCH_QUERY, TRAFFIC_REFRESH } from '../consts';
import {
  SAME_SPOT, cameraCongestion, countFeatures, filterCamerasByBbox, groupCameraSites, snapEvents, warningColour, warningFeatures, warningsAt,
} from '../utils';
import { lines } from '../utils/geometry';

const DEFAULT_LOCATION = [174.787, -41.272]; // Wellington
const DEFAULT_ZOOM = 11;
// Shorter on a phone, so a camera card fits under it
export const MAP_HEIGHT = { xs: '40svh', sm: '46.5vh' };
const TOUCH = window.matchMedia?.(TOUCH_QUERY).matches;
// Required by the NZTA terms of use: https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use
const NZTA_ATTRIBUTION = 'Cameras &amp; signs: <a href="https://www.journeys.nzta.govt.nz/" target="_blank" rel="noopener">Waka Kotahi NZ Transport Agency</a>';
// Every way of moving the map; all off while it's minimised
const INTERACTIONS = ['boxZoom', 'doubleClickZoom', 'dragPan', 'dragRotate', 'keyboard', 'scrollZoom', 'touchPitch', 'touchZoomRotate'];
// Credits are left off the minimised map. Note: OpenStreetMap, OpenMapTiles and Mapbox ask for
// attribution wherever their data is shown; add a page-level credit if this is ever hosted.
const MAP_FILL = { position: 'absolute', inset: 0 };

const toGeojson = items => ({
  type: 'FeatureCollection',
  features: items.map(({ lat, lon, ...properties }) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties,
  })),
});

export default function Map({
  styleUrl, dark, traffic, weather, cameras, signs, events, warnings, trafficCounts, centre, congestion, isShown, minimised,
  layers, initialView, onBoundsChange, onSiteClick, onCongestion, onToggleMinimised, onLayersChange, onViewChange,
  countVehicles: vehicles, onCountVehicles, hiddenLevels, onHiddenLevels, selectedCamera, onSiteTap,
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const onBoundsChangeRef = useLatest(onBoundsChange);
  const onViewChangeRef = useLatest(onViewChange);
  const initialViewRef = useLatest(initialView);
  const onSiteClickRef = useLatest(onSiteClick);
  const onSiteTapRef = useLatest(onSiteTap);
  const onCongestionRef = useLatest(onCongestion);
  const camerasRef = useLatest(cameras);
  const eventsRef = useLatest(events);
  const warningsRef = useLatest(warnings);
  const congestionRef = useLatest(congestion);
  const minimisedRef = useLatest(minimised);
  const expandedView = useRef(null); // The last settled full-size view
  // Set from minimising until the full-size view is back; the map's own resize events
  // in between mustn't count as the user's view
  const restoreView = useRef(null);
  const reportBoundsRef = useRef(null);
  const snapEventsRef = useRef(() => {}); // Re-matches road events to roads (set up with the map)
  const [hovered, setHovered] = useState(null); // { cameras, lngLat }: the site under the pointer
  const hoverKey = useRef(null);
  const [hoveredEvent, setHoveredEvent] = useState(null); // The road event under the pointer
  const [clickedWarnings, setClickedWarnings] = useState(null); // { warnings, lngLat }: the weather warnings clicked on
  const [hoveredCounts, setHoveredCounts] = useState(null); // { refs, lngLat }: the counting sites under the pointer
  const [, setMoved] = useState(0);

  // Keep a hover popup on its icon if the map moves underneath it (e.g. scroll-zooming)
  useEffect(() => {
    const map = mapRef.current;
    if ((!hovered && !hoveredEvent && !clickedWarnings && !hoveredCounts) || !map) return undefined;
    const onMove = () => setMoved(n => n + 1);
    map.on('move', onMove);
    return () => map.off('move', onMove);
  }, [hovered, hoveredEvent, clickedWarnings, hoveredCounts]);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      transformStyle: (previous, style) => greyWater(style, dark),
      // Rebuilt for a new style (e.g. the dark theme): keep the view. Otherwise start where it
      // last was (e.g. back from a camera page), if anywhere.
      ...(expandedView.current
        ? (({ center, zoom, bearing, pitch }) => ({ center, zoom, bearing, pitch }))(expandedView.current)
        : initialViewRef.current ?? { center: DEFAULT_LOCATION, zoom: DEFAULT_ZOOM }),
      // Folding to an ⓘ button on narrow maps (e.g. phones) once the map's moved; hidden while minimised
      attributionControl: { customAttribution: NZTA_ATTRIBUTION },
    });
    mapRef.current = map;
    // On a touchscreen, pinching zooms, so only the compass: shown once the map's turned or
    // tilted, to put it back
    map.addControl(new maplibregl.NavigationControl({ showZoom: !TOUCH, visualizePitch: true }), 'top-right');
    if (TOUCH) {
      const showCompass = () => map.getContainer().classList
        .toggle('turned', Math.round(map.getBearing()) !== 0 || Math.round(map.getPitch()) !== 0);
      map.on('rotate', showCompass);
      map.on('pitch', showCompass);
      showCompass();
    }
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    // While minimised the grid keeps the cameras from the full-size view, which is remembered
    // here each time it settles (by the time minimising runs, the map may already have shrunk)
    const reportBounds = () => {
      if (minimisedRef.current || restoreView.current) return;
      expandedView.current = {
        center: map.getCenter(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), bounds: map.getBounds(),
      };
      onBoundsChangeRef.current(expandedView.current.bounds);
      const { center, zoom, bearing, pitch } = expandedView.current;
      onViewChangeRef.current?.({ center: [center.lng, center.lat], zoom, bearing, pitch });
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
    // Likewise, draw the road events in view on the roads they run along (utils/snapEvents)
    let snapNeeded = true;
    const snapEventRoads = () => {
      if (!snapNeeded || !map.getSource('event-roads')) return;
      snapNeeded = false;
      const bounds = map.getBounds();
      const inView = eventsRef.current.filter(event => event.geometry.type !== 'Point'
        && lines(event.geometry).some(line => line.some(point => bounds.contains(point))));
      const roads = traffic && map.getSource('traffic') ? map.querySourceFeatures('traffic', { sourceLayer: 'traffic' }) : [];
      const { snapped, fallback } = snapEvents(inView, roads);
      map.getSource('event-roads').setData({ type: 'FeatureCollection', features: snapped });
      map.getSource('event-fallback').setData({ type: 'FeatureCollection', features: fallback });
    };
    snapEventsRef.current = () => { snapNeeded = true; if (map.loaded()) snapEventRoads(); };
    map.on('load', () => {
      addLayers(map, traffic, dark, weather);
      setLoaded(true);
      reportBounds();
    });
    map.on('moveend', () => { matchNeeded = true; snapNeeded = true; reportBounds(); });
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'traffic' && e.tile) {
        matchNeeded = true;
        snapNeeded = true;
      }
    });
    map.on('idle', () => {
      matchCongestion();
      snapEventRoads();
    });

    // Hovering a site shows its cameras' recent footage, and which traffic segments its
    // congestion came from. mousemove rather than mouseenter, to catch moving straight
    // from one site to a neighbouring one. A device that can't hover (a phone, a tablet) taps
    // instead: a tap shows what a hover would, a second tap on a site does what a click does, and a
    // tap elsewhere on the map closes it. On a phone (`onSiteTap`), a first tap goes to the site's
    // cameras in the row under the map instead, which the map then marks (selectedCamera).
    let shownAt = 0; // When a site was last shown: a tap's own (emulated) mousemove shows it just before its click
    const siteIds = e => String(e.features[0].properties.cameraIds).split(',').map(Number);
    // A counting site's dot, drawn over the camera icon it's often beside, takes the pointer
    const onCountDot = e => map.getLayoutProperty('counts', 'visibility') === 'visible'
      && map.queryRenderedFeatures(e.point, { layers: COUNT_DOTS }).length > 0;
    const leaveSite = () => {
      hoverKey.current = null;
      map.getCanvas().style.cursor = '';
      map.getSource('matched').setData(EMPTY);
      setHovered(null);
    };
    const showSite = (e) => {
      if (onCountDot(e)) {
        if (hoverKey.current) leaveSite();
        return;
      }
      const key = e.features[0].properties.cameraIds;
      if (minimisedRef.current || hoverKey.current === key) return;
      hoverKey.current = key;
      shownAt = Date.now();
      map.getCanvas().style.cursor = 'pointer';
      const ids = siteIds(e);
      if (onSiteTapRef.current) {
        onSiteTapRef.current(ids);
        return;
      }
      const segments = ids.flatMap(id => congestionRef.current.get(id)?.segments ?? []);
      map.getSource('matched').setData({
        type: 'FeatureCollection',
        features: segments.map(coordinates => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
      });
      const siteCameras = camerasRef.current
        .filter(camera => ids.includes(camera.id))
        .sort((a, b) => DIRECTION_ORDER.indexOf(a.direction) - DIRECTION_ORDER.indexOf(b.direction));
      setHovered({ cameras: siteCameras, lngLat: e.features[0].geometry.coordinates });
    };
    map.on('mousemove', 'cameras', showSite);
    map.on('mouseleave', 'cameras', leaveSite);
    map.on('click', 'cameras', (e) => {
      if (minimisedRef.current || onCountDot(e)) return;
      if (TOUCH && (hoverKey.current !== e.features[0].properties.cameraIds || Date.now() - shownAt < 500)) {
        showSite(e); // A first tap: show it
        return;
      }
      onSiteClickRef.current(siteIds(e));
    });

    // Hovering a sign's icon shows the sign itself
    addSignHover(map, () => minimisedRef.current, TOUCH);

    // Hovering a road event's icon shows its details
    map.on(TOUCH ? 'click' : 'mousemove', 'events', (e) => {
      if (minimisedRef.current) return;
      const { id } = e.features[0].properties;
      map.getCanvas().style.cursor = 'pointer';
      setHoveredEvent(current => (current?.id === id ? current : eventsRef.current.find(event => event.id === id) ?? null));
    });
    map.on('mouseleave', 'events', () => {
      map.getCanvas().style.cursor = '';
      setHoveredEvent(null);
    });

    // Hovering a counting place (or site, zoomed in) shows how its traffic compares with recent years
    COUNT_DOTS.forEach((id) => {
      map.on(TOUCH ? 'click' : 'mousemove', id, (e) => {
        if (minimisedRef.current) return;
        // Read now: the event's features are gone by the time React runs the update
        const { properties: { refs }, geometry: { coordinates: lngLat } } = e.features[0];
        map.getCanvas().style.cursor = 'pointer';
        setHoveredCounts(current => (current?.refs === refs ? current : { refs, lngLat }));
      });
      map.on('mouseleave', id, () => {
        map.getCanvas().style.cursor = '';
        setHoveredCounts(null);
      });
    });

    // Every popup closed: on Escape, or a tap off them on a device that can't hover
    const closeAll = () => {
      leaveSite();
      hideExpandedSign(map);
      setHoveredEvent(null);
      setHoveredCounts(null);
      setClickedWarnings(null);
    };
    const onKey = e => e.key === 'Escape' && closeAll();
    map.getContainer().addEventListener('keydown', onKey);

    // Clicking inside weather warning areas (other than on an icon) shows those warnings; clicking
    // anywhere else closes them. A click rather than a hover: the areas are large.
    map.on('click', (e) => {
      if (minimisedRef.current) return;
      const icons = ['cameras', 'events', 'signs', ...COUNT_DOTS].filter(id => map.getLayer(id));
      const onIcon = map.queryRenderedFeatures(e.point, { layers: icons });
      // A tap off whatever's showing closes it (what's tapped shows instead)
      if (TOUCH) {
        const tapped = new Set(onIcon.map(f => f.layer.id));
        if (!tapped.has('cameras')) leaveSite();
        if (!tapped.has('signs')) hideExpandedSign(map);
        if (!tapped.has('events')) setHoveredEvent(null);
        if (!COUNT_DOTS.some(dots => tapped.has(dots))) setHoveredCounts(null);
      }
      if (onIcon.length) return;
      const lngLat = [e.lngLat.lng, e.lngLat.lat];
      const found = map.getLayer('warning-areas') && map.queryRenderedFeatures(e.point, { layers: ['warning-areas'] }).length
        ? warningsAt({ lon: lngLat[0], lat: lngLat[1] }, warningsRef.current)
        : [];
      setClickedWarnings(found.length ? { warnings: found, lngLat } : null);
    });

    // Traffic changes every few minutes: refetch the tiles (the server shares them between viewers)
    const refresh = setInterval(() => map.getSource('traffic')?.setTiles(trafficTiles()), TRAFFIC_REFRESH);
    const refreshRain = setInterval(() => map.getSource(RAIN_LAYER)?.setTiles(rainTiles()), RAIN_REFRESH);
    const refreshWindHourly = setInterval(() => refreshWind(map), WIND_REFRESH);

    return () => {
      map.getContainer().removeEventListener('keydown', onKey); // The element outlives the map
      clearInterval(refresh);
      clearInterval(refreshRain);
      clearInterval(refreshWindHourly);
      setLoaded(false);
      mapRef.current = null;
      map.remove();
    };
  }, [
    styleUrl, dark, traffic, weather, onBoundsChangeRef, onViewChangeRef, onSiteClickRef, onCongestionRef,
    onSiteTapRef, camerasRef, eventsRef, warningsRef, congestionRef, minimisedRef, initialViewRef,
  ]);

  // Minimised: show the same area in the smaller box, and stop all interaction.
  // Runs after React has resized the container, so the map can measure its new size.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    INTERACTIONS.forEach(handler => map[handler][minimised ? 'disable' : 'enable']());
    if (minimised) {
      const view = expandedView.current;
      restoreView.current = view;
      hoverKey.current = null;
      setHovered(null);
      setHoveredEvent(null);
      setClickedWarnings(null);
      setHoveredCounts(null);
      map.getSource('matched')?.setData(EMPTY);
      hideExpandedSign(map);
      map.getCanvas().style.cursor = '';
      if (view) map.fitBounds(view.bounds, { animate: false, bearing: view.bearing, pitch: view.pitch });
    } else if (restoreView.current) {
      const { center, zoom, bearing, pitch } = restoreView.current;
      map.jumpTo({ center, zoom, bearing, pitch });
      restoreView.current = null;
      reportBoundsRef.current(); // The grid follows the map again
    } else if (reportBoundsRef.current) {
      reportBoundsRef.current(); // Expanded a map that started minimised (e.g. back from a camera page)
    }
  }, [minimised]);

  // The camera a phone's showing, with the traffic its congestion was judged by
  useEffect(() => {
    if (!loaded) return;
    const segments = selectedCamera ? congestion.get(selectedCamera.id)?.segments ?? [] : [];
    mapRef.current.getSource('selected')?.setData({
      type: 'FeatureCollection',
      features: segments.map(coordinates => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
    });
  }, [loaded, selectedCamera, congestion]);
  // …marked with a pulse (whether or not the cameras are shown) in its congestion's colour, as its
  // card's border is: an element over the map, animated by CSS, so the map needn't redraw for it
  const selectedAt = selectedCamera && [selectedCamera.lon, selectedCamera.lat].join();
  const pulse = useRef(null);
  useEffect(() => {
    if (!loaded || !selectedAt) return undefined;
    pulse.current = document.createElement('div');
    pulse.current.className = 'camera-pulse';
    const marker = new maplibregl.Marker({ element: pulse.current }).setLngLat(selectedAt.split(',').map(Number)).addTo(mapRef.current);
    return () => marker.remove();
  }, [loaded, selectedAt]);
  const pulseColour = selectedCamera ? congestion.get(selectedCamera.id)?.color ?? '' : '';
  useEffect(() => {
    if (pulse.current) pulse.current.style.color = pulseColour; // Unknown: the theme's
  }, [pulseColour, selectedAt, loaded]);

  // Optional layers. The congestion lines are hidden by making them transparent, not with
  // 'visibility': that clears the source's tiles until the map next moves, and the card
  // borders and the congestion filter need that data.
  useEffect(() => {
    const map = mapRef.current;
    if (!loaded) return;
    map.setLayoutProperty('cameras', 'visibility', layers.cameras ? 'visible' : 'none');
    map.setLayoutProperty('cameras', 'text-field', layers.labels ? ['get', 'name'] : '');
    if (!layers.cameras && hoverKey.current) { // Hidden under the pointer: let go of the site
      hoverKey.current = null;
      map.getCanvas().style.cursor = '';
      map.getSource('matched').setData(EMPTY);
      setHovered(null);
    }
    SIGN_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.signs ? 'visible' : 'none'));
    EVENT_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.events ? 'visible' : 'none'));
    WARNING_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.warnings ? 'visible' : 'none'));
    if (map.getLayer(RAIN_LAYER)) map.setLayoutProperty(RAIN_LAYER, 'visibility', layers.rain ? 'visible' : 'none');
    WIND_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.wind ? 'visible' : 'none'));
    COUNT_LAYERS.forEach(id => map.setLayoutProperty(id, 'visibility', layers.counts ? 'visible' : 'none'));
    if (!layers.counts) setHoveredCounts(null);
    if (!layers.warnings) setClickedWarnings(null);
    TRAFFIC_LAYERS.forEach(id => map.getLayer(id) && map.setPaintProperty(id, 'line-opacity', layers.traffic ? trafficOpacity : 0));
  }, [loaded, layers]);

  // Road events: a point each for the icon, and their stretches of road matched to the roads
  useEffect(() => {
    if (!loaded) return;
    mapRef.current.getSource('event-icons').setData(toGeojson(events.map(({ id, impact, lat, lon }) => ({ id, impact, lat, lon }))));
    snapEventsRef.current();
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
    if (loaded) mapRef.current.getSource('weather-warnings').setData(warningFeatures(warnings));
  }, [loaded, warnings]);

  // A link to the map as it is: the page's address, which says so (utils/mapLink)
  const [notice, setNotice] = useState(null);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Link to this map copied to the clipboard');
    } catch {
      setNotice(`Couldn't copy to the clipboard: ${window.location.href}`);
    }
  };

  // The counts compare all vehicles, or heavy or light ones (chosen in their key)
  useEffect(() => {
    const map = mapRef.current;
    // A new theme rebuilds the map (for its style), and this runs once more with the old map's
    // `loaded`, against the new map before it has its layers: it runs again once that has loaded
    if (!loaded || !map.getSource('traffic-counts')) return;
    map.getSource('traffic-counts').setData(countFeatures(trafficCounts, dark, { vehicles }));
    map.getSource('traffic-count-sites').setData(countFeatures(trafficCounts, dark, { radius: SAME_SPOT, vehicles }));
  }, [loaded, trafficCounts, dark, vehicles]);

  // The levels of change hidden from the counts (clicked off in their key)
  useEffect(() => {
    if (!loaded) return;
    Object.entries(countFilters(hiddenLevels)).forEach(([id, filter]) => mapRef.current.setFilter(id, filter));
    setHoveredCounts(null);
  }, [loaded, hiddenLevels]);
  const toggleLevel = level => onHiddenLevels(hidden => (hidden.includes(level) ? hidden.filter(l => l !== level) : [...hidden, level]));

  useEffect(() => {
    if (loaded) setSigns(mapRef.current, signs);
  }, [loaded, signs]);

  useEffect(() => (loaded ? startSignPaging(mapRef.current) : undefined), [loaded]);

  useEffect(() => {
    if (centre) mapRef.current?.flyTo({ center: centre.lngLat, zoom: centre.zoom, curve: 6 ** 0.25 });
  }, [centre]);

  return (
    <Paper
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: minimised ? '100%' : 'auto',
        // The zoom controls go too: nothing on a minimised map responds. So does the attribution,
        // which would cover it; hidden rather than removed, as it would come back above the scale.
        '& .maplibregl-ctrl-top-right, & .maplibregl-ctrl-attrib': minimised ? { display: 'none' } : {},
        // The compass alone, below the buttons, while the map's turned
        ...(TOUCH && {
          '& .maplibregl-ctrl-top-right': { top: 40 },
          '& .maplibregl-map:not(.turned) .maplibregl-ctrl-top-right': { display: 'none' },
        }),
        ...mapControls,
        ...(dark && mapControlsDark),
        '& .camera-pulse': {
          width: 26,
          height: 26,
          pointerEvents: 'none',
          color: 'primary.main',
          '&::before, &::after': {
            content: '""', position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid currentColor',
          },
          '&::after': { animation: 'camera-pulse 1.8s ease-out infinite' },
          '@media (prefers-reduced-motion: reduce)': { '&::after': { animation: 'none', opacity: 0 } },
        },
        '@keyframes camera-pulse': {
          from: { transform: 'scale(1)', opacity: 0.8 },
          to: { transform: 'scale(2.4)', opacity: 0 },
        },
      }}
    >
      {!minimised && (
        <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}>
          <CityButtons onGo={lngLat => mapRef.current?.flyTo({ center: lngLat, zoom: DEFAULT_ZOOM, curve: 6 ** 0.25 })} />
        </Box>
      )}
      <Box sx={{ position: 'absolute', zIndex: 2, top: 10, right: minimised || TOUCH ? 10 : 50, display: 'flex', gap: 0.5 }}>
        {!minimised && <Button variant="contained" size="small" onClick={share} sx={{ opacity: 0.85 }}>Share</Button>}
        {!minimised && <LayersMenu layers={layers} onChange={onLayersChange} traffic={traffic} weather={weather} />}
        {onToggleMinimised && ( // Not on a phone
          <Button variant="contained" size="small" onClick={onToggleMinimised} sx={{ opacity: 0.85 }}>
            {minimised ? 'Expand' : 'Minimise'}
          </Button>
        )}
      </Box>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          // Card-sized when minimised: fills its grid cell, and is at least as tall as a card's image
          height: minimised ? '100%' : MAP_HEIGHT,
          minHeight: minimised ? 'calc(25.5vh + 8px)' : undefined,
        }}
      >
        {/* The map's own element, whose classes React never sets: MapLibre adds its own
            (maplibregl-map, for its controls' styles), which re-rendering a Box's changed sx would
            wipe out */}
        <div ref={container} style={MAP_FILL} />
      </Box>
      {!minimised && (
        <Box sx={{
          position: 'absolute', left: 10, bottom: 26, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
          // Clear of the buttons along the top; scrolling, on a short map (a phone's), if the keys are open
          maxHeight: 'calc(100% - 76px)', overflowY: 'auto', p: '2px', m: '-2px',
        }}
        >
          {layers.counts && trafficCounts.length > 0 && (
            <CountsLegend
              sites={trafficCounts}
              hidden={hiddenLevels}
              onToggle={toggleLevel}
              vehicles={vehicles}
              onVehicles={onCountVehicles}
            />
          )}
          {traffic && layers.traffic && <CongestionLegend />}
        </Box>
      )}
      {hovered && !minimised && mapRef.current && <SitePopup map={mapRef.current} {...hovered} />}
      {clickedWarnings && !minimised && mapRef.current && (
        <MapPopup
          map={mapRef.current}
          lngLat={clickedWarnings.lngLat}
          // Clickable, for its links
          sx={{ p: 1.5, width: 320, pointerEvents: 'auto', borderTop: `4px solid ${warningColour(clickedWarnings.warnings[0])}` }}
          onClose={() => setClickedWarnings(null)}
        >
          {clickedWarnings.warnings.map((warning, i) => (
            <Box key={warning.id} sx={{ mt: i ? 2 : 0 }}><WarningDetails warning={warning} /></Box>
          ))}
        </MapPopup>
      )}
      {hoveredCounts && !minimised && mapRef.current && (
        <CountPopup
          map={mapRef.current}
          lngLat={hoveredCounts.lngLat}
          sites={hoveredCounts.refs.split(',').map(ref => trafficCounts.find(site => site.ref === ref)).filter(Boolean)}
          vehicles={vehicles}
          onClose={() => setHoveredCounts(null)}
        />
      )}
      {hoveredEvent && !minimised && mapRef.current && (
        <EventPopup map={mapRef.current} event={hoveredEvent} lngLat={[hoveredEvent.lon, hoveredEvent.lat]} onClose={() => setHoveredEvent(null)} />
      )}
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Paper>
  );
}
