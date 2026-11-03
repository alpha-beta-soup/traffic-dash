// Offline prototype: vehicle counts over time, per camera, with a trend and its uncertainty.
// Counts every cached frame of the cameras with the most history, then charts each: the counts
// as faint dots, a rolling mean over a centred window (src/utils/trend.js), and its 95% band.
//
//   npm run eval:trends -- [--cameras 6] [--window 10] [--threshold 0.4]
//
// Output: eval-output/trends/index.html. Counts are kept in counts.json beside it, so a rerun
// only runs the detector on frames it hasn't seen.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

import trend from '../../src/utils/trend.js';
import {
  DEFAULT_MODEL, cacheDir, cameraFrames, cameraNames, frameTime, loadDetector, root,
} from './detector.mjs';

const { values: args } = parseArgs({
  options: {
    model: { type: 'string', default: DEFAULT_MODEL },
    cameras: { type: 'string', default: '6' }, // The cameras with the most cached frames
    window: { type: 'string', default: '10' }, // Minutes the rolling mean spans
    threshold: { type: 'string', default: '0.4' },
    out: { type: 'string', default: path.join(root, 'eval-output', 'trends') },
  },
});
const threshold = Number(args.threshold);
const windowMs = Number(args.window) * 60_000;

// Chart layout and colours (dark surface; the series blue validated for it)
const W = 720;
const H = 220;
const M = {
  top: 12, right: 16, bottom: 28, left: 36,
};
const COLOURS = {
  surface: '#1a1a19', text: '#f0efec', muted: '#c3c2b7', grid: '#34332f', series: '#3987e5',
};
const clock = new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });

async function countFrames(detector, files, store) {
  for (const [i, file] of files.entries()) {
    const key = path.relative(cacheDir, file);
    if (store[key]?.threshold === threshold) continue;
    const { found } = await detector.detect(file, threshold);
    store[key] = { threshold, count: found.length };
    if (i % 20 === 0) process.stdout.write('.');
  }
}

// Ticks on round minutes (15, 30 or 60 apart, whichever gives about six)
function timeTicks(start, end) {
  const step = [15, 30, 60, 120].map(m => m * 60_000).find(s => (end - start) / s <= 7) ?? 240 * 60_000;
  const ticks = [];
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push(t);
  return ticks;
}

