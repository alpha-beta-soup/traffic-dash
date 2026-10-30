import {
  ANIMATION_FADE,
  ANIMATION_HOLD,
  ANIMATION_SPEEDUP,
  ANIMATION_WINDOW,
} from '../consts';

// A shared playhead, derived from the wall clock alone, so every looping camera (in every
// tab) shows the same moment. Each cycle: hold the oldest moment while the restart
// crossfade plays, sweep the last ANIMATION_WINDOW at ANIMATION_SPEEDUP, then hold the present.
const SWEEP = ANIMATION_WINDOW / ANIMATION_SPEEDUP;
const CYCLE = ANIMATION_FADE + SWEEP + ANIMATION_HOLD;

const position = (now) => {
  const cycleStart = now - (now % CYCLE);
  const sweepFrom = cycleStart - ANIMATION_WINDOW; // Real time shown at the start of the sweep
  const swept = Math.min(Math.max(now - cycleStart - ANIMATION_FADE, 0), SWEEP);
  return { cycleStart, sweepFrom, playhead: sweepFrom + swept * ANIMATION_SPEEDUP };
};

// For frames sorted oldest first: the one to show now, and how long until that changes
export default function loopFrame(frames, now = Date.now()) {
  const { cycleStart, sweepFrom, playhead } = position(now);
  // The latest frame at or before the playhead; before a camera's first frame, show that
  let index = frames.findLastIndex(frame => frame.time <= playhead);
  if (index < 0) index = 0;
  const next = frames[index + 1];
  let changesAt = cycleStart + CYCLE; // The restart
  if (next && next.time <= cycleStart) {
    changesAt = Math.min(changesAt, cycleStart + ANIMATION_FADE + (next.time - sweepFrom) / ANIMATION_SPEEDUP);
  }
  return { frame: frames[index], cycle: cycleStart, delay: Math.max(changesAt - now, 0) };
}
