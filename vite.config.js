import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const server = `http://localhost:${process.env.PORT || 3000}`;
// As the server sends (server/index.js): cross-origin isolation, for the wind layer
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

// The big libraries get their own files: they download in parallel, and stay cached in the
// browser when only the app's own code changes
const VENDOR_CHUNKS = {
  maplibre: ['maplibre-gl'],
  mui: ['@mui/', '@emotion/'],
  react: ['react', 'react-dom', 'scheduler'],
};

const vendorChunk = (id) => {
  const match = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (!match) return undefined;
  const pkg = match[1];
  return Object.keys(VENDOR_CHUNKS).find(chunk => VENDOR_CHUNKS[chunk]
    .some(name => (name.endsWith('/') ? pkg.startsWith(name) : pkg === name)));
};

export default defineConfig({
  plugins: [react()],
  // Open-Meteo's map layer loads its worker and WebAssembly from beside its own module, which
  // pre-bundling would move it away from
  optimizeDeps: { exclude: ['@openmeteo/weather-map-layer'] },
  server: {
    headers,
    proxy: {
      '/api': server,
      '/cache': server,
    },
  },
  preview: { headers },
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
    // maplibre-gl alone is about 1MB minified; there's no splitting it further
    chunkSizeWarningLimit: 1100,
  },
});
