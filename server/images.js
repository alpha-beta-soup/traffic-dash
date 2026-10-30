// Shared in-memory store of the latest image per camera, so the number of requests
// to trafficnz.info doesn't grow with the number of people watching.
// - An image fetched less than FRESH_MS ago is served as-is
// - Concurrent requests for the same camera share one upstream fetch
// - Refreshes are conditional (If-None-Match), so an unchanged image costs a 304
// - NZTA's stock "unavailable" image is flagged (placeholder), and never cached as a frame
import { cacheFrame, removeFrames } from './cache.js';
import { imageHash, isPlaceholder } from './placeholders.js';

const FRESH_MS = 10_000;
const IDLE_MS = 5 * 60_000; // Forget cameras nobody has asked for in this long

const images = new Map(); // camera id -> { buffer, etag, lastModified, placeholder, fetchedAt, usedAt, pending }

const refresh = async (camera, entry) => {
  const res = await fetch(camera.imageUrl, {
    headers: entry.etag ? { 'If-None-Match': entry.etag } : {},
    signal: AbortSignal.timeout(15000),
  });
  if (res.status !== 304) {
    if (!res.ok) throw Object.assign(new Error(`Camera ${camera.id} image responded ${res.status}`), { status: res.status });
    entry.buffer = Buffer.from(await res.arrayBuffer());
    entry.etag = res.headers.get('etag');
    entry.lastModified = res.headers.get('last-modified');
    const hash = imageHash(entry.buffer);
    const wasPlaceholder = entry.placeholder;
    entry.placeholder = isPlaceholder(hash, camera.id);
    if (!entry.placeholder) await cacheFrame(camera.id, entry.lastModified ? new Date(entry.lastModified) : new Date(), entry.buffer);
    else if (!wasPlaceholder) await removeFrames(camera.id, hash); // Any saved before it was recognised
  }
  entry.fetchedAt = Date.now();
};

export const getImage = async (camera) => {
  let entry = images.get(camera.id);
  if (!entry) {
    entry = {};
    images.set(camera.id, entry);
  }
  entry.usedAt = Date.now();
  if (entry.buffer && Date.now() - entry.fetchedAt < FRESH_MS) return entry;
  entry.pending ??= refresh(camera, entry).finally(() => { entry.pending = null; });
  try {
    await entry.pending;
  } catch (err) {
    if (!entry.buffer) throw err;
    // Serve the last good image (its Last-Modified shows its age), and back off before retrying
    console.error(err.message);
    entry.fetchedAt = Date.now();
  }
  return entry;
};

// Whether the camera's latest image (if anyone has looked recently) was the stock placeholder
export const showingPlaceholder = id => !!images.get(id)?.placeholder;

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS;
  images.forEach((entry, id) => {
    if (entry.usedAt < cutoff && !entry.pending) images.delete(id);
  });
}, 60_000).unref();
