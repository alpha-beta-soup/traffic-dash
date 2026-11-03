import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { anniversaryOf, holidaysAt, nationalHolidays } from '../shared/holidays.js';

const dates = map => [...map.keys()].sort();
const place = (region, lat = -41, lon = 175) => ({ region, lat, lon });
const anniversary = (region, year, lat, lon) => [...holidaysAt(place(region, lat, lon), year)]
  .find(([, name]) => name.endsWith('Anniversary Day'))?.[0];

// As MBIE lists them (employment.govt.nz, public holidays and anniversary dates), observed
describe('public holidays', () => {
  it('works out the national holidays', () => {
    assert.deepEqual(dates(nationalHolidays(2026)), [
      '2026-01-01', '2026-01-02', '2026-02-06', '2026-04-03', '2026-04-06', '2026-04-27',
      '2026-06-01', '2026-07-10', '2026-10-26', '2026-12-25', '2026-12-28',
    ]);
    assert.deepEqual(dates(nationalHolidays(2027)), [
      '2027-01-01', '2027-01-04', '2027-02-08', '2027-03-26', '2027-03-29', '2027-04-26',
      '2027-06-07', '2027-06-25', '2027-10-25', '2027-12-27', '2027-12-28',
    ]);
    assert.equal(nationalHolidays(2026).get('2026-04-27'), 'Anzac Day'); // A Saturday, so the Monday
  });

  it('works out each region’s anniversary day', () => {
    const expected = {
      2026: [['02 - Auckland', '2026-01-26'], ['07 - Taranaki', '2026-03-09'], ['06 - Hawkes Bay', '2026-10-23'],
        ['09 - Wellington', '2026-01-19'], ['13 - Otago', '2026-03-23'], ['14 - Southland', '2026-04-07'],
        ['12 - West Coast', '2026-11-30']],
      2027: [['02 - Auckland', '2027-02-01'], ['07 - Taranaki', '2027-03-08'], ['06 - Hawkes Bay', '2027-10-22'],
        ['09 - Wellington', '2027-01-25'], ['13 - Otago', '2027-03-22'], ['14 - Southland', '2027-03-30'],
        ['12 - West Coast', '2027-11-29']],
    };
    Object.entries(expected).forEach(([year, regions]) => regions.forEach(([region, date]) => {
      assert.equal(anniversary(region, Number(year)), date, `${region} ${year}`);
    }));
    // The regions holding two: Nelson and Marlborough, Canterbury and South Canterbury
    assert.equal(anniversary('10 - Nelson/Marlborough', 2026, -41.27, 173.28), '2026-02-02'); // Nelson
    assert.equal(anniversary('10 - Nelson/Marlborough', 2026, -41.51, 173.96), '2026-11-02'); // Blenheim
    assert.equal(anniversary('11 - Canterbury', 2026, -43.53, 172.64), '2026-11-13'); // Christchurch
    assert.equal(anniversary('11 - Canterbury', 2027, -44.4, 171.25), '2027-09-27'); // Timaru
  });

  it('moves Otago’s off Easter Monday, and takes old provinces’ days', () => {
    assert.equal(anniversary('13 - Otago', 2035), '2035-03-27'); // Easter Monday is the 26th
    assert.equal(anniversaryOf(place('03 - Waikato')), 'Auckland');
    assert.equal(anniversaryOf(place('08 - Manawatu-Wanganui')), 'Wellington');
    assert.equal(anniversaryOf(place('Somewhere else')), null);
  });
});
