// What the evaluations share: the detector (server/vehicleDetector.js), and the frames in cache/
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
