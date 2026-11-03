import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import CameraMap from '../components/CameraMap';
import CameraPlaceholder from '../components/CameraPlaceholder';
import CameraWeather from '../components/CameraWeather';
import ErrorBoundary from '../components/ErrorBoundary';
import EventDetails, { impactOf } from '../components/EventDetails';
import LedSign from '../components/LedSign';
import NearbyCounts from '../components/NearbyCounts';
import WarningDetails from '../components/WarningDetails';
import ToggleButton from '../components/ToggleButton';
import VehicleTrend from '../components/VehicleTrend';
import useLiveImage from '../hooks/useLiveImage';
import { useLoopFrames } from '../hooks/useLoop';
import useNow from '../hooks/useNow';
import useVehicleCounts from '../hooks/useVehicleCounts';
import usePlayer from '../hooks/usePlayer';
import useWeather from '../hooks/useWeather';
import { TextLink, cameraPath, navigate } from '../router';
import { descriptionReplace, eventImpacts } from '../consts';
import {
  groupCameraSites, nearbyEvents, nearestCameras, nearestTo, replaceAll, resolutionLabel, timeAgo, warningColour,
  warningsAt,
} from '../utils';

const MAX_UPSCALE = 2; // Small cameras (480×270) only blur beyond about twice their size
const NEARBY = 1000; // metres: road events listed on the page
const SIGNS_NEARBY = 2; // km: message signs shown on the page
const MAX_SIGNS = 4;
const VEHICLE_HOURS = 3; // Of vehicle counts charted
const DASHBOARD_ZOOM = 11; // The dashboard map's zoom when it has no saved view

const clockFormat = new Intl.DateTimeFormat('en-NZ', {
  hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland',
});

// Zoom is offered when the frame's own size is noticeably more than it's shown at
const MIN_ZOOM_GAIN = 1.2;
const DRAG_THRESHOLD = 4; // px: a press that moves less than this is a click

// One axis of the zoomed view: the offset of the visible window into the full-size frame,
// kept within the frame (or centred, where the frame is smaller than the window)
const clampAxis = (offset, natural, shown) => (natural <= shown
  ? (natural - shown) / 2
  : Math.max(0, Math.min(natural - shown, offset)));

