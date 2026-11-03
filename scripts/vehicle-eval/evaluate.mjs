// Offline evaluation: how well does a pretrained object detector count vehicles in our camera
// frames? Runs D-FINE (small, COCO-trained, Apache-2.0) on frames already in cache/, draws what
// it found onto copies of them, and writes a contact sheet to look through.
//
//   npm run eval:vehicles -- [--model models/dfine_s_coco.onnx] [--cameras 40] [--threshold 0.4]
//
// Needs onnxruntime-node and sharp (dev dependencies) and the model file (see readme.md here).
// Output: eval-output/vehicles/index.html, with each frame annotated, and results.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as ort from 'onnxruntime-node';
import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: path.join(root, 'models', 'dfine_s_coco.onnx') },
    cameras: { type: 'string', default: '40' }, // How many cameras to sample a frame from
    sequence: { type: 'string', default: '228' }, // A camera to take consecutive frames from
    threshold: { type: 'string', default: '0.4' }, // Score to count a detection
    out: { type: 'string', default: path.join(root, 'eval-output', 'vehicles') },
  },
});

const INPUT = 640; // The model's input: frames are stretched to this square, as it was trained
const THRESHOLDS = [0.3, 0.4, 0.5]; // Counts at each, to show how sensitive they are
// COCO classes counted as vehicles, and the colours their boxes are drawn in
const VEHICLES = {
  2: { label: 'car', colour: '#00e676' },
  3: { label: 'motorcycle', colour: '#ffea00' },
  5: { label: 'bus', colour: '#2979ff' },
  7: { label: 'truck', colour: '#ff9100' },
};
const SEQUENCE_LENGTH = 10;
const DUPLICATE_OVERLAP = 0.7; // Intersection over union above which two boxes are one vehicle
const cacheDir = path.join(root, 'cache');
const threshold = Number(args.threshold);

const sigmoid = x => 1 / (1 + Math.exp(-x));
const frameTime = name => Number(path.basename(name, '.jpg'));

// Camera names, if the dev server is running; ids otherwise
async function cameraNames() {
  try {
    const res = await fetch('http://localhost:3000/api/cameras', { signal: AbortSignal.timeout(5000) });
    return new Map((await res.json()).map(c => [String(c.id), c.name]));
  } catch {
    return new Map();
  }
}

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

// The frame as the model's input: RGB, channels first, 0–1
async function toTensor(file) {
  const { data } = await sharp(file).removeAlpha().resize(INPUT, INPUT, { fit: 'fill' }).raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = INPUT * INPUT;
  const input = new Float32Array(3 * pixels);
  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) input[c * pixels + i] = data[i * 3 + c] / 255;
  }
  return new ort.Tensor('float32', input, [1, 3, INPUT, INPUT]);
}

const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.w * a.h + b.w * b.h - w * h);
};

// The vehicles among the model's queries, with boxes in the frame's pixels. DETR-style models
// mostly give one box per object, but now and then a second, weaker one (often as another
// class, e.g. car and truck): those are dropped.
function vehicles(logits, boxes, width, height, minScore) {
  const [, queries, classes] = logits.dims;
  const found = [];
  for (let q = 0; q < queries; q++) {
    let best = null;
    for (const cls of Object.keys(VEHICLES).map(Number)) {
      const score = sigmoid(logits.data[q * classes + cls]);
      if (score >= minScore && (!best || score > best.score)) best = { cls, score };
    }
    if (!best) continue;
    const [cx, cy, w, h] = boxes.data.slice(q * 4, q * 4 + 4);
    found.push({
      ...best, label: VEHICLES[best.cls].label, x: (cx - w / 2) * width, y: (cy - h / 2) * height, w: w * width, h: h * height,
    });
  }
  found.sort((a, b) => b.score - a.score);
  const kept = [];
  found.forEach(v => kept.some(k => overlap(k, v) > DUPLICATE_OVERLAP) || kept.push(v));
  return kept;
}

