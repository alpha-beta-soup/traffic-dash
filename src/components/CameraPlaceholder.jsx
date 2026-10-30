import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

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
        color: 'text.secondary',
        bgcolor: 'action.hover',
        backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 12px, rgba(128,128,128,0.08) 12px 24px)',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>{title}</Typography>
      {detail && <Typography variant="caption">{detail}</Typography>}
    </Box>
  );
}
