import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import CameraPlaceholder from './CameraPlaceholder';
import CameraWeather from './CameraWeather';
import FadeImage from './FadeImage';
import ToggleButton from './ToggleButton';
import useLiveImage from '../hooks/useLiveImage';
import useNow from '../hooks/useNow';
import useWeather from '../hooks/useWeather';
import { Link, cameraPath } from '../router';
import { useLoopFrames, useLoopPlayback } from '../hooks/useLoop';
import {
  descriptionReplace,
  eventImpacts,
} from '../consts';
import {
  replaceAll,
  timeAgo,
} from '../utils';
import loadingImage from '../../data/hatchback_loading.gif';

const overlayChip = {
  bgcolor: theme => alpha(theme.palette.background.paper, 0.85),
  fontSize: '0.7rem',
  height: 20,
};

export function CameraTime({ time }) {
  const now = useNow(1000);
  if (!time) return null;
  return <Chip size="small" label={timeAgo(time, now)} sx={overlayChip} />;
}

// The most serious road event near the camera, e.g. "Road closed nearby", with the details on hover
function NearbyEvent({ events }) {
  const [event] = events;
  const impact = eventImpacts[event.impact];
  const more = events.length > 1 ? ` (+${events.length - 1} more)` : '';
  return (
    <Chip
      size="small"
      label={`${impact.label} nearby${more}`}
      title={events.map(e => `${eventImpacts[e.impact].label}: ${e.cause}, ${e.area}`).join('\n')}
      // Bottom left, clear of the time chip at the top
      sx={{ ...overlayChip, position: 'absolute', bottom: 14, left: 6, bgcolor: impact.color, color: 'white', fontWeight: 500 }}
    />
  );
}

// congestion comes from the map, which matches cameras to the traffic lines it has loaded
// nearbyEvents: road closures and delays near the camera, most serious first
export default function Camera({
  camera, config, congestion, nearbyEvents = [], loopAll, pinned, onPin, onFocus,
}) {
  const { id, name, description, lat, lon, offline, underMaintenance } = camera;
  const unavailable = offline || underMaintenance;
  const { live, failed, stockImage } = useLiveImage(camera, unavailable);
  // Follows the global toggle whenever it changes, but can be overridden per camera
  const [looping, setLooping] = useState(loopAll);
  const [prevLoopAll, setPrevLoopAll] = useState(loopAll);
  if (loopAll !== prevLoopAll) {
    setPrevLoopAll(loopAll);
    setLooping(loopAll);
  }
  const weather = useWeather(config.weather, lat, lon);
  const [notice, setNotice] = useState(null);

  // Reload the frame list whenever a new live frame arrives
  const liveTime = live?.time.getTime();
  const frames = useLoopFrames(id, looping && !unavailable && !!liveTime, liveTime);
  const shown = useLoopPlayback(frames, looping);

  // A link to the camera's own page
  const share = async () => {
    const url = `${window.location.origin}${cameraPath(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Link for the ${name} camera copied to the clipboard!`);
    } catch {
      setNotice(`Couldn't copy to the clipboard: ${url}`);
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
      {/* The image opens the camera's page */}
      <Box component={Link} to={cameraPath(id)} aria-label={`Open ${name}`} sx={{ position: 'relative', display: 'block', color: 'inherit' }}>
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
            // The loading animation is black on white: inverted, it suits the dark theme
            '& img[src*="hatchback_loading"]': { filter: theme => (theme.palette.mode === 'dark' ? 'invert(0.9)' : 'none') },
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
        {nearbyEvents.length > 0 && <NearbyEvent events={nearbyEvents} />}
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', lineHeight: 1.2 }}>
          {name}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
