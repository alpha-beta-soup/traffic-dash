import { useEffect, useState } from 'react';

import { ANIMATION_HOLD, ANIMATION_SPEEDUP } from '../consts';

const MIN_FRAME = 120; // ms
const MAX_FRAME = 2000; // ms: a long gap in the history plays as a pause, not a freeze

// How long to show frame `index` while playing: its real gap to the next frame, sped up, or a
// hold on the newest before starting again
export function frameDelay(frames, index) {
  if (index >= frames.length - 1) return ANIMATION_HOLD;
  const gap = frames[index + 1].time - frames[index].time;
  return Math.min(MAX_FRAME, Math.max(MIN_FRAME, gap / ANIMATION_SPEEDUP));
}

// Playback of a camera's cached frames (oldest first) that the viewer controls, for the camera
// page. Modes: 'live' (the latest image, no frame), 'playing' (looping), 'paused' (on a frame).
export default function usePlayer(frames) {
  const [mode, setMode] = useState('live');
  const [index, setIndex] = useState(0);
  const count = frames.length;
  const current = Math.max(0, Math.min(index, count - 1)); // The history can shrink as frames expire

  useEffect(() => {
    if (mode !== 'playing' || count < 2) return undefined;
    const timer = setTimeout(() => setIndex((current + 1) % count), frameDelay(frames, current));
    return () => clearTimeout(timer);
  }, [mode, current, count, frames]);

  const from = () => (mode === 'live' ? count - 1 : current); // Live is the newest frame
  return {
    mode,
    index: current,
    count,
    frame: mode === 'live' ? null : frames[current] ?? null,
    play: () => {
      if (count < 2) return;
      if (mode === 'live') setIndex(0); // From live, play the history from its start
      setMode('playing');
    },
    pause: () => {
      setIndex(from());
      setMode('paused');
    },
    live: () => setMode('live'),
    seek: (i) => {
      setIndex(i);
      setMode('paused');
    },
    step: (delta) => {
      if (!count) return;
      setIndex(Math.max(0, Math.min(count - 1, from() + delta)));
      setMode('paused');
    },
  };
}
