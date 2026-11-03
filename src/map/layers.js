// The map's own sources and layers, and their styling: camera sites, message signs, Mapbox
// traffic lines, and the hover highlight of the segments a site's congestion came from
import { BLACK, congestionEnum, eventImpacts, trafficEnum } from '../consts';
import { MATCHABLE_CLASS } from '../consts/trafficEnum';
import { SITE_ICONS, signThumbnail } from '../utils';
import eventIcon from './eventIcon';
import siteIcon from './siteIcon';
import { BARB_MAX, BARB_STEP, barbIcons } from './windIcon';

export const EMPTY = { type: 'FeatureCollection', features: [] };
const FONT = ['Noto Sans Bold'];
const MAPBOX_ATTRIBUTION = 'Traffic: <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a>';
const OPENWEATHER_ATTRIBUTION = 'Rain: <a href="https://openweathermap.org/" target="_blank" rel="noopener">© OpenWeather</a>';
// Required by the feed's Creative Commons BY 4.0 licence
// Required by the open data's Creative Commons BY 4.0 licence
const NZTA_COUNTS_ATTRIBUTION = 'Traffic counts: <a href="https://opendata-nzta.opendata.arcgis.com/" target="_blank" rel="noopener">Waka Kotahi NZ Transport Agency</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)';
const METSERVICE_ATTRIBUTION = 'Weather warnings: <a href="https://www.metservice.com/warnings/home" target="_blank" rel="noopener">© MetService</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)';

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

// Camera labels: dark on a white halo on the light map, and the reverse on the dark one.
// Sites the congestion filter leaves out get dimmer text rather than transparency, which would
// fade the halo too and blur the label into the map.
const LABELS = {
  light: { text: BLACK, halo: 'white', dimmed: '#8a96a3' },
  dark: { text: '#e3eaf1', halo: '#0e1317', dimmed: '#6b7785' },
};

export const EVENT_LAYERS = ['event-roads', 'event-areas', 'events'];
const eventIconId = impact => `event-${impact}`;
// Each impact's colour mixed with the base map's background, for opaque bands that read as a tint
const mix = (hex, base, amount) => {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [rgb(hex), rgb(base)];
  return `rgb(${a.map((v, i) => Math.round(v * (1 - amount) + b[i] * amount)).join(', ')})`;
};
const byImpactTint = dark => ['match', ['get', 'impact'],
  ...Object.entries(eventImpacts).flatMap(([impact, { color }]) => [impact, mix(color, dark ? '#0c0c0c' : '#ffffff', 0.5)]),
  dark ? '#333333' : '#cccccc'];
const byImpact = (key, fallback) => ['match', ['get', 'impact'],
  ...Object.entries(eventImpacts).flatMap(([impact, style]) => [impact, style[key]]),
  fallback];

// The base map's labels (road names, shields, places) that should stay readable above what
// this app draws: the first symbol layer after its last road (OpenMapTiles' 'transportation'
// lines), so the roads and bridges themselves stay underneath. Undefined (the top) for a
// style with no such layers.
const firstLabelLayer = (map) => {
  const layers = map.getStyle().layers;
  const lastRoad = layers.findLastIndex(layer => layer.type === 'line' && layer['source-layer'] === 'transportation');
  return layers.slice(lastRoad + 1).find(layer => layer.type === 'symbol')?.id;
};

// The base map's first bridge layer (OpenMapTiles' brunnel = bridge), so what this app draws
// along roads goes under overpasses, as the roads do. Undefined for a style without bridges.
const BRIDGE_FILTERS = ['["==",["get","brunnel"],"bridge"]', '["==","brunnel","bridge"]'];
const firstBridgeLayer = map => map.getStyle().layers.find(layer => layer['source-layer'] === 'transportation'
  && BRIDGE_FILTERS.some(filter => JSON.stringify(layer.filter ?? '').includes(filter)))?.id;

// Modelled rain (OpenWeatherMap, through the server: server/weatherTiles.js), above the warning
// tints and under the roads. A new URL each refresh, as with the traffic tiles.
export const RAIN_LAYER = 'rain';
export const RAIN_REFRESH = 10 * 60_000; // The server shares each tile for as long
export const rainTiles = () => [`${window.location.origin}/api/weather-tiles/rain/{z}/{x}/{y}.png?t=${Date.now()}`];

