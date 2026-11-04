import { createTheme } from '@mui/material/styles';

// Light: the dashboard's original navy and slate text. Dark: cool greys on near-black, to sit
// with the dark base map. Components use the palette (text.primary, background.paper…) rather
// than fixed colours, so both work.
const PALETTES = {
  light: {
    mode: 'light',
    text: { primary: '#113654', secondary: '#485d6f' },
  },
  dark: {
    mode: 'dark',
    primary: { main: '#64a8f0' },
    text: { primary: '#e3eaf1', secondary: '#9fb0c0' },
    background: { default: '#0e1317', paper: '#161d23' },
  },
};

// Buttons' text is in capitals, which sit high in their line: it keeps room below for
// descenders, which capitals don't use. Each button's padding moves its text down, top added and
// bottom taken, so it keeps its height: 0.18em (2.3 px at a small button's 13 px), as measured in
// MUI's buttons' line (1.75 high). `capsPadding(px)`: the same, for a button whose padding is
// set by hand.
const CAPS_DROP = '0.18em';
export const capsPadding = px => ({ paddingTop: `calc(${px}px + ${CAPS_DROP})`, paddingBottom: `calc(${px}px - ${CAPS_DROP})` });
// MUI's own vertical padding (px), by variant and size
const BUTTON_PADDING = {
  text: { small: 4, medium: 6, large: 8 },
  outlined: { small: 3, medium: 5, large: 7 },
  contained: { small: 4, medium: 6, large: 8 },
};
const TOGGLE_PADDING = { small: 7, medium: 11, large: 15 };

const components = {
  MuiButton: {
    styleOverrides: {
      root: ({ ownerState: { variant = 'text', size = 'medium' } }) => capsPadding(BUTTON_PADDING[variant]?.[size] ?? 6),
    },
  },
  MuiToggleButton: {
    styleOverrides: { root: ({ ownerState: { size = 'medium' } }) => capsPadding(TOGGLE_PADDING[size]) },
  },
};

export const makeTheme = mode => createTheme({ palette: PALETTES[mode], components });

// The theme setting, in the order the top-bar button cycles through them
export const THEME_SETTINGS = ['auto', 'light', 'dark'];
