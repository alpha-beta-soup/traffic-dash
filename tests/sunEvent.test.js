import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import sunEvent from '../src/utils/sunEvent.js';

const HOUR = 60 * 60;
const sys = { sunrise: 1000 * HOUR, sunset: 1014 * HOUR }; // A 14-hour day

describe('sunEvent', () => {
  it('gives sunrise around sunrise, before and after', () => {
    assert.deepEqual(sunEvent(sys, sys.sunrise - 1.5 * HOUR), { type: 'sunrise', time: sys.sunrise });
    assert.deepEqual(sunEvent(sys, sys.sunrise + HOUR), { type: 'sunrise', time: sys.sunrise });
  });

  it('gives sunset around sunset', () => {
    assert.deepEqual(sunEvent(sys, sys.sunset - HOUR), { type: 'sunset', time: sys.sunset });
  });

  it('gives nothing in the middle of the day or night', () => {
    assert.equal(sunEvent(sys, sys.sunrise + 6 * HOUR), null);
    assert.equal(sunEvent(sys, sys.sunset + 5 * HOUR), null); // Not this morning's sunrise
  });

  it('copes with missing data', () => {
    assert.equal(sunEvent(undefined, 0), null);
  });
});
