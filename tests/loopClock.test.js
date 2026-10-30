import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import loopFrame from '../src/utils/loopClock.js';
import { ANIMATION_FADE, ANIMATION_HOLD, ANIMATION_SPEEDUP, ANIMATION_WINDOW } from '../src/consts/index.js';

const SWEEP = ANIMATION_WINDOW / ANIMATION_SPEEDUP;
const CYCLE = ANIMATION_FADE + SWEEP + ANIMATION_HOLD;
const START = CYCLE * 150_000_000; // A cycle boundary, around 2021
const SWEEP_FROM = START - ANIMATION_WINDOW; // The real time shown when the sweep begins

// One frame a minute across the window, starting `offset` ms after its start
const frames = (offset = 0) => Array.from({ length: 30 }, (_, k) => ({ time: SWEEP_FROM + offset + k * 60_000 }));

describe('loopFrame', () => {
  it('holds the oldest frame while the restart crossfade plays', () => {
    const f = frames();
    const { frame, cycle, delay } = loopFrame(f, START + 100);
    assert.equal(frame, f[0]);
    assert.equal(cycle, START);
    // The next frame is a minute later: 60s / speedup after the fade
    assert.equal(delay, ANIMATION_FADE + 60_000 / ANIMATION_SPEEDUP - 100);
  });

  it('sweeps real time at the speed-up', () => {
    const f = frames();
    // Halfway through the sweep the playhead is 15 minutes into the window
    const { frame } = loopFrame(f, START + ANIMATION_FADE + SWEEP / 2);
    assert.equal(frame, f[15]);
  });

  it('holds the newest frame at the end of the cycle', () => {
    const f = frames();
    const now = START + ANIMATION_FADE + SWEEP + 100;
    const { frame, delay } = loopFrame(f, now);
    assert.equal(frame, f[29]);
    assert.equal(delay, START + CYCLE - now); // Until the restart
  });

  it('starts a new cycle', () => {
    assert.equal(loopFrame(frames(), START + CYCLE + 1).cycle, START + CYCLE);
  });

  it('keeps different cameras in sync by time, not frame number', () => {
    const a = frames(0);
    const b = frames(25_000); // A camera whose frames come 25s later in each minute
    for (const t of [0.1, 0.3, 0.6, 0.9]) {
      const now = START + ANIMATION_FADE + SWEEP * t;
      const shownA = loopFrame(a, now).frame.time;
      const shownB = loopFrame(b, now).frame.time;
      assert.ok(Math.abs(shownA - shownB) < 60_000, `at ${t} of the sweep: ${shownA} vs ${shownB}`);
    }
  });

  it('shows a camera\'s first frame until the playhead reaches it', () => {
    const late = frames().slice(10); // History only from 10 minutes into the window
    assert.equal(loopFrame(late, START + 100).frame, late[0]);
  });
});
