// Offline prototype: two measures of the traffic in view over time, per camera, charted one above
// the other on the same time axis:
// - Detected vehicles: the detector's count (in tiles too, for small, far-off vehicles).
// - Occupancy: how much of the road differs from a car-free baseline, weighted for perspective
//   so a far-off vehicle counts about as much as a near one: roughly vehicle-equivalents. It
//   sees vehicles too small or too bunched up to detect, as in a far-off queue.
//
// Occupancy, per camera:
// 1. Baselines: every 30 minutes, each pixel's median over the emptiest frames (fewest vehicles
//    detected) within 3 hours either side: the road without its traffic, in that light. How
//    much a pixel varies across those frames (swaying trees, compression) sets how far a frame
//    must differ there to count. Frames are compared in units of their own spread of
//    brightness, so the camera's exposure changing doesn't count; less the light's own change
//    across the road (shade, sun: the median difference in each cell of CELL px, smoothed;
//    vehicles are small and sharp, light changes broad); and with the baseline's range over each
//    pixel's neighbours, so the camera shaking a pixel doesn't count either.
// 2. Perspective: how big a car looks at each spot, from the cars detected there. Each differing
//    pixel adds 1 ÷ a car's area at that spot, so a vehicle anywhere adds about 1.
// 3. Only the road counts: where cars have been detected. Pixels that differ in most frames (the
//    clock overlay) are left out too.
//
//   npm run eval:occupancy -- [--cameras 3] [--tile 320] [--window 10] [--threshold 0.4]
//
// Output: eval-output/occupancy/index.html. Detections are kept in
// eval-output/detections-tile<px>.json (shared with road.mjs), so a rerun only runs the detector
// on frames it hasn't seen.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

import trend from '../../src/utils/trend.js';
import { chart, page } from './charts.mjs';
import {
  DEFAULT_MODEL, cacheDir, cameraFrames, cameraNames, detectFrames, frameTime, loadDetector, root,
} from './detector.mjs';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    cameras: { type: 'string', default: '3' }, // The cameras with the most cached frames
    tile: { type: 'string', default: '320' }, // Tile size (px) to also detect in; 0 for none
    window: { type: 'string', default: '10' }, // Minutes the rolling mean spans
    threshold: { type: 'string', default: '0.4' },
    out: { type: 'string', default: path.join(root, 'eval-output', 'occupancy') },
  },
});
const threshold = Number(args.threshold);
const tile = Number(args.tile);
const windowMs = Number(args.window) * 60_000;

const WORK_WIDTH = 480; // px: frames are compared at this width
const BLOCK = 30 * 60_000; // A baseline this often
const NEAR = 180 * 60_000; // From frames this close to it
const EMPTIEST = 9; // The baseline is the median of this many of them
const MIN_EMPTIEST = 5;
const MIN_DIFF = 0.25; // A pixel differs by at least this, in its frame's brightness spreads
const NOISE = 4; // And by this many times its own variation in the baseline's frames
const MIN_AREA = 3; // px² (at WORK_WIDTH): where a car looks smaller, it isn't counted
const BOX_FILL = 0.7; // Of a car's box, the car: about, from the side and behind
const ALWAYS = 0.5; // Pixels differing in more than this share of frames are left out
const CELL = 16; // px (at WORK_WIDTH): the light's change is worked out over cells this size
const MIN_CELL_ROAD = 0.25; // Of a cell's pixels on the road, to work the light out from it
const ROAD_BOXES = 3; // Pixels inside this many detected cars' boxes are road
const CAR = 2; // COCO class

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
};

// Each frame, grey and blurred a little (against compression noise), at the working size, with
// its brightness's mean and spread
const loadFrames = (files, width, height) => Promise.all(files.map(async (file) => {
  const data = await sharp(file).greyscale().resize(width, height, { fit: 'fill' }).blur(0.8)
    .extractChannel(0).raw().toBuffer();
  let sum = 0;
  let squares = 0;
  for (const v of data) {
    sum += v;
    squares += v * v;
  }
  const mean = sum / data.length;
  return { data, mean, spread: Math.sqrt(squares / data.length - mean * mean) || 1 };
}));

