import { useEffect, useState } from 'react';

import { ANIMATION_WINDOW } from '../consts';
import { fetchJson, loopFrame } from '../utils';

// A camera's cached frames from the loop window, oldest first; reloaded whenever refreshKey changes
// (e.g. when a new live frame arrives, which the server will have cached)
export function useLoopFrames(id, enabled, refreshKey) {
  const [frames, setFrames] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    fetchJson(`/api/cameras/${id}/history`)
      .then((history) => {
        // A time window, not a frame count, so the loop never spans a gap in viewing
        const since = Date.now() - ANIMATION_WINDOW;
        const recent = history.filter(({ time }) => time >= since);
        recent.forEach(({ url }) => { new Image().src = url; }); // Preload
        setFrames(recent);
      })
      .catch(console.error);
  }, [id, enabled, refreshKey]);
  return frames;
}

// The frame to show now on the shared loop clock, so every looping camera stays in sync:
// { frame, cycle, fade } (fade: crossfade, as the loop has just started or restarted),
// or null when not looping. Re-renders only when this camera's frame changes.
export function useLoopPlayback(frames, enabled) {
  const [shown, setShown] = useState(null);
  const canLoop = enabled && frames.length >= 2;
  useEffect(() => {
    if (!canLoop) return undefined;
    let timer;
    const step = () => {
      const { frame, cycle, delay } = loopFrame(frames);
      setShown((current) => {
        if (current?.frame === frame && current.cycle === cycle) return current;
        // Crossfade when the loop starts or restarts; cut between frames within a sweep
        return { frame, cycle, fade: current?.cycle !== cycle };
      });
      timer = setTimeout(step, delay + 5); // Just past the change, so it's not recomputed early
    };
    step();
    return () => clearTimeout(timer);
  }, [canLoop, frames]);
  return canLoop ? shown : null;
}
