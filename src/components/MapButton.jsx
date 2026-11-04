import { forwardRef } from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';

import Icon from './Icon';

// A button over the map that's an icon (see Icon), as MapLibre's zoom buttons beside it are:
// square, in the theme's colour. Named by `label`, for screen readers and as its tooltip; any
// other props go to the button (e.g. a menu's aria-expanded).
const MapButton = forwardRef(function MapButton({ icon, label, ...props }, ref) {
  return (
    <Tooltip title={label}>
      <Button
        ref={ref}
        variant="contained"
        size="small"
        aria-label={label}
        sx={{
          minWidth: 0, width: 31, height: 31, p: 0, opacity: 0.85,
        }}
        {...props}
      >
        <Icon name={icon} fontSize="small" />
      </Button>
    </Tooltip>
  );
});

export default MapButton;
