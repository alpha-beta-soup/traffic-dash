// Small geometry helpers for distances around a point (a camera), in metres

// The lines of a GeoJSON geometry, as arrays of [lon, lat]
export const lines = (geometry) => {
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
};

// Local flat projection around a point, in metres: plenty accurate over a few kilometres
export const projector = ({ lat, lon }) => {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  return ([x, y]) => [(x - lon) * kx, (y - lat) * 110540];
};

// Distance from the projection's origin to the segment a–b (both projected)
export const distanceToSegment = ([ax, ay], [bx, by]) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx, ay + t * dy);
};

// Distance in metres from a point to a GeoJSON Point, LineString or MultiLineString
export const distanceTo = (point, geometry) => {
  const project = projector(point);
  if (geometry.type === 'Point') return Math.hypot(...project(geometry.coordinates));
  let nearest = Infinity;
  lines(geometry).forEach((line) => {
    const points = line.map(project);
    if (points.length === 1) nearest = Math.min(nearest, Math.hypot(...points[0]));
    for (let i = 1; i < points.length; i++) nearest = Math.min(nearest, distanceToSegment(points[i - 1], points[i]));
  });
  return nearest;
};
