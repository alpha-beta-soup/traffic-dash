import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { ThemeProvider } from '@mui/material/styles';

import AppBar from './components/AppBar';
import Camera from './components/Camera';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorSnackbar from './components/ErrorSnackbar';
import StaleNotice from './components/StaleNotice';
import { DEFAULT_LAYERS } from './components/LayersMenu';
import TrafficMap from './components/Map';
import useFeed from './hooks/useFeed';
import useStoredSetting from './hooks/useStoredSetting';
import CameraPage from './pages/CameraPage';
import { matchRoute, navigate, usePath } from './router';
import { congestionEnum } from './consts';
import {
  fetchJson, filterCamerasByBbox, mapLinkQuery, nearbyEvents, warningsAt,
} from './utils';
import { makeTheme } from './theme';

const SIGNS_REFRESH = 60000;
const EVENTS_REFRESH = 2 * 60_000; // The server reuses the feed for 2 minutes
const WARNINGS_REFRESH = 5 * 60_000; // Likewise, for 5 minutes
const COUNTS_REFRESH = 60 * 60_000; // NZTA's counts arrive weekly or so
const CAMERAS_REFRESH = 2 * 60_000;
const CARD_SIZE = { xs: 12, sm: 6, md: 4, lg: 2 }; // Grid columns per card, out of 12
const NO_CONGESTION = new Map();
const withMessages = signs => signs.filter(sign => sign.message); // Signs showing something

const sameCongestion = (a, b) => (a?.level === b?.level && a?.score === b?.score
  && a?.segments.length === b?.segments.length);

