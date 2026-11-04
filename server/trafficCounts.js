// NZTA's traffic counts: its state highway counting sites (TMS, the Traffic Monitoring System)
// and their daily counts, from its open data (licensed Creative Commons BY 4.0). Each site is a
// direction (or a ramp) at a place, counted by loops in the road. The permanent ones send their
// counts in weekly or so, so the latest are days old: enough to show a road that has been busier
// or quieter for a while (a detour, a closure), not what's happening now. Busier or quieter than
// recent years: the same days of the last YEARS years (52 weeks apart, so the weekdays line up),
// averaged, so one odd year (roadworks, a gap in counting) counts for less. Unlike the weeks just
// before, that doesn't come to take a long disruption as normal.
//   https://opendata-nzta.opendata.arcgis.com/ (TMS daily traffic counts)
import { anniversaryOf, holidaysAt } from '../shared/holidays.js';
import { VEHICLES } from '../shared/vehicleClasses.js';

const SERVICES = 'https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services';
export const SITES_URL = `${SERVICES}/Assets_SHTrafficMonitoringSites/FeatureServer/0/query`;
export const COUNTS_URL = `${SERVICES}/TMS_Telemetry_Sites/FeatureServer/0/query`;
const PAGE = 2000; // The services' most rows per request
const PARALLEL = 4; // Requests at once

const DAY = 86_400_000;
export const YEAR = 364 * DAY; // 52 weeks: the same weekday, a year before
export const YEARS = 3; // Years before, averaged for comparing with
export const SHOWN_DAYS = 35; // Of daily counts kept for each site's chart
const FETCHED_DAYS = 49; // Back from today, as some sites' latest counts are weeks old
const STALE_DAYS = 30; // A site with nothing newer is left out
// Days of the latest week, or four, compared with recent years: at least half of them must have
// counts this year and in at least one year before
export const PERIODS = { week: 7, month: 28 };

const isoDate = ms => new Date(ms).toISOString().slice(0, 10);

const TRIES = 3; // A busy service fails the odd request (a timeout, or an error with no message)
const RETRY_DELAY = 2000; // ms, doubling

