// NZTA's geometry for road events along a stretch of road is approximate: coarse, and often tens
// of metres off the road. This finds the real road segments (from the Mapbox traffic data) that
// the event's line runs along, so the event can be drawn on the road itself. Events with no
// matching road fall back to their own line, smoothed.
import trafficEnum, { MATCHABLE_CLASS } from '../consts/trafficEnum';
import { distanceToSegment, lines, projector } from './geometry';

const SNAP_DISTANCE = 100; // metres: how far a road may be from the event's line
const MAX_ANGLE = 35; // degrees: roads must run roughly along the line, not across it

// Undirected angle between two segments, 0-90°: traffic data has a line per direction of travel
const bearing = ([ax, ay], [bx, by]) => (Math.atan2(bx - ax, by - ay) * 180) / Math.PI;
const angleBetween = (a, b) => {
  const d = Math.abs(((a - b) % 180 + 180) % 180);
  return Math.min(d, 180 - d);
};

const bounds = (coords) => {
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  return { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) };
};
const PAD = 0.0015; // Degrees, about 120-165m: a little more than SNAP_DISTANCE

// Chaikin's corner cutting: each pass replaces every corner with two points, 1/4 and 3/4 of
// the way along its edges, keeping the ends. Two passes round off coarse lines nicely.
export function smooth(coords, passes = 2) {
  let points = coords;
  for (let pass = 0; pass < passes && points.length > 2; pass++) {
    const next = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const [[ax, ay], [bx, by]] = [points[i], points[i + 1]];
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    next.push(points[points.length - 1]);
    points = next;
  }
  return points;
}

// events: normalised road events; roads: GeoJSON features from the traffic source layer.
// Returns { snapped, fallback }: GeoJSON line features with each event's id and impact.
// snapped: the matched stretches of road; fallback: the smoothed lines of events with none.
export default function snapEvents(events, roads) {
  const roadLines = roads
    .filter(road => (trafficEnum[road.properties.class]?.value ?? Infinity) <= MATCHABLE_CLASS)
    .flatMap(road => lines(road.geometry))
    .map(coords => ({ coords, ...bounds(coords) }));
  const snapped = [];
  const fallback = [];
  events.filter(event => event.geometry.type !== 'Point').forEach((event) => {
    const properties = { id: event.id, impact: event.impact };
    const eventLines = lines(event.geometry);
    const box = bounds(eventLines.flat());
    const project = projector(event); // One flat projection per event: distances are between nearby points
    const eventSegments = eventLines.flatMap((coords) => {
      const points = coords.map(project);
      return points.slice(1).map((b, i) => ({ a: points[i], b, bearing: bearing(points[i], b) }));
    });
    let matched = 0;
    roadLines.forEach((road) => {
      if (road.east < box.west - PAD || road.west > box.east + PAD || road.north < box.south - PAD || road.south > box.north + PAD) return;
      const points = road.coords.map(project);
      // Which of this road's segments run along the event's line: near it (from the segment's
      // middle) and roughly parallel
      const along = points.slice(1).map((b, i) => {
        const a = points[i];
        const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const roadBearing = bearing(a, b);
        return eventSegments.some((segment) => {
          const distance = distanceToSegment(
            [segment.a[0] - middle[0], segment.a[1] - middle[1]],
            [segment.b[0] - middle[0], segment.b[1] - middle[1]],
          );
          return distance <= SNAP_DISTANCE && angleBetween(roadBearing, segment.bearing) <= MAX_ANGLE;
        });
      });
      const first = along.indexOf(true);
      if (first < 0) return;
      // Fill gaps: everything between the first and last match on the same road (where NZTA's
      // line strays further from it, e.g. on a bend), as one line
      const last = along.lastIndexOf(true);
      snapped.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: road.coords.slice(first, last + 2) } });
      matched += 1;
    });
    if (!matched) {
      fallback.push({
        type: 'Feature', properties, geometry: { type: 'MultiLineString', coordinates: eventLines.map(coords => smooth(coords)) },
      });
    }
  });
  return { snapped, fallback };
}
