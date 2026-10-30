import React from 'react';
import { createRoot } from 'react-dom/client';

import 'maplibre-gl/dist/maplibre-gl.css';
import '../styles/weather-icons.min.css';
import '../styles/weather-icons-wind.min.css';
import '../styles/app.css';

import App from './App';

createRoot(document.getElementById('app')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
