import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';

import { useNarrow, usePhone } from '../hooks/useScreen';

// The cities, north to south, by their airports' codes for when there's little room
export const CITIES = {
  Auckland: { code: 'AKL', lngLat: [174.7633, -36.8484] },
  Hamilton: { code: 'HLZ', lngLat: [175.2793, -37.7870] },
  Wellington: { code: 'WLG', lngLat: [174.7762, -41.2865] },
  Christchurch: { code: 'CHC', lngLat: [172.6362, -43.5321] },
  Queenstown: { code: 'ZQN', lngLat: [168.6626, -45.0312] },
  Dunedin: { code: 'DUD', lngLat: [170.5028, -45.8788] },
};

// As tall as the map's icon buttons beside them (31 px), with the capitals in the middle: the
// line keeps room below for descenders, which capitals don't use, so they'd sit high (by half
// that room, less the gap above them: 1.5 px), and are moved down
const BUTTON_SX = {
  opacity: 0.85, height: 31, py: 0, pt: '3px', lineHeight: 1,
};

// Buttons to go to each city (`onGo([lon, lat])`): named in full on a wide screen, by airport
// code on a narrower one, and in a menu on a phone
export default function CityButtons({ onGo }) {
  const phone = usePhone();
  const narrow = useNarrow();
  const [anchor, setAnchor] = useState(null);
  if (phone) {
    return (
      <>
        <Button
          variant="contained"
          size="small"
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          onClick={e => setAnchor(e.currentTarget)}
          sx={BUTTON_SX}
        >
          Go to
        </Button>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          {Object.entries(CITIES).map(([city, { lngLat }]) => (
            <MenuItem key={city} dense onClick={() => { setAnchor(null); onGo(lngLat); }}>{city}</MenuItem>
          ))}
        </Menu>
      </>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {Object.entries(CITIES).map(([city, { code, lngLat }]) => {
        const button = (
          <Button
            key={city}
            variant="contained"
            size="small"
            aria-label={narrow ? city : undefined}
            sx={narrow ? { ...BUTTON_SX, minWidth: 0 } : BUTTON_SX}
            onClick={() => onGo(lngLat)}
          >
            {narrow ? code : city}
          </Button>
        );
        return narrow ? <Tooltip key={city} title={city}>{button}</Tooltip> : button;
      })}
    </Box>
  );
}
