import MuiAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

import ToggleButton from './ToggleButton';
import { THEME_SETTINGS } from '../theme';
import useNow from '../hooks/useNow';
import { version } from '../../package.json';

const clockFormat = new Intl.DateTimeFormat('en-NZ', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'Pacific/Auckland',
});

const CONGESTION_FILTERS = [
  ['all', 'All'],
  ['moderate', 'Moderate+'],
  ['heavy', 'Heavy+'],
];

// congestionFilter is null when traffic data isn't available
export default function AppBar({
  loopAll, onToggleLoopAll, congestionFilter, onCongestionFilter, themeSetting, mode, onThemeSetting,
}) {
  const now = useNow(1000);
  return (
    <MuiAppBar position="static" color="default">
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
        <Typography variant="h6" noWrap>
          NZ Traffic Dashboard
        </Typography>
        <Typography variant="h6" noWrap sx={{ flex: 1, textAlign: 'center', display: { xs: 'none', lg: 'block' } }}>
          {clockFormat.format(now)}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
          {congestionFilter && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} role="group" aria-label="Congestion filter">
              <Typography variant="body2" sx={{ mr: 0.5, whiteSpace: 'nowrap' }}>Congestion</Typography>
              {CONGESTION_FILTERS.map(([value, label]) => (
                <ToggleButton key={value} on={congestionFilter === value} onClick={() => onCongestionFilter(value)} offVariant="outlined">
                  {label}
                </ToggleButton>
              ))}
            </Box>
          )}
          <ToggleButton on={loopAll} onClick={onToggleLoopAll} offVariant="outlined">Loop all</ToggleButton>
          {/* Cycles Auto (follow the system), Light and Dark */}
          <Button
            size="small"
            variant="outlined"
            title="Colour theme: Auto follows your system's light or dark setting"
            onClick={() => onThemeSetting(THEME_SETTINGS[(THEME_SETTINGS.indexOf(themeSetting) + 1) % THEME_SETTINGS.length])}
          >
            {themeSetting === 'auto' ? `Auto (${mode})` : themeSetting}
          </Button>
          <Typography variant="subtitle1" color="secondary">
            v{version}
          </Typography>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}