async function annotate(frame, found, out) {
  const { width, height } = await sharp(frame.file).metadata();
  const scale = Math.max(1, width / 800); // Lines and text readable on large frames
  const shapes = found.map(({ x, y, w, h, cls, score }) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${VEHICLES[cls].colour}" stroke-width="${2 * scale}"/>
    <text x="${x + 2}" y="${Math.max(10 * scale, y - 2)}" font-size="${10 * scale}" font-family="sans-serif" fill="${VEHICLES[cls].colour}">${score.toFixed(2)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes}</svg>`;
  await sharp(frame.file).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 85 }).toFile(out);
}

function contactSheet(results, summary) {
  const card = r => `
    <figure>
      <a href="${r.image}"><img src="${r.image}" loading="lazy"></a>
      <figcaption><b>${r.name}</b> · ${r.width}×${r.height} · ${r.kind}<br>
        ${r.counts[threshold]} vehicles at ${threshold} (${THRESHOLDS.map(t => `${t}: ${r.counts[t]}`).join(', ')})
        · ${Object.entries(r.byClass).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'} · ${r.ms} ms · ${new Date(r.time).toLocaleString('en-NZ')}</figcaption>
    </figure>`;
  return `<!doctype html><meta charset="utf-8"><title>Vehicle counts</title>
<style>body{font:14px system-ui;margin:16px;background:#111;color:#ddd}figure{margin:0}img{width:100%}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}figcaption{font-size:12px;margin-top:4px}
h2{margin-top:28px}</style>
<h1>Vehicle counts: ${path.basename(args.model)}, threshold ${threshold}</h1>
<p>${summary}</p>
${['latest', 'earlier day', 'sequence'].map(kind => {
    const rows = results.filter(r => r.kind === kind);
    return rows.length ? `<h2>${kind} (${rows.length})</h2><div class="grid">${rows.map(card).join('')}</div>` : '';
  }).join('')}`;
}

const names = await cameraNames();
const frames = await pickFrames();
console.log(`Loading ${args.model}`);
const session = await ort.InferenceSession.create(args.model);
const [inputName] = session.inputNames;
const outputName = want => session.outputNames.find(n => n.includes(want)) ?? session.outputNames[want === 'logits' ? 0 : 1];
await fs.mkdir(args.out, { recursive: true });

// One run first, so the timings are of warm runs
if (frames.length) await session.run({ [inputName]: await toTensor(frames[0].file) });

const results = [];
for (const frame of frames) {
  const input = await toTensor(frame.file);
  const started = performance.now();
  const output = await session.run({ [inputName]: input });
  const ms = Math.round(performance.now() - started);
  const { width, height } = frame.width ? frame : await sharp(frame.file).metadata();
  const logits = output[outputName('logits')];
  const boxes = output[outputName('box')];
  const found = vehicles(logits, boxes, width, height, Math.min(...THRESHOLDS));
  const counted = found.filter(v => v.score >= threshold);
  const image = `${frame.id}-${frame.time}.jpg`;
  await annotate(frame, counted, path.join(args.out, image));
  const byClass = {};
  counted.forEach((v) => { byClass[v.label] = (byClass[v.label] ?? 0) + 1; });
  results.push({
    id: frame.id, name: names.get(frame.id) ?? `Camera ${frame.id}`, kind: frame.kind, time: frame.time, width, height, ms, image,
    byClass, counts: Object.fromEntries(THRESHOLDS.map(t => [t, found.filter(v => v.score >= t).length])),
  });
  console.log(`${String(results.length).padStart(3)}/${frames.length} ${frame.id.padStart(4)} ${`${width}×${height}`.padEnd(9)} ${String(counted.length).padStart(3)} vehicles  ${ms} ms`);
}

const times = results.map(r => r.ms).sort((a, b) => a - b);
const sequence = results.filter(r => r.kind === 'sequence').map(r => r.counts[threshold]);
const summary = [
  `${results.length} frames; inference median ${times[Math.floor(times.length / 2)]} ms, max ${times.at(-1)} ms (CPU).`,
  sequence.length ? `Sequence (${names.get(args.sequence) ?? args.sequence}, consecutive frames): ${sequence.join(', ')}.` : '',
].join(' ');
await fs.writeFile(path.join(args.out, 'results.json'), JSON.stringify({ model: args.model, threshold, results }, null, 2));
await fs.writeFile(path.join(args.out, 'index.html'), contactSheet(results, summary));
console.log(`\n${summary}\nContact sheet: ${path.join(args.out, 'index.html')}`);