// Wind from Open-Meteo's files of ECMWF's global model (about 9 km), read in the browser through
// the 'om' protocol (map/maplibre.js). The protocol draws arrows in each tile, interpolated on a
// lattice, but as tile geometry, so they're stretched as the map zooms in. Instead, a wind barb
// of our own (map/windIcon.js) goes on each: the same size on screen at any zoom. Each arrow's
// `value` is the speed in m/s, and `direction` the way the wind blows, in radians clockwise from
// north (not wrapped). Barbs that would crowd each other are left out, the stronger kept. The
// protocol credits Open-Meteo itself.
export const WIND_LAYERS = ['wind'];
export const WIND_REFRESH = 60 * 60_000; // The current hour is looked up when the URL changes
const windUrl = () => 'om://https://openmeteo.s3.amazonaws.com/data_spatial/ecmwf_ifs/latest.json'
  + '?time_step=current_time_1H&variable=wind_u_component_10m'
  + `&arrows=true&hour=${Math.floor(Date.now() / WIND_REFRESH)}`;
// Moves the wind on to the current hour's forecast
export const refreshWind = map => map.getSource('wind')?.setUrl(windUrl());
const STRONG_WIND_MS = 50 / 3.6; // As utils/wind.js: strong from 50 km/h

// MetService weather warnings: a tint over each area, in its colour, under the roads
export const WARNING_LAYERS = ['warning-areas', 'warning-outlines'];
const firstRoadLayer = map => map.getStyle().layers.find(layer => layer['source-layer'] === 'transportation')?.id;

// NZTA's traffic counting sites (utils/trafficCounts): a dot each, coloured by how its latest
// week compares with a year before, and sized by its traffic
export const COUNT_LAYERS = ['counts'];

// The congestion lines: on bridges, above the base map's bridges, and on other roads, under
// them, so an overpass covers the road it crosses
export const TRAFFIC_LAYERS = ['traffic', 'traffic-bridges'];
const ON_BRIDGE = ['==', ['get', 'structure'], 'bridge'];

// The base map's water (OpenMapTiles' water, waterway and water_name layers) in neutral greys:
// blue water matters little here, and would hide the blue of the rain layer and road events
const WATER = {
  light: { fill: '#d5d8dc', line: '#c3c8ce', text: '#6b7178' },
  dark: { fill: '#2f3338', line: '#3b4047', text: '#99a0a8' },
};
const WATER_PAINT = { fill: 'fill-color', line: 'line-color', symbol: 'text-color' };
const greyWater = (map, dark) => {
  const colours = WATER[dark ? 'dark' : 'light'];
  map.getStyle().layers
    .filter(layer => ['water', 'waterway', 'water_name'].includes(layer['source-layer']) && WATER_PAINT[layer.type])
    .forEach(layer => map.setPaintProperty(layer.id, WATER_PAINT[layer.type], colours[layer.type === 'symbol' ? 'text' : layer.type]));
};