export default function App() {
  const [config, setConfig] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [pinned, setPinned] = useStoredSetting('pinned', []); // camera ids
  const [loopAll, setLoopAll] = useStoredSetting('loop-all', true);
  // Merged with the defaults, so a layer added later starts on
  const [mapLayers, setMapLayers] = useStoredSetting('map-layers', DEFAULT_LAYERS, (defaults, saved) => ({ ...defaults, ...saved }));
  const [congestion, setCongestion] = useState(NO_CONGESTION); // camera id -> matched congestion
  // 'all', or the least severe congestion level to show
  const [congestionFilter, setCongestionFilter] = useStoredSetting('congestion-filter', 'all');
  const [centre, setCentre] = useState(null);
  const [mapMinimised, setMapMinimised] = useState(false);
  // Where the dashboard map was, so it comes back there (from a camera page, or on reload)
  const [mapView, setMapView] = useStoredSetting('map-view', null);
  // The traffic counts compare all vehicles, or heavy or light ones; and the levels of change
  // hidden from them (both chosen in their key)
  const [countVehicles, setCountVehicles] = useStoredSetting('count-vehicles', 'all');
  const [hiddenLevels, setHiddenLevels] = useStoredSetting('count-levels-hidden', []);
  const route = matchRoute(usePath());
  // 'auto' follows the system's light or dark setting
  const [themeSetting, setThemeSetting] = useStoredSetting('theme', 'auto');
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = themeSetting === 'auto' ? (systemDark ? 'dark' : 'light') : themeSetting;
  const theme = useMemo(() => makeTheme(mode), [mode]);
  const [error, setError] = useState(null);

  // Keeps the current list when nothing changed, so a refresh doesn't redraw the map and cards.
  // On failure the last good list stays, with a message offering a retry.
  const loadCameras = useCallback(() => {
    fetchJson('/api/cameras')
      .then((data) => {
        setCameras(current => (JSON.stringify(current) === JSON.stringify(data) ? current : data));
        setError(null);
      })
      .catch(err => setError(`Sorry, the traffic cameras failed to load: ${err.message}`));
  }, []);

  useEffect(() => {
    fetchJson('/api/config')
      .then(setConfig)
      .catch(err => setError(`Sorry, the dashboard server isn't responding: ${err.message}`));
  }, []);

  // Refresh for offline/maintenance status and new cameras (the server reuses the list for a minute)
  useEffect(() => {
    loadCameras();
    const timer = setInterval(loadCameras, CAMERAS_REFRESH);
    return () => clearInterval(timer);
  }, [loadCameras]);

  // The feeds over the map, each polled, and named for saying when it's out of date (StaleNotice)
  const signsFeed = useFeed('/api/signs', SIGNS_REFRESH, { select: withMessages });
  const eventsFeed = useFeed('/api/events', EVENTS_REFRESH);
  const warningsFeed = useFeed('/api/weather-warnings', WARNINGS_REFRESH); // MetService's
  const countsFeed = useFeed('/api/traffic-counts', COUNTS_REFRESH, { enabled: mapLayers.counts }); // NZTA's, with their layer
  const { data: signs } = signsFeed;
  const { data: events } = eventsFeed;
  const { data: warnings } = warningsFeed;
  const { data: trafficCounts } = countsFeed;
  const feeds = [
    { name: 'message signs', refresh: SIGNS_REFRESH, ...signsFeed },
    { name: 'road events', refresh: EVENTS_REFRESH, ...eventsFeed },
    { name: 'weather warnings', refresh: WARNINGS_REFRESH, ...warningsFeed },
    ...(mapLayers.counts ? [{ name: 'traffic counts', refresh: COUNTS_REFRESH, ...countsFeed }] : []),
  ];

  // The dashboard's address says what its map shows (utils/mapLink), so it can be shared
  useEffect(() => {
    if (route.page !== 'dashboard') return;
    const query = mapLinkQuery({
      view: mapView, layers: mapLayers, vehicles: countVehicles, hidden: hiddenLevels,
    });
    if (window.location.search !== (query && `?${query}`)) window.history.replaceState(null, '', query ? `/?${query}` : '/');
  }, [route.page, mapView, mapLayers, countVehicles, hiddenLevels]);

  // Results for the cameras the map just evaluated; others keep their last known congestion.
  // Only update when something changed, as each update redraws the map, which re-evaluates.
  const updateCongestion = useCallback((results, evaluatedIds) => {
    setCongestion((current) => {
      if (evaluatedIds.every(id => sameCongestion(current.get(id), results.get(id)))) return current;
      const next = new Map(current);
      evaluatedIds.forEach(id => (results.has(id) ? next.set(id, results.get(id)) : next.delete(id)));
      return next;
    });
  }, []);

  const passesFilter = useCallback((id) => {
    if (congestionFilter === 'all') return true;
    const level = congestion.get(id)?.level;
    return !!level && congestionEnum[level].value <= congestionEnum[congestionFilter].value;
  }, [congestion, congestionFilter]);

  const togglePin = useCallback((id) => {
    setPinned(ids => (ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id]));
  }, [setPinned]);

  // For a site on the map: pin all its cameras, or unpin them if they're all pinned already
  const toggleSitePins = useCallback((siteIds) => {
    setPinned(ids => (siteIds.every(id => ids.includes(id))
      ? ids.filter(id => !siteIds.includes(id))
      : [...new Set([...ids, ...siteIds])]));
  }, [setPinned]);

  // A minimised map can't move, so focusing a camera expands it first
  const focus = useCallback((camera) => {
    setMapMinimised(false);
    setCentre({ lngLat: [camera.lon, camera.lat], zoom: 14 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const inView = useMemo(() => (bounds ? filterCamerasByBbox(cameras, bounds) : []), [cameras, bounds]);
  // Pinned cameras always show, first; then the rest of what's in view (cards fetch only while
  // on screen, so there can be any number)
  const pinnedCameras = useMemo(() => cameras.filter(camera => pinned.includes(camera.id)), [cameras, pinned]);
  const unpinnedInView = inView.filter(camera => !pinned.includes(camera.id) && passesFilter(camera.id));
  // Working cameras first, offline ones after
  const isWorking = camera => !camera.offline && !camera.underMaintenance && !camera.unavailable;
  const working = unpinnedInView.filter(isWorking);
  const notWorking = unpinnedInView.filter(camera => !isWorking(camera));
  const shown = [...pinnedCameras, ...working, ...notWorking];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar
        loopAll={loopAll}
        onToggleLoopAll={() => setLoopAll(on => !on)}
        congestionFilter={config?.traffic ? congestionFilter : null}
        onCongestionFilter={setCongestionFilter}
        themeSetting={themeSetting}
        mode={mode}
        onThemeSetting={setThemeSetting}
        onBack={route.page === 'dashboard' ? null : () => navigate('/')}
      />
      <StaleNotice feeds={feeds} />
      {route.page === 'camera' && (
        <CameraPage
          id={route.id}
          cameras={cameras}
          events={events}
          signs={signs}
          warnings={warnings}
          config={config ?? {}}
          dark={mode === 'dark'}
          mapView={mapView}
          onMapView={setMapView}
          congestion={congestion.get(route.id)}
          pinned={pinned.includes(route.id)}
          onPin={togglePin}
        />
      )}
      {route.page === 'dashboard' && (
        <Box sx={{ p: 1 }}>
          <Grid container spacing={1}>
            {/* Minimised, the map takes a card's place at the start of the grid (same element, so it isn't recreated) */}
            <Grid size={mapMinimised ? CARD_SIZE : 12}>
              {config && (
                <ErrorBoundary name="The map" sx={{ height: mapMinimised ? '100%' : '46.5vh' }}>
                  <TrafficMap
                    styleUrl={mode === 'dark' ? config.mapStyleDark : config.mapStyle}
                    dark={mode === 'dark'}
                    traffic={config.traffic}
                    weather={config.weather}
                    cameras={cameras}
                    signs={signs}
                    events={events}
                    warnings={warnings}
                    trafficCounts={trafficCounts}
                    centre={centre}
                    congestion={congestion}
                    isShown={passesFilter}
                    minimised={mapMinimised}
                    onBoundsChange={setBounds}
                    onSiteClick={toggleSitePins}
                    onCongestion={updateCongestion}
                    onToggleMinimised={() => setMapMinimised(on => !on)}
                    layers={mapLayers}
                    onLayersChange={setMapLayers}
                    initialView={mapView}
                    onViewChange={setMapView}
                    countVehicles={countVehicles}
                    onCountVehicles={setCountVehicles}
                    hiddenLevels={hiddenLevels}
                    onHiddenLevels={setHiddenLevels}
                  />
                </ErrorBoundary>
              )}
            </Grid>
            {shown.map(camera => (
              <Grid key={camera.id} size={CARD_SIZE}>
                <Camera
                  camera={camera}
                  config={config ?? {}}
                  congestion={congestion.get(camera.id)}
                  nearbyEvents={nearbyEvents(camera, events)}
                  warnings={warningsAt(camera, warnings)}
                  loopAll={loopAll}
                  pinned={pinned.includes(camera.id)}
                  onPin={togglePin}
                  onFocus={focus}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      <ErrorSnackbar
        message={error}
        actionLabel="Retry"
        onAction={loadCameras}
        onClose={() => setError(null)}
      />
    </ThemeProvider>
  );
}
