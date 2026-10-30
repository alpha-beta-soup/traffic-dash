const TRAFFICNZ = 'https://trafficnz.info';

// Variable message sign markup: [nl] new line, [np] new page, [jl4] justify
const signMessage = message => (message || '')
  .replace(/\[jl\d\]/g, '\t')
  .replace(/\[nl\]/g, '\n')
  .replace(/\[np\]/g, '\n\n')
  .trim();

export const normaliseCamera = camera => ({
  id: camera.id,
  name: camera.name.trim(),
  description: camera.description,
  direction: camera.direction,
  highway: camera.highway,
  region: camera.region?.name,
  lat: camera.latitude,
  lon: camera.longitude,
  offline: camera.offline,
  underMaintenance: camera.underMaintenance,
  imageUrl: `${TRAFFICNZ}${camera.imageUrl}`,
});

export const normaliseSign = sign => ({
  id: sign.id,
  name: sign.name,
  region: sign.region?.name,
  lat: sign.latitude,
  lon: sign.longitude,
  message: signMessage(sign.currentMessage),
  lastUpdate: sign.lastMessageUpdate || sign.lastUpdate,
});

// trafficnz.info gives event geometry as WKT: POINT, LINESTRING or MULTILINESTRING
const coordinates = text => text.trim().split(/\s*,\s*/).map(pair => pair.trim().split(/\s+/).map(Number));
export const parseWkt = (wkt) => {
  const match = /^\s*(POINT|LINESTRING|MULTILINESTRING)\s*\((.*)\)\s*$/is.exec(wkt ?? '');
  if (!match) return null;
  const [, type, body] = match;
  if (type.toUpperCase() === 'POINT') return { type: 'Point', coordinates: coordinates(body)[0] };
  if (type.toUpperCase() === 'LINESTRING') return { type: 'LineString', coordinates: coordinates(body) };
  return { type: 'MultiLineString', coordinates: [...body.matchAll(/\(([^()]*)\)/g)].map(([, line]) => coordinates(line)) };
};

// Where to put an event's icon: the point itself, or the middle of its (first) line
const anchor = (geometry) => {
  if (geometry.type === 'Point') return geometry.coordinates;
  const line = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates[0];
  return line[Math.floor(line.length / 2)];
};

const notApplicable = text => (!text || /^not applicable$/i.test(text.trim()) ? null : text.trim());

// A road event (crash, roadworks, hazard…); null if its geometry can't be read
export const normaliseEvent = (event) => {
  const geometry = parseWkt(event.geometry);
  if (!geometry) return null;
  const [lon, lat] = anchor(geometry);
  return {
    id: event.id,
    type: event.eventType, // e.g. Road Work, Area Warning, Road Hazard
    cause: event.eventDescription, // e.g. Crash, Fallen tree/s across highway
    impact: event.impact, // Caution, Delays, Road Closed or Vehicle Restrictions
    planned: !!event.planned,
    status: event.status,
    area: event.locationArea,
    comments: event.eventComments?.trim() || null,
    alternative: notApplicable(event.alternativeRoute),
    resolution: notApplicable(event.expectedResolution),
    start: event.startDate,
    end: event.endDate,
    region: event.region?.name,
    lat,
    lon,
    geometry,
  };
};
