// NZTA's traffic counting sites (server/trafficCounts.js) on the map: how each site's latest week
// compares with the same week a year before. Most weeks are within 10% of the year before
// (holidays, weather, a year's growth), so that's "about the same".
export const SAME = 0.1;
export const MUCH = 0.25;

export const CHANGE_LABELS = {
  'much-quieter': 'Much quieter than a year before',
  quieter: 'Quieter than a year before',
  same: 'About the same as a year before',
  busier: 'Busier than a year before',
  'much-busier': 'Much busier than a year before',
  unknown: 'Not counted enough a year before to compare',
};
// For the map's key, busiest first, under a heading saying what they're against
export const CHANGE_KEY = [
  ['much-busier', `Much busier (${Math.round(MUCH * 100)}%+)`],
  ['busier', 'Busier'],
  ['same', `About the same (±${Math.round(SAME * 100)}%)`],
  ['quieter', 'Quieter'],
  ['much-quieter', 'Much quieter'],
  ['unknown', 'Too few counts to compare'],
];

// How up to date the sites' counts are, as each comes in on its own schedule: { half, newest },
// the latest day that half the sites are counted to and the latest of any; or null for no sites
export function countedTo(sites) {
  if (!sites.length) return null;
  const days = sites.map(site => site.latest).sort();
  return { half: days[Math.floor((days.length - 1) / 2)], newest: days.at(-1) };
}

// A change (0.1 is 10% busier than a year before; null if unknown) → a CHANGE_LABELS key
export const changeLevel = (change) => {
  if (change === null || change === undefined) return 'unknown';
  if (change <= -MUCH) return 'much-quieter';
  if (change <= -SAME) return 'quieter';
  if (change < SAME) return 'same';
  if (change < MUCH) return 'busier';
  return 'much-busier';
};

// The classes of vehicles to compare, as NZTA counts them (by length; see shared/vehicleClasses)
export const VEHICLE_CLASSES = { all: 'All vehicles', heavy: 'Heavy vehicles', light: 'Light vehicles' };

// A site's changes, of a class of `vehicles`: { week, month } (either null if unknown)
export const changesOf = (site, vehicles = 'all') => (vehicles === 'all'
  ? { week: site.week, month: site.month }
  : site[vehicles] ?? { week: null, month: null });

// The week's change if known, else the four weeks'
export const siteChange = (site, vehicles = 'all') => {
  const { week, month } = changesOf(site, vehicles);
  return week ?? month;
};

// Blue for quieter, magenta for busier (clear of the congestion lines' orange and red, and of each
// other in colour blindness), paler for a smaller change, and grey for about the same: per theme
const COLOURS = {
  light: {
    'much-quieter': '#2a78d6', quieter: '#8fb3e3', same: '#9aa1ab', busier: '#e08aa8', 'much-busier': '#c2185b', unknown: '#c4c9cf',
  },
  dark: {
    'much-quieter': '#3987e5', quieter: '#6f93c0', same: '#7d8590', busier: '#c0738f', 'much-busier': '#e0447c', unknown: '#565d66',
  },
};
export const changeColour = (level, dark) => COLOURS[dark ? 'dark' : 'light'][level];

// The + or − on a busier or quieter dot (none for about the same, or unknown), and its ink: white
// on the strong colours, dark on the pale ones
export const CHANGE_SIGNS = {
  'much-quieter': ['−', 'white'], quieter: ['−', '#1b1e23'], busier: ['+', '#1b1e23'], 'much-busier': ['+', 'white'],
};

// "+12%", "−8%", or "0%" (unsigned, rounded to nothing)
export const formatChange = (change) => {
  const percent = Math.round(Math.abs(change) * 100);
  return percent ? `${change > 0 ? '+' : '−'}${percent}%` : '0%';
};

export const PLACE_RADIUS = 100; // m: sites this close are one place (a road's directions, an interchange's ramps)
export const SAME_SPOT = 5; // m: sites this close would hide each other, even zoomed right in
const metres = (a, b) => 6371e3 * Math.hypot((b.lat - a.lat) * (Math.PI / 180), (b.lon - a.lon) * (Math.PI / 180) * Math.cos(a.lat * (Math.PI / 180)));
const traffic = site => site.aadt.findLast(v => v) ?? 0;

// The sites grouped into places, each within `radius` (m) of its busiest site (first)
export const placesOf = (sites, radius = PLACE_RADIUS) => [...sites].sort((a, b) => traffic(b) - traffic(a)).reduce((places, site) => {
  const place = places.find(([first]) => metres(first, site) <= radius);
  if (place) place.push(site);
  else places.push([site]);
  return places;
}, []);

// The sites as map points, one per place (sites within `radius` m): a site is often one direction
// of a road, with the other direction (and an interchange's ramps) beside it. Each point shows its
// biggest change of a class of `vehicles` (as a colour, a sign, and a label unless it's about the
// same), is sized by its busiest site's traffic, and carries its sites' refs.
export function countFeatures(sites, dark, { radius = PLACE_RADIUS, vehicles = 'all' } = {}) {
  const changeAt = site => siteChange(site, vehicles);
  return {
    type: 'FeatureCollection',
    features: placesOf(sites, radius).map((group) => {
      const biggest = group.reduce((a, b) => (Math.abs(changeAt(b) ?? 0) > Math.abs(changeAt(a) ?? 0) ? b : a));
      const change = changeAt(biggest);
      const level = changeLevel(change);
      const [sign = '', ink = ''] = CHANGE_SIGNS[level] ?? [];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [group[0].lon, group[0].lat] },
        properties: {
          refs: group.map(site => site.ref).join(','),
          level, // To show or hide by (in the key)
          colour: changeColour(level, dark),
          sign,
          ink,
          label: sign && formatChange(change),
          // px at zoom 10: area grows with traffic, from 3 px for the quietest roads
          radius: 3 + Math.sqrt(traffic(group[0])) / 40,
          order: Math.abs(change ?? 0), // Bigger changes drawn on top
        },
      };
    }),
  };
}
