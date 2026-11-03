import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { cacheDir, listFrames } from './cache.js';
import darkStyle from './darkStyle.js';
import { getImage, showingPlaceholder } from './images.js';
import { normaliseCamera, normaliseEvent, normaliseSign } from './normalise.js';
import { inNz, tileInNz } from './nz.js';
import rateLimit from './rateLimit.js';
import { cameraRoute, normaliseJourneys } from './routes.js';
import { vehicleCounts, vehiclesEnabled } from './vehicles.js';
import {
  FEED as WARNINGS_FEED, feedLinks, isCurrent, parseAlert,
} from './weatherWarnings.js';
import {
  LAYERS as WEATHER_LAYERS, MAX_ZOOM as WEATHER_MAX_ZOOM, TILE_TTL as WEATHER_TILE_TTL, getTile as getWeatherTile,
} from './weatherTiles.js';
import {
  MAX_ZOOM as TILE_MAX_ZOOM, MIN_ZOOM as TILE_MIN_ZOOM, TILE_TTL, getTile,
} from './trafficTiles.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TRAFFICNZ = 'https://trafficnz.info';
const TRAFFICNZ_API = `${TRAFFICNZ}/service/traffic/rest/4`;
const PORT = Number(process.env.PORT) || 3000;
const MAP_STYLE = process.env.MAP_STYLE || 'https://tiles.openfreemap.org/styles/liberty';
const MAP_STYLE_DARK_PATH = '/api/map-style/dark';
const PRODUCTION = process.env.NODE_ENV === 'production';
// Each client's requests to /api: a burst of this many, then this many a second. A screen of cards
// and a map pan stay well within it.
const RATE_BURST = 300;
const RATE_PER_SECOND = 10;
const WEATHER_TTL = 10 * 60_000; // Weather is shared between viewers of the same place this long
// A blank tile, for rain outside New Zealand
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy (e.g. Caddy), how many hops of X-Forwarded-For to trust, so each
// client's own address is what's rate limited: 1 for one proxy. Off (direct connections) unless set.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Cross-origin isolation, so the wind layer (Open-Meteo's map layer) can share its weather data
// with its workers rather than copy it for each tile. 'credentialless' rather than 'require-corp':
// cross-origin resources (map tiles, fonts, weather files) then need no extra header.
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};
app.use((req, res, next) => {
  res.set({ ...ISOLATION_HEADERS, ...SECURITY_HEADERS });
  next();
});

const fetchOk = async (url, options) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), ...options });
  if (!res.ok) {
    // Report only the origin and path: the query string may hold an API key
    const { origin, pathname } = new URL(url);
    throw Object.assign(new Error(`${origin}${pathname} responded ${res.status}`), { status: res.status });
  }
  return res;
};
const fetchJson = async (url, options) => (await fetchOk(url, options)).json();
const fetchText = async (url, options) => (await fetchOk(url, options)).text();

// Small in-memory cache so many browser tabs don't hammer the upstream feeds.
// Caching the promise means concurrent callers share one request.
const memo = (ttl, fn) => {
  let promise;
  let expires = 0;
  return () => {
    if (Date.now() > expires) {
      promise = fn();
      expires = Date.now() + ttl;
      promise.catch(() => { expires = 0; }); // Retry on next call rather than caching the failure
    }
    return promise;
  };
};

// State highway routes ("journeys"), to place cameras along them. They rarely change, and the
// feed is large and slow (about 20s), so it gets longer than the usual timeout, starts loading
// when the server starts, and never holds up the camera list: cameras get routes once they've
// loaded (within a minute or so of starting).
let routes = new Map();
const loadRoutes = memo(6 * 60 * 60_000, async () => {
  const data = await fetchJson(`${TRAFFICNZ_API}/journeys/all/12`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(60_000),
  });
  routes = normaliseJourneys(data.response.journey ?? []);
});
const refreshRoutes = () => loadRoutes().catch(err => console.error(err.message));
refreshRoutes();

const getCameras = memo(60_000, async () => {
  refreshRoutes(); // Not awaited: uses the routes loaded so far
  const data = await fetchJson(`${TRAFFICNZ_API}/cameras/all`, { headers: { Accept: 'application/json' } });
  return data.response.camera.map(camera => ({
    ...normaliseCamera(camera),
    route: cameraRoute(camera.journey?.id, [camera.longitude, camera.latitude], routes),
  }));
});

