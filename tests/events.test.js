import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normaliseEvent, parseWkt } from '../server/normalise.js';
import { distanceTo } from '../src/utils/geometry.js';
import nearbyEvents from '../src/utils/nearbyEvents.js';

describe('parseWkt', () => {
  it('reads points, lines and multi-lines', () => {
    assert.deepEqual(parseWkt('POINT (176.1006 -37.6958)'), { type: 'Point', coordinates: [176.1006, -37.6958] });
    assert.deepEqual(parseWkt('LINESTRING (1 2, 3 4)'), { type: 'LineString', coordinates: [[1, 2], [3, 4]] });
    assert.deepEqual(parseWkt('MULTILINESTRING ((1 2, 3 4), (5 6, 7 8, 9 10))'), {
      type: 'MultiLineString', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 8], [9, 10]]],
    });
  });

  it('returns null for anything else', () => {
    assert.equal(parseWkt('POLYGON ((1 2, 3 4, 5 6, 1 2))'), null);
    assert.equal(parseWkt(''), null);
    assert.equal(parseWkt(undefined), null);
  });
});

describe('normaliseEvent', () => {
  const raw = {
    id: 566074,
    eventType: 'Area Warning',
    eventDescription: 'Crash',
    impact: 'Road Closed',
    planned: false,
    status: 'Active',
    locationArea: 'SH 6 Kawarau Gorge',
    eventComments: ' Due to a crash, State Highway 6 is closed. ',
    alternativeRoute: 'Detour via Crown Range Road',
    expectedResolution: 'Not Applicable',
    startDate: '2026-10-30T15:16:23+13:00',
    region: { id: 13, name: 'Otago' },
    geometry: 'MULTILINESTRING ((168.85 -44.98, 168.90 -45.00, 169.04 -45.05))',
  };

  it('reshapes an event, anchoring its icon mid-line', () => {
    const event = normaliseEvent(raw);
    assert.equal(event.cause, 'Crash');
    assert.equal(event.impact, 'Road Closed');
    assert.equal(event.comments, 'Due to a crash, State Highway 6 is closed.');
    assert.equal(event.alternative, 'Detour via Crown Range Road');
    assert.equal(event.resolution, null); // "Not Applicable"
    assert.equal(event.region, 'Otago');
    assert.deepEqual([event.lon, event.lat], [168.90, -45.00]);
    assert.equal(event.geometry.type, 'MultiLineString');
  });

  it('skips events whose geometry can\'t be read', () => {
    assert.equal(normaliseEvent({ ...raw, geometry: '' }), null);
  });
});

describe('distanceTo', () => {
  const camera = { lat: -41, lon: 174 };

  it('measures to a point', () => {
    const d = distanceTo(camera, { type: 'Point', coordinates: [174, -40.999] }); // 0.001° north
    assert.ok(Math.abs(d - 110.5) < 1, String(d));
  });

  it('measures to the nearest part of a line, not its ends', () => {
    // A line passing 0.001° east of the camera (about 84m), with both ends far away
    const d = distanceTo(camera, { type: 'LineString', coordinates: [[174.001, -40.9], [174.001, -41.1]] });
    assert.ok(Math.abs(d - 84) < 1, String(d));
  });
});

describe('nearbyEvents', () => {
  const camera = { lat: -41, lon: 174 };
  const event = (id, impact, lonOffset) => ({ id, impact, geometry: { type: 'Point', coordinates: [174 + lonOffset, -41] } });

  it('finds closures and delays within 500m, closures first, then nearest', () => {
    const found = nearbyEvents(camera, [
      event(1, 'Delays', 0.004), // ~340m
      event(2, 'Delays', 0.001), // ~84m
      event(3, 'Road Closed', 0.005), // ~420m
    ]);
    assert.deepEqual(found.map(e => e.id), [3, 2, 1]);
  });

  it('leaves out events further away, and routine caution events', () => {
    const found = nearbyEvents(camera, [
      event(1, 'Delays', 0.01), // ~840m
      event(2, 'Caution', 0.001),
      event(3, 'Vehicle Restrictions', 0.001),
    ]);
    assert.deepEqual(found, []);
  });
});
