import Box from '@mui/material/Box';

// An arrow, drawn rather than a character: fonts set ← ↗ and the like at different heights, most
// of them low on the line. This one is centred on capitals' height. `bearing`: the way it
// points, in degrees clockwise from up (90 is →, 270 is ←).
export default function Arrow({ bearing = 90 }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 16 16"
      aria-hidden="true"
      sx={{
        width: '0.75em', height: '0.75em', verticalAlign: '-0.02em', flexShrink: 0, transform: `rotate(${bearing - 90}deg)`,
      }}
    >
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Box>
  );
}