const getEvents = memo(2 * 60_000, async () => {
  const data = await fetchJson(`${TRAFFICNZ_API}/events/all/18`, { headers: { Accept: 'application/json' } });
  return [data.response.roadevent ?? []].flat()
    .filter(event => event.status === 'Active')
    .map(normaliseEvent)
    .filter(Boolean);
});

const getSigns = memo(60_000, async () => {
  const data = await fetchJson(`${TRAFFICNZ_API}/signs/vms/all`, { headers: { Accept: 'application/json' } });
  return data.response.vms.map(normaliseSign);
});

const handle = fn => (req, res, next) => fn(req, res).catch(next);

// For a container's or host's health check: up, and whether the vehicle counter is
app.get('/api/health', handle(async (req, res) => {
  res.set('Cache-Control', 'no-store').json({ ok: true, vehicles: await vehiclesEnabled() });
}));

app.use('/api', rateLimit({ burst: RATE_BURST, perSecond: RATE_PER_SECOND }));

app.get('/api/config', handle(async (req, res) => {
  res.json({
    weather: !!process.env.OPENWEATHERMAP_APIKEY,
    traffic: !!process.env.MAPBOX_TOKEN,
    // Whether the vehicle counter (counter/, a process of its own) is running
    vehicles: await vehiclesEnabled(),
    mapStyle: MAP_STYLE,
    // By default, the light style darkened (server/darkStyle.js), so both themes are one map
    mapStyleDark: process.env.MAP_STYLE_DARK || MAP_STYLE_DARK_PATH,
  });
}));

const getDarkStyle = memo(6 * 60 * 60 * 1000, async () => darkStyle(await fetchJson(MAP_STYLE)));

app.get(MAP_STYLE_DARK_PATH, handle(async (req, res) => {
  res.set('Cache-Control', 'no-cache'); // Revalidated by ETag: cheap, and never stale after a change
  res.json(await getDarkStyle());
}));

// unavailable: NZTA hasn't marked the camera offline, but it's serving the stock
// "temporarily unavailable" image (known only for cameras someone has looked at recently)
app.get('/api/cameras', handle(async (req, res) => {
  res.json((await getCameras()).map(camera => ({ ...camera, unavailable: showingPlaceholder(camera.id) })));
}));

app.get('/api/signs', handle(async (req, res) => {
  res.json(await getSigns());
}));

// MetService's current weather watches and warnings. Each alert's document never changes, so
// it's fetched once; the feed (which alerts are current) is checked every few minutes.
const alerts = new Map();
const getAlert = (url) => {
  if (!alerts.has(url)) {
    const alert = fetchText(url).then(parseAlert);
    alert.catch(() => alerts.delete(url)); // Retry next time
    alerts.set(url, alert);
  }
  return alerts.get(url);
};
const getWarnings = memo(5 * 60_000, async () => {
  const links = feedLinks(await fetchText(WARNINGS_FEED));
  [...alerts.keys()].filter(url => !links.includes(url)).forEach(url => alerts.delete(url)); // Gone from the feed
  const settled = await Promise.allSettled(links.map(getAlert));
  return settled.filter(r => r.status === 'fulfilled').map(r => r.value).filter(alert => isCurrent(alert));
});

app.get('/api/weather-warnings', handle(async (req, res) => {
  res.json(await getWarnings());
}));

app.get('/api/events', handle(async (req, res) => {
  res.json(await getEvents());
}));

app.get('/api/cameras/:id/image', handle(async (req, res) => {
  const camera = (await getCameras()).find(c => String(c.id) === req.params.id);
  if (!camera) return res.sendStatus(404);
  const { buffer, lastModified, placeholder } = await getImage(camera);
  // NZTA's stock "temporarily unavailable" image: say so, rather than pass it off as the view
  if (placeholder) return res.status(503).set('Cache-Control', 'no-store').json({ unavailable: true });
  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'no-store',
    ...(lastModified && { 'Last-Modified': lastModified }),
  });
  res.send(buffer);
}));

app.get('/api/cameras/:id/history', handle(async (req, res) => {
  res.json(await listFrames(req.params.id));
}));

