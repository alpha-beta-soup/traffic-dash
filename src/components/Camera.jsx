import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';

import CameraPlaceholder from './CameraPlaceholder';
import CameraWeather from './CameraWeather';
import FadeImage from './FadeImage';
import ToggleButton from './ToggleButton';
import useNow from '../hooks/useNow';
import { useLoopFrames, useLoopPlayback } from '../hooks/useLoop';
import {
  BLACK,
  LIGHTBLACK,
  MAX_REFRESH,
  MIN_REFRESH,
  descriptionReplace,
} from '../consts';
import {
  fetchJson,
  randomInt,
  replaceAll,
  timeAgo,
} from '../utils';
import loadingImage from '../../data/hatchback_loading.gif';

const overlayChip = {
  bgcolor: 'rgba(255,255,255,0.8)',
  fontSize: '0.7rem',
  height: 20,
};

export function CameraTime({ time }) {
  const now = useNow(1000);
  if (!time) return null;
  return <Chip size="small" label={timeAgo(time, now)} sx={overlayChip} />;
}

// congestion comes from the map, which matches cameras to the traffic lines it has loaded
export default function Camera({ camera, config, congestion, loopAll, pinned, onPin, onFocus }) {
  const { id, name, description, lat, lon, imageUrl, offline, underMaintenance } = camera;
  const unavailable = offline || underMaintenance;
  const [live, setLive] = useState(null); // { src, time }
  const [failed, setFailed] = useState(false);
  // NZTA is serving its stock "temporarily unavailable" image (the server spots it), though the
  // camera isn't marked offline. Polling carries on, so the card recovers when the camera does.
  const [stockImage, setStockImage] = useState(!!camera.unavailable);
  // Follows the global toggle whenever it changes, but can be overridden per camera
  const [looping, setLooping] = useState(loopAll);
  const [prevLoopAll, setPrevLoopAll] = useState(loopAll);
  if (loopAll !== prevLoopAll) {
    setPrevLoopAll(loopAll);
    setLooping(loopAll);
  }
  const [weather, setWeather] = useState(null);
  const [notice, setNotice] = useState(null);
  const objectUrl = useRef(null);

  const loadImage = useCallback(async () => {
    try {
      const res = await fetch(`/api/cameras/${id}/image`);
      if (res.status === 503) {
        setStockImage(true);
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const time = new Date(res.headers.get('last-modified') ?? Date.now());
      const src = URL.createObjectURL(await res.blob());
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = src;
      setLive({ src, time });
      setFailed(false);
      setStockImage(false);
    } catch (err) {
      console.error(`Camera ${id} (${name}):`, err);
      setFailed(true);
    }
  }, [id, name]);

  // Each live image fetch also lets the server cache a new frame for the loop
  useEffect(() => {
    if (unavailable) return undefined;
    loadImage();
    const timer = setInterval(loadImage, randomInt(MIN_REFRESH, MAX_REFRESH));
    return () => clearInterval(timer);
  }, [loadImage, unavailable]);

  useEffect(() => () => objectUrl.current && URL.revokeObjectURL(objectUrl.current), []);

  // Reload the frame list whenever a new live frame arrives
  const liveTime = live?.time.getTime();
  const frames = useLoopFrames(id, looping && !unavailable && !!liveTime, liveTime);
  const shown = useLoopPlayback(frames, looping);

  useEffect(() => {
    if (!config.weather) return;
    fetchJson(`/api/weather?lat=${lat}&lon=${lon}`).then(setWeather).catch(console.error);
  }, [config.weather, lat, lon]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      setNotice(`Link for the ${name} camera copied to the clipboard!`);
    } catch {
      setNotice(`Couldn't copy to the clipboard: ${imageUrl}`);
    }
  };

  const frame = shown?.frame;
  let src = loadingImage;
  if (frame) src = frame.url;
  else if (live) src = live.src;
  const time = frame ? new Date(frame.time) : live?.time;

  // When a fetch fails but there's an earlier image, keep showing that: its time chip shows its age
  let placeholder = null;
  if (offline) placeholder = { title: 'Camera offline', detail: 'NZTA has marked this camera offline' };
  else if (underMaintenance) placeholder = { title: 'Under maintenance', detail: 'NZTA has marked this camera under maintenance' };
  else if (stockImage) placeholder = { title: 'Camera unavailable', detail: 'NZTA is showing its "temporarily unavailable" image. Checking again shortly.' };
  else if (failed && !frame && !live) placeholder = { title: 'Image unavailable', detail: 'Retrying…' };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ position: 'relative' }}>
        <CardMedia
          title={congestion
            ? `${name}\n${congestion.description} congestion (free-flow score ${congestion.score}%)${congestion.directionMatched ? '' : '\nFrom roads in both directions: none nearby run the camera\'s way'}`
            : name}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            height: 'calc(25.5vh + 8px)',
            borderBottom: '8px solid',
            borderColor: congestion?.color ?? 'transparent',
          }}
        >
          {placeholder
            ? <CameraPlaceholder {...placeholder} />
            /* Fade at the loop restart and for live updates; cut between loop frames */
            : <FadeImage src={src} alt={name} fade={!frame || shown.fade} />}
        </CardMedia>
        <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
          {!placeholder && <CameraTime time={time} />}
        </Box>
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ color: BLACK, lineHeight: 1.2 }}>
          {name}
        </Typography>
        <Typography variant="body2" sx={{ color: LIGHTBLACK }}>
          {replaceAll(description, descriptionReplace)}
        </Typography>
        <CameraWeather data={weather} />
      </CardContent>
      {/* Buttons shrink to their labels, and wrap rather than overflow on narrow cards */}
      <CardActions disableSpacing sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiButton-root': { minWidth: 0, px: 1 } }}>
        <Button size="small" onClick={share}>Share</Button>
        <Button size="small" onClick={() => onFocus(camera)}>Focus</Button>
        <ToggleButton on={looping && !unavailable} onClick={() => setLooping(on => !on)} disabled={unavailable}>
          Loop
        </ToggleButton>
        <ToggleButton on={pinned} onClick={() => onPin(id)}>Pin</ToggleButton>
      </CardActions>
      <Snackbar
        open={!!notice}
        autoHideDuration={4750}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Card>
  );
}
