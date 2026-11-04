import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import MapPopup from './MapPopup';
import { seriesColour } from './VehicleTrend';
import { VEHICLES } from '../../shared/vehicleClasses';
import {
  CHANGE_LABELS, VEHICLE_CLASSES, changeColour, changeLevel, changesOf, fetchJson, formatChange, siteChange,
} from '../utils';

// Dates are days (UTC midnights), not moments
const dayFormat = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = iso => dayFormat.format(new Date(iso));
const number = new Intl.NumberFormat('en-NZ');

// Each site's daily counts, fetched once for each latest day it has
const details = new Map();
const fetchDetails = (site) => {
  const key = `${site.ref}:${site.latest}`;
  if (!details.has(key)) {
    const request = fetchJson(`/api/traffic-counts/${encodeURIComponent(site.ref)}`);
    request.catch(() => details.delete(key)); // Tried again next time
    details.set(key, request);
  }
  return details.get(key);
};

const W = 280;
const TIGHT = { lineHeight: 1.3 };
const SHOWN_DAYS = 35; // Of each site's daily counts, as the server sends them (server/trafficCounts.js)
const DAY = 86_400_000;

const isWeekend = iso => [0, 6].includes(new Date(iso).getUTCDay());

// Each weekend in `days` as [first, last] indexes (cut short at either end of the chart)
const weekends = days => days.reduce((runs, d, i) => {
  if (!isWeekend(d.date)) return runs;
  if (runs.length && runs.at(-1)[1] === i - 1) runs.at(-1)[1] = i;
  else runs.push([i, i]);
  return runs;
}, []);

