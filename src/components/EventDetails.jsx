import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { eventImpacts } from '../consts';

export const timeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland',
});

export const impactOf = event => eventImpacts[event.impact] ?? { label: event.impact, color: '#888' };

export function Detail({ label, children }) {
  if (!children) return null;
  return (
    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, whiteSpace: 'pre-line' }}>
      <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{label}: </Box>
      {children}
    </Typography>
  );
}

// A road event's details: what, where, NZTA's comments, any detour, and when it clears
export default function EventDetails({ event }) {
  const impact = impactOf(event);
  return (
    <>
      <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.4 }}>
        {impact.label} · {event.planned ? event.type : 'Unplanned'}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 500, lineHeight: 1.3 }}>
        {event.cause}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>{event.area}</Typography>
      {event.comments && (
        <Typography variant="body2" sx={{ color: 'text.primary', mt: 1 }}>{event.comments}</Typography>
      )}
      <Detail label="Detour">{event.alternative}</Detail>
      <Detail label="Expected to clear">{event.resolution}</Detail>
      <Detail label="Since">{event.start && timeFormat.format(new Date(event.start))}</Detail>
    </>
  );
}
