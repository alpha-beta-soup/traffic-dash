// NZTA's traffic counts: its state highway counting sites (TMS, the Traffic Monitoring System)
// and their daily counts, from its open data (licensed Creative Commons BY 4.0). Each site is a
// direction (or a ramp) at a place, counted by loops in the road. The permanent ones send their
// counts in weekly or so, so the latest are days old: enough to show a road that has been busier
// or quieter than usual for a while (a detour, a closure), not what's happening now. "Usual" is the
// same days a year before (52 weeks, so the weekdays line up): unlike the weeks just before, that
// doesn't come to take a long disruption as normal.
//   https://opendata-nzta.opendata.arcgis.com/ (TMS daily traffic counts)

const SERVICES = 'https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services';
export const SITES_URL = `${SERVICES}/Assets_SHTrafficMonitoringSites/FeatureServer/0/query`;
export const COUNTS_URL = `${SERVICES}/TMS_Telemetry_Sites/FeatureServer/0/query`;
const PAGE = 2000; // The services' most rows per request
const PARALLEL = 4; // Requests at once

const DAY = 86_400_000;
export const YEAR = 364 * DAY; // 52 weeks: the same weekday, a year before
export const SHOWN_DAYS = 35; // Of daily counts kept for each site's chart
const FETCHED_DAYS = 49; // Back from today, as some sites' latest counts are weeks old
const STALE_DAYS = 30; // A site with nothing newer is left out
// Days of the latest week, or four, compared with a year before: at least half of them must
// have counts both years
export const PERIODS = { week: 7, month: 28 };

const isoDate = ms => new Date(ms).toISOString().slice(0, 10);

const request = async (fetchJson, url, params) => {
  const body = await fetchJson(`${url}?${new URLSearchParams({ ...params, f: 'json' })}`);
  if (body.error) throw new Error(`${new URL(url).pathname}: ${body.error.message}`);
  return body;
};

// Every row an ArcGIS query matches, as its attributes (and lat, lon for points): counted first,
// then fetched a page at a time, PARALLEL pages at once
async function query(fetchJson, url, params) {
  const { count } = await request(fetchJson, url, { ...params, returnCountOnly: true });
  const offsets = Array.from({ length: Math.ceil(count / PAGE) }, (_, i) => i * PAGE);
  const pages = [];
  const next = async () => {
    for (let offset = offsets.shift(); offset !== undefined; offset = offsets.shift()) {
      const { features } = await request(fetchJson, url, { ...params, resultOffset: offset, resultRecordCount: PAGE });
      pages[offset / PAGE] = features.map(({ attributes, geometry }) => ({
        ...attributes, ...(geometry && { lon: geometry.x, lat: geometry.y }),
      }));
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, next));
  return pages.flat();
}

// The counting sites, by reference: { ref, name, highway, lat, lon, aadt } with aadt the average
// daily traffic in each of the last five years, oldest first (null where not counted)
export async function fetchSites(fetchJson) {
  const years = ['aadt5yearsago', 'aadt4yearsago', 'aadt3yearsago', 'aadt2yearsago', 'aadt1yearago'];
  const rows = await query(fetchJson, SITES_URL, {
    where: '1=1', outFields: ['siteref', 'description', 'sh', ...years].join(','), outSR: 4326, orderByFields: 'OBJECTID',
  });
  return new Map(rows.filter(row => row.siteref && row.lat !== undefined).map(row => [row.siteref, {
    ref: row.siteref,
    name: row.description?.trim() ?? row.siteref,
    highway: row.sh,
    lat: row.lat,
    lon: row.lon,
    aadt: years.map(year => row[year] || null),
  }]));
}

// Each site's daily counts from `from` to `to` (ms, UTC dates), summed over its lanes: rows of
// { SiteRef, startDate, classWeight (Light or Heavy), n, rows (lanes counted) }
export const fetchDaily = (fetchJson, from, to) => query(fetchJson, COUNTS_URL, {
  where: `startDate >= DATE '${isoDate(from)}' AND startDate < DATE '${isoDate(to)}'`,
  outStatistics: JSON.stringify([
    { statisticType: 'sum', onStatisticField: 'trafficCount', outStatisticFieldName: 'n' },
    { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'rows' },
  ]),
  groupByFieldsForStatistics: 'SiteRef,startDate,classWeight',
  orderByFields: 'SiteRef,startDate,classWeight',
});

// Daily rows → site → date (moved on by `shift` ms) → { total, heavy, rows }
const byDay = (rows, shift = 0) => {
  const sites = new Map();
  rows.forEach(({ SiteRef, startDate, classWeight, n, rows: lanes }) => {
    if (!sites.has(SiteRef)) sites.set(SiteRef, new Map());
    const date = isoDate(startDate + shift);
    const day = sites.get(SiteRef).get(date) ?? { total: 0, heavy: 0, rows: 0 };
    day.total += n;
    if (classWeight === 'Heavy') day.heavy += n;
    day.rows += lanes;
    sites.get(SiteRef).set(date, day);
  });
  return sites;
};

// The change over the last `days` days of `series` ([{ total, lastYear }], oldest first) from a
// year before, as a fraction (0.1 is 10% busier), or null without enough days counted both years
export function change(series, days) {
  const paired = series.slice(-days).filter(d => d.total !== null && d.lastYear !== null);
  if (paired.length < days / 2) return null;
  const before = paired.reduce((sum, d) => sum + d.lastYear, 0);
  return before > 0 ? paired.reduce((sum, d) => sum + d.total, 0) / before - 1 : null;
}

// Each site with recent counts: its place, its latest day, its change from a year before over the
// latest week and four weeks, and its daily counts ({ date, total, heavy, lastYear }) for the last
// SHOWN_DAYS days to its latest. A day missing a lane (fewer rows than the site's usual) counts as
// not counted, rather than as a quiet day.
export function summarise(sites, recentRows, lastYearRows, today) {
  const recent = byDay(recentRows);
  const lastYear = byDay(lastYearRows, YEAR);
  const oldest = isoDate(today - STALE_DAYS * DAY);
  return [...recent].flatMap(([ref, days]) => {
    const site = sites.get(ref);
    const before = lastYear.get(ref) ?? new Map();
    const lanes = Math.max(...[...days.values(), ...before.values()].map(d => d.rows));
    const complete = day => (day && day.rows === lanes ? day : null);
    const counted = [...days.keys()].filter(date => complete(days.get(date))).sort();
    const latest = counted.at(-1);
    if (!site || !latest || latest < oldest) return [];
    const series = Array.from({ length: SHOWN_DAYS }, (_, i) => {
      const date = isoDate(Date.parse(latest) - (SHOWN_DAYS - 1 - i) * DAY);
      const day = complete(days.get(date));
      return {
        date, total: day?.total ?? null, heavy: day?.heavy ?? null, lastYear: complete(before.get(date))?.total ?? null,
      };
    });
    return [{
      ...site,
      latest,
      week: change(series, PERIODS.week),
      month: change(series, PERIODS.month),
      days: series,
    }];
  });
}

// The sites, their counts, and how they compare with a year before, as of `now`
export async function fetchTrafficCounts(fetchJson, sites, now = Date.now()) {
  const today = Date.parse(isoDate(now));
  const from = today - FETCHED_DAYS * DAY;
  const [recent, lastYear] = await Promise.all([
    fetchDaily(fetchJson, from, today + DAY),
    fetchDaily(fetchJson, from - YEAR, today + DAY - YEAR),
  ]);
  return summarise(sites, recent, lastYear, today);
}
