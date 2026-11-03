// On-disk cache of camera frames, used to animate recent history.
// Frames are only cached for cameras someone is actually viewing, and are
// pruned once they are older than CACHE_MAX_AGE_HOURS.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { imageHash } from './placeholders.js';

export const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cache');

const maxAge = () => (Number(process.env.CACHE_MAX_AGE_HOURS) || 6) * 3600_000;
const enabled = () => process.env.CACHE_ENABLED !== 'false';

const frameName = date => `${date.getTime()}.jpg`;
const frameTime = name => Number(path.basename(name, '.jpg'));

const prune = async (dir) => {
  const cutoff = Date.now() - maxAge();
  const names = await fs.readdir(dir);
  await Promise.all(names
    .filter(name => !(frameTime(name) >= cutoff)) // Also clears files not named by timestamp
    .map(name => fs.rm(path.join(dir, name), { force: true })));
};

// Saves a frame; true if it's new (not already saved)
export const cacheFrame = async (cameraId, date, buffer) => {
  if (!enabled() || Number.isNaN(date.getTime())) return false;
  const dir = path.join(cacheDir, String(cameraId));
  const file = path.join(dir, frameName(date));
  try {
    await fs.mkdir(dir, { recursive: true });
    // Same Last-Modified means the camera hasn't produced a new frame
    await fs.writeFile(file, buffer, { flag: 'wx' });
    await prune(dir);
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') console.error(err.message);
    return false;
  }
};

// Removes a camera's cached frames whose content has the given hash (e.g. a placeholder image)
export const removeFrames = async (cameraId, hash) => {
  const dir = path.join(cacheDir, String(cameraId));
  try {
    const names = await fs.readdir(dir);
    await Promise.all(names.map(async (name) => {
      const file = path.join(dir, name);
      if (imageHash(await fs.readFile(file)) === hash) await fs.rm(file, { force: true });
    }));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(err.message);
  }
};

// Every camera's cached frames: [{ id, time, file }]
export const listAllFrames = async () => {
  const cutoff = Date.now() - maxAge();
  const ids = (await fs.readdir(cacheDir).catch(() => [])).filter(name => /^\d+$/.test(name));
  const perCamera = await Promise.all(ids.map(async id => (await fs.readdir(path.join(cacheDir, id)).catch(() => []))
    .map(name => ({ id, time: frameTime(name), file: path.join(cacheDir, id, name) }))
    .filter(({ time }) => time >= cutoff)));
  return perCamera.flat();
};

export const listFrames = async (cameraId) => {
  const id = String(Number(cameraId));
  const cutoff = Date.now() - maxAge();
  try {
    const names = await fs.readdir(path.join(cacheDir, id));
    return names
      .map(frameTime)
      .filter(time => time >= cutoff)
      .sort((a, b) => a - b)
      .map(time => ({ time, url: `/cache/${id}/${time}.jpg` }));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
};