// The lowest and highest of each pixel's 3×3 neighbourhood
function neighbourRange(values, width) {
  const low = new Float32Array(values.length);
  const high = new Float32Array(values.length);
  const rows = values.length / width;
  for (let p = 0; p < values.length; p++) {
    const x = p % width;
    const y = Math.floor(p / width);
    let lo = Infinity;
    let hi = -Infinity;
    for (let dy = Math.max(0, y - 1); dy <= Math.min(rows - 1, y + 1); dy++) {
      for (let dx = Math.max(0, x - 1); dx <= Math.min(width - 1, x + 1); dx++) {
        const v = values[dy * width + dx];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    low[p] = lo;
    high[p] = hi;
  }
  return { low, high };
}

// The median of each pixel over `frames`, normalised (`level`), and its neighbourhood's range (`low`,
// `high`); raw (`image`, to look at); and how far each pixel varies about it (`noise`, a robust
// standard deviation)
function baseline(frames, width) {
  const n = frames[0].data.length;
  const level = new Float32Array(n);
  const noise = new Float32Array(n);
  const image = Buffer.alloc(n);
  const values = new Float32Array(frames.length);
  const raw = new Uint8Array(frames.length);
  for (let p = 0; p < n; p++) {
    frames.forEach((f, j) => {
      values[j] = (f.data[p] - f.mean) / f.spread;
      raw[j] = f.data[p];
    });
    const middle = median(values);
    level[p] = middle;
    image[p] = median(raw);
    noise[p] = 1.4826 * median(values.map(v => Math.abs(v - middle)));
  }
  return {
    level, ...neighbourRange(level, width), noise, image,
  };
}

// The road, and how big a car looks on it: where at least ROAD_BOXES cars' boxes have been, and
// their typical (geometric mean) area there, in working px. From where the cars are, rather than
// a model of the view, so curving roads and roads at several distances need nothing special.
// Returns 1 ÷ a car's area for each pixel: 0 off the road, and where cars are too small to count.
function carSizes(stored, sx, sy, width, height) {
  const covered = new Uint16Array(width * height);
  const logArea = new Float32Array(width * height);
  stored.forEach(s => s.boxes.filter(b => b[4] === CAR).forEach(([x, y, w, h]) => {
    const [x0, x1] = [Math.max(0, Math.floor(x * sx)), Math.min(width - 1, Math.ceil((x + w) * sx))];
    const [y0, y1] = [Math.max(0, Math.floor(y * sy)), Math.min(height - 1, Math.ceil((y + h) * sy))];
    const area = Math.log(Math.max(1e-3, w * sx * h * sy * BOX_FILL));
    for (let row = y0; row <= y1; row++) {
      for (let col = x0; col <= x1; col++) {
        covered[row * width + col]++;
        logArea[row * width + col] += area;
      }
    }
  }));
  return Float32Array.from(covered, (n, p) => {
    const area = n >= ROAD_BOXES ? Math.exp(logArea[p] / n) : 0;
    return area >= MIN_AREA ? 1 / area : 0;
  });
}

// How much the light has changed at each pixel since the baseline: the median difference over the
// road in each cell, interpolated between cells' centres (cells with too little road take the
// whole road's)
function lightChange(frame, base, onRoad, width) {
  const n = frame.data.length;
  const rows = n / width;
  const [cols, cellRows] = [Math.ceil(width / CELL), Math.ceil(rows / CELL)];
  const cells = Array.from({ length: cols * cellRows }, () => []);
  const all = [];
  for (let p = 0; p < n; p++) {
    if (!onRoad[p]) continue;
    const d = (frame.data[p] - frame.mean) / frame.spread - base.level[p];
    cells[Math.floor(p / width / CELL) * cols + Math.floor((p % width) / CELL)].push(d);
    all.push(d);
  }
  const overall = all.length ? median(all) : 0;
  const shift = cells.map(c => (c.length >= MIN_CELL_ROAD * CELL * CELL ? median(c) : overall));
  const at = (cx, cy) => shift[Math.min(cellRows - 1, Math.max(0, cy)) * cols + Math.min(cols - 1, Math.max(0, cx))];
  const field = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const fx = (p % width) / CELL - 0.5;
    const fy = Math.floor(p / width) / CELL - 0.5;
    const [cx, cy] = [Math.floor(fx), Math.floor(fy)];
    const [tx, ty] = [fx - cx, fy - cy];
    field[p] = (at(cx, cy) * (1 - tx) + at(cx + 1, cy) * tx) * (1 - ty) + (at(cx, cy + 1) * (1 - tx) + at(cx + 1, cy + 1) * tx) * ty;
  }
  return field;
}

// Which pixels differ from the baseline (outside its range over their neighbours, once the light's
// change is taken off), as 1s; specks (fewer than 2 differing neighbours of 4) dropped
function differing(frame, base, onRoad, width) {
  const n = frame.data.length;
  const light = lightChange(frame, base, onRoad, width);
  const raw = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const v = (frame.data[p] - frame.mean) / frame.spread - light[p];
    const off = v < base.low[p] ? base.low[p] - v : Math.max(0, v - base.high[p]);
    raw[p] = off > Math.max(MIN_DIFF, NOISE * base.noise[p]) ? 1 : 0;
  }
  const kept = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!raw[p]) continue;
    const x = p % width;
    kept[p] = ((x > 0 && raw[p - 1]) || 0) + ((x < width - 1 && raw[p + 1]) || 0) + (raw[p - width] || 0) + (raw[p + width] || 0) >= 2 ? 1 : 0;
  }
  return kept;
}

