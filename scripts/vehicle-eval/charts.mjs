// What the trend prototypes draw: a chart of a value per frame over time, as faint dots, with its
// trend (src/utils/trend.js) and 95% band; and the page they go on (dark, with hover tooltips)

// Chart layout and colours (dark surface; the series blue validated for it)
const W = 720;
const H = 220;
const M = {
  top: 12, right: 16, bottom: 28, left: 40,
};
export const COLOURS = {
  surface: '#1a1a19', text: '#f0efec', muted: '#c3c2b7', grid: '#34332f', series: '#3987e5',
};
export const clock = new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });

// Ticks on round minutes (15, 30 or 60 apart, whichever gives about six)
function timeTicks(start, end) {
  const step = [15, 30, 60, 120].map(m => m * 60_000).find(s => (end - start) / s <= 7) ?? 240 * 60_000;
  const ticks = [];
  for (let t = Math.ceil(start / step) * step; t <= end; t += step) ticks.push(t);
  return ticks;
}

// About five round steps up to max
function valueTicks(max) {
  const raw = Math.max(max, 1) / 5;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * magnitude).find(s => s >= raw);
  const top = Math.ceil(max / step) * step || step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

// points: from trend(). start and end (ms) set the time axis, to line up charts above each
// other; unit names the values; digits, how they're shown
export function chart(title, points, {
  start = points[0].time, end = points.at(-1).time, unit = 'vehicles', digits = 0, window = 10,
} = {}) {
  const ticks = valueTicks(Math.max(...points.map(p => Math.max(p.value, p.high ?? 0))));
  const top = ticks.at(-1);
  const x = t => M.left + ((t - start) / Math.max(1, end - start)) * (W - M.left - M.right);
  const y = v => M.top + (1 - v / top) * (H - M.top - M.bottom);
  const segments = Object.values(Object.groupBy(points.filter(p => p.mean !== null), p => p.segment));
  const band = segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.high)}`).join('L')}L${[...s].reverse().map(p => `${x(p.time)},${y(p.low)}`).join('L')}Z`).join('');
  const line = segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.mean)}`).join('L')}`).join('');
  const valid = points.filter(p => p.mean !== null);
  const halfWidths = valid.map(p => (p.high - p.low) / 2).sort((a, b) => a - b);
  const typical = halfWidths.length ? halfWidths[Math.floor(halfWidths.length / 2)].toFixed(1) : '–';
  const format = v => v.toFixed(digits);
  const data = JSON.stringify(points.map(p => ({
    x: x(p.time), t: clock.format(p.time), v: format(p.value), m: p.mean === null ? null : [p.mean, p.low, p.high].map(v => v.toFixed(1)),
  })));
  return `
  <section class="chart">
    <h3>${title}</h3>
    <p class="sub">${points.length} frames, ${clock.format(points[0].time)}–${clock.format(points.at(-1).time)} · trend over ${window} min, 95% band typically ±${typical} ${unit}</p>
    <div class="plot">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}: ${unit} per frame over time, with trend and 95% band">
        ${ticks.map(v => `<line x1="${M.left}" x2="${W - M.right}" y1="${y(v)}" y2="${y(v)}" stroke="${COLOURS.grid}"/>
        <text x="${M.left - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join('')}
        ${timeTicks(start, end).map(t => `<text x="${x(t)}" y="${H - 8}" text-anchor="middle" class="tick">${clock.format(t)}</text>`).join('')}
        <path d="${band}" fill="${COLOURS.series}" fill-opacity="0.22"/>
        ${points.map(p => `<circle cx="${x(p.time)}" cy="${y(p.value)}" r="2.5" fill="${COLOURS.series}" fill-opacity="0.45"/>`).join('')}
        <path d="${line}" fill="none" stroke="${COLOURS.series}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <line class="cursor" y1="${M.top}" y2="${H - M.bottom}" stroke="${COLOURS.muted}" stroke-width="1" visibility="hidden"/>
        <rect class="hit" x="${M.left}" y="${M.top}" width="${W - M.left - M.right}" height="${H - M.top - M.bottom}" fill="transparent" data-unit="${unit}" data-points='${data}'/>
      </svg>
      <div class="tip" hidden></div>
    </div>
    <details><summary>Table</summary><table><tr><th>Time</th><th>${unit[0].toUpperCase()}${unit.slice(1)}</th><th>Trend</th><th>95% band</th></tr>
      ${points.map(p => `<tr><td>${clock.format(p.time)}</td><td>${format(p.value)}</td><td>${p.mean === null ? '–' : p.mean.toFixed(1)}</td><td>${p.mean === null ? '–' : `${p.low.toFixed(1)}–${p.high.toFixed(1)}`}</td></tr>`).join('')}
    </table></details>
  </section>`;
}

export const page = (title, intro, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>
body{font:14px system-ui;margin:16px;background:${COLOURS.surface};color:${COLOURS.text}}
h1{font-size:20px}h2{font-size:17px;margin:28px 0 8px}h3{font-size:14px;margin:0}.sub{color:${COLOURS.muted};margin:2px 0 6px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,560px),1fr));gap:24px}
.plot{position:relative}svg{width:100%;height:auto;display:block}.tick{fill:${COLOURS.muted};font-size:11px}
.tip{position:absolute;top:0;pointer-events:none;background:#262624;border:1px solid ${COLOURS.grid};border-radius:6px;padding:4px 8px;font-size:12px;white-space:nowrap}
details{margin-top:4px;font-size:12px;color:${COLOURS.muted}}table{border-collapse:collapse;margin-top:4px}td,th{padding:1px 10px 1px 0;text-align:left}
img{max-width:100%;display:block}figure{margin:0}figcaption{font-size:12px;color:${COLOURS.muted};margin-top:2px}
</style>
<h1>${title}</h1>
<p class="sub">${intro}</p>
${body}
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
    tip.textContent = p.t + ' · ' + p.v + ' ' + hit.dataset.unit + (p.m ? ' · trend ' + p.m[0] + ' (' + p.m[1] + '–' + p.m[2] + ')' : '');
    tip.hidden = false;
    const left = (p.x / ${W}) * box.width;
    tip.style.left = Math.min(Math.max(0, left - tip.offsetWidth / 2), box.width - tip.offsetWidth) + 'px';
  });
  hit.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}
</script>`;
