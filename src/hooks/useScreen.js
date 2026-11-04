import useMediaQuery from '@mui/material/useMediaQuery';

import { NARROW, PHONE, TOUCH } from '../consts';

// What sort of screen this is, known from the first render (noSsr), so nothing starts out laid
// out for the wrong one
const useQuery = query => useMediaQuery(query, { noSsr: true });

export const usePhone = () => useQuery(PHONE);
export const useNarrow = () => useQuery(NARROW);
export const useTouch = () => useQuery(TOUCH);

// Where a snackbar about a card's buttons goes: on a phone, at the top, clear of the buttons (at
// the bottom of the screen, under a phone's row of cameras); elsewhere MUI's usual corner
export const useNoticePlace = () => (usePhone()
  ? { vertical: 'top', horizontal: 'center' }
  : { vertical: 'bottom', horizontal: 'left' });