// weather: whether the server has weather (an OpenWeatherMap key), for the rain layer
export const addLayers = (map, traffic, dark, weather = false) => {
  greyWater(map, dark);
  const belowLabels = firstLabelLayer(map);
  const belowBridges = firstBridgeLayer(map) ?? belowLabels;
  const belowRoads = firstRoadLayer(map) ?? belowBridges;
  map.addSource('weather-warnings', { type: 'geojson', data: EMPTY, attribution: METSERVICE_ATTRIBUTION });
  map.addLayer({
    id: 'warning-areas',
    type: 'fill',
    source: 'weather-warnings',
    paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': dark ? 0.16 : 0.22 },
  }, belowRoads);
  map.addLayer({
    id: 'warning-outlines',
    type: 'line',
    source: 'weather-warnings',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'colour'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 2.5], 'line-opacity': 0.9 },
  }, belowRoads);
  if (weather) {
    map.addSource(RAIN_LAYER, {
      type: 'raster', tiles: rainTiles(), tileSize: 256, maxzoom: 10, attribution: OPENWEATHER_ATTRIBUTION,
    });
    map.addLayer({
      id: RAIN_LAYER,
      type: 'raster',
      source: RAIN_LAYER,
      layout: { visibility: 'none' }, // Until turned on in the layers menu
      // The tiles are pale washes: more saturated and contrasting, they read on the map, and
      // on the dark one, lifted out of the dark
      paint: {
        'raster-opacity': 0.85, 'raster-saturation': 0.6, 'raster-contrast': 0.3, 'raster-brightness-min': dark ? 0.2 : 0,
      },
    }, belowRoads);
  }
  const labels = LABELS[dark ? 'dark' : 'light'];
  SITE_ICONS.forEach(icon => map.addImage(icon, siteIcon(icon.replace('site-', '')), { pixelRatio: 2 }));
  map.addSource('cameras', { type: 'geojson', data: EMPTY });
  map.addSource('signs', { type: 'geojson', data: EMPTY });
  map.addSource('matched', { type: 'geojson', data: EMPTY });
  map.addSource('event-roads', { type: 'geojson', data: EMPTY }); // Road segments events run along
  map.addSource('event-fallback', { type: 'geojson', data: EMPTY }); // Events with no road to snap to
  map.addSource('event-icons', { type: 'geojson', data: EMPTY }); // One point per event, for its icon
  Object.entries(eventImpacts).forEach(([impact, style]) => map.addImage(eventIconId(impact), eventIcon(style), { pixelRatio: 2 }));
  // Events along a stretch of road (roadworks, closures), under the traffic lines and the base
  // map's bridges (NZTA doesn't say which events are on a bridge): where they've been matched to
  // the real road (utils/snapEvents), a band along it, and otherwise along NZTA's own line,
  // smoothed. Opaque tints rather than translucency: overlapping pieces (each vertex's round
  // join, both directions of a road) would otherwise darken, tracking vertex density.
  const eventTint = byImpactTint(dark);
  map.addLayer({
    id: 'event-roads',
    type: 'line',
    source: 'event-roads',
    minzoom: 8,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': eventTint,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 12, 12, 16, 24],
    },
  }, belowBridges);
  map.addLayer({
    id: 'event-areas',
    type: 'line',
    source: 'event-fallback',
    minzoom: 8,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': eventTint,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 8, 16, 16],
    },
  }, belowBridges);
  if (traffic) {
    map.addSource('traffic', {
      type: 'vector',
      tiles: trafficTiles(),
      minzoom: 6,
      maxzoom: 16,
      attribution: MAPBOX_ATTRIBUTION,
    });
    const trafficLayer = (id, filter, before) => map.addLayer({
      id,
      type: 'line',
      source: 'traffic',
      'source-layer': 'traffic',
      filter: ['all', TRAFFIC_FILTER, filter],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': byCongestion('color', 'transparent'),
        'line-width': trafficWidth,
        'line-offset': trafficOffset,
        'line-opacity': trafficOpacity,
      },
    }, before);
    // Both above the event bands, which were added first
    trafficLayer('traffic', ['!', ON_BRIDGE], belowBridges);
    trafficLayer('traffic-bridges', ON_BRIDGE, belowLabels);
  }
  // Wind barbs, above the roads and under the labels: faint, and in the strong-wind warning
  // colour from 50 km/h
  const speed = ['to-number', ['get', 'value']];
  const knots = ['*', speed, 1.94384];
  const strong = ['>=', speed, STRONG_WIND_MS];
  barbIcons().forEach(([id, image]) => map.addImage(id, image, { pixelRatio: 2, sdf: true }));
  map.addSource('wind', { type: 'vector', url: windUrl() });
  map.addLayer({
    id: 'wind',
    type: 'symbol',
    source: 'wind',
    'source-layer': 'wind-arrows',
    layout: {
      visibility: 'none',
      // The barb for the speed, to the nearest 5 knots
      'icon-image': ['concat', 'barb-', ['to-string',
        ['min', BARB_MAX, ['*', BARB_STEP, ['round', ['/', knots, BARB_STEP]]]]]],
      // Into the wind: the way it blows, turned round
      'icon-rotate': ['+', ['*', ['to-number', ['get', 'direction']], 180 / Math.PI], 180],
      'icon-rotation-alignment': 'map',
      // Room kept clear around each barb. Labels and icons are placed first (they're above), so
      // the barbs give way to them, then to each other.
      'icon-padding': 12,
      'symbol-sort-key': ['-', speed], // Where they crowd, the strongest are kept
    },
    paint: {
      'icon-color': ['case', strong, dark ? '#ffb74d' : '#e65100',
        dark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(20, 24, 28, 0.5)'],
    },
  }, belowLabels);
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
      'text-color': ['case', ['get', 'dim'], labels.dimmed, labels.text],
      'text-halo-color': labels.halo,
      'text-halo-width': 1.6,
    },
  });
  // Counting sites, above the camera sites: they're often at the same spot, and smaller
  map.addSource('traffic-counts', { type: 'geojson', data: EMPTY, attribution: NZTA_COUNTS_ATTRIBUTION });
  const radius = ['get', 'radius'];
  map.addLayer({
    id: 'counts',
    type: 'circle',
    source: 'traffic-counts',
    layout: { visibility: 'none', 'circle-sort-key': ['get', 'order'] },
    paint: {
      'circle-color': ['get', 'colour'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['*', radius, 0.5], 10, radius, 14, ['*', radius, 1.5]],
      'circle-stroke-color': dark ? '#0e1317' : 'white',
      'circle-stroke-width': 1.5,
    },
  });

  // Road events, above the camera sites so an incident is never hidden; closures on top
  map.addLayer({
    id: 'events',
    type: 'symbol',
    source: 'event-icons',
    layout: {
      'icon-image': ['concat', 'event-', ['get', 'impact']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 12, 1],
      'symbol-sort-key': ['-', 3, byImpact('rank', 3)], // Higher keys draw on top
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
