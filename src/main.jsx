import React from 'react';
import { createRoot } from 'react-dom/client';

// MUI's type is made for Roboto: its weights in use (light headings, regular, medium, bold),
// bundled, so every device has it rather than its own fallback
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/weather-icons.min.css';
import '../styles/weather-icons-wind.min.css';
import '../styles/app.css';

import App from './App';
import { DEFAULT_LAYERS } from './components/LayersMenu';
import { storeSetting } from './hooks/useStoredSetting';
import { readMapLink } from './utils';

// A link to the dashboard's map (utils/mapLink) sets it so, before it's drawn: as the visitor's
// own settings, as if they'd set them themselves
if (window.location.pathname === '/') {
  const link = readMapLink(window.location.search, Object.keys(DEFAULT_LAYERS));
  const settings = {
    'map-view': link.view, 'map-layers': link.layers, 'count-vehicles': link.vehicles, 'count-levels-hidden': link.hidden,
  };
  Object.entries(settings).forEach(([key, value]) => value !== undefined && storeSetting(key, value));
}

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
