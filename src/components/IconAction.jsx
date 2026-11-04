import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';

import Icon from './Icon';

// A button that's an icon (see Icon), named by `label`, for screen readers and as its tooltip.
// `pressed` (true or false) makes it a toggle, tinted while on.
export default function IconAction({
  icon, label, onClick, pressed, disabled, sx,
}) {
  return (
    <Tooltip title={label}>
      {/* A disabled button fires no events, so the tooltip goes on a wrapper */}
      <span>
        <IconButton
          color="primary"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={pressed}
          sx={{ ...(pressed && { bgcolor: theme => alpha(theme.palette.primary.main, 0.14) }), ...sx }}
        >
          <Icon name={icon} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
