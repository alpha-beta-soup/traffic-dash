// Proxy for Mapbox Traffic v1 vector tiles: keeps the token on the server, and shares each
// tile between viewers for TILE_TTL. Mapbox updates traffic roughly every 5 minutes and
// clients refresh every 5 (TRAFFIC_REFRESH); a shorter TTL here keeps what they get fresh.
export const TILE_TTL = 2 * 60_000;
const MAX_TILES = 2000; // About 10KB each
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 16;

const tiles = new Map(); // 'z/x/y' -> { promise, expires }

const fetchTile = async (z, x, y) => {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-traffic-v1/${z}/${x}/${y}.vector.pbf?access_token=${process.env.MAPBOX_TOKEN}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null; // No traffic data in this tile
  if (!res.ok) throw Object.assign(new Error(`Traffic tile ${z}/${x}/${y} responded ${res.status}`), { status: res.status });
  return Buffer.from(await res.arrayBuffer()); // fetch has already undone any gzip encoding
};

export const getTile = (z, x, y) => {
  const key = `${z}/${x}/${y}`;
  const cached = tiles.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetchTile(z, x, y);
  promise.catch(() => tiles.delete(key));
  tiles.delete(key); // Re-insert, so Map order is roughly least recently fetched first
  tiles.set(key, { promise, expires: Date.now() + TILE_TTL });
  if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
  return promise;
};
