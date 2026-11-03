// Proxy for OpenWeatherMap's weather map tiles (Weather Maps 1.0): keeps the API key on the
// server, and shares each tile between viewers for TILE_TTL. The layers are modelled, not
// radar, and update about every 10 minutes.
export const TILE_TTL = 10 * 60_000;
const MAX_TILES = 1000; // About 30KB each
export const MAX_ZOOM = 10; // The data is coarse: the map stretches these further in
// The layers offered, by the name the app uses
export const LAYERS = { rain: 'precipitation_new' };

const tiles = new Map(); // 'layer/z/x/y' -> { promise, expires }

const fetchTile = async (layer, z, x, y) => {
  const url = `https://tile.openweathermap.org/map/${LAYERS[layer]}/${z}/${x}/${y}.png?appid=${process.env.OPENWEATHERMAP_APIKEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  // The URL holds the key: report only the tile
  if (!res.ok) throw Object.assign(new Error(`Weather tile ${layer}/${z}/${x}/${y} responded ${res.status}`), { status: res.status });
  return Buffer.from(await res.arrayBuffer());
};

export const getTile = (layer, z, x, y) => {
  const key = `${layer}/${z}/${x}/${y}`;
  const cached = tiles.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetchTile(layer, z, x, y);
  promise.catch(() => tiles.delete(key));
  tiles.delete(key); // Re-insert, so Map order is roughly least recently fetched first
  tiles.set(key, { promise, expires: Date.now() + TILE_TTL });
  if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value);
  return promise;
};
