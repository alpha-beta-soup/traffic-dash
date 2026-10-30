// Recognises the stock image NZTA serves for a camera that isn't working ("This webcam is
// temporarily unavailable"), which can appear before the camera list marks it offline.
// Known placeholders are listed by hash; as a backstop, an image served byte-for-byte by two
// or more different cameras must be a stock image too, as real camera images never match.
import { createHash } from 'node:crypto';

const KNOWN = new Set([
  'd5b5811e2185b878ba0c21d16e4266d8a2cd1cd461789befbbd1f40d69f17346', // "This webcam is temporarily unavailable…"
]);
const seenBy = new Map(); // image hash -> Set of camera ids

export const imageHash = buffer => createHash('sha256').update(buffer).digest('hex');

export const isPlaceholder = (hash, cameraId) => {
  if (KNOWN.has(hash)) return true;
  const cameras = seenBy.get(hash) ?? new Set();
  cameras.add(cameraId);
  seenBy.set(hash, cameras);
  if (cameras.size < 2) return false;
  if (!KNOWN.has(hash)) console.log(`Treating image ${hash.slice(0, 12)}… as a placeholder: served by cameras ${[...cameras].join(', ')}`);
  KNOWN.add(hash);
  seenBy.delete(hash);
  return true;
};

// Only recent hashes need remembering for the duplicate check
setInterval(() => seenBy.clear(), 60 * 60_000).unref();
