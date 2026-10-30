import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import MapPopup from './MapPopup';
import { BLACK, LIGHTBLACK, eventImpacts } from '../consts';

const timeFormat = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland',
});

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <Typography variant="body2" sx={{ color: LIGHTBLACK, mt: 0.75, whiteSpace: 'pre-line' }}>
      <Box component="span" sx={{ fontWeight: 500, color: BLACK }}>{label}: </Box>
      {children}
    </Typography>
  );
}

// The details of a hovered road event
export default function EventPopup({ map, event, lngLat }) {
  const impact = eventImpacts[event.impact] ?? { label: event.impact, color: '#888' };
  return (
    <MapPopup map={map} lngLat={lngLat} sx={{ p: 1.5, width: 300, borderTop: `4px solid ${impact.color}` }}>
      <Typography variant="overline" sx={{ color: LIGHTBLACK, lineHeight: 1.4 }}>
        {impact.label} · {event.planned ? event.type : 'Unplanned'}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: BLACK, fontWeight: 500, lineHeight: 1.3 }}>
        {event.cause}
      </Typography>
      <Typography variant="body2" sx={{ color: LIGHTBLACK }}>{event.area}</Typography>
      {event.comments && (
        <Typography variant="body2" sx={{ color: BLACK, mt: 1 }}>{event.comments}</Typography>
      )}
      <Detail label="Detour">{event.alternative}</Detail>
      <Detail label="Expected to clear">{event.resolution}</Detail>
      <Detail label="Since">{event.start && timeFormat.format(new Date(event.start))}</Detail>
    </MapPopup>
  );
}
