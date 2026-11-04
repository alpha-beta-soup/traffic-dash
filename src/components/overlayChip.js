import { alpha } from '@mui/material/styles';

// A chip over a camera's image (its time, weather, a road event or a weather warning): small, on a
// mostly opaque patch of the page's colour, so it reads over any picture
const overlayChip = {
  bgcolor: theme => alpha(theme.palette.background.paper, 0.85),
  typography: 'caption',
  height: 20,
};

export default overlayChip;
