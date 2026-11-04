import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOWN_DAYS, YEAR, change, fetchSites, summarise,
} from '../server/trafficCounts.js';
import {
  changeLevel, countFeatures, countedTo, formatChange,
} from '../src/utils/trafficCounts.js';

const DAY = 86_400_000;
const TODAY = Date.parse('2026-11-04');
const site = (ref, extra = {}) => ({
  ref, name: `Site ${ref}`, highway: '1', lat: -41.25, lon: 174.8, aadt: [null, null, 9000, 9500, 10000], ...extra,
});

// A day's rows for a site: light and heavy, each summed over `lanes` lanes
const dayRows = (ref, date, total, lanes = 2) => [
  { SiteRef: ref, startDate: date, classWeight: 'Light', n: total * 0.9, rows: lanes },
  { SiteRef: ref, startDate: date, classWeight: 'Heavy', n: total * 0.1, rows: lanes },
];
// `days` days to `last` (ms), each with total(i) vehicles (i from 0, oldest)
const days = (ref, last, count, total, lanes) => Array.from({ length: count }, (_, i) => dayRows(ref, last - (count - 1 - i) * DAY, total(i), lanes)).flat();

describe('traffic counts', () => {
  it('compares the latest week with the same days a year before', () => {
    const last = TODAY - 3 * DAY;
    const sites = new Map([['A', site('A')]]);
    const recent = days('A', last, 40, () => 12000);
    const lastYear = days('A', last - YEAR, 40, () => 10000);
    const [a] = summarise(sites, recent, lastYear, TODAY);
    assert.equal(a.latest, '2026-11-01');
    assert.equal(a.days.length, SHOWN_DAYS);
    assert.deepEqual(a.days.at(-1), {
      date: '2026-11-01', total: 12000, heavy: 1200, lastYear: 10000, lastYearHeavy: 1000, holiday: null, lastYearHoliday: null,
    });
    assert.ok(Math.abs(a.week - 0.2) < 1e-9);
    assert.ok(Math.abs(a.month - 0.2) < 1e-9);
    assert.ok(Math.abs(a.heavy.week - 0.2) < 1e-9); // 1200 heavy a day against 1000
    assert.ok(Math.abs(a.light.month - 0.2) < 1e-9);
  });

  it('leaves public holidays out of the comparison, and names them', () => {
    const last = TODAY - 3 * DAY; // Sunday 1 November 2026: the week has Labour Day (Monday 26 October)
    const sites = new Map([['A', site('A', { region: '09 - Wellington' })]]);
    const labourDay = Date.parse('2026-10-26');
    const recent = days('A', last, 40, i => (last - (39 - i) * DAY === labourDay ? 4000 : 12000));
    const [a] = summarise(sites, recent, days('A', last - YEAR, 40, () => 10000), TODAY);
    assert.ok(Math.abs(a.week - 0.2) < 1e-9); // Not dragged down by the holiday's 4000
    assert.equal(a.days.find(d => d.date === '2026-10-26').holiday, 'Labour Day');
    // Easter 2026 (5 April) was a fortnight earlier than 2025's: 52 weeks on from Easter Monday 2025
    // is an ordinary Monday, a holiday only the year before
    const series = change([{ total: 100, lastYear: 50, holiday: null, lastYearHoliday: 'Easter Monday' },
      ...Array.from({ length: 6 }, () => ({ total: 100, lastYear: 100, holiday: null, lastYearHoliday: null }))], 7);
    assert.equal(series, 0);
  });

  it('treats a day missing a lane as not counted, rather than quiet', () => {
    const last = TODAY - DAY;
    const sites = new Map([['A', site('A')]]);
    const recent = [...days('A', last - DAY, 20, () => 10000), ...dayRows('A', last, 5000, 1)];
    const [a] = summarise(sites, recent, days('A', last - YEAR, 20, () => 10000), TODAY);
    assert.equal(a.latest, isoOf(last - DAY)); // The partial day isn't the latest
    assert.equal(a.week, 0);
  });

  it('compares heavy and light vehicles apart, given enough of them', () => {
    const day = (heavy, lastYearHeavy) => ({
      total: 1000, heavy, lastYear: 1000, lastYearHeavy, holiday: null, lastYearHoliday: null,
    });
    const trucks = Array.from({ length: 7 }, () => day(130, 100)); // Freight up, cars down
    assert.equal(change(trucks, 7), 0);
    assert.ok(Math.abs(change(trucks, 7, 'heavy') - 0.3) < 1e-9);
    assert.ok(Math.abs(change(trucks, 7, 'light') - -30 / 900) < 1e-9);
    // 30 trucks a day the year before: too few to say
    assert.equal(change(Array.from({ length: 7 }, () => day(40, 30)), 7, 'heavy'), null);
  });

  it('needs half the days counted both years to compare', () => {
    const series = Array.from({ length: 7 }, (_, i) => ({ total: 100, lastYear: i < 3 ? 80 : null }));
    assert.equal(change(series, 7), null);
    series[3].lastYear = 80;
    assert.equal(change(series, 7), 0.25);
  });

  it('leaves out sites with nothing recent, or not on the map', () => {
    const sites = new Map([['A', site('A')]]);
    const old = days('A', TODAY - 40 * DAY, 10, () => 10000);
    assert.deepEqual(summarise(sites, old, [], TODAY), []);
    assert.deepEqual(summarise(new Map(), days('B', TODAY - DAY, 10, () => 1), [], TODAY), []);
  });

  it('pages through the sites', async () => {
    const requests = [];
    const fetchJson = async (url) => {
      const params = new URL(url).searchParams;
      requests.push(params);
      if (params.get('returnCountOnly')) return { count: 2001 };
      const offset = Number(params.get('resultOffset'));
      return {
        features: (offset ? [2001] : [1, 2]).map(n => ({
          attributes: { siteref: `S${n}`, description: ` Site ${n} `, sh: '2', aadt1yearago: n }, geometry: { x: 175, y: -41 },
        })),
      };
    };
    const sites = await fetchSites(fetchJson);
    assert.deepEqual([...sites.keys()], ['S1', 'S2', 'S2001']);
    assert.deepEqual(sites.get('S1'), {
      ref: 'S1', name: 'Site 1', highway: '2', region: null, lat: -41, lon: 175, aadt: [null, null, null, null, 1],
    });
    assert.deepEqual(requests.slice(1).map(p => p.get('resultOffset')).sort(), ['0', '2000']);
  });

  it('tries a failed request again', async () => {
    let calls = 0;
    const fetchJson = async (url) => {
      calls += 1;
      if (calls === 1) return { error: { code: 500, message: '' } };
      if (new URL(url).searchParams.get('returnCountOnly')) return { count: 1 };
      return { features: [{ attributes: { siteref: 'S1', description: 'Site 1' }, geometry: { x: 175, y: -41 } }] };
    };
    const sites = await fetchSites(fetchJson);
    assert.deepEqual([...sites.keys()], ['S1']);
    assert.equal(calls, 3);
  });

  it('puts the sites at a place (within 100 m) on one point, showing the biggest change', () => {
    const north = site('N', { week: 0.05, month: 0.04 });
    const south = site('S', {
      lat: -41.2502, week: -0.3, month: -0.2, aadt: [null, null, null, null, 40000],
    }); // 22 m away
    const away = site('X', { lat: -41.2511, week: null, month: null }); // 122 m
    const { features } = countFeatures([north, south, away], false);
    assert.equal(features.length, 2);
    assert.equal(features[0].properties.refs, 'S,N'); // Busiest first, and where the point is
    assert.deepEqual(features[0].geometry.coordinates, [174.8, -41.2502]);
    assert.equal(features[0].properties.colour, '#2a78d6'); // Much quieter
    assert.equal(features[0].properties.radius, 3 + Math.sqrt(40000) / 40);
    assert.equal(features[0].properties.sign, '−');
    assert.equal(features[0].properties.label, '−30%');
    assert.equal(features[1].properties.order, 0);
    assert.equal(features[1].properties.label, ''); // Unknown: no sign, no label
    // Zoomed in, only sites at the very same spot share a point
    assert.equal(countFeatures([north, south, away], false, { radius: 5 }).features.length, 3);
    // Heavy vehicles' changes, where chosen: the north site's trucks are up most
    const trucks = countFeatures([{ ...north, heavy: { week: 0.4, month: 0.3 } }, south], false, { vehicles: 'heavy' });
    assert.equal(trucks.features[0].properties.label, '+40%');
    const [same] = countFeatures([north], false).features;
    assert.deepEqual([same.properties.sign, same.properties.label], ['', '']); // About the same: likewise
  });

  it('names changes', () => {
    assert.deepEqual([-0.3, -0.12, 0.05, 0.1, 0.4, null].map(changeLevel), ['much-quieter', 'quieter', 'same', 'busier', 'much-busier', 'unknown']);
    assert.equal(formatChange(0.123), '+12%');
    assert.equal(formatChange(-0.08), '−8%');
    assert.equal(formatChange(-0.004), '0%');
  });

  it('says how up to date the counts are', () => {
    const latest = ['2026-11-01', '2026-10-18', '2026-10-18', '2026-11-02', '2026-10-04'].map(day => ({ latest: day }));
    assert.deepEqual(countedTo(latest), { half: '2026-10-18', newest: '2026-11-02' });
    assert.equal(countedTo([]), null);
  });
});

function isoOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
