import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';

import MapLegend from './MapLegend';
import { useTouch } from '../hooks/useScreen';
import {
  CHANGE_KEY, CHANGE_SIGNS, VEHICLE_CLASSES, changeColour, countedTo,
} from '../utils';

const dayFormat = new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// Names each colour of the traffic counts, and says how old the counts are: they come in days late.
// Each colour is a button that shows or hides those places (`hidden`, toggled by `onToggle(level)`),
// e.g. to see only the roads busier than recent years. Above them, which vehicles are compared
// (`vehicles`, chosen with `onVehicles`): all, or heavy or light ones, e.g. to see freight detours.
export default function CountsLegend({
  sites, hidden, onToggle, vehicles, onVehicles,
}) {
  const dark = useTheme().palette.mode === 'dark';
  const touch = useTouch(); // Taller buttons, for fingers
  const counted = countedTo(sites);
  const day = iso => dayFormat.format(new Date(iso));
  // Folded, what it's set to that changes the map, e.g. "Heavy · 2 hidden"
  const note = [
    vehicles !== 'all' && VEHICLE_CLASSES[vehicles].replace(' vehicles', ''),
    hidden.length > 0 && `${hidden.length} hidden`,
  ].filter(Boolean).join(' · ');
  return (
    <MapLegend name="counts" title="Traffic against recent years" note={note} label="Traffic counts key">
      <ToggleButtonGroup
        exclusive
        size="small"
        value={vehicles}
        onChange={(e, value) => value && onVehicles(value)} // Always one chosen
        aria-label="Vehicles compared"
        sx={{
          my: 0.5,
          '& .MuiToggleButton-root': {
            py: touch ? 0.5 : 0, px: touch ? 1.25 : 0.75, fontSize: '0.6875rem', textTransform: 'none', lineHeight: 1.6,
          },
        }}
      >
        {Object.entries(VEHICLE_CLASSES).map(([value, label]) => (
          <ToggleButton key={value} value={value} aria-label={label}>{label.replace(' vehicles', '')}</ToggleButton>
        ))}
      </ToggleButtonGroup>
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
              <ButtonBase
                aria-pressed={shown}
                onClick={() => onToggle(level)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1, width: '100%', minHeight: touch ? 28 : 0,
                  borderRadius: 0.5, font: 'inherit', textAlign: 'left',
                  opacity: shown ? 1 : 0.45, textDecoration: shown ? 'none' : 'line-through',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
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
              </ButtonBase>
            </li>
          );
        })}
      </Box>
    </MapLegend>
  );
}
