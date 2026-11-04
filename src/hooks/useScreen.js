import useMediaQuery from '@mui/material/useMediaQuery';

import { NARROW, PHONE, TOUCH } from '../consts';

// What sort of screen this is, known from the first render (noSsr), so nothing starts out laid
// out for the wrong one
const useQuery = query => useMediaQuery(query, { noSsr: true });

export const usePhone = () => useQuery(PHONE);
export const useNarrow = () => useQuery(NARROW);
export const useTouch = () => useQuery(TOUCH);