// The camera's whole frame, uncropped, as large as fits, up to MAX_UPSCALE its own size. Where
// that's well short of its own size (the HD cameras), a click shows it full size around the
// point clicked; drag to look around, and click again (or Escape) to zoom out. `zoom` ({ x, y }:
// the top left of the view into the full-size frame, or null) is kept by the page, so it
// stays put through playback.
function LargeImage({ src, alt, stale, zoom, onZoom }) {
  const [natural, setNatural] = useState(null);
  const [box, setBox] = useState(null); // The image element's size on screen
  const [dragging, setDragging] = useState(false);
  const img = useRef(null);
  const press = useRef(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(img.current);
    return () => observer.disconnect();
  }, []);

  // object-fit: contain: the frame is drawn at this scale, centred in the element
  const scale = natural && box ? Math.min(box.width / natural.width, box.height / natural.height) : 1;
  const zoomable = !!natural && !!box && scale * MIN_ZOOM_GAIN <= 1;
  const view = zoom && zoomable && {
    x: clampAxis(zoom.x, natural.width, box.width),
    y: clampAxis(zoom.y, natural.height, box.height),
  };

  const point = (e) => {
    const rect = img.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onPointerDown = (e) => {
    if (e.button !== 0 || !zoomable) return;
    press.current = { start: { x: e.clientX, y: e.clientY }, view, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const p = press.current;
    if (!p?.view) return;
    const dx = e.clientX - p.start.x;
    const dy = e.clientY - p.start.y;
    if (!p.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    p.moved = true;
    setDragging(true);
    onZoom({ x: p.view.x - dx, y: p.view.y - dy });
  };
  const onPointerUp = (e) => {
    const p = press.current;
    press.current = null;
    setDragging(false);
    if (!p || p.moved) return;
    if (p.view) {
      onZoom(null);
      return;
    }
    // Zoom in, keeping the point clicked under the pointer
    const { x, y } = point(e);
    const left = (box.width - natural.width * scale) / 2;
    const top = (box.height - natural.height * scale) / 2;
    onZoom({ x: (x - left) / scale - x, y: (y - top) / scale - y });
  };

  let cursor = 'default';
  if (view) cursor = dragging ? 'grabbing' : 'grab';
  else if (zoomable) cursor = 'zoom-in';

  return (
    <Box sx={{ bgcolor: 'common.black', display: 'flex', justifyContent: 'center', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { press.current = null; setDragging(false); }}
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: natural ? natural.width * MAX_UPSCALE : '100%',
          cursor,
          touchAction: view ? 'none' : 'auto', // Dragging a zoomed image pans it, not the page
          userSelect: 'none',
        }}
      >
        <Box
          component="img"
          ref={img}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={e => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          sx={{
            display: 'block',
            width: '100%',
            maxHeight: 'min(70vh, 100vh - 160px)', // Room for the controls below it, when stuck in view
            objectFit: 'contain',
            // The previous camera's image, while this one's loads
            opacity: stale ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}
        />
        {view && (
          <>
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'common.black',
                backgroundImage: `url("${src}")`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: `${natural.width}px ${natural.height}px`,
                backgroundPosition: `${-view.x}px ${-view.y}px`,
              }}
            />
            <Typography
              variant="caption"
              sx={{
                position: 'absolute', right: 8, bottom: 8, px: 1, py: 0.25, borderRadius: 1,
                bgcolor: 'rgba(0, 0, 0, 0.6)', color: 'common.white', pointerEvents: 'none',
              }}
            >
              Full size · drag to look around · click or Esc to zoom out
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}

// Live, play/pause, step and a scrubber across the camera's saved history
function PlaybackControls({ player, frames, time }) {
  const now = useNow(1000);
  const { mode, index, count } = player;
  if (count < 2) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
        No history yet: frames are saved while this camera is on screen, here or on the dashboard.
      </Typography>
    );
  }
  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <ToggleButton on={mode === 'live'} onClick={player.live}>Live</ToggleButton>
        <Button size="small" onClick={() => player.step(-1)} aria-label="Previous frame">‹ Frame</Button>
        <Button size="small" variant="outlined" onClick={mode === 'playing' ? player.pause : player.play}>
          {mode === 'playing' ? 'Pause' : 'Play'}
        </Button>
        <Button size="small" onClick={() => player.step(1)} aria-label="Next frame">Frame ›</Button>
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {time && `${clockFormat.format(time)} · ${timeAgo(time, now)}`}
        </Typography>
      </Box>
      <Slider
        size="small"
        min={0}
        max={count - 1}
        value={mode === 'live' ? count - 1 : index}
        onChange={(_, value) => player.seek(value)}
        valueLabelDisplay="auto"
        valueLabelFormat={value => clockFormat.format(frames[value].time)}
        aria-label="Saved frames"
      />
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Space plays or pauses; ← and → step a frame. Click a high-resolution image to see it full size.
      </Typography>
    </Box>
  );
}

// The cameras at the same site (other directions), the nearest along the road either way, the
// nearest by distance on any road, and every camera on the route, in order. Routes come from
// NZTA's state highway "journeys" (see server/routes.js): they end at junctions (e.g. SH2 ends
// at Ngauranga, where SH1 carries on to Wellington), and cameras off the state highways have
// none, so the nearest cameras by distance cover those.
function GettingAround({ camera, cameras }) {
  // The route list opens scrolled to this camera
  const list = useRef(null);
  useEffect(() => {
    const current = list.current?.querySelector('[aria-current]');
    // offsetTop is from the list itself (it's position: relative): centre the camera in it
    if (current) list.current.scrollTop = current.offsetTop - (list.current.clientHeight - current.offsetHeight) / 2;
  }, [camera.id]);
  const site = groupCameraSites(cameras).find(s => s.cameraIds.split(',').map(Number).includes(camera.id));
  const siteIds = site ? site.cameraIds.split(',').map(Number) : [camera.id];
  const atSite = cameras.filter(c => siteIds.includes(c.id) && c.id !== camera.id);
  const { route } = camera;
  const onRoute = route ? cameras.filter(c => c.route?.id === route.id).sort((a, b) => a.route.km - b.route.km) : [];
  const others = onRoute.filter(c => !siteIds.includes(c.id));
  const before = others.filter(c => c.route.km <= route?.km).at(-1);
  const after = others.find(c => c.route.km > route?.km);
  const distance = other => `${Math.abs(other.route.km - route.km).toFixed(1)} km`;
  const nearest = nearestCameras(camera, cameras, { exclude: siteIds });
  if (!atSite.length && !onRoute.length && !nearest.length) return null;
  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>Getting around</Typography>
      {atSite.length > 0 && (
        <Typography variant="body2" component="div" sx={{ mb: 1 }}>
          At this site:{' '}
          {atSite.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ', '}
              <TextLink to={cameraPath(c.id)}>{c.direction?.replace('bound', '')}: {c.name}</TextLink>
            </span>
          ))}
        </Typography>
      )}
      {before && (
        <Typography variant="body2">
          ← Towards {route.start}: <TextLink to={cameraPath(before.id)}>{before.name}</TextLink> · {distance(before)}
        </Typography>
      )}
      {after && (
        <Typography variant="body2">
          Towards {route.end} →: <TextLink to={cameraPath(after.id)}>{after.name}</TextLink> · {distance(after)}
        </Typography>
      )}
      {nearest.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 1.5 }}>Nearby</Typography>
          <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none' }}>
            {nearest.map(({ camera: c, km, direction }) => (
              <Box component="li" key={c.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25, fontSize: '0.85rem' }}>
                <TextLink to={cameraPath(c.id)}>{c.name}</TextLink>
                <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }} title={`${km.toFixed(1)} km ${direction.label}`}>
                  {km.toFixed(1)} km {direction.arrow} {direction.label}
                </Box>
              </Box>
            ))}
          </Box>
        </>
      )}
      {onRoute.length > 1 && (
        <>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            {route.name}, {route.start} to {route.end}
          </Typography>
          <Box component="ol" ref={list} sx={{ m: 0, pl: 0, listStyle: 'none', maxHeight: 260, overflowY: 'auto', position: 'relative' }}>
            {onRoute.map((c) => {
              const offline = c.offline || c.underMaintenance || c.unavailable;
              return (
                <Box
                  component="li"
                  key={c.id}
                  aria-current={c.id === camera.id ? 'location' : undefined}
                  sx={{
                    display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25,
                    fontSize: '0.85rem', opacity: offline ? 0.5 : 1, fontWeight: c.id === camera.id ? 600 : 400,
                  }}
                >
                  {c.id === camera.id ? <span>{c.name}</span> : <TextLink to={cameraPath(c.id)}>{c.name}</TextLink>}
                  <Box component="span" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{c.route.km.toFixed(1)} km</Box>
                </Box>
              );
            })}
          </Box>
        </>
      )}
    </Paper>
  );
}