function chart(name, points) {
  const start = points[0].time;
  const end = points.at(-1).time;
  const max = Math.max(5, ...points.map(p => Math.max(p.value, p.high ?? 0)));
  const yStep = max > 30 ? 10 : 5;
  const top = Math.ceil(max / yStep) * yStep;
  const x = t => M.left + ((t - start) / Math.max(1, end - start)) * (W - M.left - M.right);
  const y = v => M.top + (1 - v / top) * (H - M.top - M.bottom);
  const segments = Object.values(Object.groupBy(points.filter(p => p.mean !== null), p => p.segment));
  const band = segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.high)}`).join('L')}L${[...s].reverse().map(p => `${x(p.time)},${y(p.low)}`).join('L')}Z`).join('');
  const line = segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.mean)}`).join('L')}`).join('');
  const yTicks = Array.from({ length: top / yStep + 1 }, (_, i) => i * yStep);
  const valid = points.filter(p => p.mean !== null);
  const halfWidths = valid.map(p => (p.high - p.low) / 2).sort((a, b) => a - b);
  const typical = halfWidths.length ? halfWidths[Math.floor(halfWidths.length / 2)].toFixed(1) : '–';
  const data = JSON.stringify(points.map(p => ({
    x: x(p.time), t: clock.format(p.time), v: p.value, m: p.mean === null ? null : [p.mean, p.low, p.high].map(v => v.toFixed(1)),
  })));
  return `
  <section class="chart">
    <h2>${name}</h2>
    <p class="sub">${points.length} frames, ${clock.format(start)}–${clock.format(end)} · trend over ${args.window} min, 95% band typically ±${typical} vehicles</p>
    <div class="plot">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${name}: vehicles per frame over time, with trend and 95% band">
        ${yTicks.map(v => `<line x1="${M.left}" x2="${W - M.right}" y1="${y(v)}" y2="${y(v)}" stroke="${COLOURS.grid}"/>
        <text x="${M.left - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join('')}
        ${timeTicks(start, end).map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle" class="tick">${clock.format(t)}</text>`).join('')}
        <path d="${band}" fill="${COLOURS.series}" fill-opacity="0.22"/>
        ${points.map(p => `<circle cx="${x(p.time)}" cy="${y(p.value)}" r="2.5" fill="${COLOURS.series}" fill-opacity="0.45"/>`).join('')}
        <path d="${line}" fill="none" stroke="${COLOURS.series}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <line class="cursor" y1="${M.top}" y2="${H - M.bottom}" stroke="${COLOURS.muted}" stroke-width="1" visibility="hidden"/>
        <rect class="hit" x="${M.left}" y="${M.top}" width="${W - M.left - M.right}" height="${H - M.top - M.bottom}" fill="transparent" data-points='${data}'/>
      </svg>
      <div class="tip" hidden></div>
    </div>
    <details><summary>Table</summary><table><tr><th>Time</th><th>Vehicles</th><th>Trend</th><th>95% band</th></tr>
      ${points.map(p => `<tr><td>${clock.format(p.time)}</td><td>${p.value}</td><td>${p.mean === null ? '–' : p.mean.toFixed(1)}</td><td>${p.mean === null ? '–' : `${p.low.toFixed(1)}–${p.high.toFixed(1)}`}</td></tr>`).join('')}
    </table></details>
  </section>`;
}

const page = charts => `<!doctype html><meta charset="utf-8"><title>Vehicle trends</title>
<style>
body{font:14px system-ui;margin:16px;background:${COLOURS.surface};color:${COLOURS.text}}
h1{font-size:20px}h2{font-size:15px;margin:0}.sub{color:${COLOURS.muted};margin:2px 0 6px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:24px}
.plot{position:relative}svg{width:100%;height:auto;display:block}.tick{fill:${COLOURS.muted};font-size:11px}
.tip{position:absolute;top:0;pointer-events:none;background:#262624;border:1px solid ${COLOURS.grid};border-radius:6px;padding:4px 8px;font-size:12px;white-space:nowrap}
details{margin-top:4px;font-size:12px;color:${COLOURS.muted}}table{border-collapse:collapse;margin-top:4px}td,th{padding:1px 10px 1px 0;text-align:left}
</style>
<h1>Vehicles per frame: trend and 95% band</h1>
<p class="sub">Dots: each frame's count (threshold ${threshold}). Line: mean over a centred ${args.window}-minute window, where it holds 4 or more frames; broken across gaps. Band: 95% interval for that mean, from the window's own spread.</p>
<div class="grid">${charts.join('')}</div>
<script>
for (const hit of document.querySelectorAll('.hit')) {
  const points = JSON.parse(hit.dataset.points);
  const svg = hit.ownerSVGElement;
  const cursor = svg.querySelector('.cursor');
  const tip = svg.parentElement.querySelector('.tip');
  hit.addEventListener('pointermove', (e) => {
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * ${W};
    const p = points.reduce((a, b) => (Math.abs(b.x - px) < Math.abs(a.x - px) ? b : a));
    cursor.setAttribute('x1', p.x); cursor.setAttribute('x2', p.x); cursor.setAttribute('visibility', 'visible');
    tip.textContent = p.t + ' · ' + p.v + ' vehicles' + (p.m ? ' · trend ' + p.m[0] + ' (' + p.m[1] + '–' + p.m[2] + ')' : '');
    tip.hidden = false;
    const left = (p.x / ${W}) * box.width;
    tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), box.width - tip.offsetWidth) + 'px';
  });
  hit.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}
</script>`;

const names = await cameraNames();
const ids = (await fs.readdir(cacheDir)).filter(name => /^\d+$/.test(name));
const withFrames = await Promise.all(ids.map(async id => ({ id, files: await cameraFrames(id) })));
const chosen = withFrames.sort((a, b) => b.files.length - a.files.length).slice(0, Number(args.cameras));

await fs.mkdir(args.out, { recursive: true });
const storeFile = path.join(args.out, 'counts.json');
const store = JSON.parse(await fs.readFile(storeFile, 'utf8').catch(() => '{}'));
const detector = await loadDetector(args.model, chosen[0]?.files[0]);
const charts = [];
for (const { id, files } of chosen) {
  process.stdout.write(`${names.get(id) ?? id} (${files.length} frames) `);
  await countFrames(detector, files, store);
  await fs.writeFile(storeFile, JSON.stringify(store));
  const points = trend(files.map(file => ({ time: frameTime(file), value: store[path.relative(cacheDir, file)].count })), { window: windowMs });
  charts.push(chart(names.get(id) ?? `Camera ${id}`, points));
  console.log(' done');
}
await fs.writeFile(path.join(args.out, 'index.html'), page(charts));
console.log(`Charts: ${path.join(args.out, 'index.html')}`);
