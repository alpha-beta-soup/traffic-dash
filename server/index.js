import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { cacheDir, listFrames } from './cache.js';
import { getImage, showingPlaceholder } from './images.js';
import { normaliseCamera, normaliseEvent, normaliseSign } from './normalise.js';
import {
  MAX_ZOOM as TILE_MAX_ZOOM, MIN_ZOOM as TILE_MIN_ZOOM, TILE_TTL, getTile,
} from './trafficTiles.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const TRAFFICNZ = 'https://trafficnz.info';
const TRAFFICNZ_API = `${TRAFFICNZ}/service/traffic/rest/4`;
const PORT = Number(process.env.PORT) || 3000;

const app = express();

const fetchJson = async (url, options) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), ...options });
  if (!res.ok) {
    // Report only the origin and path: the query string may hold an API key
    const { origin, pathname } = new URL(url);
    throw Object.assign(new Error(`${origin}${pathname} responded ${res.status}`), { status: res.status });
  }
  return res.json();
};

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

const getCameras = memo(60_000, async () => {
  const data = await fetchJson(`${TRAFFICNZ_API}/cameras/all`, { headers: { Accept: 'application/json' } });
  return data.response.camera.map(normaliseCamera);
});

// Road events: crashes, closures, roadworks, hazards. Only those in effect now. The zoom level
// sets the detail of their geometry: at 18, stretches of road follow its bends far better than
// at lower levels (2-4 times the points), for about 30% more data from NZTA.
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

app.get('/api/config', (req, res) => {
  res.json({
    weather: !!process.env.OPENWEATHERMAP_APIKEY,
    traffic: !!process.env.MAPBOX_TOKEN,
    mapStyle: process.env.MAP_STYLE || 'https://tiles.openfreemap.org/styles/liberty',
    mapStyleDark: process.env.MAP_STYLE_DARK || 'https://tiles.openfreemap.org/styles/dark',
  });
});

// unavailable: NZTA hasn't marked the camera offline, but it's serving the stock
// "temporarily unavailable" image (known only for cameras someone has looked at recently)
app.get('/api/cameras', handle(async (req, res) => {
  res.json((await getCameras()).map(camera => ({ ...camera, unavailable: showingPlaceholder(camera.id) })));
}));

app.get('/api/signs', handle(async (req, res) => {
  res.json(await getSigns());
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

app.get('/api/weather', handle(async (req, res) => {
  const key = process.env.OPENWEATHERMAP_APIKEY;
  if (!key) return res.sendStatus(204);
  const { lat, lon } = req.query;
  const params = new URLSearchParams({ lat, lon, units: 'metric', appid: key });
  res.json(await fetchJson(`https://api.openweathermap.org/data/2.5/weather?${params}`));
}));

app.get('/api/traffic-tiles/:z/:x/:y.pbf', handle(async (req, res) => {
  if (!process.env.MAPBOX_TOKEN) return res.sendStatus(404);
  const [z, x, y] = [req.params.z, req.params.x, req.params.y].map(Number);
  const max = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < TILE_MIN_ZOOM || z > TILE_MAX_ZOOM || x < 0 || y < 0 || x >= max || y >= max) {
    return res.sendStatus(400);
  }
  const tile = await getTile(z, x, y);
  if (!tile) return res.sendStatus(204);
  res.set({ 'Content-Type': 'application/x-protobuf', 'Cache-Control': `public, max-age=${TILE_TTL / 1000}` });
  res.send(tile);
}));

app.use('/cache', express.static(cacheDir, { maxAge: '1h' }));

// In production, serve the built client too
app.use(express.static(path.join(root, 'dist')));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err.message);
  res.status(err.status >= 400 ? 502 : 500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`traffic-dash server on http://localhost:${PORT}`));
