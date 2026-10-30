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

export const makeTheme = mode => createTheme({ palette: PALETTES[mode] });

// The theme setting, in the order the top-bar button cycles through them
export const THEME_SETTINGS = ['auto', 'light', 'dark'];
