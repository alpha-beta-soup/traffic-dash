// Where camera frames are cached, and how: shared by the server, which caches them, and the
// vehicle counter (counter/), which counts them. Frames are cache/<camera id>/<time, ms>.jpg,
// kept for CACHE_MAX_AGE_HOURS.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cache');

export const maxAge = () => (Number(process.env.CACHE_MAX_AGE_HOURS) || 6) * 3600_000;

export const frameTime = name => Number(path.basename(name, '.jpg'));

// Every camera's cached frames: [{ id, time, file }]
export const listAllFrames = async (dir = cacheDir) => {
  const cutoff = Date.now() - maxAge();
  const ids = (await fs.readdir(dir).catch(() => [])).filter(name => /^\d+$/.test(name));
  const perCamera = await Promise.all(ids.map(async id => (await fs.readdir(path.join(dir, id)).catch(() => []))
    .filter(name => name.endsWith('.jpg'))
    .map(name => ({ id, time: frameTime(name), file: path.join(dir, id, name) }))
    .filter(({ time }) => time >= cutoff)));
  return perCamera.flat();
};
