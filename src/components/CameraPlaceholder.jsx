import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { LIGHTBLACK } from '../consts';

// Stands in for the camera image when there is none to show
export default function CameraPlaceholder({ title, detail }) {
  return (
    <Box
      role="img"
      aria-label={title}
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        p: 2,
        textAlign: 'center',
        color: LIGHTBLACK,
        bgcolor: 'grey.100',
        backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 12px, rgba(0,0,0,0.035) 12px 24px)',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{title}</Typography>
      {detail && <Typography variant="caption">{detail}</Typography>}
    </Box>
  );
}
