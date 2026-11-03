import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOWN_DAYS, YEAR, change, fetchSites, summarise,
} from '../server/trafficCounts.js';
import { changeLevel, countFeatures, formatChange } from '../src/utils/trafficCounts.js';

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
      date: '2026-11-01', total: 12000, heavy: 1200, lastYear: 10000,
    });
    assert.ok(Math.abs(a.week - 0.2) < 1e-9);
    assert.ok(Math.abs(a.month - 0.2) < 1e-9);
  });

  it('treats a day missing a lane as not counted, rather than quiet', () => {
    const last = TODAY - DAY;
    const sites = new Map([['A', site('A')]]);
    const recent = [...days('A', last - DAY, 20, () => 10000), ...dayRows('A', last, 5000, 1)];
    const [a] = summarise(sites, recent, days('A', last - YEAR, 20, () => 10000), TODAY);
    assert.equal(a.latest, isoOf(last - DAY)); // The partial day isn't the latest
    assert.equal(a.week, 0);
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
      ref: 'S1', name: 'Site 1', highway: '2', lat: -41, lon: 175, aadt: [null, null, null, null, 1],
    });
    assert.deepEqual(requests.slice(1).map(p => p.get('resultOffset')).sort(), ['0', '2000']);
  });

  it('puts both directions at a place on one point, showing the bigger change', () => {
    const north = site('N', { week: 0.05, month: 0.04 });
    const south = site('S', { week: -0.3, month: -0.2, aadt: [null, null, null, null, 40000] });
    const away = site('X', { lat: -41.3, week: null, month: null });
    const { features } = countFeatures([north, south, away], false);
    assert.equal(features.length, 2);
    assert.equal(features[0].properties.refs, 'N,S');
    assert.equal(features[0].properties.colour, '#2a78d6'); // Much quieter
    assert.equal(features[0].properties.radius, 3 + Math.sqrt(40000) / 25);
    assert.equal(features[1].properties.order, 0);
  });

  it('names changes', () => {
    assert.deepEqual([-0.3, -0.12, 0.05, 0.1, 0.4, null].map(changeLevel), ['much-quieter', 'quieter', 'usual', 'busier', 'much-busier', 'unknown']);
    assert.equal(formatChange(0.123), '+12%');
    assert.equal(formatChange(-0.08), '−8%');
  });
});

function isoOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
