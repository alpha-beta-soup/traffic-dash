// maplibre-gl, set up for this app: import it from here rather than from 'maplibre-gl'
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { alpha } from '@mui/material/styles';
import { omProtocol } from '@openmeteo/weather-map-layer';

// maplibre-gl 6 looks for its worker next to its own module, which isn't there once
// Vite has pre-bundled (dev) or bundled (build) it; so point it at the real file
maplibregl.setWorkerUrl(workerUrl);

// Open-Meteo's weather files as map sources: 'om://' + a file URL (see map/layers.js, the wind)
maplibregl.addProtocol('om', omProtocol);

export default maplibregl;

// Material's "info" icon (outlined), for the button that opens the map's credits on a narrow map
const INFO = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28" fill="rgba(0,0,0,0.75)"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
)}")`;

// MapLibre's own controls, in either theme:
// - the zoom and compass buttons like the app's buttons over the map (MUI's small contained ones):
//   its primary colour, an icon in its contrasting text colour, its corners, shadow and opacity
// - a slimmer scale bar, whose 10px text otherwise sits in the map's 20px lines (by its own
//   selector, so the dark theme's colours below add to it)
const BUTTON = 31; // px: as tall as a small MUI button
export const mapControls = {
  '& .maplibregl-ctrl.maplibregl-ctrl-group': {
    bgcolor: 'primary.main', borderRadius: 1, boxShadow: 2, opacity: 0.85, overflow: 'hidden',
  },
  '& .maplibregl-ctrl-group button': {
    width: BUTTON,
    height: BUTTON,
    '&:not(:disabled):hover': { bgcolor: 'primary.dark' },
    '& + button': { borderTop: theme => `1px solid ${alpha(theme.palette.primary.contrastText, 0.3)}` },
  },
  // The icons are dark; made white, or kept dark, as the theme's text on its primary colour is
  '& .maplibregl-ctrl-group .maplibregl-ctrl-icon': {
    filter: theme => (theme.palette.primary.contrastText === '#fff' ? 'brightness(0) invert(1)' : 'brightness(0)'),
  },
  '& .maplibregl-ctrl-attrib-button': { backgroundImage: INFO },
  '& .maplibregl-ctrl.maplibregl-ctrl-scale': { lineHeight: '12px', px: '4px', borderWidth: '0 1.5px 1.5px' },
};

// MapLibre's scale and credits are light; on the dark theme, give them its colours
export const mapControlsDark = {
  '& .maplibregl-ctrl-scale': {
    bgcolor: theme => alpha(theme.palette.background.paper, 0.8), color: 'text.secondary', borderColor: 'text.secondary',
  },
  '& .maplibregl-ctrl-attrib': { bgcolor: theme => alpha(theme.palette.background.paper, 0.8), color: 'text.secondary' },
  '& .maplibregl-ctrl-attrib a': { color: 'text.secondary' },
  '& .maplibregl-ctrl-attrib-button': { filter: 'invert(1)' }, // The ⓘ on a narrow map
};