// The lit message signs nearest the camera, as their LED boards. NZTA doesn't say which way a
// sign faces, so some will be for traffic going the other way.
function SignsNearby({ camera, signs }) {
  const nearest = nearestTo(camera, signs, { limit: MAX_SIGNS, maxKm: SIGNS_NEARBY });
  if (!nearest.length) return null;
  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>Signs nearby</Typography>
      {nearest.map(({ item: sign, km, direction }) => (
        <Box key={sign.id} sx={{ '& + &': { mt: 1.5 } }}>
          <LedSign message={sign.message} label={sign.name} />
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            {sign.name} · {km.toFixed(1)} km {direction.arrow} {direction.label}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

// mapView: the dashboard map's saved view ({ center, zoom, bearing, pitch }, or null)
export default function CameraPage({
  id, cameras, events, signs, warnings, config, dark, mapView, onMapView, congestion, pinned, onPin,
}) {
  const camera = cameras.find(c => c.id === id);
  // Back on the dashboard, its map is where this page's map ended up: centred there, at the
  // dashboard's own zoom (the small map's extent would be far too close on the big one). Just
  // looking at a camera and going back leaves the dashboard as it was.
  const [entryView] = useState(mapView);
  const onMapMoveEnd = (centre) => {
    if (!centre) onMapView(entryView);
    else onMapView({ zoom: DASHBOARD_ZOOM, bearing: 0, pitch: 0, ...entryView, center: centre });
  };
  useEffect(() => {
    document.title = camera ? `${camera.name} · NZ Traffic Dashboard` : 'NZ Traffic Dashboard';
    return () => { document.title = 'NZ Traffic Dashboard'; };
  }, [camera]);
  if (!camera) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">
          {cameras.length ? `There's no camera ${id}.` : 'Loading…'}
        </Typography>
        {cameras.length > 0 && <TextLink to="/">Back to the dashboard</TextLink>}
      </Box>
    );
  }
  return (
    // Not keyed by camera: moving to another camera updates the page in place (the map pans,
    // the last image stays until the next arrives) rather than rebuilding it
    <CameraView
      camera={camera}
      cameras={cameras}
      events={events}
      signs={signs}
      warnings={warnings}
      config={config}
      dark={dark}
      onMapMoveEnd={onMapMoveEnd}
      congestion={congestion}
      pinned={pinned}
      onPin={onPin}
    />
  );
}

function CameraView({
  camera, cameras, events, signs, warnings, config, dark, onMapMoveEnd, congestion, pinned, onPin,
}) {
  const { id, name, description, direction, highway, region, lat, lon, imageUrl, offline, underMaintenance } = camera;
  const unavailable = offline || underMaintenance;
  const { live, failed, stockImage } = useLiveImage(camera, unavailable);
  const liveTime = live?.time.getTime();
  const frames = useLoopFrames(id, !unavailable && !!liveTime, liveTime);
  const player = usePlayer(frames, id);
  const weather = useWeather(config.weather, lat, lon);
  const vehicleCounts = useVehicleCounts(id, config.vehicles, VEHICLE_HOURS, liveTime);
  const [notice, setNotice] = useState(null);
  const [zoom, setZoom] = useState(null); // The zoomed view into the image (see LargeImage)
  const [zoomId, setZoomId] = useState(id);
  if (zoomId !== id) { // Another camera: start zoomed out
    setZoomId(id);
    setZoom(null);
  }
  const nearby = nearbyEvents(camera, events, { radius: NEARBY, impacts: Object.keys(eventImpacts) });

  // Keyboard: space plays or pauses, arrows step a frame, Escape zooms out or goes back to the dashboard
  useEffect(() => {
    const onKey = (e) => {
      // Leave keys alone in form fields and on the scrubber, which has its own arrow keys
      if (e.target instanceof Element && e.target.closest('input, textarea, [role=slider]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (player.mode === 'playing') player.pause();
        else player.play();
      } else if (e.key === 'ArrowLeft') player.step(-1);
      else if (e.key === 'ArrowRight') player.step(1);
      else if (e.key === 'Escape') {
        if (zoom) setZoom(null);
        else navigate('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player, zoom]);

  const share = async () => {
    const url = `${window.location.origin}${cameraPath(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link to this camera copied to the clipboard');
    } catch {
      setNotice(`Couldn't copy to the clipboard: ${url}`);
    }
  };

  let placeholder = null;
  if (offline) placeholder = { title: 'Camera offline', detail: 'NZTA has marked this camera offline' };
  else if (underMaintenance) placeholder = { title: 'Under maintenance', detail: 'NZTA has marked this camera under maintenance' };
  else if (stockImage) placeholder = { title: 'Camera unavailable', detail: 'NZTA is showing its "temporarily unavailable" image. Checking again shortly.' };
  else if (failed && live?.id !== id) placeholder = { title: 'Image unavailable', detail: 'Retrying…' };
  const stale = !player.frame && live?.id !== id; // Still the previous camera's image
  // e.g. "1920 × 1080 px (1080p)"
  const size = !stale && live?.size;
  const named = size && resolutionLabel(size).endsWith('p') ? ` (${resolutionLabel(size)})` : '';
  const resolution = size && `${size.width} × ${size.height} px${named}`;
  const src = player.frame?.url ?? live?.src;
  const time = player.frame ? new Date(player.frame.time) : !stale && live?.time;

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Grid container spacing={2}>
        {/* Side by side, the image stays in view while the details beside it scroll */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ position: { md: 'sticky' }, top: { md: 16 }, alignSelf: 'flex-start' }}>
          {placeholder || !src ? (
            <Box sx={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden' }}>
              <CameraPlaceholder {...(placeholder ?? { title: 'Loading…' })} />
            </Box>
          ) : (
            <>
              <LargeImage src={src} alt={name} stale={stale} zoom={zoom} onZoom={setZoom} />
              <PlaybackControls player={player} frames={frames} time={time} />
            </>
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ color: 'text.primary' }}>{name}</Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {replaceAll(description, descriptionReplace)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {[
                direction, highway, region,
                resolution,
              ].filter(Boolean).join(' · ')}
            </Typography>
            {congestion && (
              <Typography variant="body2" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ width: 28, height: 6, borderRadius: 3, bgcolor: congestion.color }} />
                {congestion.description} congestion (free-flow score {congestion.score}%)
              </Typography>
            )}
            <CameraWeather data={weather} alwaysShowWind />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <ToggleButton on={pinned} onClick={() => onPin(id)} offVariant="outlined">Pin</ToggleButton>
              <Button size="small" variant="outlined" onClick={share}>Share</Button>
              <Button size="small" href={imageUrl} target="_blank" rel="noopener">NZTA image</Button>
            </Box>
          </Paper>
          {warningsAt(camera, warnings).map(warning => (
            <Paper key={warning.id} sx={{ p: 1.5, mt: 2, borderTop: `4px solid ${warningColour(warning)}` }}>
              <WarningDetails warning={warning} />
            </Paper>
          ))}
          {config.vehicles && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>Vehicles in view</Typography>
              <VehicleTrend counts={vehicleCounts} cursor={time ? time.getTime() : null} />
            </Paper>
          )}
          <NearbyCounts camera={camera} />
          {config.mapStyle && (
            <ErrorBoundary name="The map" sx={{ mt: 2 }}>
              <CameraMap
                camera={camera}
                cameras={cameras}
                events={events}
                signs={signs}
                warnings={warnings}
                styleUrl={dark ? config.mapStyleDark : config.mapStyle}
                dark={dark}
                traffic={config.traffic}
                onMoveEnd={onMapMoveEnd}
              />
            </ErrorBoundary>
          )}
          <GettingAround camera={camera} cameras={cameras} />
          <SignsNearby camera={camera} signs={signs} />
          {nearby.map(event => (
            <Paper key={event.id} sx={{ p: 1.5, mt: 2, borderTop: `4px solid ${impactOf(event).color}` }}>
              <EventDetails event={event} />
            </Paper>
          ))}
          <Box sx={{ mt: 2 }}>
            <TextLink to="/">← Back to the dashboard</TextLink>
          </Box>
        </Grid>
      </Grid>
      <Snackbar open={!!notice} autoHideDuration={4750} onClose={() => setNotice(null)} message={notice} />
    </Box>
  );
}