// Vehicles counted in the camera's frames, by the counter: [{ time, count }], for the last
// `hours` (up to a week)
const MAX_COUNT_HOURS = 7 * 24;
app.get('/api/cameras/:id/vehicles', handle(async (req, res) => {
  const hours = Math.min(MAX_COUNT_HOURS, Number(req.query.hours) || 6);
  res.json(await vehicleCounts(req.params.id, Date.now() - hours * 3600_000));
}));

// The weather at a place in New Zealand, shared between everyone asking about the same place
// (to about 1 km) for WEATHER_TTL
const weather = new Map(); // 'lat,lon' -> { promise, expires }
const getWeather = (lat, lon) => {
  const place = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const now = Date.now();
  for (const [key, entry] of weather) if (entry.expires < now) weather.delete(key);
  if (!weather.has(place)) {
    const params = new URLSearchParams({
      lat: lat.toFixed(2), lon: lon.toFixed(2), units: 'metric', appid: process.env.OPENWEATHERMAP_APIKEY,
    });
    const promise = fetchJson(`https://api.openweathermap.org/data/2.5/weather?${params}`);
    promise.catch(() => weather.delete(place)); // Retry next time
    weather.set(place, { promise, expires: now + WEATHER_TTL });
  }
  return weather.get(place).promise;
};

app.get('/api/weather', handle(async (req, res) => {
  if (!process.env.OPENWEATHERMAP_APIKEY) return res.sendStatus(204);
  const [lat, lon] = [req.query.lat, req.query.lon].map(Number);
  if (!inNz(lat, lon)) return res.sendStatus(400);
  res.json(await getWeather(lat, lon));
}));

app.get('/api/weather-tiles/:layer/:z/:x/:y.png', handle(async (req, res) => {
  const { layer } = req.params;
  if (!process.env.OPENWEATHERMAP_APIKEY || !Object.hasOwn(WEATHER_LAYERS, layer)) return res.sendStatus(404);
  const [z, x, y] = [req.params.z, req.params.x, req.params.y].map(Number);
  const max = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > WEATHER_MAX_ZOOM || x < 0 || y < 0 || x >= max || y >= max) {
    return res.sendStatus(400);
  }
  const tile = tileInNz(z, x, y) ? await getWeatherTile(layer, z, x, y) : BLANK_PNG;
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${WEATHER_TILE_TTL / 1000}` });
  res.send(tile);
}));

app.get('/api/traffic-tiles/:z/:x/:y.pbf', handle(async (req, res) => {
  if (!process.env.MAPBOX_TOKEN) return res.sendStatus(404);
  const [z, x, y] = [req.params.z, req.params.x, req.params.y].map(Number);
  const max = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < TILE_MIN_ZOOM || z > TILE_MAX_ZOOM || x < 0 || y < 0 || x >= max || y >= max) {
    return res.sendStatus(400);
  }
  const tile = tileInNz(z, x, y) ? await getTile(z, x, y) : null;
  if (!tile) return res.sendStatus(204);
  res.set({ 'Content-Type': 'application/x-protobuf', 'Cache-Control': `public, max-age=${TILE_TTL / 1000}` });
  res.send(tile);
}));

app.use('/cache', express.static(cacheDir, { maxAge: '1h' }));

// In production, serve the built client too, including at its page addresses (e.g. a camera's
// page at /camera/714), which are handled in the browser
// page at /camera/714), which are handled in the browser. Built files are named by their content,
// so can be kept for good; the page itself is checked each time, so it always loads the latest.
const IMMUTABLE = 'public, max-age=31536000, immutable';
app.use(express.static(path.join(root, 'dist'), {
  setHeaders: (res, file) => res.set('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? IMMUTABLE : 'no-cache'),
}));
app.get('/camera/:id', (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(root, 'dist', 'index.html')));

// Upstream errors are logged in full; in production the browser is told only that something
// failed, not what or where
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(`${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(err.status >= 400 ? 502 : 500).json({ error: PRODUCTION ? 'Request failed' : err.message });
});

const server = app.listen(PORT, () => console.log(`traffic-dash server on http://localhost:${PORT}`));

// On stop (e.g. a container restarting), finish the requests under way, then exit
const stop = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

