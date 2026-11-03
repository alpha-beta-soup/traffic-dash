// Vehicle counts for camera frames: each frame the server caches is counted by the detector
// (server/vehicleDetector.js), one at a time in the background, new frames before old ones.
// Counts are kept per camera in vehicle-counts/<id>.json for COUNTS_DAYS, longer than the
// frames: they're tiny, and a longer history can say what's usual. Off unless the model file is
// there (VEHICLE_MODEL, by default models/dfine_s_coco.onnx).
//
// Parked vehicles (yards, service lanes, the verge) are left out: the same ones in every frame,
// they'd be a floor under the count that flattens its rises and falls (see
// scripts/vehicle-eval/readme.md). A vehicle is parked if it's been in the same place in most of
// the camera's frames within PARKED_WINDOW, of those counted so far: the earlier ones, for a new
// frame. Queued traffic creeps along between frames a minute apart, so isn't.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_MODEL, loadDetector } from './vehicleDetector.js';

export const countsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vehicle-counts');
const THRESHOLD = 0.4; // Detection score counted as a vehicle (see scripts/vehicle-eval)
const COUNTS_DAYS = () => Number(process.env.VEHICLE_COUNTS_DAYS) || 7;
const MAX_QUEUE = 1000; // Beyond this, the oldest waiting frames are dropped
// Frames are looked at in overlapping tiles of about this many px as well as whole: about half as
// many vehicles again, mostly small and far off, at about 7 times the cost (see
// vehicleDetector.js and scripts/vehicle-eval)
const TILE = 320;
const PARKED_WINDOW = 15 * 60_000;
const PARKED_SHARE = 0.6; // Of the frames near it with a box in the same place
const PARKED_MIN_FRAMES = 6; // Near it, to judge
const SAME_PLACE = 0.5; // Intersection over union of two boxes in the same place
const MAX_RECENT = 120; // Frames' boxes kept per camera, to judge parking by

let state = null; // { detector: Promise, dir, saveDelay }, once started
const counts = new Map(); // camera id -> Map(time -> count)
const recent = new Map(); // camera id -> Map(time -> boxes), the latest counted frames'
const queue = []; // [{ id, time, image }]: new frames at the front, the backlog behind
let running = false;
const unsaved = new Set();
let saveTimer = null;

export const vehiclesEnabled = () => !!state;

const cameraCounts = (id) => {
  if (!counts.has(id)) counts.set(id, new Map());
  return counts.get(id);
};

const save = async () => {
  saveTimer = null;
  const ids = [...unsaved];
  unsaved.clear();
  await fs.mkdir(state.dir, { recursive: true });
  await Promise.all(ids.map(id => fs.writeFile(path.join(state.dir, `${id}.json`), JSON.stringify([...cameraCounts(id)]))));
};

const record = (id, time, count) => {
  const cutoff = Date.now() - COUNTS_DAYS() * 86_400_000;
  const map = cameraCounts(id);
  map.set(time, count);
  for (const t of map.keys()) if (t < cutoff) map.delete(t);
  unsaved.add(id);
  saveTimer ??= setTimeout(() => save().catch(err => console.error(`Saving vehicle counts: ${err.message}`)), state.saveDelay);
};

const samePlace = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 && (w * h) / (a.w * a.h + b.w * b.h - w * h) > SAME_PLACE;
};

// How many of a frame's vehicles aren't parked; keeps its boxes to judge later frames by
const moving = (id, time, found) => {
  const boxes = found.map(({
    x, y, w, h,
  }) => ({
    x, y, w, h,
  }));
  if (!recent.has(id)) recent.set(id, new Map());
  const frames = recent.get(id);
  const near = [...frames].filter(([t]) => Math.abs(t - time) <= PARKED_WINDOW).map(([, b]) => b);
  frames.set(time, boxes);
  if (frames.size > MAX_RECENT) frames.delete(Math.min(...frames.keys()));
  const parked = box => near.length >= PARKED_MIN_FRAMES
    && near.filter(other => other.some(b => samePlace(b, box))).length / near.length >= PARKED_SHARE;
  return boxes.filter(box => !parked(box)).length;
};

const run = async () => {
  if (running) return;
  running = true;
  try {
    const detector = await state.detector;
    while (queue.length) {
      const { id, time, image } = queue.shift();
      if (cameraCounts(id).has(time)) continue;
      try {
        const { found } = await detector.detect(image, THRESHOLD, { tile: TILE });
        record(id, time, moving(id, time, found));
      } catch (err) {
        console.error(`Counting vehicles in camera ${id}'s ${new Date(time).toISOString()} frame: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
};

// Counts a frame (its image as a Buffer or a file path) when the detector gets to it: new frames
// go first, backlog frames (`backlog: true`) after
export const countFrame = (id, time, image, { backlog = false } = {}) => {
  if (!state || cameraCounts(String(id)).has(time)) return;
  const job = { id: String(id), time, image };
  if (backlog) queue.push(job);
  else queue.unshift(job);
  if (queue.length > MAX_QUEUE) queue.length = MAX_QUEUE;
  run().catch(err => console.error(`Vehicle counting: ${err.message}`));
};

// A camera's counts since `since` (ms), oldest first: [{ time, count }]
export const vehicleCounts = (id, since = 0) => [...cameraCounts(String(id))]
  .filter(([time]) => time >= since)
  .sort(([a], [b]) => a - b)
  .map(([time, count]) => ({ time, count }));

// Starts counting if the model is there: loads the counts kept so far, then counts `backlog`
// ([{ id, time, file }], e.g. frames cached before a restart) behind any new frames. Counts are
// written in batches, `saveDelay` ms after a change. A `detector` ({ detect }) and `dir` can be
// given instead, e.g. for tests.
export async function startVehicleCounting({
  backlog = [], detector, dir = countsDir, model = process.env.VEHICLE_MODEL || DEFAULT_MODEL, saveDelay = 5000,
} = {}) {
  if (!detector) {
    try {
      await fs.access(model);
    } catch {
      console.log(`Vehicle counting off: no model at ${model} (see scripts/vehicle-eval/readme.md)`);
      return false;
    }
  }
  const loading = detector ? Promise.resolve(detector) : loadDetector(model);
  state = { detector: loading, dir, saveDelay };
  loading.catch((err) => {
    console.error(`Vehicle counting off: ${err.message}`);
    state = null;
    queue.length = 0;
  });
  const files = await fs.readdir(dir).catch(() => []);
  await Promise.all(files.filter(f => f.endsWith('.json')).map(async (f) => {
    try {
      const stored = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      counts.set(path.basename(f, '.json'), new Map(stored));
    } catch (err) {
      console.error(`Reading ${f}: ${err.message}`);
    }
  }));
  backlog.forEach(({ id, time, file }) => countFrame(id, time, file, { backlog: true }));
  return true;
}

// For tests: forget everything, and stop
export const resetVehicleCounting = () => {
  state = null;
  counts.clear();
  recent.clear();
  queue.length = 0;
  unsaved.clear();
  clearTimeout(saveTimer);
  saveTimer = null;
};
