import Box from '@mui/material/Box';

import { BLACK, congestionEnum } from '../consts';
import { BASE_WIDTH } from '../map/layers';

// Names each congestion level, drawn as it appears on the map (at the zoom-12 base width)
export default function CongestionLegend() {
  const levels = Object.values(congestionEnum).sort((a, b) => b.value - a.value); // Low first
  return (
    <Box
      component="ul"
      aria-label="Congestion key"
      sx={{
        position: 'absolute', left: 10, bottom: 26, zIndex: 1, m: 0, px: 1, py: 0.5,
        listStyle: 'none', bgcolor: 'rgba(255,255,255,0.9)', borderRadius: 1, boxShadow: 1,
        fontSize: '0.75rem', color: BLACK,
      }}
    >
      {levels.map(({ description, color, width }) => {
        const strokeWidth = BASE_WIDTH[12] * width;
        return (
          <Box component="li" key={description} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <svg width="36" height="12" aria-hidden="true">
              <line
                x1={strokeWidth / 2 + 1}
                x2={36 - strokeWidth / 2 - 1}
                y1="6"
                y2="6"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            </svg>
            {description}
          </Box>
        );
      })}
    </Box>
  );
}
