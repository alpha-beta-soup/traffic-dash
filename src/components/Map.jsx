import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

import CameraPreview, { PREVIEW_WIDTH } from './CameraPreview';
import LayersMenu from './LayersMenu';
import useLatest from '../hooks/useLatest';
import { BLACK, TRAFFIC_REFRESH, congestionEnum, trafficEnum } from '../consts';
import { MATCHABLE_CLASS } from '../consts/trafficEnum';
import {
  SITE_ICONS, cameraCongestion, drawSignPage, filterCamerasByBbox, groupCameraSites, signPages, signSize, signThumbnail,
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
const FONT = ['Noto Sans Bold'];
// Required by the NZTA terms of use: https://www.journeys.nzta.govt.nz/about-this-site/terms-of-use
const NZTA_ATTRIBUTION = 'Cameras &amp; signs: <a href="https://www.journeys.nzta.govt.nz/" target="_blank" rel="noopener">Waka Kotahi NZ Transport Agency</a>';
const MAPBOX_ATTRIBUTION = 'Traffic: <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a>';
const EMPTY = { type: 'FeatureCollection', features: [] };
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

// A new URL each refresh, so the browser can't answer from its own cache (the server
// shares tiles between viewers regardless of the query string)
const trafficTiles = () => [`${window.location.origin}/api/traffic-tiles/{z}/{x}/{y}.pbf?t=${Date.now()}`];

// Only roads above street level are drawn, each from its trafficEnum minzoom: minor roads just
// add clutter until zoomed in
const drawnClasses = Object.keys(trafficEnum).filter(c => trafficEnum[c].value <= MATCHABLE_CLASS);
const zoomSteps = [...new Set(drawnClasses.map(c => trafficEnum[c].minzoom))].filter(z => z > 0).sort((a, b) => a - b);
const visibleClasses = zoom => drawnClasses.filter(c => trafficEnum[c].minzoom <= zoom);
const TRAFFIC_FILTER = ['in', ['get', 'class'], ['literal', drawnClasses]];
// Fully opaque: translucent lines darken where the short traffic segments overlap
const opacityAt = zoom => ['match', ['get', 'class'], visibleClasses(zoom), 1, 0];
const trafficOpacity = ['step', ['zoom'], opacityAt(0), ...zoomSteps.flatMap(z => [z, opacityAt(z)])];

// Congestion styling from congestionEnum: colour and width per level
const byCongestion = (key, fallback) => ['match', ['get', 'congestion'],
  ...Object.entries(congestionEnum).flatMap(([level, style]) => [level, style[key]]),
  fallback];
const BASE_WIDTH = { 8: 1.5, 12: 2.5, 16: 5 }; // px at each zoom, for a width multiple of 1
// Each direction sits to the left of its travel direction (NZ drives on the left), clear of the other
const scaledByZoom = (scale, add) => ['interpolate', ['linear'], ['zoom'],
  ...Object.entries(BASE_WIDTH).flatMap(([zoom, base]) => [Number(zoom), ['+', ['*', base * scale, byCongestion('width', 1)], add]])];
const trafficWidth = scaledByZoom(1, 0);
const trafficOffset = scaledByZoom(-0.5, -0.5);

// Message signs show as small icons, and as LED dot-matrix images (utils/ledSign), one per
// page, when hovered. Signs with several pages alternate between them, all in step, like the
// real signs.
const SIGN_PAGE_TIME = 3000; // ms
const SIGN_LAYERS = ['signs', 'sign-expanded', 'sign-full'];
const SIGN_FULL_ZOOM = 14; // Signs show in full from here; below it, as icons that expand on hover
const signImageId = (pages, size, page) => `sign:${size.columns}x${size.rows}:${pages[page].map(({ left, right }) => `${left}>${right}`).join('|')}`;
const signIcon = tick => ['get', ['concat', 'page', ['to-string', ['%', tick, ['get', 'pages']]]]];

const DIMMED_LABEL = '#8a96a3';
const QUADRANT_FILL = { w: BLACK, o: '#b8c2cc', '-': 'white' };

// A circle split into N/E/S/W quarters, each filled if the site has a camera facing that way.
// pattern: one character per quarter, as made by groupCameraSites
const siteIcon = (pattern) => {
  const size = 48;
  const c = size / 2;
  const r = 19;
  const ctx = Object.assign(document.createElement('canvas'), { width: size, height: size }).getContext('2d');
  ctx.beginPath();
  ctx.arc(c, c, r + 3, 0, 2 * Math.PI);
  ctx.fillStyle = 'white'; // Halo, so the icon reads on any base map
  ctx.fill();
  [...pattern].forEach((state, i) => {
    const middle = (i - 1) * (Math.PI / 2); // Canvas angles start east; quarter 0 is north
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, middle - Math.PI / 4, middle + Math.PI / 4);
    ctx.closePath();
    ctx.fillStyle = QUADRANT_FILL[state];
    ctx.fill();
  });
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  [Math.PI / 4, (3 * Math.PI) / 4].forEach((a) => {
    ctx.moveTo(c + r * Math.cos(a), c + r * Math.sin(a));
    ctx.lineTo(c - r * Math.cos(a), c - r * Math.sin(a));
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, 2 * Math.PI);
  ctx.strokeStyle = BLACK;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
};

const addLayers = (map, traffic) => {
  SITE_ICONS.forEach(icon => map.addImage(icon, siteIcon(icon.replace('site-', '')), { pixelRatio: 2 }));
  map.addSource('cameras', { type: 'geojson', data: EMPTY });
  map.addSource('signs', { type: 'geojson', data: EMPTY });
  map.addSource('matched', { type: 'geojson', data: EMPTY });
  if (traffic) {
    map.addSource('traffic', {
      type: 'vector',
      tiles: trafficTiles(),
      minzoom: 6,
      maxzoom: 16,
      attribution: MAPBOX_ATTRIBUTION,
    });
    map.addLayer({
      id: 'traffic',
      type: 'line',
      source: 'traffic',
      'source-layer': 'traffic',
      filter: TRAFFIC_FILTER,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': byCongestion('color', 'transparent'),
        'line-width': trafficWidth,
        'line-offset': trafficOffset,
        'line-opacity': trafficOpacity,
      },
    });
  }
  map.addLayer({
    id: 'matched',
    type: 'line',
    source: 'matched',
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': '#e040fb',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
      'line-offset': ['interpolate', ['linear'], ['zoom'], 10, -2, 16, -5],
      'line-opacity': 0.6,
    },
  }, traffic ? 'traffic' : undefined); // Under the traffic line, as a glow around it
  map.addLayer({
    id: 'signs',
    type: 'symbol',
    source: 'signs',
    minzoom: 10,
    // Small, so always shown, even overlapping other labels. At SIGN_FULL_ZOOM and beyond, full
    // signs cover their icons; an icon still shows where its full sign is crowded out.
    layout: { 'icon-image': 'sign-icon', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  });
  map.addLayer({
    id: 'cameras',
    type: 'symbol',
    source: 'cameras',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotation-alignment': 'map', // Keep the north quarter pointing north
      'icon-pitch-alignment': 'viewport', // Stand upright when the map is tilted, rather than lying flat
      'text-field': ['get', 'name'],
      'text-font': FONT,
      'text-offset': [0, 1],
      'text-anchor': 'top',
      'text-size': 11,
      'text-optional': true,
    },
    paint: {
      'icon-opacity': ['case', ['get', 'dim'], 0.3, 1],
      // Dark on a white halo: reads cleanly on a light base map, and matches the cards.
      // Sites the congestion filter leaves out get grey text rather than transparency,
      // which would fade the halo too and blur the label into the map.
      'text-color': ['case', ['get', 'dim'], DIMMED_LABEL, BLACK],
      'text-halo-color': 'white',
      'text-halo-width': 1.6,
    },
  });
  // The hovered sign, full size, just above its icon and on top of everything
  map.addImage('sign-icon', signThumbnail(), { pixelRatio: 2 });
  map.addLayer({
    id: 'sign-expanded',
    type: 'symbol',
    source: 'signs',
    filter: ['==', ['get', 'id'], -1],
    layout: {
      'icon-image': signIcon(0),
      'icon-anchor': 'bottom',
      'icon-offset': [0, -8],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // Zoomed in far enough, every sign shows in full. They avoid overlapping each other
  // (e.g. two signs on one gantry): one shows until zoomed in further.
  map.addLayer({
    id: 'sign-full',
    type: 'symbol',
    source: 'signs',
    minzoom: SIGN_FULL_ZOOM,
    layout: {
      'icon-image': signIcon(0),
      // Lower keys are placed first, so in a collision an incident or warning message wins over
      // routine travel times (whose icon still shows)
      'symbol-sort-key': ['case', ['get', 'travelTimes'], 1, 0],
    },
  });
};

const DIRECTION_ORDER = ['Northbound', 'Eastbound', 'Southbound', 'Westbound'];
const POPUP_GAP = 6; // px between previews, and around them
const POPUP_OFFSET = 18; // px between the site icon and the popup

// The hovered site's cameras, looping. Above the site, or below it if there's no room; kept
// inside the map horizontally. pointer-events: none, so it never steals the hover from the map.
function SitePopup({ map, cameras, lngLat }) {
  const columns = Math.min(cameras.length, 2);
  const rows = Math.ceil(cameras.length / columns);
  const width = columns * PREVIEW_WIDTH + (columns + 1) * POPUP_GAP;
  const height = rows * (PREVIEW_WIDTH * 0.75 + 34) + (rows + 1) * POPUP_GAP; // Image plus a caption of up to 2 lines
  const point = map.project(lngLat);
  const container = map.getContainer();
  const left = Math.min(Math.max(point.x - width / 2, POPUP_GAP), container.clientWidth - width - POPUP_GAP);
  const above = point.y - POPUP_OFFSET - height >= POPUP_GAP;
  const top = above ? point.y - POPUP_OFFSET - height : point.y + POPUP_OFFSET;
  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute', left, top, zIndex: 3, p: `${POPUP_GAP}px`, pointerEvents: 'none',
        display: 'grid', gridTemplateColumns: `repeat(${columns}, ${PREVIEW_WIDTH}px)`, gap: `${POPUP_GAP}px`,
      }}
    >
      {cameras.map(camera => <CameraPreview key={camera.id} camera={camera} />)}
    </Paper>
  );
}

