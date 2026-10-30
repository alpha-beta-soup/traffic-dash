// Matches each camera to the Mapbox Traffic v1 road segments it is looking along, and
// scores their congestion. Segments must be:
// - near the camera (within MATCH_RADIUS)
// - heading the camera's way (traffic lines are drawn in the direction of travel)
// - on the most important class of road nearby (e.g. the motorway, not the street beside it),
//   and never a street or service lane
import congestionEnum from '../consts/congestionEnum';
import trafficEnum, { MATCHABLE_CLASS } from '../consts/trafficEnum';
import calculateCongestionScore from './calculateCongestionScore';
import congestionConversion from './congestionConversion';

const MATCH_RADIUS = 200; // metres
const MAX_HEADING_DIFFERENCE = 60; // degrees
const HEADINGS = { Northbound: 0, Eastbound: 90, Southbound: 180, Westbound: 270 };

const lines = (geometry) => {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
};

// Local flat projection around a camera, in metres: plenty accurate over a few hundred metres
const projector = ({ lat, lon }) => {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  return ([x, y]) => [(x - lon) * kx, (y - lat) * 110540];
};

const distanceToSegment = ([ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy);
};

const heading = ([ax, ay], [bx, by]) => ((Math.atan2(bx - ax, by - ay) * 180) / Math.PI + 360) % 360;
const angleBetween = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const roadClass = segment => trafficEnum[segment.class]?.value ?? Infinity;

// features: GeoJSON features from the traffic source layer
// Returns Map: camera id -> { level, color, description, score, directionMatched, segments: [[lng, lat], [lng, lat]][] }
export default function cameraCongestion(cameras, features) {
  const roads = features
    .filter(f => f.properties.congestion in congestionEnum
      && (trafficEnum[f.properties.class]?.value ?? Infinity) <= MATCHABLE_CLASS)
    .flatMap(f => lines(f.geometry).map(coords => ({
      coords,
      class: f.properties.class,
      congestion: f.properties.congestion,
      // Bounding box, to skip roads nowhere near a camera cheaply
      west: Math.min(...coords.map(c => c[0])),
      east: Math.max(...coords.map(c => c[0])),
      south: Math.min(...coords.map(c => c[1])),
      north: Math.max(...coords.map(c => c[1])),
    })));
  const result = new Map();
  cameras.forEach((camera) => {
    const cameraHeading = HEADINGS[camera.direction];
    const project = projector(camera);
    const pad = MATCH_RADIUS / 100000; // Degrees, generously
    const nearby = [];
    roads.forEach((road) => {
      if (camera.lon < road.west - pad * 1.5 || camera.lon > road.east + pad * 1.5
        || camera.lat < road.south - pad || camera.lat > road.north + pad) return;
      const points = road.coords.map(project);
      for (let i = 1; i < points.length; i++) {
        if (distanceToSegment(points[i - 1], points[i]) <= MATCH_RADIUS) {
          nearby.push({ ...road, heading: heading(points[i - 1], points[i]), segment: [road.coords[i - 1], road.coords[i]] });
        }
      }
    });
    // NZTA's direction is sometimes the route's label rather than a compass direction (SH16
    // is "Northbound" heading west out of Auckland), so if nothing nearby heads the camera's
    // way, use the nearby roads in both directions and say so
    const headed = cameraHeading === undefined ? []
      : nearby.filter(m => angleBetween(m.heading, cameraHeading) <= MAX_HEADING_DIFFERENCE);
    const matches = headed.length ? headed : nearby;
    if (!matches.length) return;
    // The most important road class present, plus its links (e.g. motorway and motorway_link)
    const best = Math.min(...matches.map(roadClass));
    const used = matches.filter(m => roadClass(m) <= best + 0.5);
    const score = calculateCongestionScore(used.map(m => ({ properties: { congestion: m.congestion } })));
    const level = congestionConversion(score);
    result.set(camera.id, {
      ...level,
      level: Object.keys(congestionEnum).find(k => congestionEnum[k] === level),
      score,
      directionMatched: headed.length > 0,
      segments: used.map(m => m.segment),
    });
  });
  return result;
}
