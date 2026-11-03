import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

import { LEGEND_SX } from './CongestionLegend';
import {
  CHANGE_KEY, CHANGE_SIGNS, changeColour, countedTo,
} from '../utils';

const dayFormat = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Names each colour of the traffic counts, and says how old the counts are: they come in days late.
// Each colour is a button that shows or hides those places (`hidden`, toggled by `onToggle(level)`),
// e.g. to see only the roads busier than a year before.
export default function CountsLegend({ sites, hidden, onToggle }) {
  const dark = useTheme().palette.mode === 'dark';
  const counted = countedTo(sites);
  const day = iso => dayFormat.format(new Date(iso));
  return (
    <Box sx={LEGEND_SX} aria-label="Traffic counts key">
      <Box sx={{ fontWeight: 500 }}>Traffic against a year before</Box>
      {counted && (
        <Box sx={{ color: 'text.secondary' }}>
          Counted to {day(counted.half)}{counted.newest !== counted.half && `, some to ${day(counted.newest)}`}
        </Box>
      )}
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {CHANGE_KEY.map(([level, label]) => {
          const shown = !hidden.includes(level);
          return (
            <li key={level}>
              <Box
                component="button"
                type="button"
                aria-pressed={shown}
                onClick={() => onToggle(level)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, width: '100%', p: 0, border: 0, borderRadius: 0.5,
                  bgcolor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer',
                  opacity: shown ? 1 : 0.45, textDecoration: shown ? 'none' : 'line-through',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
                }}
              >
                <Box sx={{
                  width: 13, height: 13, mx: '2px', borderRadius: '3px', flexShrink: 0, bgcolor: changeColour(level, dark),
                  color: CHANGE_SIGNS[level]?.[1], fontSize: 11, fontWeight: 700, lineHeight: '13px', textAlign: 'center',
                }}
                >
                  {CHANGE_SIGNS[level]?.[0]}
                </Box>
                {label}
              </Box>
            </li>
          );
        })}
      </Box>
      <Box sx={{ color: 'text.secondary', fontSize: '0.6875rem' }}>Click to show or hide</Box>
    </Box>
  );
}
