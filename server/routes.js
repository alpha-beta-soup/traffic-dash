// Positions cameras along their state highway route ("journey" in NZTA's data), so a camera's
// page can offer the next camera along the road. NZTA's ordering fields on cameras aren't usable
// (sortOrder is patchy; leg sequence numbers are all 0), but a journey's legs, in order, run
// from its start to its end, so a camera's distance along them orders the cameras. Each leg
// appears twice, once per direction of travel (I and D); the route follows the I legs. (The
// journey's own geometry has both, interleaved, so it runs back and forth.)
import { parseWkt } from './normalise.js';

const rad = d => (d * Math.PI) / 180;
const metres = ([lon1, lat1], [lon2, lat2]) => {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// A journey's geometry as one line from start to end, with the distance to each vertex
export function routeLine(geometry) {
  const coords = geometry.type === 'LineString' ? geometry.coordinates
    : geometry.type === 'MultiLineString' ? geometry.coordinates.flat() : [];
  const along = [0];
  for (let i = 1; i < coords.length; i++) along.push(along[i - 1] + metres(coords[i - 1], coords[i]));
  return { coords, along };
}

// How far along the route (metres) the point nearest to `point` is
export function distanceAlong({ coords, along }, point) {
  let best = { offset: Infinity, along: 0 };
  const [px, py] = point;
  const kx = Math.cos(rad(py)); // Flat projection around the point: fine for nearest-segment search
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = [(coords[i - 1][0] - px) * kx, coords[i - 1][1] - py];
    const [bx, by] = [(coords[i][0] - px) * kx, coords[i][1] - py];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    const offset = Math.hypot(ax + t * dx, ay + t * dy);
    if (offset < best.offset) best = { offset, along: along[i - 1] + t * (along[i] - along[i - 1]) };
  }
  return best.along;
}

// "Manawatu Boundary to Otaki" … "Evans Bay to Wellington Airport" -> the route's two ends
const ends = (legs) => {
  const names = legs.map(leg => leg.name?.split(/\s+to\s+/i) ?? []);
  return { start: names[0]?.[0] ?? null, end: names.at(-1)?.at(-1) ?? null };
};

// trafficnz.info journeys -> Map: journey id -> { name, start, end, line }
export function normaliseJourneys(journeys) {
  const routes = new Map();
  [journeys].flat().forEach((journey) => {
    const legs = [journey.legs ?? []].flat()
      .filter(leg => leg.direction === 'I')
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const coordinates = legs.map(leg => parseWkt(leg.geometry)).filter(Boolean)
      .flatMap(geometry => (geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates));
    if (!coordinates.length) return;
    routes.set(journey.id, {
      name: journey.name, ...ends(legs), line: routeLine({ type: 'MultiLineString', coordinates }),
    });
  });
  return routes;
}

// A camera's place on its route: { id, name, km, start, end }, or null if it isn't on one
export function cameraRoute(journeyId, point, routes) {
  const route = routes.get(journeyId);
  if (!route || route.line.coords.length < 2) return null;
  const km = Math.round(distanceAlong(route.line, point) / 100) / 10;
  return { id: journeyId, name: route.name, km, start: route.start, end: route.end };
}
