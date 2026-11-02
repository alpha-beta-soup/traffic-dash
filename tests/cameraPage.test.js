import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { cameraPath, matchRoute } from '../src/routes.js';
import { frameDelay } from '../src/hooks/usePlayer.js';
import nearbyEvents from '../src/utils/nearbyEvents.js';
import { ANIMATION_HOLD, ANIMATION_SPEEDUP } from '../src/consts/index.js';

describe('routes', () => {
  it('matches a camera\'s page', () => {
    assert.deepEqual(matchRoute('/camera/714'), { page: 'camera', id: 714 });
    assert.deepEqual(matchRoute('/camera/714/'), { page: 'camera', id: 714 });
    assert.equal(cameraPath(714), '/camera/714');
  });

  it('treats anything else as the dashboard', () => {
    for (const path of ['/', '/camera/', '/camera/abc', '/camera/714/extra', '/elsewhere']) {
      assert.deepEqual(matchRoute(path), { page: 'dashboard' }, path);
    }
  });
});

describe('frameDelay', () => {
  const frames = [0, 60_000, 120_000, 1_200_000, 1_260_000].map(time => ({ time }));

  it('plays each frame for its real gap to the next, sped up', () => {
    assert.equal(frameDelay(frames, 0), 60_000 / ANIMATION_SPEEDUP);
  });

  it('caps a long gap in the history, so it plays as a pause rather than a freeze', () => {
    assert.equal(frameDelay(frames, 2), 2000); // An 18-minute gap
  });

  it('holds the newest frame before starting again', () => {
    assert.equal(frameDelay(frames, 4), ANIMATION_HOLD);
  });
});

describe('nearbyEvents options', () => {
  const camera = { lat: -41, lon: 174 };
  const event = (id, impact, lonOffset) => ({ id, impact, geometry: { type: 'Point', coordinates: [174 + lonOffset, -41] } });
  const events = [event(1, 'Caution', 0.002), event(2, 'Delays', 0.01), event(3, 'Road Closed', 0.02)];

  it('can widen the radius and include every impact, most serious first', () => {
    const all = ['Road Closed', 'Delays', 'Vehicle Restrictions', 'Caution'];
    assert.deepEqual(nearbyEvents(camera, events, { radius: 1000, impacts: all }).map(e => e.id), [2, 1]);
    assert.deepEqual(nearbyEvents(camera, events, { radius: 2000, impacts: all }).map(e => e.id), [3, 2, 1]);
  });
});
