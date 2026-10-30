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
