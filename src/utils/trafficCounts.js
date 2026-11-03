// NZTA's traffic counting sites (server/trafficCounts.js) on the map: how each site's latest week
// compares with the same week a year before. Most weeks are within 10% of the year before
// (holidays, weather, a year's growth), so that's "about usual".
export const USUAL = 0.1;
export const MUCH = 0.25;

export const CHANGE_LABELS = {
  'much-quieter': 'Much quieter than usual',
  quieter: 'Quieter than usual',
  usual: 'About usual',
  busier: 'Busier than usual',
  'much-busier': 'Much busier than usual',
  unknown: 'Not counted enough a year ago to compare',
};

// A change (0.1 is 10% busier than a year before; null if unknown) → a CHANGE_LABELS key
export const changeLevel = (change) => {
  if (change === null || change === undefined) return 'unknown';
  if (change <= -MUCH) return 'much-quieter';
  if (change <= -USUAL) return 'quieter';
  if (change < USUAL) return 'usual';
  if (change < MUCH) return 'busier';
  return 'much-busier';
};

// The week if known, else the four weeks
export const siteChange = site => site.week ?? site.month;

// Blue for quieter, magenta for busier (clear of the congestion lines' orange and red, and of each
// other in colour blindness), paler for a smaller change, and grey for about usual: per theme
const COLOURS = {
  light: {
    'much-quieter': '#2a78d6', quieter: '#8fb3e3', usual: '#9aa1ab', busier: '#e08aa8', 'much-busier': '#c2185b', unknown: '#c4c9cf',
  },
  dark: {
    'much-quieter': '#3987e5', quieter: '#6f93c0', usual: '#7d8590', busier: '#c0738f', 'much-busier': '#e0447c', unknown: '#565d66',
  },
};
export const changeColour = (level, dark) => COLOURS[dark ? 'dark' : 'light'][level];

// "+12%" or "−8%"
export const formatChange = change => `${change >= 0 ? '+' : '−'}${Math.round(Math.abs(change) * 100)}%`;

// The sites as map points, one per place: a site is often one direction of a road, with the other
// direction at the same spot. Each point shows its biggest change, is sized by its busiest site's
// traffic, and carries its sites' refs.
export function countFeatures(sites, dark) {
  const places = Object.values(Object.groupBy(sites, site => `${site.lat.toFixed(4)},${site.lon.toFixed(4)}`));
  return {
    type: 'FeatureCollection',
    features: places.map((group) => {
      const biggest = group.reduce((a, b) => (Math.abs(siteChange(b) ?? 0) > Math.abs(siteChange(a) ?? 0) ? b : a));
      const change = siteChange(biggest);
      const traffic = Math.max(0, ...group.map(site => site.aadt.findLast(v => v) ?? 0));
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [group[0].lon, group[0].lat] },
        properties: {
          refs: group.map(site => site.ref).join(','),
          colour: changeColour(changeLevel(change), dark),
          // px at zoom 10: area grows with traffic, from 3 px for the quietest roads
          radius: 3 + Math.sqrt(traffic) / 25,
          order: Math.abs(change ?? 0), // Bigger changes drawn on top
        },
      };
    }),
  };
}
