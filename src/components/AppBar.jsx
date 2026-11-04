import { useState } from 'react';
import MuiAppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import AboutDialog from './AboutDialog';
import Arrow from './Arrow';
import Icon from './Icon';
import { THEME_SETTINGS, capsPadding } from '../theme';
import useNow from '../hooks/useNow';
import { usePhone } from '../hooks/useScreen';
import { version } from '../../package.json';

// The clock (on a wide screen, e.g. a dashboard left up on a wall), in New Zealand's time, as the
// viewer's browser writes dates and times (its language, 12- or 24-hour, the day's order): the
// day spelt out, and to the minute, not ticking seconds. Seen from another time zone, it says
// it's New Zealand's. e.g. "Wednesday, 4 November at 5:17 pm"
const NZ = 'Pacific/Auckland';
const clockFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: NZ,
  ...(Intl.DateTimeFormat().resolvedOptions().timeZone !== NZ && { timeZoneName: 'short' }),
});

const CONGESTION_FILTERS = [
  ['all', 'All'],
  ['moderate', 'Moderate+'],
  ['heavy', 'Heavy+'],
];

const THEME_LABELS = { auto: 'Auto', light: 'Light', dark: 'Dark' };

// The colour theme, as an icon (a sun, a moon, or A for following the system's), stepping
// through Auto, Light and Dark
function ThemeButton({ themeSetting, mode, onThemeSetting }) {
  const next = THEME_SETTINGS[(THEME_SETTINGS.indexOf(themeSetting) + 1) % THEME_SETTINGS.length];
  const now = themeSetting === 'auto' ? `Auto (${mode}, as your system is)` : THEME_LABELS[themeSetting];
  return (
    <Tooltip title={`Colour theme: ${now}. Click for ${THEME_LABELS[next]}`}>
      <IconButton aria-label={`Colour theme: ${now}`} onClick={() => onThemeSetting(next)}>
        <Icon name={themeSetting} />
      </IconButton>
    </Tooltip>
  );
}

// On a phone, one line: the title, the congestion filter as a dropdown, and the rest in a menu
function PhoneBar({
  loopAll, onToggleLoopAll, congestionFilter, onCongestionFilter, themeSetting, mode, onThemeSetting, onBack, onAbout,
}) {
  const [anchor, setAnchor] = useState(null);
  const close = () => setAnchor(null);
  const tick = on => <ListItemIcon sx={{ visibility: on ? 'visible' : 'hidden' }}><Icon name="check" fontSize="small" /></ListItemIcon>;
  return (
    <MuiAppBar position="static" color="default">
      <Toolbar variant="dense" sx={{ gap: 1, px: 1.5 }}>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}>
          NZ Traffic Dashboard
        </Typography>
        {onBack && <Button size="small" variant="outlined" onClick={onBack} startIcon={<Arrow bearing={270} />}>Dashboard</Button>}
        {!onBack && congestionFilter && (
          <TextField
            select
            size="small"
            label="Congestion"
            value={congestionFilter}
            onChange={e => onCongestionFilter(e.target.value)}
            sx={{ width: 128, '& .MuiSelect-select': { py: 0.5 } }}
          >
            {CONGESTION_FILTERS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
        )}
        <IconButton
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={e => setAnchor(e.currentTarget)}
        >
          <Icon name="more" />
        </IconButton>
        <Menu anchorEl={anchor} open={!!anchor} onClose={close}>
          {!onBack && (
            <MenuItem role="menuitemcheckbox" aria-checked={loopAll} onClick={onToggleLoopAll}>
              {tick(loopAll)}Loop all cameras
            </MenuItem>
          )}
          {!onBack && <Divider />}
          <MenuItem disabled sx={{ typography: 'caption' }}>Colour theme</MenuItem>
          {THEME_SETTINGS.map(setting => (
            <MenuItem
              key={setting}
              role="menuitemradio"
              aria-checked={themeSetting === setting}
              onClick={() => { onThemeSetting(setting); close(); }}
            >
              {tick(themeSetting === setting)}{THEME_LABELS[setting]}{setting === 'auto' && ` (${mode} now)`}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={() => { close(); onAbout(); }}>About (v{version})</MenuItem>
        </Menu>
      </Toolbar>
    </MuiAppBar>
  );
}

// congestionFilter is null when traffic data isn't available. onBack: on a page other than the
// dashboard, which has a way back instead of the dashboard's controls
export default function AppBar(props) {
  const phone = usePhone();
  const [about, setAbout] = useState(false);
  const Bar = phone ? PhoneBar : WideBar;
  return (
    <>
      <Bar {...props} onAbout={() => setAbout(true)} />
      <AboutDialog open={about} onClose={() => setAbout(false)} />
    </>
  );
}

function WideBar({
  loopAll, onToggleLoopAll, congestionFilter, onCongestionFilter, themeSetting, mode, onThemeSetting, onBack, onAbout,
}) {
  const now = useNow(5000); // To the minute, a few seconds late at most
  return (
    <MuiAppBar position="static" color="default">
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
        <Typography variant="h6" noWrap>
          NZ Traffic Dashboard
        </Typography>
        <Typography variant="subtitle1" noWrap sx={{ flex: 1, textAlign: 'center', color: 'text.secondary', display: { xs: 'none', lg: 'block' } }}>
          {clockFormat.format(now)}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
          {onBack && <Button size="small" variant="outlined" onClick={onBack} startIcon={<Arrow bearing={270} />}>Dashboard</Button>}
          {!onBack && congestionFilter && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" id="congestion-filter" sx={{ whiteSpace: 'nowrap' }}>Congestion</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                color="primary"
                value={congestionFilter}
                onChange={(e, value) => value && onCongestionFilter(value)} // Always one chosen
                aria-labelledby="congestion-filter"
              >
                {CONGESTION_FILTERS.map(([value, label]) => <ToggleButton key={value} value={value} sx={capsPadding(2)}>{label}</ToggleButton>)}
              </ToggleButtonGroup>
            </Box>
          )}
          {!onBack && (
            <FormControlLabel
              control={<Switch size="small" checked={loopAll} onChange={onToggleLoopAll} />}
              label="Loop all"
              slotProps={{ typography: { variant: 'body2' } }}
              sx={{ mr: 0 }}
            />
          )}
          <ThemeButton themeSetting={themeSetting} mode={mode} onThemeSetting={onThemeSetting} />
          <Link component="button" variant="subtitle1" color="secondary" underline="hover" onClick={onAbout} title="About, sources and source code">
            v{version}
          </Link>
        </Box>
      </Toolbar>
    </MuiAppBar>
  );
}
