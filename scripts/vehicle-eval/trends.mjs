// Offline prototype: vehicle counts over time, per camera, with a trend and its uncertainty.
// Counts every cached frame of the cameras with the most history, then charts each: the counts
// as faint dots, a rolling mean over a centred window (src/utils/trend.js), and its 95% band.
//
//   npm run eval:trends -- [--cameras 6] [--window 10] [--threshold 0.4] [--tile 320]
//
// With --tile, frames are counted in overlapping tiles too, for small, far-off vehicles.
//
// Output: eval-output/trends/index.html. Counts are kept in counts.json beside it (and
// counts-tile<px>.json), so a rerun only runs the detector on frames it hasn't seen.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import trend from '../../src/utils/trend.js';
import { chart, page } from './charts.mjs';
import {
  DEFAULT_MODEL, cacheDir, cameraFrames, cameraNames, frameTime, loadDetector, root,
} from './detector.mjs';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    cameras: { type: 'string', default: '6' }, // The cameras with the most cached frames
    window: { type: 'string', default: '10' }, // Minutes the rolling mean spans
    threshold: { type: 'string', default: '0.4' },
    tile: { type: 'string', default: '0' }, // Tile size (px) to also count in; 0 for none
    out: { type: 'string', default: path.join(root, 'eval-output', 'trends') },
  },
});
const threshold = Number(args.threshold);
const windowMs = Number(args.window) * 60_000;
const tile = Number(args.tile);

async function countFrames(detector, files, store) {
  for (const [i, file] of files.entries()) {
    const key = path.relative(cacheDir, file);
    if (store[key]?.threshold === threshold) continue;
    const { found } = await detector.detect(file, threshold, { tile });
    store[key] = { threshold, count: found.length };
    if (i % 20 === 0) process.stdout.write('.');
  }
}

const names = await cameraNames();
const ids = (await fs.readdir(cacheDir)).filter(name => /^\d+$/.test(name));
const withFrames = await Promise.all(ids.map(async id => ({ id, files: await cameraFrames(id) })));
const chosen = withFrames.sort((a, b) => b.files.length - a.files.length).slice(0, Number(args.cameras));

await fs.mkdir(args.out, { recursive: true });
const storeFile = path.join(args.out, tile ? `counts-tile${tile}.json` : 'counts.json');
const store = JSON.parse(await fs.readFile(storeFile, 'utf8').catch(() => '{}'));
const detector = await loadDetector(args.model, chosen[0]?.files[0]);
const charts = [];
for (const { id, files } of chosen) {
  process.stdout.write(`${names.get(id) ?? id} (${files.length} frames) `);
  await countFrames(detector, files, store);
  await fs.writeFile(storeFile, JSON.stringify(store));
  const points = trend(files.map(file => ({ time: frameTime(file), value: store[path.relative(cacheDir, file)].count })), { window: windowMs });
  charts.push(chart(names.get(id) ?? `Camera ${id}`, points, { window: Number(args.window) }));
  console.log(' done');
}
await fs.writeFile(path.join(args.out, 'index.html'), page(
  `Vehicles per frame: trend and 95% band${tile ? `, counted in tiles of ${tile} px` : ''}`,
  `Dots: each frame's count (threshold ${threshold}). Line: mean over a centred ${args.window}-minute window, where it holds 4 or more frames; broken across gaps. Band: 95% interval for that mean, from the window's own spread.`,
  `<div class="grid">${charts.join('')}</div>`,
));
console.log(`Charts: ${path.join(args.out, 'index.html')}`);