const request = async (fetchJson, url, params, tries = TRIES) => {
  try {
    const body = await fetchJson(`${url}?${new URLSearchParams({ ...params, f: 'json' })}`);
    if (body.error) throw new Error(`${new URL(url).pathname}: ${body.error.message || `error ${body.error.code}`}`);
    return body;
  } catch (err) {
    if (tries <= 1) throw err;
    await new Promise(resolve => { setTimeout(resolve, RETRY_DELAY * 2 ** (TRIES - tries)); });
    return request(fetchJson, url, params, tries - 1);
  }
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

// The counting sites, by reference: { ref, name, highway, region, lat, lon, aadt } with region
// NZTA's ("09 - Wellington"), and aadt the average daily traffic in each of the last five years,
// oldest first (null where not counted)
export async function fetchSites(fetchJson) {
  const years = ['aadt5yearsago', 'aadt4yearsago', 'aadt3yearsago', 'aadt2yearsago', 'aadt1yearago'];
  const rows = await query(fetchJson, SITES_URL, {
    where: '1=1', outFields: ['siteref', 'description', 'sh', 'region', ...years].join(','), outSR: 4326, orderByFields: 'OBJECTID',
  });
  return new Map(rows.filter(row => row.siteref && row.lat !== undefined).map(row => [row.siteref, {
    ref: row.siteref,
    name: row.description?.trim() ?? row.siteref,
    highway: row.sh,
    region: row.region ?? null,
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

// A site's days ({ total, heavy, rows }) as they can be trusted: a function from a day to the day,
// or null if it can't be:
// - its rows repeated (NZTA's data has whole months with every row there several times over):
//   as many times as the site's commonest day's rows go into its own, so counted once each
// - a lane missing (its rows not a whole number of times the commonest's): null, as it would look
//   quiet, rather than not counted
// - implausible: more than IMPLAUSIBLE times its median day, null. A backstop for other faults:
//   real traffic falls far below usual at times (2020's lockdown: a quarter), but never rises so.
const IMPLAUSIBLE = 3;
const commonest = values => [...Map.groupBy(values, v => v)].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0]?.[0];
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
export const trustedDays = (days) => {
  const rows = commonest(days.map(d => d.rows));
  const once = (day) => {
    if (!day || !rows || day.rows % rows) return null;
    const times = day.rows / rows;
    return times === 1 ? day : { total: day.total / times, heavy: day.heavy / times, rows };
  };
  const most = IMPLAUSIBLE * median(days.map(once).filter(Boolean).map(d => d.total));
  return (day) => {
    const counted = once(day);
    return counted && counted.total <= most ? counted : null;
  };
};

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

// Vehicles of a class a day in recent years, to compare it at all: a few dozen trucks swing by a
// quarter on chance alone
const MIN_DAILY = 40;

// The change over the last `days` days of `series` ([{ total, heavy, baseline, baselineHeavy,
// holiday }], oldest first) from recent years, of a class of `vehicles` (VEHICLES), as a fraction
// (0.1 is 10% busier), or null without enough days counted, or too few vehicles. Public holidays
// are left out (this year's here; the years before's from their baselines): some move (Easter, by
// up to five weeks), so would otherwise make a week look much quieter, then one much busier.
export function change(series, days, vehicles = 'all') {
  const [now, before] = VEHICLES[vehicles];
  const paired = series.slice(-days).filter(d => now(d) !== null && before(d) !== null && !d.holiday);
  if (paired.length < days / 2) return null;
  const sum = count => paired.reduce((total, d) => total + count(d), 0);
  const was = sum(before);
  return was >= MIN_DAILY * paired.length ? sum(now) / was - 1 : null;
}

// Each site with recent counts: its place, its latest day, its change from recent years over the
// latest week and four weeks (week, month: of all vehicles; and heavy: { week, month } and light
// likewise), and its daily counts for the last SHOWN_DAYS days to its latest: { date, total, heavy,
// baseline, baselineHeavy, holiday (named, or null) }, the baselines the average of the same day
// in each year before (pastRows: the rows of each, a year back first) that was counted and not a
// holiday. A day missing a lane (fewer rows than the site's usual that year) counts as not
// counted, rather than as a quiet day.
export function summarise(sites, recentRows, pastRows, today) {
  const recent = byDay(recentRows);
  const past = pastRows.map((rows, i) => byDay(rows, (i + 1) * YEAR));
  const oldest = isoDate(today - STALE_DAYS * DAY);
  // A site's holiday on a date, if any: holidays by its anniversary day and year, worked out once
  const holidays = new Map();
  const holidayAt = (site, ms) => {
    const year = new Date(ms).getUTCFullYear();
    const key = `${anniversaryOf(site)}:${year}`;
    if (!holidays.has(key)) holidays.set(key, holidaysAt(site, year));
    return holidays.get(key).get(isoDate(ms)) ?? null;
  };
  return [...recent].flatMap(([ref, days]) => {
    const site = sites.get(ref);
    // A day's counts, if they can be trusted (trustedDays), judged in its own year (a road can
    // gain a lane)
    const completeIn = (year) => {
      const trusted = trustedDays([...year.values()]);
      return date => trusted(year.get(date));
    };
    const now = completeIn(days);
    const before = past.map(year => completeIn(year.get(ref) ?? new Map()));
    const counted = [...days.keys()].filter(now).sort();
    const latest = counted.at(-1);
    if (!site || !latest || latest < oldest) return [];
    const series = Array.from({ length: SHOWN_DAYS }, (_, i) => {
      const ms = Date.parse(latest) - (SHOWN_DAYS - 1 - i) * DAY;
      const date = isoDate(ms);
      const day = now(date);
      const years = before.map((year, y) => !holidayAt(site, ms - (y + 1) * YEAR) && year(date)).filter(Boolean);
      const mean = count => (years.length ? years.reduce((sum, d) => sum + count(d), 0) / years.length : null);
      return {
        date,
        total: day?.total ?? null,
        heavy: day?.heavy ?? null,
        baseline: mean(d => d.total),
        baselineHeavy: mean(d => d.heavy),
        holiday: holidayAt(site, ms),
      };
    });
    return [{
      ...site,
      latest,
      week: change(series, PERIODS.week),
      month: change(series, PERIODS.month),
      ...Object.fromEntries(['heavy', 'light'].map(vehicles => [vehicles, {
        week: change(series, PERIODS.week, vehicles),
        month: change(series, PERIODS.month, vehicles),
      }])),
      days: series,
    }];
  });
}

// The sites, their counts, and how they compare with recent years, as of `now`. Each year's counts
// are fetched in turn: the service fails requests when asked for too many at once.
export async function fetchTrafficCounts(fetchJson, sites, now = Date.now()) {
  const today = Date.parse(isoDate(now));
  const from = today - FETCHED_DAYS * DAY;
  const recent = await fetchDaily(fetchJson, from, today + DAY);
  const past = [];
  for (let year = 1; year <= YEARS; year += 1) {
    past.push(await fetchDaily(fetchJson, from - year * YEAR, today + DAY - year * YEAR));
  }
  return summarise(sites, recent, past, today);
}

// A site's traffic over the years: its average daily count each month since HISTORY_FROM, all
// vehicles and heavy ones, from the days with all of that month's lanes counted. Fetched a site at
// a time, when asked for (it's thousands of days each).
const HISTORY_FROM = '2018-01-01'; // When NZTA's daily counts begin
const MIN_MONTH_DAYS = 10; // Days counted, for a month's average to be shown: fewer would mislead

// Daily rows ({ startDate, classWeight, n, rows }) → [{ month: 'YYYY-MM', total, heavy }], every
// month from the first counted to the last, total and heavy null where too few days were counted
export function monthly(rows) {
  const days = byDay(rows.map(row => ({ ...row, SiteRef: 'site' }))).get('site') ?? new Map();
  const months = Map.groupBy(days, ([date]) => date.slice(0, 7));
  if (!months.size) return [];
  const [first, last] = [[...months.keys()].sort()[0], [...months.keys()].sort().at(-1)];
  // Over all its years too: a month can be faulty throughout
  const most = IMPLAUSIBLE * median([...days.values()].map(trustedDays([...days.values()])).filter(Boolean).map(d => d.total));
  const result = [];
  for (let at = new Date(`${first}-01T00:00:00Z`); isoDate(at).slice(0, 7) <= last; at.setUTCMonth(at.getUTCMonth() + 1)) {
    const month = isoDate(at).slice(0, 7);
    const counted = (months.get(month) ?? []).map(([, d]) => d);
    const trusted = trustedDays(counted); // By that month's lanes (a road can gain a lane)
    const complete = counted.map(trusted).filter(d => d && d.total <= most);
    const mean = count => complete.reduce((sum, d) => sum + count(d), 0) / complete.length;
    result.push(complete.length >= MIN_MONTH_DAYS
      ? { month, total: Math.round(mean(d => d.total)), heavy: Math.round(mean(d => d.heavy)) }
      : { month, total: null, heavy: null });
  }
  return result;
}

// Rows of each lane's count on a day (startDate, classWeight, laneNumber, n) → rows of each day's
// count, its lanes added up (startDate, classWeight, n, rows: its lanes)
export const lanesAdded = laneRows => [...Map.groupBy(laneRows, row => `${row.startDate}|${row.classWeight}`).values()]
  .map(lanes => ({
    startDate: lanes[0].startDate, classWeight: lanes[0].classWeight, n: lanes.reduce((sum, lane) => sum + lane.n, 0), rows: lanes.length,
  }));

// One site's monthly history (monthly()). Each lane's count is its rows' average, not their sum:
// NZTA's data has months with every row there several times over, which this counts once. `ref`
// goes into the query as is, so give only one known to be a site's (from fetchSites).
export const fetchHistory = async (fetchJson, ref) => monthly(lanesAdded(await query(fetchJson, COUNTS_URL, {
  where: `SiteRef = '${ref}' AND startDate >= DATE '${HISTORY_FROM}'`,
  outStatistics: JSON.stringify([{ statisticType: 'avg', onStatisticField: 'trafficCount', outStatisticFieldName: 'n' }]),
  groupByFieldsForStatistics: 'startDate,classWeight,laneNumber',
  orderByFields: 'startDate,classWeight,laneNumber',
})));
