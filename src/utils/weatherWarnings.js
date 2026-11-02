// MetService weather warnings (from the server: server/weatherWarnings.js), on the map and
// for the cameras inside them

// Ray casting: whether [lon, lat] is inside a polygon ring of [lon, lat] points
export function insideRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// MetService's colour codes, most serious last
const COLOURS = ['Yellow', 'Orange', 'Red'];
export const warningRank = warning => COLOURS.indexOf(warning.colour);

// The warnings covering a point ({ lat, lon }), most serious first
export function warningsAt({ lat, lon }, warnings) {
  return warnings
    .filter(warning => warning.areas.some(area => area.polygons.some(ring => insideRing([lon, lat], ring))))
    .sort((a, b) => warningRank(b) - warningRank(a));
}

const FALLBACK_COLOUR = '#9e9e9e';
export const warningColour = warning => warning.colourHex ?? FALLBACK_COLOUR;

// Black or white, whichever reads on the warning's colour (yellow needs black)
export function warningTextColour(warning) {
  const hex = warningColour(warning).replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#000' : '#fff';
}

// A polygon feature for each warning area, the more serious drawn on top
export const warningFeatures = warnings => ({
  type: 'FeatureCollection',
  features: [...warnings].sort((a, b) => warningRank(a) - warningRank(b)).flatMap(warning => warning.areas
    .flatMap(area => area.polygons.map(ring => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { id: warning.id, colour: warningColour(warning) },
    })))),
});
