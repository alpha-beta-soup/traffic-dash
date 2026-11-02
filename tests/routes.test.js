import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cameraRoute, distanceAlong, normaliseJourneys, routeLine } from '../server/routes.js';

// A route heading due south from (174, -41) for about 22km, in two legs. Each leg is listed
// once per direction of travel, as NZTA does; only the I (increasing) legs make the route.
const journey = {
  id: 10,
  name: 'SH1',
  legs: [
    { name: 'Ngauranga to Terrace Tunnel', direction: 'I', sequenceNumber: 1, geometry: 'LINESTRING (174 -41.1, 174 -41.2)' },
    { name: 'Tawa to Ngauranga', direction: 'I', sequenceNumber: 0, geometry: 'LINESTRING (174 -41, 174 -41.1)' },
    { name: 'Ngauranga to Tawa', direction: 'D', sequenceNumber: 0, geometry: 'LINESTRING (174 -41.1, 174 -41)' },
    { name: 'Terrace Tunnel to Ngauranga', direction: 'D', sequenceNumber: 1, geometry: 'LINESTRING (174 -41.2, 174 -41.1)' },
  ],
};

describe('routes', () => {
  const routes = normaliseJourneys([journey]);

  it('measures distance along a route from its start', () => {
    const line = routeLine({ type: 'LineString', coordinates: [[174, -41], [174, -41.1], [174, -41.2]] });
    assert.ok(Math.abs(line.along[2] - 22239) < 50, String(line.along[2])); // 0.2° of latitude
    // A point 0.05° down the route, and a little off to the side
    assert.ok(Math.abs(distanceAlong(line, [174.001, -41.05]) - 5560) < 50);
  });

  it('follows the increasing legs in order, ignoring the other direction', () => {
    assert.ok(Math.abs(routes.get(10).line.along.at(-1) - 22239) < 50); // Not doubled back
  });

  it('names the route\'s ends after its first and last legs', () => {
    const route = routes.get(10);
    assert.equal(route.start, 'Tawa');
    assert.equal(route.end, 'Terrace Tunnel');
  });

  it('places a camera on its route, in km', () => {
    assert.deepEqual(cameraRoute(10, [174.0005, -41.15], routes), {
      id: 10, name: 'SH1', km: 16.7, start: 'Tawa', end: 'Terrace Tunnel',
    });
  });

  it('orders cameras by where they are along the route', () => {
    const kms = [[174, -41.18], [174, -41.02], [174, -41.11]].map(p => cameraRoute(10, p, routes).km);
    assert.deepEqual([...kms].sort((a, b) => a - b), [kms[1], kms[2], kms[0]]);
  });

  it('gives no route for a camera on an unknown journey', () => {
    assert.equal(cameraRoute(99, [174, -41], routes), null);
  });
});