// A frame to look at: grey, the left-out area darkened, differing pixels counted in blue
async function overlay(frame, diff, counted, width, height, file) {
  const rgb = Buffer.alloc(width * height * 3);
  for (let p = 0; p < width * height; p++) {
    const g = frame.data[p];
    const [r, gg, b] = !counted[p] ? [g * 0.35, g * 0.35, g * 0.35] : diff[p] ? [57, 135, 229] : [g, g, g];
    rgb.set([r, gg, b], p * 3);
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } }).jpeg({ quality: 85 }).toFile(file);
}

async function camera(id, files, store, name) {
  const stored = files.map(f => store[path.relative(cacheDir, f)]);
  const times = files.map(frameTime);
  const { width, height } = stored[0];
  const workHeight = Math.round((WORK_WIDTH * height) / width);
  const [sx, sy] = [WORK_WIDTH / width, workHeight / height];
  const weights = carSizes(stored, sx, sy, WORK_WIDTH, workHeight);
  const onRoad = weights.map(w => (w > 0 ? 1 : 0));
  if (!onRoad.some(Boolean)) return `<h2>${name}</h2><p class="sub">Too few cars detected to find the road.</p>`;
  const frames = await loadFrames(files, WORK_WIDTH, workHeight);

  // A baseline every BLOCK, from the emptiest frames near it; each frame compared with the nearest
  const blocks = [];
  for (let t = times[0]; t <= times.at(-1) + BLOCK / 2; t += BLOCK) {
    const near = times.map((time, i) => i).filter(i => Math.abs(times[i] - t) <= NEAR)
      .sort((a, b) => stored[a].boxes.length - stored[b].boxes.length || Math.abs(times[a] - t) - Math.abs(times[b] - t))
      .slice(0, EMPTIEST);
    if (near.length >= MIN_EMPTIEST) blocks.push({ time: t, ...baseline(near.map(i => frames[i]), WORK_WIDTH) });
  }
  if (!blocks.length) return `<h2>${name}</h2><p class="sub">Too few frames for a baseline.</p>`;
  const nearest = time => blocks.reduce((a, b) => (Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a));
  const diffs = frames.map((f, i) => differing(f, nearest(times[i]), onRoad, WORK_WIDTH));

  // Counted: the road, where cars are big enough to count, and not always differing
  const often = new Float32Array(frames[0].data.length);
  diffs.forEach(d => d.forEach((v, p) => { often[p] += v; }));
  const counted = Uint8Array.from(often, (v, p) => (
    onRoad[p] && v / frames.length <= ALWAYS ? 1 : 0));
  const occupancy = diffs.map((d) => {
    let sum = 0;
    for (let p = 0; p < d.length; p++) if (d[p] && counted[p]) sum += weights[p];
    return sum;
  });

  const detected = trend(stored.map((s, i) => ({ time: times[i], value: s.boxes.length })), { window: windowMs });
  const occupied = trend(occupancy.map((value, i) => ({ time: times[i], value })), { window: windowMs });
  const axis = { start: times[0], end: times.at(-1), window: Number(args.window) };

  // To look at: the latest baseline, and the busiest frame by occupancy with what was counted
  const busiest = occupancy.indexOf(Math.max(...occupancy));
  await sharp(blocks.at(-1).image, { raw: { width: WORK_WIDTH, height: workHeight, channels: 1 } }).jpeg({ quality: 85 })
    .toFile(path.join(args.out, `${id}-baseline.jpg`));
  await overlay(frames[busiest], diffs[busiest], counted, WORK_WIDTH, workHeight, path.join(args.out, `${id}-busiest.jpg`));
  const roadShare = onRoad.reduce((a, b) => a + b, 0) / onRoad.length;
  console.log(` ${blocks.length} baselines; road ${Math.round(roadShare * 100)}% of the frame`);

  return `
  <h2>${name}</h2>
  <div class="grid">
    ${chart('Vehicles detected', detected, { ...axis, unit: 'vehicles' })}
    ${chart('Occupancy', occupied, { ...axis, unit: 'vehicle-equivalents', digits: 1 })}
  </div>
  <details><summary>How occupancy was measured here</summary>
    <p>${blocks.length} baselines, each from the ${EMPTIEST} emptiest frames within ${NEAR / 3_600_000} hours. The road, and how big a car looks on it, from where cars have been detected: ${Math.round(roadShare * 100)}% of the frame.</p>
    <div class="grid">
      <figure><img src="${id}-baseline.jpg" alt="The latest baseline"><figcaption>The latest baseline</figcaption></figure>
      <figure><img src="${id}-busiest.jpg" alt="The busiest frame"><figcaption>The busiest frame (${new Date(times[busiest]).toLocaleTimeString('en-NZ')}): blue differs from the baseline and is counted; dark areas aren't counted</figcaption></figure>
    </div>
  </details>`;
}

