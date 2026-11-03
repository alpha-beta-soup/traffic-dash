import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { trend } from '../utils';

export const TREND_WINDOW = 10 * 60_000; // ms: the rolling mean's span (see utils/trend.js)
// The one series colour, validated against each mode's surface
export const seriesColour = theme => (theme.palette.mode === 'dark' ? '#3987e5' : '#2a78d6');

const clock = new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland' });

// The latest point with a trend, and whether it's recent enough to stand for now
const latestTrend = (points) => {
  const latest = [...points].reverse().find(p => p.mean !== null);
  return latest && { ...latest, recent: Date.now() - latest.time <= TREND_WINDOW };
};

// counts: [{ time, count }] → the trend's points, and paths for its line and band in a w×h box
export function trendShapes(counts, { w, h, start, end, top }) {
  const points = trend(counts.map(({ time, count }) => ({ time, value: count })), { window: TREND_WINDOW });
  const x = t => ((t - start) / Math.max(1, end - start)) * w;
  const y = v => h - (v / top) * h;
  const segments = Object.values(Object.groupBy(points.filter(p => p.mean !== null), p => p.segment));
  return {
    points,
    x,
    y,
    band: segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.high)}`).join('L')}L${[...s].reverse().map(p => `${x(p.time)},${y(p.low)}`).join('L')}Z`).join(''),
    line: segments.map(s => `M${s.map(p => `${x(p.time)},${y(p.mean)}`).join('L')}`).join(''),
  };
}

const W = 600;
const H = 150;
const M = {
  top: 8, right: 8, bottom: 22, left: 28,
};

// Vehicles counted in each frame over time, for the camera page: each count as a faint dot, the
// trend (rolling mean) as a line, and its 95% band. `cursor` (ms) marks the frame being shown.
export default function VehicleTrend({ counts, cursor }) {
  const theme = useTheme();
  const colour = seriesColour(theme);
  const svg = useRef(null);
  const [hovered, setHovered] = useState(null);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const chart = useMemo(() => {
    if (!counts.length) return null;
    const start = counts[0].time;
    // To the frame being shown, if that's newer than the last count (it may not be counted yet)
    const end = Math.max(counts.at(-1).time, cursor ?? 0, start + 30 * 60_000);
    const max = Math.max(5, ...counts.map(c => c.count));
    const yStep = max > 30 ? 10 : 5;
    const top = Math.ceil(max / yStep) * yStep;
    const shapes = trendShapes(counts, { w: plotW, h: plotH, start, end, top });
    const step = [15, 30, 60].map(m => m * 60_000).find(s => (end - start) / s <= 6) ?? 120 * 60_000;
    const xTicks = [];
    for (let t = Math.ceil(start / step) * step; t <= end; t += step) xTicks.push(t);
    const yTicks = Array.from({ length: top / yStep + 1 }, (_, i) => i * yStep);
    return { ...shapes, start, end, xTicks, yTicks };
  }, [counts, cursor, plotW, plotH]);

  if (!chart) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No counts yet: frames are counted as they are saved, while this camera is on screen.
      </Typography>
    );
  }
  const latest = latestTrend(chart.points);
  const band = latest && `${Math.round(latest.low)}–${Math.round(latest.high)}`;
  let summary = `${counts.length} frames counted; too few close together for a trend yet`;
  if (latest?.recent) summary = `About ${Math.round(latest.mean)} in view (${band}), over the last ${TREND_WINDOW / 60_000} minutes`;
  else if (latest) summary = `About ${Math.round(latest.mean)} in view (${band}) at ${clock.format(latest.time)}; too few frames since for a trend`;
  const onMove = (e) => {
    const box = svg.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W - M.left;
    setHovered(chart.points.reduce((a, b) => (Math.abs(chart.x(b.time) - px) < Math.abs(chart.x(a.time) - px) ? b : a)));
  };
  const cursorX = cursor >= chart.start && cursor <= chart.end ? chart.x(cursor) : null;
  const tick = { fill: theme.palette.text.secondary, fontSize: 11 };
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
        {summary}
      </Typography>
      <Box sx={{ position: 'relative' }}>
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label="Vehicles in view over time: each frame's count, the trend and its 95% band"
          onPointerMove={onMove}
          onPointerLeave={() => setHovered(null)}
        >
          <g transform={`translate(${M.left},${M.top})`}>
            {chart.yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={plotW} y1={chart.y(v)} y2={chart.y(v)} stroke={theme.palette.divider} />
                <text x={-6} y={chart.y(v) + 4} textAnchor="end" style={tick}>{v}</text>
              </g>
            ))}
            {chart.xTicks.map(t => (
              <text key={t} x={chart.x(t)} y={plotH + 16} textAnchor="middle" style={tick}>{clock.format(t)}</text>
            ))}
            <path d={chart.band} fill={colour} fillOpacity={0.2} />
            {chart.points.map(p => <circle key={p.time} cx={chart.x(p.time)} cy={chart.y(p.value)} r={2.5} fill={colour} fillOpacity={0.4} />)}
            <path d={chart.line} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {cursorX !== null && <line x1={cursorX} x2={cursorX} y1={0} y2={plotH} stroke={theme.palette.text.primary} strokeOpacity={0.6} />}
            {hovered && <line x1={chart.x(hovered.time)} x2={chart.x(hovered.time)} y1={0} y2={plotH} stroke={theme.palette.text.secondary} strokeDasharray="3 3" />}
            <rect x={0} y={0} width={plotW} height={plotH} fill="transparent" />
          </g>
        </svg>
        {hovered && (
          <Box
            sx={{
              position: 'absolute', top: 0, left: `${((M.left + chart.x(hovered.time)) / W) * 100}%`, transform: 'translateX(-50%)',
              bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.25,
              fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: 2,
            }}
          >
            {clock.format(hovered.time)} · {hovered.value} vehicles
            {hovered.mean !== null && ` · trend ${hovered.mean.toFixed(1)} (${hovered.low.toFixed(1)}–${hovered.high.toFixed(1)})`}
          </Box>
        )}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Dots: each frame. Line: average over {TREND_WINDOW / 60_000} minutes, with its 95% band. Far-off and hidden vehicles are missed, so read it against this camera&apos;s own level.
      </Typography>
    </Box>
  );
}

// A small sparkline of the trend and its band, for the cards: no axes, dots or numbers. Each is
// scaled to its own camera's counts, so it shows rising or falling, not how many: counts aren't
// comparable between cameras (they see different stretches of road, and miss far-off vehicles).
export function VehicleSparkline({ counts }) {
  const theme = useTheme();
  const colour = seriesColour(theme);
  const w = 120;
  const h = 24;
  const chart = useMemo(() => {
    if (counts.length < 2) return null;
    const start = counts[0].time;
    const end = Math.max(counts.at(-1).time, start + 10 * 60_000);
    const top = Math.max(5, ...counts.map(c => c.count));
    return trendShapes(counts, { w, h, start, end, top });
  }, [counts]);
  const latest = chart && latestTrend(chart.points);
  if (!latest?.recent) return null; // Only a current trend is worth a place on the card
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}
      title={`Vehicles in view over the last ${counts.length > 1 ? Math.round((counts.at(-1).time - counts[0].time) / 60_000) : 0} minutes: the average over ${TREND_WINDOW / 60_000} minutes, with its 95% band, on this camera's own scale`}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend in vehicles in view" style={{ overflow: 'visible' }}>
        <path d={chart.band} fill={colour} fillOpacity={0.2} />
        <path d={chart.line} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>Vehicles, 30 min</Typography>
    </Box>
  );
}
