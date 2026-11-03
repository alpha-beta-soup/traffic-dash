// Offline evaluation: how well does a pretrained object detector count vehicles in our camera
// frames? Runs D-FINE (small, COCO-trained, Apache-2.0) on frames already in cache/, draws what
// it found onto copies of them, and writes a contact sheet to look through.
//
//   npm run eval:vehicles -- [--model models/dfine_s_coco.onnx] [--cameras 40] [--threshold 0.4]
//     [--tile 320]
//
// With --tile, each frame is also looked at in overlapping tiles of about that many pixels (for
// small, far-off vehicles), and compared with the whole frame alone: boxes only the tiles found
// are dashed.
//
// Needs onnxruntime-node and sharp and the model file (see readme.md here).
// Output: eval-output/vehicles/index.html, with each frame annotated, and results.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

import {
  DEFAULT_MODEL, VEHICLES, cacheDir, cameraNames, frameTime, loadDetector, root,
} from './detector.mjs';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    cameras: { type: 'string', default: '40' }, // How many cameras to sample a frame from
    sequence: { type: 'string', default: '228' }, // A camera to take consecutive frames from
    threshold: { type: 'string', default: '0.4' }, // Score to count a detection
    tile: { type: 'string', default: '0' }, // Tile size (px) to also look in; 0 for none
    out: { type: 'string', default: path.join(root, 'eval-output', 'vehicles') },
  },
});

const THRESHOLDS = [0.3, 0.4, 0.5]; // Counts at each, to show how sensitive they are
const SEQUENCE_LENGTH = 10;
const threshold = Number(args.threshold);
const tile = Number(args.tile);

// The frames to look at: the latest from a spread of cameras (sampled across image sizes), any
// from before today (other light), and a run of consecutive frames from one camera
async function pickFrames() {
  const cameras = (await fs.readdir(cacheDir)).filter(name => /^\d+$/.test(name));
  const latest = [];
  const older = [];
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  for (const id of cameras) {
    const frames = (await fs.readdir(path.join(cacheDir, id))).filter(f => f.endsWith('.jpg')).sort();
    if (!frames.length) continue;
    const file = path.join(cacheDir, id, frames.at(-1));
    const { width, height } = await sharp(file).metadata();
    latest.push({ id, file, width, height, time: frameTime(file), kind: 'latest' });
    frames.filter(f => frameTime(f) < startOfToday).slice(-1)
      .forEach(f => older.push({ id, file: path.join(cacheDir, id, f), width, height, time: frameTime(f), kind: 'earlier day' }));
  }
  // Evenly across the cameras sorted by size, so every resolution is represented
  latest.sort((a, b) => a.width * a.height - b.width * b.height);
  const n = Math.min(Number(args.cameras), latest.length);
  const spread = Array.from({ length: n }, (_, i) => latest[Math.floor((i * latest.length) / n)]);
  const sequenceDir = path.join(cacheDir, args.sequence);
  const sequence = (await fs.readdir(sequenceDir).catch(() => [])).filter(f => f.endsWith('.jpg')).sort()
    .slice(-SEQUENCE_LENGTH)
    .map(f => ({ id: args.sequence, file: path.join(sequenceDir, f), time: frameTime(f), kind: 'sequence' }));
  return [...spread, ...older, ...sequence];
}

// Whether the whole frame alone found a vehicle too
const alsoInFrame = (v, plain) => plain.some(p => {
  const w = Math.min(v.x + v.w, p.x + p.w) - Math.max(v.x, p.x);
  const h = Math.min(v.y + v.h, p.y + p.h) - Math.max(v.y, p.y);
  return w > 0 && h > 0 && (w * h) / Math.min(v.w * v.h, p.w * p.h) > 0.5;
});

