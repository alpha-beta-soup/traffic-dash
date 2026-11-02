import { useEffect, useState } from 'react';
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
import { Link, cameraPath, navigate } from '../router';
import { descriptionReplace, eventImpacts } from '../consts';
import { nearbyEvents, replaceAll, timeAgo } from '../utils';

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
        {cameras.length > 0 && <Link to="/">Back to the dashboard</Link>}
      </Box>
    );
  }
  return (
    <CameraView
      key={camera.id}
      camera={camera}
      events={events}
      config={config}
      congestion={congestion}
      pinned={pinned}
      onPin={onPin}
    />
  );
}

function CameraView({ camera, events, config, congestion, pinned, onPin }) {
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
          {nearby.map(event => (
            <Paper key={event.id} sx={{ p: 1.5, mt: 2, borderTop: `4px solid ${impactOf(event).color}` }}>
              <EventDetails event={event} />
            </Paper>
          ))}
          <Box sx={{ mt: 2 }}>
            <Link to="/">← Back to the dashboard</Link>
          </Box>
        </Grid>
      </Grid>
      <Snackbar open={!!notice} autoHideDuration={4750} onClose={() => setNotice(null)} message={notice} />
    </Box>
  );
}
