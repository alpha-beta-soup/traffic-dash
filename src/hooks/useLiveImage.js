import { useCallback, useEffect, useRef, useState } from 'react';

import { MAX_REFRESH, MIN_REFRESH } from '../consts';
import { randomInt } from '../utils';

// Polls a camera's latest image through the server, at a random interval in the refresh range
// so cameras don't all ask at once. Each fetch also lets the server cache a new frame for loops.
// Returns { live: { src, time, id } | null, failed, stockImage }:
// - live: the latest image; after switching to another camera, the previous camera's (see its
//   id) until the new one's arrives, so the page doesn't blank in between
// - failed: the last fetch failed (any earlier image stays in `live`)
// - stockImage: NZTA is serving its stock "temporarily unavailable" image (the server spots
//   it) though the camera isn't marked offline; polling carries on, so this clears itself
// Not polled while the camera is marked offline or under maintenance (`unavailable`).
export default function useLiveImage(camera, unavailable) {
  const { id, name } = camera;
  const [live, setLive] = useState(null);
  const [failed, setFailed] = useState(false);
  const [stockImage, setStockImage] = useState(!!camera.unavailable);
  const objectUrl = useRef(null);
  const [shownId, setShownId] = useState(id);
  if (shownId !== id) {
    setShownId(id);
    setFailed(false);
    setStockImage(!!camera.unavailable);
  }

  // `isCurrent` is false once the camera has changed or stopped polling: a late answer for the
  // previous camera mustn't replace the new camera's image
  const loadImage = useCallback(async (isCurrent) => {
    try {
      const res = await fetch(`/api/cameras/${id}/image`);
      if (!isCurrent()) return;
      if (res.status === 503) {
        setStockImage(true);
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const time = new Date(res.headers.get('last-modified') ?? Date.now());
      const blob = await res.blob();
      if (!isCurrent()) return;
      const src = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = src;
      setLive({ src, time, id });
      setFailed(false);
      setStockImage(false);
    } catch (err) {
      if (!isCurrent()) return;
      console.error(`Camera ${id} (${name}):`, err);
      setFailed(true);
    }
  }, [id, name]);

  useEffect(() => {
    if (unavailable) return undefined;
    let current = true;
    const load = () => loadImage(() => current);
    load();
    const timer = setInterval(load, randomInt(MIN_REFRESH, MAX_REFRESH));
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [loadImage, unavailable]);

  useEffect(() => () => objectUrl.current && URL.revokeObjectURL(objectUrl.current), []);

  return { live, failed, stockImage };
}