const names = await cameraNames();
const ids = (await fs.readdir(cacheDir)).filter(name => /^\d+$/.test(name));
const withFrames = await Promise.all(ids.map(async id => ({ id, files: await cameraFrames(id) })));
const chosen = withFrames.sort((a, b) => b.files.length - a.files.length).slice(0, Number(args.cameras));

await fs.mkdir(args.out, { recursive: true });
const storeFile = path.join(root, 'eval-output', `detections-tile${tile}.json`);
const store = JSON.parse(await fs.readFile(storeFile, 'utf8').catch(() => '{}'));
const detector = await loadDetector(args.model, chosen[0]?.files[0]);
const sections = [];
for (const { id, files } of chosen) {
  const name = names.get(id) ?? `Camera ${id}`;
  process.stdout.write(`${name} (${files.length} frames) `);
  await detectFrames(detector, files, store, storeFile, { threshold, tile });
  // The frames still there now, that have been through the detector
  const current = (await cameraFrames(id)).filter(f => store[path.relative(cacheDir, f)]?.threshold === threshold);
  sections.push(await camera(id, current, store, name));
}
await fs.writeFile(path.join(args.out, 'index.html'), page(
  'Traffic in view: vehicles detected and occupancy',
  `Per camera, two measures over time on the same axis. Vehicles detected: the detector's count${tile ? `, in tiles of ${tile} px as well as the whole frame` : ''} (threshold ${threshold}). Occupancy: how much of the road differs from a car-free baseline, weighted so a far-off vehicle counts about as much as a near one; roughly vehicle-equivalents. Dots are frames; the line is the mean over a centred ${args.window}-minute window, with its 95% band.`,
  sections.join(''),
));
console.log(`Charts: ${path.join(args.out, 'index.html')}`);
