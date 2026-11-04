import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';

import useStoredSetting from '../hooks/useStoredSetting';
import { usePhone, useTouch } from '../hooks/useScreen';

const PANEL_SX = {
  m: 0, px: 1, py: 0.5, bgcolor: theme => alpha(theme.palette.background.paper, 0.9), borderRadius: 1, boxShadow: 1,
  fontSize: '0.75rem', color: 'text.primary',
};

// A key's panel on the map (see the legends in Map), which folds to its `title` to clear the
// map, with a `note` of anything it's set to that changes what's shown (e.g. levels hidden).
// Folded at first on a phone; remembered by `name`, for phones and wider screens apart.
export default function MapLegend({ name, ...props }) {
  const phone = usePhone();
  // Keyed, to start again from what's remembered for the other sort of screen
  return <Panel key={phone} setting={`legend-${name}-open${phone ? '-phone' : ''}`} openAtFirst={!phone} {...props} />;
}

function Panel({
  setting, openAtFirst, title, note, label, children,
}) {
  const [open, setOpen] = useStoredSetting(setting, openAtFirst);
  const touch = useTouch();
  return (
    <Box sx={PANEL_SX} aria-label={label}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(on => !on)}
        sx={{
          display: 'flex', alignItems: 'baseline', gap: 0.5, width: '100%', py: touch ? 0.75 : 0, px: 0, border: 0, bgcolor: 'transparent',
          color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer',
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
        }}
      >
        <Box component="span" sx={{ fontWeight: 500 }}>{title}</Box>
        {!open && note && <Box component="span" sx={{ color: 'text.secondary' }}>· {note}</Box>}
        <Box component="span" aria-hidden="true" sx={{ ml: 'auto', pl: 0.5, color: 'text.secondary' }}>{open ? '▾' : '▸'}</Box>
      </Box>
      {open && children}
    </Box>
  );
}
