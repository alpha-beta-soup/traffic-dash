import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import nearestCameras, { compassPoint } from '../src/utils/nearestCameras.js';

// Around a point where 0.01° of latitude is about 1.1km
const camera = (id, dLat, dLon) => ({ id, lat: -41 + dLat, lon: 174 + dLon });

describe('nearestCameras', () => {
  const here = camera(1, 0, 0);
  const cameras = [
    here,
    camera(2, -0.01, 0), // ~1.1km south
    camera(3, 0, 0.02), // ~1.7km east
    camera(4, 0.005, -0.005), // ~0.7km north-west
    camera(5, 0.2, 0), // ~22km north: too far
  ];

  it('lists the nearest cameras first, with distance and compass direction', () => {
    const found = nearestCameras(here, cameras);
    assert.deepEqual(found.map(f => f.camera.id), [4, 2, 3]);
    assert.deepEqual(found.map(f => f.direction.label), ['NW', 'S', 'E']);
    assert.ok(Math.abs(found[1].km - 1.11) < 0.01, String(found[1].km));
  });

  it('leaves out cameras beyond the distance limit, and any excluded', () => {
    assert.deepEqual(nearestCameras(here, cameras, { exclude: [4] }).map(f => f.camera.id), [2, 3]);
    assert.deepEqual(nearestCameras(here, cameras, { maxKm: 30 }).map(f => f.camera.id), [4, 2, 3, 5]);
  });

  it('caps the list', () => {
    assert.equal(nearestCameras(here, cameras, { limit: 2 }).length, 2);
  });
});

describe('compassPoint', () => {
  it('rounds to the nearest of eight points', () => {
    assert.deepEqual(compassPoint(0), { label: 'N', bearing: 0 });
    assert.deepEqual(compassPoint(22), { label: 'N', bearing: 0 });
    assert.deepEqual(compassPoint(23), { label: 'NE', bearing: 45 });
    assert.deepEqual(compassPoint(225), { label: 'SW', bearing: 225 });
    assert.deepEqual(compassPoint(350), { label: 'N', bearing: 0 });
  });
});
