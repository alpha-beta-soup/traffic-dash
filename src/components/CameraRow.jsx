import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const PEEK = 24; // px of the row's padding each side, less the gap: how much of the next card shows
const GAP = 8;

// The cameras on a phone: one card at a time, swiped through, with the cards either side peeking
// in. Says which is showing (`onCurrent(camera)`), for the map to mark, and goes to the camera
// `target` asks for ({ id }, e.g. tapped on the map). Only the cards on screen (this one, and
// those peeking) fetch their images.
export default function CameraRow({
  cameras, target, onCurrent, renderCard,
}) {
  const row = useRef(null);
  const [index, setIndex] = useState(0);
  const currentId = useRef(null);
  const step = () => {
    const [first, second] = row.current?.children ?? [];
    return second ? second.offsetLeft - first.offsetLeft : (first?.offsetWidth ?? 1);
  };
  const scrollTo = useCallback((i, behavior) => row.current?.scrollTo({ left: i * step(), behavior }), []);

  const onScroll = () => {
    const i = Math.min(cameras.length - 1, Math.max(0, Math.round(row.current.scrollLeft / step())));
    if (i !== index) setIndex(i);
  };

  // A new list (the map moved): stay on the same camera if it's still there, else the first.
  // By their ids: the list itself is new with each render.
  const ids = cameras.map(camera => camera.id).join();
  useLayoutEffect(() => {
    const i = Math.max(0, ids.split(',').indexOf(String(currentId.current)));
    setIndex(i);
    scrollTo(i, 'instant');
  }, [ids, scrollTo]);

  const camera = cameras[index] ?? null;
  useEffect(() => {
    currentId.current = camera?.id ?? null;
    onCurrent(camera);
  }, [camera, onCurrent]);

  useEffect(() => {
    const i = cameras.findIndex(({ id }) => id === target?.id);
    if (i >= 0) scrollTo(i, 'smooth');
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps -- only when asked, not as the list changes

  if (!cameras.length) {
    return <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>No cameras in view: move the map to find some</Typography>;
  }
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ textAlign: 'center' }} aria-live="polite">
        {index + 1} of {cameras.length}
      </Typography>
      <Box
        ref={row}
        onScroll={onScroll}
        role="region"
        aria-label="Cameras in view: swipe, or use the arrow keys"
        tabIndex={0}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: `${GAP}px`,
          px: `${PEEK}px`,
          mx: -1, // Out to the screen's edges, past the page's padding
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          overscrollBehaviorX: 'contain',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
        }}
      >
        {cameras.map(camera => (
          <Box key={camera.id} sx={{ flex: '0 0 100%', scrollSnapAlign: 'center', scrollSnapStop: 'always' }}>
            {renderCard(camera)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
