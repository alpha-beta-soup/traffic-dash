import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import MapPopup from './MapPopup';
import { seriesColour } from './VehicleTrend';
import {
  CHANGE_LABELS, changeColour, changeLevel, fetchJson, formatChange, siteChange,
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
const H = 64;

// The site's daily counts (a line, gaps where not counted) over the same days a year before (dashed)
function DailyChart({ days }) {
  const theme = useTheme();
  const top = Math.max(1, ...days.flatMap(d => [d.total, d.lastYear]).filter(v => v !== null));
  const x = i => (i / (days.length - 1)) * W;
  const y = v => H - (v / top) * H;
  const path = key => days
    .map((d, i) => (d[key] === null ? null : `${x(i)},${y(d[key])}`))
    .reduce((parts, point, i) => (point === null ? parts : `${parts}${i && days[i - 1][key] !== null ? 'L' : 'M'}${point}`), '');
  const tick = { fill: theme.palette.text.secondary, fontSize: 10 };
  return (
    <svg
      viewBox={`0 -12 ${W} ${H + 26}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Vehicles a day over five weeks, and the same days a year before"
    >
      <line x1={0} x2={W} y1={H} y2={H} stroke={theme.palette.divider} />
      <text x={0} y={-3} style={tick}>{number.format(Math.round(top))}</text>
      <path d={path('lastYear')} fill="none" stroke={theme.palette.text.secondary} strokeWidth={1.5} strokeDasharray="3 3" />
      <path d={path('total')} fill="none" stroke={seriesColour(theme)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <text x={0} y={H + 12} style={tick}>{day(days[0].date)}</text>
      <text x={W} y={H + 12} textAnchor="end" style={tick}>{day(days.at(-1).date)}</text>
    </svg>
  );
}

function CountDetails({ site }) {
  const theme = useTheme();
  const [days, setDays] = useState(null);
  useEffect(() => {
    let current = true;
    fetchDetails(site).then(full => current && setDays(full.days)).catch(() => {});
    return () => { current = false; };
  }, [site]);
  const change = siteChange(site);
  const level = changeLevel(change);
  let period = 'Too few days counted, this year or last, to compare';
  if (site.week !== null) period = `Week to ${day(site.latest)}, against the same days a year before${site.month !== null ? `; four weeks ${formatChange(site.month)}` : ''}`;
  else if (site.month !== null) period = `Four weeks to ${day(site.latest)}, against the same days a year before`;
  const average = site.aadt.findLast(v => v);
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ lineHeight: 1.3 }}>{site.name}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {site.highway && `SH${site.highway} · `}Counted to {day(site.latest)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, bgcolor: changeColour(level, theme.palette.mode === 'dark') }} />
        <Typography variant="body2">
          <b>{CHANGE_LABELS[level]}</b>
          {change !== null && `: ${formatChange(change)}`}
        </Typography>
      </Box>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 0.5 }}>{period}</Typography>
      {days ? <DailyChart days={days} /> : <Box sx={{ height: 80 }} />}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Vehicles a day: line, this year; dashed, a year before.
        {average && ` Average last year ${number.format(average)}.`}
      </Typography>
    </Box>
  );
}

// The counting sites at a hovered place (often both directions of a road)
export default function CountPopup({ map, lngLat, sites }) {
  return (
    <MapPopup map={map} lngLat={lngLat} sx={{ p: 1.5, width: 320 }}>
      {sites.map((site, i) => (
        <Box key={site.ref} sx={{ mt: i ? 2 : 0 }}><CountDetails site={site} /></Box>
      ))}
    </MapPopup>
  );
}
