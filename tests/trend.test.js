import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import trend, { t95 } from '../src/utils/trend.js';

const MINUTE = 60_000;
const series = values => values.map((value, i) => ({ time: i * MINUTE, value }));

describe('trend', () => {
  it('averages over a centred window', () => {
    const [, , middle] = trend(series([10, 10, 10, 10, 10]), { window: 4 * MINUTE });
    assert.equal(middle.mean, 10);
    assert.equal(middle.n, 5);
    assert.equal(middle.low, 10); // No spread, no doubt
    assert.equal(middle.high, 10);
  });

  it('gives an interval from the spread in the window', () => {
    const points = trend(series([8, 12, 8, 12, 8, 12, 8]), { window: 6 * MINUTE });
    const { mean, low, high, n } = points[3];
    assert.equal(n, 7);
    assert.ok(Math.abs(mean - 9.714) < 0.01);
    // sd ~2.14: 95% half-width t(6) * sd / sqrt(7) ~ 1.98
    assert.ok(Math.abs(high - mean - 1.98) < 0.02);
    assert.ok(Math.abs(mean - low - 1.98) < 0.02);
  });

  it('leaves out windows with too few points', () => {
    const points = trend(series([5, 6]), { minPoints: 4 });
    assert.ok(points.every(p => p.mean === null));
  });

  it('never goes below zero', () => {
    const { low } = trend(series([0, 0, 9, 0, 0]), { window: 4 * MINUTE })[2];
    assert.equal(low, 0);
  });

  it('starts a new segment after a gap longer than the window', () => {
    const points = [0, 1, 2, 30, 31].map(m => ({ time: m * MINUTE, value: 1 }));
    assert.deepEqual(trend(points, { window: 10 * MINUTE }).map(p => p.segment), [0, 0, 0, 1, 1]);
  });

  it('uses t for small samples', () => {
    assert.equal(t95(1), 12.706);
    assert.equal(t95(100), 1.96);
  });
});
