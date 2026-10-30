// The map's own sources and layers, and their styling: camera sites, message signs, Mapbox
// traffic lines, and the hover highlight of the segments a site's congestion came from
import { BLACK, congestionEnum, trafficEnum } from '../consts';
import { MATCHABLE_CLASS } from '../consts/trafficEnum';
import { SITE_ICONS, signThumbnail } from '../utils';
import siteIcon from './siteIcon';

export const EMPTY = { type: 'FeatureCollection', features: [] };
const FONT = ['Noto Sans Bold'];
const MAPBOX_ATTRIBUTION = 'Traffic: <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a>';

// A new URL each refresh, so the browser can't answer from its own cache (the server
// shares tiles between viewers regardless of the query string)
export const trafficTiles = () => [`${window.location.origin}/api/traffic-tiles/{z}/{x}/{y}.pbf?t=${Date.now()}`];

// Only roads above street level are drawn, each from its trafficEnum minzoom: minor roads just
// add clutter until zoomed in
const drawnClasses = Object.keys(trafficEnum).filter(c => trafficEnum[c].value <= MATCHABLE_CLASS);
const zoomSteps = [...new Set(drawnClasses.map(c => trafficEnum[c].minzoom))].filter(z => z > 0).sort((a, b) => a - b);
const visibleClasses = zoom => drawnClasses.filter(c => trafficEnum[c].minzoom <= zoom);
const TRAFFIC_FILTER = ['in', ['get', 'class'], ['literal', drawnClasses]];
// Fully opaque: translucent lines darken where the short traffic segments overlap
const opacityAt = zoom => ['match', ['get', 'class'], visibleClasses(zoom), 1, 0];
export const trafficOpacity = ['step', ['zoom'], opacityAt(0), ...zoomSteps.flatMap(z => [z, opacityAt(z)])];

// Congestion styling from congestionEnum: colour and width per level
const byCongestion = (key, fallback) => ['match', ['get', 'congestion'],
  ...Object.entries(congestionEnum).flatMap(([level, style]) => [level, style[key]]),
  fallback];
export const BASE_WIDTH = { 8: 1.5, 12: 2.5, 16: 5 }; // px at each zoom, for a width multiple of 1
// Each direction sits to the left of its travel direction (NZ drives on the left), clear of the other
const scaledByZoom = (scale, add) => ['interpolate', ['linear'], ['zoom'],
  ...Object.entries(BASE_WIDTH).flatMap(([zoom, base]) => [Number(zoom), ['+', ['*', base * scale, byCongestion('width', 1)], add]])];
const trafficWidth = scaledByZoom(1, 0);
const trafficOffset = scaledByZoom(-0.5, -0.5);

// Message signs show as small icons, and as LED dot-matrix images (utils/ledSign), one per
// page, when hovered. Signs with several pages alternate between them, all in step, like the
// real signs.
export const SIGN_PAGE_TIME = 3000; // ms
export const SIGN_LAYERS = ['signs', 'sign-expanded', 'sign-full'];
const SIGN_FULL_ZOOM = 14; // Signs show in full from here; below it, as icons that expand on hover
export const signImageId = (pages, size, page) => `sign:${size.columns}x${size.rows}:${pages[page].map(({ left, right }) => `${left}>${right}`).join('|')}`;
export const signIcon = tick => ['get', ['concat', 'page', ['to-string', ['%', tick, ['get', 'pages']]]]];

const DIMMED_LABEL = '#8a96a3';

export const addLayers = (map, traffic) => {
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
