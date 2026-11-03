// Where the server relays weather and map tiles for: New Zealand (the main islands, Stewart Island
// and nearby), so its keys for OpenWeatherMap and Mapbox can't be used for anywhere else
export const NZ = {
  west: 165.5, east: 179, south: -48, north: -33.5,
};

export const inNz = (lat, lon) => lat >= NZ.south && lat <= NZ.north && lon >= NZ.west && lon <= NZ.east;

// Whether a web map tile (z/x/y) covers any of it
export function tileInNz(z, x, y) {
  const n = 2 ** z;
  const lon = i => (i / n) * 360 - 180;
  const lat = j => (Math.atan(Math.sinh(Math.PI * (1 - (2 * j) / n))) * 180) / Math.PI;
  return lon(x + 1) > NZ.west && lon(x) < NZ.east && lat(y) > NZ.south && lat(y + 1) < NZ.north;
}