// The site's daily counts (a line, gaps where not counted) over the same days of recent years,
// averaged (dashed), on shaded weekends: traffic dips at the weekend, more so than most real
// changes. Public holidays are amber, and left out of the comparison (as are the years before's,
// from their average).
function DailyChart({ days, height: H, vehicles }) {
  const theme = useTheme();
  const [now, before] = VEHICLES[vehicles]; // A day's count of those vehicles, and recent years'
  const top = Math.max(1, ...days.flatMap(d => [now(d), before(d)]).filter(v => v !== null));
  const x = i => (i / (days.length - 1)) * W;
  const y = v => H - (v / top) * H;
  const path = count => days
    .map((d, i) => (count(d) === null ? null : `${x(i)},${y(count(d))}`))
    .reduce((parts, point, i) => (point === null ? parts : `${parts}${i && count(days[i - 1]) !== null ? 'L' : 'M'}${point}`), '');
  const half = W / (days.length - 1) / 2; // Half a day's width, either side of its point
  const dark = theme.palette.mode === 'dark';
  const band = (i, fill, title) => {
    const left = Math.max(0, x(i) - half);
    return (
      <rect key={`${i}${title}`} x={left} y={0} width={Math.min(W, x(i) + half) - left} height={H} fill={fill}>
        <title>{title}</title>
      </rect>
    );
  };
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Vehicles a day over five weeks, and the same days of recent years, with weekends and public holidays shaded"
    >
      {weekends(days).map(([first, last]) => {
        const left = Math.max(0, x(first) - half);
        return <rect key={first} x={left} y={0} width={Math.min(W, x(last) + half) - left} height={H} fill={theme.palette.action.selected} />;
      })}
      {days.map((d, i) => {
        if (d.holiday) return band(i, alpha(theme.palette.warning.main, dark ? 0.3 : 0.22), d.holiday);
        return null;
      })}
      <line x1={0} x2={W} y1={H} y2={H} stroke={theme.palette.divider} />
      <path d={path(before)} fill="none" stroke={theme.palette.text.secondary} strokeWidth={1.5} strokeDasharray="3 3" />
      <path d={path(now)} fill="none" stroke={seriesColour(theme)} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// "NGAURANGA SH1 - Telemetry Site 3 - SB" → "NGAURANGA SH1 - Site 3 - SB"
const shortName = name => name.replace(/\bTelemetry Site\b/i, 'Site');

// Each site's monthly history since 2018, fetched once a page load (the server keeps it a day)
const histories = new Map();
const fetchHistory = (ref) => {
  if (!histories.has(ref)) {
    const request = fetchJson(`/api/traffic-counts/${encodeURIComponent(ref)}/history`).then(({ months }) => months);
    request.catch(() => histories.delete(ref)); // Tried again next time
    histories.set(ref, request);
  }
  return histories.get(ref);
};

// A month's average daily count of a class of vehicles (null if too few days were counted)
const MONTHLY = {
  all: m => m.total,
  heavy: m => m.heavy,
  light: m => (m.total === null ? null : m.total - m.heavy),
};
const LONG_H = 26;

// A site's average day each month since 2018 (a line, gaps where too few days were counted), with
// its years marked: lockdowns, growth, a new road nearby, where the five weeks above can't show them
function LongTermChart({ months, vehicles }) {
  const theme = useTheme();
  const count = MONTHLY[vehicles];
  const values = months.map(count);
  const top = Math.max(1, ...values.filter(v => v !== null));
  const x = i => (i / Math.max(1, months.length - 1)) * W;
  const y = v => LONG_H - (v / top) * LONG_H;
  const path = values.reduce((parts, v, i) => (v === null ? parts : `${parts}${i && values[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`), '');
  const years = months.flatMap((m, i) => (m.month.endsWith('-01') ? [[i, m.month.slice(0, 4)]] : []));
  const tick = { fill: theme.palette.text.secondary, fontSize: 9 };
  return (
    <svg
      viewBox={`0 0 ${W} ${LONG_H + 11}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={`Average vehicles a day each month, ${months[0].month.slice(0, 4)} to ${months.at(-1).month.slice(0, 4)}`}
    >
      {years.map(([i, year]) => (
        <g key={year}>
          <line x1={x(i)} x2={x(i)} y1={0} y2={LONG_H} stroke={theme.palette.divider} />
          {/* Every other year labelled, where they'd crowd */}
          {(years.length < 6 || Number(year) % 2 === 0) && <text x={x(i) + 2} y={LONG_H + 9} style={tick}>{year}</text>}
        </g>
      ))}
      <path d={path} fill="none" stroke={seriesColour(theme)} strokeWidth={1.25} strokeLinejoin="round" />
    </svg>
  );
}

function useHistory(ref, enabled) {
  const [months, setMonths] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    fetchHistory(ref).then(found => current && setMonths(found)).catch(() => {});
    return () => { current = false; };
  }, [ref, enabled]);
  return months;
}

// A site's daily counts, fetched with its row
function useDays(site) {
  const [days, setDays] = useState(null);
  useEffect(() => {
    let current = true;
    fetchDetails(site).then(full => current && setDays(full.days)).catch(() => {});
    return () => { current = false; };
  }, [site]);
  return days;
}

// One site: its name and change on a line, the details under it, and its five weeks charted
function CountRow({
  site, chartHeight, showLatest, vehicles, history,
}) {
  const months = useHistory(site.ref, history);
  const theme = useTheme();
  const days = useDays(site);
  const change = siteChange(site, vehicles);
  const { week, month } = changesOf(site, vehicles);
  const level = changeLevel(change);
  const average = vehicles === 'all' && site.aadt.findLast(v => v); // Of all vehicles
  // The change in bold is the week's (as on the map), or the four weeks' without one; the four
  // weeks' also goes under the week's, steadier
  const headline = week !== null ? `Week ${formatChange(week)}` : month !== null && `4 weeks ${formatChange(month)}`;
  const details = [
    week !== null && month !== null && `4 weeks ${formatChange(month)}`,
    change === null && 'Too few days to compare',
    showLatest && `to ${day(site.latest)}`,
    average && `${number.format(average)} a day last year`,
  ].filter(Boolean);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Box
          role="img"
          aria-label={CHANGE_LABELS[level]}
          sx={{ width: 9, height: 9, borderRadius: '2px', flexShrink: 0, bgcolor: changeColour(level, theme.palette.mode === 'dark') }}
        />
        <Typography variant="body2" sx={{ ...TIGHT, fontWeight: 500, flex: 1 }}>{shortName(site.name)}</Typography>
        <Typography variant="body2" sx={{ ...TIGHT, fontWeight: 700, whiteSpace: 'nowrap' }}>{headline || '–'}</Typography>
      </Box>
      <Typography variant="caption" component="p" sx={{ ...TIGHT, color: 'text.secondary', ml: 2, mb: 0.25 }}>
        {details.join(' · ')}
      </Typography>
      {/* Until they've loaded, the charts' space is kept, in their proportions (they scale with
          the popup's width), so nothing moves when they arrive */}
      {days ? <DailyChart days={days} height={chartHeight} vehicles={vehicles} /> : <Box sx={{ aspectRatio: `${W} / ${chartHeight}` }} />}
      {history && (
        <>
          <Typography variant="caption" sx={{ ...TIGHT, color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {months?.length > 1 ? `Each month since ${months[0].month.slice(0, 4)}` : '\u00a0'}
          </Typography>
          {months?.length > 1
            ? <LongTermChart months={months} vehicles={vehicles} />
            : <Box sx={{ aspectRatio: `${W} / ${LONG_H + 11}` }} />}
        </>
      )}
    </Box>
  );
}

// The charts' key, each mark drawn as it is in them
function ChartKey() {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const line = props => <line x1={1} x2={17} y1={5} y2={5} strokeWidth={2} strokeLinecap="round" {...props} />;
  const block = fill => <rect x={4} y={0} width={10} height={10} fill={fill} />;
  const marks = [
    [line({ stroke: seriesColour(theme), strokeWidth: 1.25 }), 'This year'],
    [line({ stroke: theme.palette.text.secondary, strokeWidth: 1.5, strokeDasharray: '3 3', strokeLinecap: 'butt' }), 'Recent years'],
    [block(theme.palette.action.selected), 'Weekend'],
    [block(alpha(theme.palette.warning.main, dark ? 0.3 : 0.22)), 'Holiday'],
  ];
  return (
    <Box component="ul" sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0.25, m: 0, p: 0, listStyle: 'none' }}>
      {marks.map(([mark, label]) => (
        <Typography component="li" variant="caption" key={label} sx={{ ...TIGHT, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <svg width="18" height="10" aria-hidden="true">{mark}</svg>
          {label}
        </Typography>
      ))}
    </Box>
  );
}

// The counting sites at a place, compactly: what they're compared with and the chart's key once,
// each site's name, change and chart (smaller, the more there are, to fit a popup), and with
// `longTerm` (by default, for a place with one or two sites, so a popup still fits the map) its
// years since 2018 under it
export function CountList({ sites, vehicles = 'all', longTerm = sites.length <= 2 }) {
  const latest = new Set(sites.map(site => site.latest));
  const shared = latest.size === 1 ? sites[0].latest : null;
  const caption = { ...TIGHT, color: 'text.secondary', display: 'block' };
  return (
    <Box>
      <Typography variant="caption" sx={{ ...caption, mb: 0.75 }}>
        {VEHICLE_CLASSES[vehicles]} against the same days of the last 3 years{shared && `, to ${day(shared)}`}
      </Typography>
      {sites.map((site, i) => (
        <Box key={site.ref} sx={{ mt: i ? 1 : 0 }}>
          <CountRow
            site={site}
            chartHeight={sites.length > 2 ? 30 : 44}
            showLatest={!shared}
            vehicles={vehicles}
            history={longTerm}
          />
        </Box>
      ))}
      <Typography variant="caption" sx={{ ...caption, mt: 0.75 }}>
        Vehicles a day{shared && `, ${day(Date.parse(shared) - (SHOWN_DAYS - 1) * DAY)} – ${day(shared)}`}
      </Typography>
      <ChartKey />
    </Box>
  );
}

// The counting sites at a hovered place (often both directions of a road, or an interchange's ramps)
export default function CountPopup({
  map, lngLat, sites, vehicles, onClose,
}) {
  return (
    <MapPopup map={map} lngLat={lngLat} onClose={onClose} sx={{ p: 1.25, width: 340 }}>
      <CountList sites={sites} vehicles={vehicles} />
    </MapPopup>
  );
}
