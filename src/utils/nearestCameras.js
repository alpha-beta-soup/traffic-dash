// The cameras nearest to one camera, on any road: for getting around where following a state
// highway route doesn't help (at junctions and route ends, and for cameras on no route)

const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

const kilometres = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Initial compass bearing from a to b, 0–360° (0 is north)
const bearing = (a, b) => {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (deg(Math.atan2(y, x)) + 360) % 360;
};

const POINTS = [['N', '↑'], ['NE', '↗'], ['E', '→'], ['SE', '↘'], ['S', '↓'], ['SW', '↙'], ['W', '←'], ['NW', '↖']];
// The nearest of the eight compass points, with an arrow: { label: 'SW', arrow: '↙' }
export const compassPoint = (degrees) => {
  const [label, arrow] = POINTS[Math.round(degrees / 45) % 8];
  return { label, arrow };
};

// [{ camera, km, direction: { label, arrow } }], nearest first. `exclude`: ids to leave out
// (e.g. the camera's own site, listed separately).
export default function nearestCameras(camera, cameras, { limit = 6, maxKm = 10, exclude = [] } = {}) {
  return cameras
    .filter(other => other.id !== camera.id && !exclude.includes(other.id))
    .map(other => ({ camera: other, km: kilometres(camera, other) }))
    .filter(({ km }) => km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map(found => ({ ...found, direction: compassPoint(bearing(camera, found.camera)) }));
}
