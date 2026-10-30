import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import snapEvents, { smooth } from '../src/utils/snapEvents.js';

// Around a point where 0.001° of longitude is about 84m and 0.001° of latitude about 111m
const LAT = -41.0;
const LON = 174.0;
const east = metres => LON + metres / 84000;
const north = metres => LAT + metres / 111000;

// An event line running north–south, 2km long, `offset` metres east of LON
const event = (offset, props = {}) => ({
  id: 1,
  impact: 'Delays',
  lat: LAT,
  lon: LON,
  geometry: { type: 'LineString', coordinates: [[east(offset), north(-1000)], [east(offset), north(1000)]] },
  ...props,
});
// A road running north–south at `x` metres east, as a few segments
const northSouthRoad = (x, props = { class: 'trunk', congestion: 'low' }) => ({
  properties: props,
  geometry: { type: 'LineString', coordinates: [-900, -300, 300, 900].map(y => [east(x), north(y)]) },
});
const eastWestRoad = (y, props = { class: 'trunk', congestion: 'low' }) => ({
  properties: props,
  geometry: { type: 'LineString', coordinates: [[east(-500), north(y)], [east(500), north(y)]] },
});

describe('snapEvents', () => {
  it('draws an event on the road it runs along, though its line is off the road', () => {
    const { snapped, fallback } = snapEvents([event(40)], [northSouthRoad(0)]); // Line 40m off the road
    assert.equal(snapped.length, 1);
    assert.equal(snapped[0].geometry.coordinates.length, 4); // The whole road: all three segments
    assert.equal(fallback.length, 0);
    assert.deepEqual(snapped[0].properties, { id: 1, impact: 'Delays' });
  });

  it('ignores roads too far away', () => {
    const { snapped, fallback } = snapEvents([event(200)], [northSouthRoad(0)]);
    assert.equal(snapped.length, 0);
    assert.equal(fallback.length, 1);
  });

  it('fills the gap where the event\'s line strays from the road', () => {
    // The line follows the road, swings 300m away in the middle, then comes back
    const swerve = event(0, { geometry: { type: 'LineString', coordinates: [
      [east(10), north(-1000)], [east(10), north(-400)], [east(300), north(-100)], [east(300), north(100)],
      [east(10), north(400)], [east(10), north(1000)],
    ] } });
    const road = { properties: { class: 'trunk', congestion: 'low' }, geometry: { type: 'LineString',
      coordinates: [-900, -600, -300, 0, 300, 600, 900].map(y => [east(0), north(y)]) } };
    const { snapped } = snapEvents([swerve], [road]);
    assert.equal(snapped.length, 1);
    assert.equal(snapped[0].geometry.coordinates.length, 7); // Including the middle, away from the line
  });

  it('ignores roads crossing the line rather than running along it', () => {
    const { snapped } = snapEvents([event(0)], [eastWestRoad(0)]);
    assert.equal(snapped.length, 0);
  });

  it('ignores streets and service lanes', () => {
    const { snapped } = snapEvents([event(10)], [northSouthRoad(0, { class: 'street', congestion: 'low' })]);
    assert.equal(snapped.length, 0);
  });

  it('leaves point events alone', () => {
    const point = { id: 2, impact: 'Caution', lat: LAT, lon: LON, geometry: { type: 'Point', coordinates: [LON, LAT] } };
    assert.deepEqual(snapEvents([point], [northSouthRoad(0)]), { snapped: [], fallback: [] });
  });

  it('falls back to the event\'s own line, smoothed, when there are no roads', () => {
    const { fallback } = snapEvents([event(0, {
      geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 0], [1, 1]]] },
    })], []);
    assert.equal(fallback[0].geometry.type, 'MultiLineString');
    assert.ok(fallback[0].geometry.coordinates[0].length > 3);
  });
});

describe('smooth', () => {
  it('cuts corners, keeping the ends', () => {
    const line = smooth([[0, 0], [4, 0], [4, 4]], 1);
    assert.deepEqual(line, [[0, 0], [1, 0], [3, 0], [4, 1], [4, 3], [4, 4]]);
  });

  it('leaves straight two-point lines as they are', () => {
    assert.deepEqual(smooth([[0, 0], [4, 0]]), [[0, 0], [4, 0]]);
  });
});
