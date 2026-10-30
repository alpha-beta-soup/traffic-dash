import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { CameraTime } from './Camera';
import CameraPlaceholder from './CameraPlaceholder';
import FadeImage from './FadeImage';
import { useLoopFrames, useLoopPlayback } from '../hooks/useLoop';
import { descriptionReplace } from '../consts';
import { replaceAll } from '../utils';

export const PREVIEW_WIDTH = 200; // px

// A small, looping view of one camera for the map's hover popup. It plays the frames already
// cached for the camera, on the same clock as the cards; with too few frames it shows the latest image.
export default function CameraPreview({ camera }) {
  const { id, name, description, offline, underMaintenance } = camera;
  // camera.unavailable: NZTA is serving its stock "temporarily unavailable" image
  const unavailable = offline || underMaintenance || camera.unavailable;
  const frames = useLoopFrames(id, !unavailable);
  const shown = useLoopPlayback(frames, !unavailable);
  const [liveSrc] = useState(() => `/api/cameras/${id}/image?t=${Date.now()}`);
  const src = shown?.frame.url ?? liveSrc;
  return (
    <Box sx={{ width: PREVIEW_WIDTH }}>
      <Box sx={{ position: 'relative', aspectRatio: '4 / 3', bgcolor: 'action.hover', borderRadius: 0.5, overflow: 'hidden' }}>
        {unavailable
          ? <CameraPlaceholder title={offline ? 'Camera offline' : underMaintenance ? 'Under maintenance' : 'Camera unavailable'} />
          : <FadeImage src={src} alt={name} fade={!shown || shown.fade} />}
        {shown && (
          <Box sx={{ position: 'absolute', top: 4, right: 4 }}>
            <CameraTime time={new Date(shown.frame.time)} />
          </Box>
        )}
      </Box>
      {/* The description, as on the cards: the map label already names the site */}
      <Typography
        variant="caption"
        component="div"
        sx={{ color: 'text.primary', mt: 0.25, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {replaceAll(description, descriptionReplace) || name}
      </Typography>
    </Box>
  );
}
