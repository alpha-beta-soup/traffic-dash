import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import AppBar from './components/AppBar';
import Camera from './components/Camera';
import ErrorSnackbar from './components/ErrorSnackbar';
import { DEFAULT_LAYERS } from './components/LayersMenu';
import TrafficMap from './components/Map';
import useStoredSetting from './hooks/useStoredSetting';
import { MAX_CAMERAS_IN_VIEW, congestionEnum } from './consts';
import { fetchJson, filterCamerasByBbox } from './utils';

const SIGNS_REFRESH = 60000;
const CAMERAS_REFRESH = 2 * 60_000;
const CARD_SIZE = { xs: 12, sm: 6, md: 4, lg: 2 }; // Grid columns per card, out of 12
const NO_CONGESTION = new Map();

const sameCongestion = (a, b) => (a?.level === b?.level && a?.score === b?.score
  && a?.segments.length === b?.segments.length);

export default function App() {
  const [config, setConfig] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [signs, setSigns] = useState([]);
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

  useEffect(() => {
    const loadSigns = () => fetchJson('/api/signs')
      .then(data => setSigns(data.filter(sign => sign.message)))
      .catch(console.error);
    loadSigns();
    const timer = setInterval(loadSigns, SIGNS_REFRESH);
    return () => clearInterval(timer);
  }, []);

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
  // Pinned cameras always show, first; the rest of what's in view follows if there aren't too many
  const pinnedCameras = useMemo(() => cameras.filter(camera => pinned.includes(camera.id)), [cameras, pinned]);
  const unpinnedInView = inView.filter(camera => !pinned.includes(camera.id) && passesFilter(camera.id));
  // Only working cameras count towards the limit; offline ones are listed after them
  const isWorking = camera => !camera.offline && !camera.underMaintenance && !camera.unavailable;
  const working = unpinnedInView.filter(isWorking);
  const notWorking = unpinnedInView.filter(camera => !isWorking(camera));
  const tooMany = working.length > MAX_CAMERAS_IN_VIEW;
  const shown = [...pinnedCameras, ...(tooMany ? [] : [...working, ...notWorking])];

  return (
    <>
      <AppBar
        loopAll={loopAll}
        onToggleLoopAll={() => setLoopAll(on => !on)}
        congestionFilter={config?.traffic ? congestionFilter : null}
        onCongestionFilter={setCongestionFilter}
      />
      <Box sx={{ p: 1 }}>
        <Grid container spacing={1}>
          {/* Minimised, the map takes a card's place at the start of the grid (same element, so it isn't recreated) */}
          <Grid size={mapMinimised ? CARD_SIZE : 12}>
            {config && (
              <TrafficMap
                styleUrl={config.mapStyle}
                traffic={config.traffic}
                cameras={cameras}
                signs={signs}
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
              />
            )}
          </Grid>
          {shown.map(camera => (
            <Grid key={camera.id} size={CARD_SIZE}>
              <Camera
                camera={camera}
                config={config ?? {}}
                congestion={congestion.get(camera.id)}
                loopAll={loopAll}
                pinned={pinned.includes(camera.id)}
                onPin={togglePin}
                onFocus={focus}
              />
            </Grid>
          ))}
          {tooMany && (
            <Grid size={12} sx={{ textAlign: 'center', py: 2 }}>
              <Typography>
                {working.length} working cameras in view{congestionFilter !== 'all' && config?.traffic ? ` with ${congestionEnum[congestionFilter].description.toLowerCase()} or worse congestion` : ''}.
                {' '}Zoom in or pan to see them, or click a site on the map to pin its cameras.
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
      <ErrorSnackbar
        message={error}
        actionLabel="Retry"
        onAction={loadCameras}
        onClose={() => setError(null)}
      />
    </>
  );
}
