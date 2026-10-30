import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import cameraCongestion from '../src/utils/cameraCongestion.js';

// A camera at a fixed point; roads are short straight lines offset from it.
// At this latitude 0.001° of longitude is about 84m and 0.001° of latitude about 111m.
const LAT = -41.0;
const LON = 174.0;
const camera = (direction, id = 1) => ({ id, direction, lat: LAT, lon: LON });

// A road `east` metres east of the camera, running north–south through its latitude
const northSouth = (east, heading, props) => {
  const lon = LON + east / 84000;
  const [from, to] = heading === 'south' ? [LAT + 0.001, LAT - 0.001] : [LAT - 0.001, LAT + 0.001];
  return { properties: props, geometry: { type: 'LineString', coordinates: [[lon, from], [lon, to]] } };
};
// A road `north` metres north of the camera, running east–west
const eastWest = (north, heading, props) => {
  const lat = LAT + north / 111000;
  const [from, to] = heading === 'east' ? [LON - 0.001, LON + 0.001] : [LON + 0.001, LON - 0.001];
  return { properties: props, geometry: { type: 'LineString', coordinates: [[from, lat], [to, lat]] } };
};

describe('cameraCongestion', () => {
  it('uses the carriageway heading the way the camera looks', () => {
    const result = cameraCongestion([camera('Southbound')], [
      northSouth(40, 'south', { class: 'motorway', congestion: 'heavy' }),
      northSouth(20, 'north', { class: 'motorway', congestion: 'low' }), // Nearer, but the other way
    ]).get(1);
    assert.equal(result.level, 'heavy');
    assert.equal(result.directionMatched, true);
    assert.equal(result.segments.length, 1);
  });

  it('prefers the most important road nearby', () => {
    const result = cameraCongestion([camera('Southbound')], [
      northSouth(60, 'south', { class: 'motorway', congestion: 'low' }),
      northSouth(10, 'south', { class: 'primary', congestion: 'severe' }), // Nearer, but a lesser road
    ]).get(1);
    assert.equal(result.level, 'low');
  });

  it('never uses streets or service lanes', () => {
    const results = cameraCongestion([camera('Southbound')], [
      northSouth(10, 'south', { class: 'street', congestion: 'severe' }),
      northSouth(15, 'south', { class: 'service', congestion: 'severe' }),
    ]);
    assert.equal(results.has(1), false);
  });

  it('ignores roads more than 200m away', () => {
    const results = cameraCongestion([camera('Southbound')], [
      northSouth(300, 'south', { class: 'motorway', congestion: 'heavy' }),
    ]);
    assert.equal(results.has(1), false);
  });

  it('ignores segments with unknown congestion', () => {
    const results = cameraCongestion([camera('Southbound')], [
      northSouth(40, 'south', { class: 'motorway', congestion: 'unknown' }),
    ]);
    assert.equal(results.has(1), false);
  });

  it('falls back to both directions when none run the camera\'s way', () => {
    // NZTA calls some cameras "Northbound" on motorways that run east–west there
    const result = cameraCongestion([camera('Northbound')], [
      eastWest(30, 'east', { class: 'motorway', congestion: 'heavy' }),
      eastWest(-30, 'west', { class: 'motorway', congestion: 'heavy' }),
    ]).get(1);
    assert.equal(result.directionMatched, false);
    assert.equal(result.level, 'heavy');
    assert.equal(result.segments.length, 2);
  });

  it('scores a mix of congestion levels', () => {
    const result = cameraCongestion([camera('Southbound')], [
      northSouth(30, 'south', { class: 'motorway', congestion: 'low' }), // 3 of 3
      northSouth(50, 'south', { class: 'motorway', congestion: 'severe' }), // 0 of 3
    ]).get(1);
    assert.equal(result.score, 50); // (3 + 0) / (2 × 3)
    assert.equal(result.level, 'moderate'); // 50–74
  });

  it('matches each camera independently', () => {
    const results = cameraCongestion([camera('Southbound', 1), camera('Northbound', 2)], [
      northSouth(40, 'south', { class: 'motorway', congestion: 'heavy' }),
      northSouth(-40, 'north', { class: 'motorway', congestion: 'low' }),
    ]);
    assert.equal(results.get(1).level, 'heavy');
    assert.equal(results.get(2).level, 'low');
  });
});