async function annotate(frame, found, out) {
  const { width, height } = await sharp(frame.file).metadata();
  const scale = Math.max(1, width / 800); // Lines and text readable on large frames
  const shapes = found.map(({
    x, y, w, h, cls, score, tiled,
  }) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${VEHICLES[cls].colour}" stroke-width="${2 * scale}"${tiled ? ` stroke-dasharray="${4 * scale}"` : ''}/>
    <text x="${x + 2}" y="${Math.max(10 * scale, y - 2)}" font-size="${10 * scale}" font-family="sans-serif" fill="${VEHICLES[cls].colour}">${score.toFixed(2)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
  await sharp(frame.file).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(out);
}

function contactSheet(results, summary) {
  const card = r => `
    <figure>
      <a href="${r.image}"><img src="${r.image}" loading="lazy"></a>
      <figcaption><b>${r.name}</b> · ${r.width}×${r.height} · ${r.kind}<br>
        ${r.counts[threshold]} vehicles at ${threshold} (${THRESHOLDS.map(t => `${t}: ${r.counts[t]}`).join(', ')})${r.plain === undefined ? '' : `, whole frame alone ${r.plain}`}
        · ${Object.entries(r.byClass).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'} · ${r.ms} ms · ${new Date(r.time).toLocaleString('en-NZ')}</figcaption>
    </figure>`;
  return `<!doctype html><meta charset="utf-8"><title>Vehicle counts</title>
<style>body{font:14px system-ui;margin:16px;background:#111;color:#ddd}figure{margin:0}img{width:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}figcaption{font-size:12px;margin-top:4px}
h2{margin-top:28px}</style>
<h1>Vehicle counts: ${path.basename(args.model)}, threshold ${threshold}${tile ? `, tiles of ${tile} px (dashed: found only in the tiles)` : ''}</h1>
<p>${summary}</p>
${['latest', 'earlier day', 'sequence'].map(kind => {
    const rows = results.filter(r => r.kind === kind);
    return rows.length ? `<h2>${kind} (${rows.length})</h2><div class="grid">${rows.map(card).join('')}</div>` : '';
  }).join('')}`;
}

const names = await cameraNames();
const frames = await pickFrames();
console.log(`Loading ${args.model}`);
const detector = await loadDetector(args.model, frames[0]?.file);
await fs.mkdir(args.out, { recursive: true });

const results = [];
for (const frame of frames) {
  const {
    found, ms, width, height, passes,
  } = await detector.detect(frame.file, Math.min(...THRESHOLDS), { tile });
  let counted = found.filter(v => v.score >= threshold);
  let plain;
  if (tile) {
    const alone = (await detector.detect(frame.file, threshold)).found;
    plain = alone.length;
    counted = counted.map(v => ({ ...v, tiled: !alsoInFrame(v, alone) }));
  }
  const image = `${frame.id}-${frame.time}.jpg`;
  await annotate(frame, counted, path.join(args.out, image));
  const byClass = {};
  counted.forEach((v) => { byClass[v.label] = (byClass[v.label] ?? 0) + 1; });
  results.push({
    id: frame.id, name: names.get(frame.id) ?? `Camera ${frame.id}`, kind: frame.kind, time: frame.time, width, height, ms, passes, plain, image,
    byClass, counts: Object.fromEntries(THRESHOLDS.map(t => [t, found.filter(v => v.score >= t).length])),
  });
  console.log(`${String(results.length).padStart(3)}/${frames.length} ${frame.id.padStart(4)} ${`${width}×${height}`.padEnd(9)} ${String(counted.length).padStart(3)} vehicles${tile ? ` (${plain} whole frame)` : ''}  ${ms} ms, ${passes} passes`);
}

const times = results.map(r => r.ms).sort((a, b) => a - b);
const sequence = results.filter(r => r.kind === 'sequence').map(r => r.counts[threshold]);
const total = key => results.reduce((sum, r) => sum + (key ? r[key] : r.counts[threshold]), 0);
const summary = [
  `${results.length} frames; inference median ${times[Math.floor(times.length / 2)]} ms, max ${times.at(-1)} ms (CPU).`,
  tile ? `Tiles found ${total()} vehicles in all, the whole frame alone ${total('plain')} (+${Math.round((total() / Math.max(1, total('plain')) - 1) * 100)}%).` : '',
  sequence.length ? `Sequence (${names.get(args.sequence) ?? args.sequence}, consecutive frames): ${sequence.join(', ')}.` : '',
].join(' ');
await fs.writeFile(path.join(args.out, 'results.json'), JSON.stringify({ model: args.model, threshold, results }, null, 2));
await fs.writeFile(path.join(args.out, 'index.html'), contactSheet(results, summary));
console.log(`\n${summary}\nContact sheet: ${path.join(args.out, 'index.html')}`);
