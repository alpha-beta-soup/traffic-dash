// Groups cameras into sites: cameras within SITE_RADIUS of each other are usually one
// installation looking different ways (e.g. "Churton Park North" and "Churton Park South")
const SITE_RADIUS = 50; // metres
const QUADRANTS = ['Northbound', 'Eastbound', 'Southbound', 'Westbound'];
const COMPASS_SUFFIX = /\s*\b(north|south|east|west)\b\s*$/i;

const rad = d => (d * Math.PI) / 180;
const distance = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

// Words all names share, e.g. "SH1 Tinwald" from "SH1 Tinwald" and "SH1 Tinwald North"
const siteName = (names) => {
  const words = names.map(name => name.split(/\s+/));
  const common = [];
  for (let i = 0; words.every(w => w[i] !== undefined && w[i] === words[0][i]); i++) common.push(words[0][i]);
  const shared = common.join(' ').replace(COMPASS_SUFFIX, '');
  return shared || names[0].replace(COMPASS_SUFFIX, '');
};

const quadrantState = (cameras, direction) => {
  const camera = cameras.find(c => c.direction === direction);
  if (!camera) return '-';
  return camera.offline || camera.underMaintenance || camera.unavailable ? 'o' : 'w';
};

// Returns [{ id, lat, lon, name, cameraIds, icon }], where icon names the quadrant pattern:
// one character per N/E/S/W quadrant: 'w' working camera, 'o' offline, '-' none
export default function groupCameraSites(cameras) {
  const sites = [];
  cameras.forEach((camera) => {
    const site = sites.find(s => s.some(other => distance(other, camera) <= SITE_RADIUS));
    if (site) site.push(camera);
    else sites.push([camera]);
  });
  return sites.map(site => ({
    id: site[0].id,
    lat: site.reduce((sum, c) => sum + c.lat, 0) / site.length,
    lon: site.reduce((sum, c) => sum + c.lon, 0) / site.length,
    name: siteName(site.map(c => c.name)),
    cameraIds: site.map(c => c.id).join(','), // A string: GeoJSON properties should be flat
    icon: `site-${QUADRANTS.map(d => quadrantState(site, d)).join('')}`,
  }));
}

export const SITE_ICONS = (() => {
  const states = ['-', 'w', 'o'];
  const icons = [''];
  QUADRANTS.forEach(() => {
    icons.splice(0, icons.length, ...icons.flatMap(prefix => states.map(s => prefix + s)));
  });
  return icons.map(pattern => `site-${pattern}`);
})();
