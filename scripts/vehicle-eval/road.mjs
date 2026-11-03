// Offline prototype: vehicles on the road, over time, per camera. The detector also finds parked
// cars (yards, car parks, the verge), the same ones in every frame: a floor under the count that
// makes its rises and falls look smaller than they are. So:
// 1. Parked: a vehicle with a box in the same place in most frames within STATIC_WINDOW either
//    side. Queued traffic still creeps along between frames a minute apart, so isn't.
// 2. The road: where moving vehicles' wheels (the bottom of their boxes) have been, in at least
//    ROAD_MIN of them; car parks drop out, as their cars mostly sit still.
// 3. Counted: moving vehicles with their wheels on the road.
//
//   npm run eval:road -- [--cameras 3] [--tile 320] [--window 10] [--threshold 0.4]
//
// Output: eval-output/road/index.html. Detections are shared with occupancy.mjs, in
// eval-output/detections-tile<px>.json.
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
    out: { type: 'string', default: path.join(root, 'eval-output', 'road') },
  },
});
const threshold = Number(args.threshold);
const tile = Number(args.tile);
const windowMs = Number(args.window) * 60_000;

const STATIC_WINDOW = 15 * 60_000;
const STATIC_SHARE = 0.6; // Of the frames near it with a box in the same place, to be parked
const STATIC_MIN_FRAMES = 6; // Near it, to judge
const SAME_PLACE = 0.5; // Intersection over union of two boxes in the same place
const WHEELS = 0.25; // The bottom of a box where its wheels are
const ROAD_MIN = 3; // Moving vehicles' wheels in a cell, for it to be road
const CELLS_ACROSS = 120; // The road is worked out on a grid this many cells wide

const sameBox = (a, b) => {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return false;
  return (w * h) / (a[2] * a[3] + b[2] * b[3] - w * h) > SAME_PLACE;
};

// Each frame's boxes, marked parked or moving
function markParked(frames) {
  return frames.map(({ time, boxes }, i) => ({
    time,
    boxes: boxes.map((box) => {
      const near = frames.filter((f, j) => j !== i && Math.abs(f.time - time) <= STATIC_WINDOW);
      const there = near.filter(f => f.boxes.some(b => sameBox(b, box))).length;
      return { box, parked: near.length >= STATIC_MIN_FRAMES && there / near.length >= STATIC_SHARE };
    }),
  }));
}

// The road, as a grid of cells: where at least ROAD_MIN moving vehicles' wheels have been
function findRoad(marked, width, height) {
  const cell = Math.max(2, Math.round(width / CELLS_ACROSS));
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const wheels = new Uint16Array(cols * rows);
  marked.forEach(f => f.boxes.filter(b => !b.parked).forEach(({ box: [x, y, w, h] }) => {
    for (let row = Math.floor((y + h * (1 - WHEELS)) / cell); row <= Math.min(rows - 1, Math.floor((y + h) / cell)); row++) {
      for (let col = Math.max(0, Math.floor(x / cell)); col <= Math.min(cols - 1, Math.floor((x + w) / cell)); col++) wheels[row * cols + col]++;
    }
  }));
  const road = Uint8Array.from(wheels, n => (n >= ROAD_MIN ? 1 : 0));
  const onRoad = ([x, y, w, h]) => {
    const col = Math.floor((x + w / 2) / cell);
    const row = Math.min(rows - 1, Math.floor((y + h) / cell));
    return col >= 0 && col < cols && row >= 0 && road[row * cols + col] === 1;
  };
  return {
    road, cell, cols, rows, onRoad,
  };
}

// The latest frame, the road tinted, parked vehicles outlined
async function picture(file, marked, road, out) {
  const { width, height } = await sharp(file).metadata();
  const cells = [];
  road.road.forEach((v, i) => v && cells.push(`<rect x="${(i % road.cols) * road.cell}" y="${Math.floor(i / road.cols) * road.cell}" width="${road.cell}" height="${road.cell}"/>`));
  const parked = marked.boxes.filter(b => b.parked).map(({ box: [x, y, w, h] }) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g fill="#3987e5" fill-opacity="0.35">${cells.join('')}</g>
    <g fill="none" stroke="#ff9100" stroke-width="2">${parked.join('')}</g></svg>`;
  await sharp(file).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(out);
}

async function camera(id, files, store, name) {
  const frames = files.map(f => ({ time: frameTime(f), ...store[path.relative(cacheDir, f)] }));
  const { width, height } = frames[0];
  const marked = markParked(frames);
  const road = findRoad(marked, width, height);
  const counts = marked.map(f => f.boxes.filter(b => !b.parked && road.onRoad(b.box)).length);
  const points = trend(marked.map((f, i) => ({ time: f.time, value: counts[i] })), { window: windowMs });
  await picture(files.at(-1), marked.at(-1), road, path.join(args.out, `${id}-road.jpg`));

  // For the console: what was left out, and the trend by half hour, before and after
  const all = frames.reduce((sum, f) => sum + f.boxes.length, 0);
  const parked = marked.reduce((sum, f) => sum + f.boxes.filter(b => b.parked).length, 0);
  const kept = counts.reduce((a, b) => a + b, 0);
  const before = trend(frames.map(f => ({ time: f.time, value: f.boxes.length })), { window: windowMs });
  const halfHours = series => Object.entries(Object.groupBy(series.filter(p => p.mean !== null), p => Math.floor(p.time / 1_800_000)))
    .map(([, ps]) => (ps.reduce((s, p) => s + p.mean, 0) / ps.length).toFixed(1)).join(' ');
  console.log(`\n  left out: ${Math.round((parked / all) * 100)}% parked, ${Math.round(((all - parked - kept) / all) * 100)}% off the road`);
  console.log(`  all detected: ${halfHours(before)}\n  on the road:  ${halfHours(points)}`);

  return `
  <section>
    ${chart(name, points, { window: Number(args.window) })}
    <details><summary>The road here</summary>
      <figure><img src="${id}-road.jpg" alt="The road found for ${name}"><figcaption>Blue: the road, where moving vehicles have been. Orange: vehicles taken as parked, in the latest frame.</figcaption></figure>
    </details>
  </section>`;
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
  const current = (await cameraFrames(id)).filter(f => store[path.relative(cacheDir, f)]?.threshold === threshold);
  sections.push(await camera(id, current, store, name));
}
await fs.writeFile(path.join(args.out, 'index.html'), page(
  'Vehicles on the road',
  `Per camera: moving vehicles on the road in each frame, detected${tile ? ` in tiles of ${tile} px as well as the whole frame` : ''} (threshold ${threshold}); parked vehicles, and any off the road, left out. Dots are frames; the line is the mean over a centred ${args.window}-minute window, with its 95% band.`,
  `<div class="grid">${sections.join('')}</div>`,
));
console.log(`\nCharts: ${path.join(args.out, 'index.html')}`);
