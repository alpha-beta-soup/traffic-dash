import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';

import { NARROW, PHONE } from '../consts';

// The cities, by their airports' codes for when there's little room
export const CITIES = {
  Auckland: { code: 'AKL', lngLat: [174.7633, -36.8484] },
  Hamilton: { code: 'HLZ', lngLat: [175.2793, -37.7870] },
  Wellington: { code: 'WLG', lngLat: [174.7762, -41.2865] },
  Christchurch: { code: 'CHC', lngLat: [172.6362, -43.5321] },
  Dunedin: { code: 'DUD', lngLat: [170.5028, -45.8788] },
};

const BUTTON_SX = { opacity: 0.85 };

// Buttons to go to each city (`onGo([lon, lat])`): named in full on a wide screen, by airport
// code on a narrower one, and in a menu on a phone
export default function CityButtons({ onGo }) {
  const phone = useMediaQuery(PHONE);
  const narrow = useMediaQuery(NARROW);
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
