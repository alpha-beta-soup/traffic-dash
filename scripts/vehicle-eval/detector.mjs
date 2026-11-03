// What the evaluations share: the detector (server/vehicleDetector.js), and the frames in cache/
// and running it over them
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cacheDir = path.join(root, 'cache');

export { DEFAULT_MODEL, VEHICLES, loadDetector } from '../../server/vehicleDetector.js';

export const frameTime = name => Number(path.basename(name, '.jpg'));

// A camera's cached frames, oldest first
export const cameraFrames = async id => (await fs.readdir(path.join(cacheDir, id)).catch(() => []))
  .filter(f => f.endsWith('.jpg')).sort().map(f => path.join(cacheDir, id, f));

// Camera names, if the dev server is running; ids otherwise
export async function cameraNames() {
  try {
    const res = await fetch('http://localhost:3000/api/cameras', { signal: AbortSignal.timeout(5000) });
    return new Map((await res.json()).map(c => [String(c.id), c.name]));
  } catch {
    return new Map();
  }
}

// Runs the detector over frames not yet in `store` (keyed by path in cache/), keeping each
// frame's size and boxes ([x, y, w, h, class]); saved to storeFile as it goes, so an interrupted
// run picks up where it left off
export async function detectFrames(detector, files, store, storeFile, { threshold, tile }) {
  let fresh = 0;
  for (const file of files) {
    const key = path.relative(cacheDir, file);
    if (store[key]?.threshold === threshold) continue;
    // The server prunes old frames as it goes, so a frame listed earlier may be gone
    const detected = await detector.detect(file, threshold, { tile }).catch(() => null);
    if (!detected) continue;
    const { found, width, height } = detected;
    store[key] = {
      threshold, width, height, boxes: found.map(v => [v.x, v.y, v.w, v.h].map(Math.round).concat(v.cls)),
    };
    if (++fresh % 10 === 0) {
      process.stdout.write('.');
      await fs.writeFile(storeFile, JSON.stringify(store));
    }
  }
  await fs.writeFile(storeFile, JSON.stringify(store));
}
