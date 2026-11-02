import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import CameraPlaceholder from '../components/CameraPlaceholder';
import CameraWeather from '../components/CameraWeather';
import EventDetails, { impactOf } from '../components/EventDetails';
import ToggleButton from '../components/ToggleButton';
import useLiveImage from '../hooks/useLiveImage';
import { useLoopFrames } from '../hooks/useLoop';
import useNow from '../hooks/useNow';
import usePlayer from '../hooks/usePlayer';
import useWeather from '../hooks/useWeather';
import { TextLink, cameraPath, navigate } from '../router';
import { descriptionReplace, eventImpacts } from '../consts';
import {
  groupCameraSites, nearbyEvents, nearestCameras, replaceAll, timeAgo,
} from '../utils';

const MAX_UPSCALE = 2; // Small cameras (480×270) only blur beyond about twice their size
const NEARBY = 1000; // metres: road events listed on the page

const clockFormat = new Intl.DateTimeFormat('en-NZ', {
  hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Auckland',
});

// The camera's whole frame, uncropped, as large as fits, up to MAX_UPSCALE its own size
function LargeImage({ src, alt }) {
  const [natural, setNatural] = useState(null);
  return (
    <Box sx={{ bgcolor: 'common.black', display: 'flex', justifyContent: 'center', borderRadius: 1, overflow: 'hidden' }}>
      <Box
        component="img"
        src={src}
        alt={alt}
        onLoad={e => setNatural({ width: e.currentTarget.naturalWidth })}
        sx={{
          display: 'block',
          width: '100%',
          maxWidth: natural ? natural.width * MAX_UPSCALE : '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
        }}
      />
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
        Space plays or pauses; ← and → step a frame.
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

export default function CameraPage({ id, cameras, events, config, congestion, pinned, onPin }) {
  const camera = cameras.find(c => c.id === id);
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
    <CameraView
      key={camera.id}
      camera={camera}
      cameras={cameras}
      events={events}
      config={config}
      congestion={congestion}
      pinned={pinned}
      onPin={onPin}
    />
  );
}

function CameraView({ camera, cameras, events, config, congestion, pinned, onPin }) {
  const { id, name, description, direction, highway, region, lat, lon, imageUrl, offline, underMaintenance } = camera;
  const unavailable = offline || underMaintenance;
  const { live, failed, stockImage } = useLiveImage(camera, unavailable);
  const liveTime = live?.time.getTime();
  const frames = useLoopFrames(id, !unavailable && !!liveTime, liveTime);
  const player = usePlayer(frames);
  const weather = useWeather(config.weather, lat, lon);
  const [notice, setNotice] = useState(null);
  const nearby = nearbyEvents(camera, events, { radius: NEARBY, impacts: Object.keys(eventImpacts) });

  // Keyboard: space plays or pauses, arrows step a frame, Escape goes back to the dashboard
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
      else if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

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
  else if (failed && !live) placeholder = { title: 'Image unavailable', detail: 'Retrying…' };
  const src = player.frame?.url ?? live?.src;
  const time = player.frame ? new Date(player.frame.time) : live?.time;

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          {placeholder || !src ? (
            <Box sx={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden' }}>
              <CameraPlaceholder {...(placeholder ?? { title: 'Loading…' })} />
            </Box>
          ) : (
            <>
              <LargeImage src={src} alt={name} />
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
              {[direction, highway, region].filter(Boolean).join(' · ')}
            </Typography>
            {congestion && (
              <Typography variant="body2" sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box component="span" sx={{ width: 28, height: 6, borderRadius: 3, bgcolor: congestion.color }} />
                {congestion.description} congestion (free-flow score {congestion.score}%)
              </Typography>
            )}
            <CameraWeather data={weather} />
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <ToggleButton on={pinned} onClick={() => onPin(id)} offVariant="outlined">Pin</ToggleButton>
              <Button size="small" variant="outlined" onClick={share}>Share</Button>
              <Button size="small" href={imageUrl} target="_blank" rel="noopener">NZTA image</Button>
            </Box>
          </Paper>
          <GettingAround camera={camera} cameras={cameras} />
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
