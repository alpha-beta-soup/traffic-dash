// maplibre-gl, set up for this app: import it from here rather than from 'maplibre-gl'
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { alpha } from '@mui/material/styles';

// maplibre-gl 6 looks for its worker next to its own module, which isn't there once
// Vite has pre-bundled (dev) or bundled (build) it; so point it at the real file
maplibregl.setWorkerUrl(workerUrl);

export default maplibregl;

// MapLibre's own controls are light; on the dark theme, give them its colours
export const mapControlsDark = {
  '& .maplibregl-ctrl-group': { bgcolor: 'background.paper' },
  '& .maplibregl-ctrl-group button + button': { borderTopColor: 'divider' },
  '& .maplibregl-ctrl-icon': { filter: 'invert(1)' },
  '& .maplibregl-ctrl-scale': {
    bgcolor: theme => alpha(theme.palette.background.paper, 0.8), color: 'text.secondary', borderColor: 'text.secondary',
  },
  '& .maplibregl-ctrl-attrib': { bgcolor: theme => alpha(theme.palette.background.paper, 0.8), color: 'text.secondary' },
  '& .maplibregl-ctrl-attrib a': { color: 'text.secondary' },
};
