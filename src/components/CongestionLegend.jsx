import Box from '@mui/material/Box';

import MapLegend from './MapLegend';
import { congestionEnum } from '../consts';
import { BASE_WIDTH } from '../map/layers';

// Names each congestion level, drawn as it appears on the map (at the zoom-12 base width)
export default function CongestionLegend() {
  const levels = Object.values(congestionEnum).sort((a, b) => b.value - a.value); // Low first
  return (
    <MapLegend name="congestion" title="Congestion now" label="Congestion key">
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
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
    </MapLegend>
  );
}
