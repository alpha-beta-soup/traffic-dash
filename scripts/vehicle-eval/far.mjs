// Offline check: how many vehicles tiling finds if only the top rows of tiles (the far side of the
// road) are looked at, against the cost. Each frame is looked at once, whole and in every tile;
// what a share of rows would have counted is the merge of just those passes' boxes, the same as
// detecting with `far` set.
//
//   npm run eval:far -- [--per-size 2] [--frames 30] [--threshold 0.4]
//
// Takes the cameras with the most cached frames at each frame size (--per-size), and --frames
// frames spread across each one's history. Results are kept in eval-output/far/results.json, so a
// rerun only looks at frames it hasn't seen.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import sharp from 'sharp';

import { merge, tiles } from '../../counter/detector.js';
import {
  DEFAULT_MODEL, cacheDir, cameraFrames, cameraNames, loadDetector, root,
} from './detector.mjs';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    'per-size': { type: 'string', default: '2' },
    frames: { type: 'string', default: '30' },
    threshold: { type: 'string', default: '0.4' },
    out: { type: 'string', default: path.join(root, 'eval-output', 'far') },
  },
});
const TILE = 320;
const SHARES = [0, 0.25, 0.5, 0.67, 1]; // Of the rows of tiles, from the top (0.25: the top row, at most 4 rows); 0 is the whole frame alone
const threshold = Number(args.threshold);

const names = await cameraNames();
const ids = (await fs.readdir(cacheDir)).filter(name => /^\d+$/.test(name));
const cameras = (await Promise.all(ids.map(async id => {
  const files = await cameraFrames(id);
  if (!files.length) return null;
  const { width, height } = await sharp(files.at(-1)).metadata();
  return { id, files, size: `${width}×${height}` };
}))).filter(Boolean);
const bySize = Map.groupBy(cameras.sort((a, b) => b.files.length - a.files.length), c => c.size);
const chosen = [...bySize.values()].flatMap(group => group.slice(0, Number(args['per-size'])));

await fs.mkdir(args.out, { recursive: true });
const storeFile = path.join(args.out, 'results.json');
const store = JSON.parse(await fs.readFile(storeFile, 'utf8').catch(() => '{}'));
const detector = await loadDetector(args.model, chosen[0]?.files[0]);

const rows = [];
for (const { id, files, size } of chosen) {
  process.stdout.write(`${names.get(id) ?? id} (${size}) `);
  const step = Math.max(1, files.length / Number(args.frames));
  const sample = Array.from({ length: Math.min(files.length, Number(args.frames)) }, (_, i) => files[Math.floor(i * step)]);
  const counts = SHARES.map(() => []);
  let ms = 0;
  let looked = 0;
  for (const file of sample) {
    const key = path.relative(cacheDir, file);
    if (store[key]?.threshold !== threshold) {
      // The server prunes old frames as it goes, so a frame listed earlier may be gone
      const detected = await detector.detect(file, threshold, { tile: TILE }).catch(() => null);
      if (!detected) continue;
      const { width, height, seen } = detected;
      store[key] = {
        threshold,
        msPerPass: detected.ms / detected.passes,
        counts: SHARES.map(far => merge(seen.filter(v => v.pass <= tiles(width, height, TILE, far).length)).length),
        passes: SHARES.map(far => 1 + tiles(width, height, TILE, far).length),
      };
      process.stdout.write('.');
    }
    store[key].counts.forEach((count, i) => counts[i].push(count));
    ms += store[key].msPerPass;
    looked++;
  }
  await fs.writeFile(storeFile, JSON.stringify(store));
  if (!looked) {
    console.log(' no frames');
    continue;
  }
  const passes = store[path.relative(cacheDir, sample.find(f => store[path.relative(cacheDir, f)]))].passes;
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  rows.push({
    camera: names.get(id) ?? id, size, frames: looked, msPerPass: ms / looked, passes, means: counts.map(mean),
  });
  console.log(' done');
}

// Per camera: the mean count with each share of rows, and how much of what tiling adds it keeps
const pct = x => `${Math.round(x * 100)}%`;
console.log(`\nMean vehicles per frame (threshold ${threshold}), passes of the model, and the share of what all tiles add that's kept\n`);
console.log(['camera', 'size', 'frames', ...SHARES.map(s => (s ? `top ${pct(s)}` : 'whole'))].join('\t'));
for (const r of rows) {
  const gain = r.means.at(-1) - r.means[0];
  console.log([
    r.camera, r.size, r.frames,
    ...r.means.map((m, i) => `${m.toFixed(1)} (${r.passes[i]}p${i && i < SHARES.length - 1 && gain > 0 ? `, ${pct((m - r.means[0]) / gain)}` : ''})`),
  ].join('\t'));
}

// Overall, weighting each camera alike: vehicles found and model passes, against all tiles
const counted = rows.filter(r => r.means.at(-1) > 0);
const total = i => counted.reduce((sum, r) => sum + r.means[i] / r.means.at(-1), 0) / counted.length;
const cost = i => rows.reduce((sum, r) => sum + r.passes[i] * r.msPerPass, 0) / rows.reduce((sum, r) => sum + r.passes.at(-1) * r.msPerPass, 0);
console.log(`\n${SHARES.map((s, i) => `${s ? `top ${pct(s)}` : 'whole'}: ${pct(total(i))} of the vehicles for ${pct(cost(i))} of the time`).join('\n')}`);