// Names each congestion level, drawn as it appears on the map (at the zoom-12 base width)
function CongestionLegend() {
  const levels = Object.values(congestionEnum).sort((a, b) => b.value - a.value); // Low first
  return (
    <Box
      component="ul"
      aria-label="Congestion key"
      sx={{
        position: 'absolute', left: 10, bottom: 26, zIndex: 1, m: 0, px: 1, py: 0.5,
        listStyle: 'none', bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1, boxShadow: 1,
        fontSize: '0.75rem', color: BLACK,
      }}
    >
      {levels.map(({ description, color, width }) => {
        const strokeWidth = BASE_WIDTH[12] * width;
        return (
          <Box component="li" key={description} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <svg width="36" height="12" aria-hidden="true">
              <line
                x1={strokeWidth / 2 + 1}
                x2={36 - strokeWidth / 2 - 1}
                y1="6"
                y2="6"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </svg>
            {description}
          </Box>
        );
      })}
    </Box>
  );
}

export default function Map({
  styleUrl, traffic, cameras, signs, centre, congestion, isShown, minimised,
  layers, onBoundsChange, onSiteClick, onCongestion, onToggleMinimised, onLayersChange,
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const onBoundsChangeRef = useLatest(onBoundsChange);
  const onSiteClickRef = useLatest(onSiteClick);
  const onCongestionRef = useLatest(onCongestion);
  const camerasRef = useLatest(cameras);
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
  const [, setMoved] = useState(0);

  // Keep the hover popup on its site if the map moves underneath it (e.g. scroll-zooming)
  useEffect(() => {
    const map = mapRef.current;
    if (!hovered || !map) return undefined;
    const onMove = () => setMoved(n => n + 1);
    map.on('move', onMove);
    return () => map.off('move', onMove);
  }, [hovered]);

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

    // Traffic changes every few minutes: refetch the tiles (the server shares them between viewers)
    const refresh = setInterval(() => map.getSource('traffic')?.setTiles(trafficTiles()), TRAFFIC_REFRESH);

    return () => {
      clearInterval(refresh);
      setLoaded(false);
      mapRef.current = null;
      map.remove();
    };
  }, [styleUrl, traffic, onBoundsChangeRef, onSiteClickRef, onCongestionRef, camerasRef, congestionRef, minimisedRef]);

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
    if (map.getLayer('traffic')) map.setPaintProperty('traffic', 'line-opacity', layers.traffic ? trafficOpacity : 0);
  }, [loaded, layers]);

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
    </Paper>
  );
}
