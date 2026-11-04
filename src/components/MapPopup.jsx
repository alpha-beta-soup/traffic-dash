import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';

import Icon from './Icon';
import { usePhone } from '../hooks/useScreen';

const MARGIN = 6; // px kept clear of the window's edges
const OFFSET = 18; // px between the hovered icon and the popup

// A popup for something hovered on the map. It's rendered outside the map (which clips its
// contents) and positioned against the window, so it can spill over the cards rather than be
// cut off: above the icon if it fits, otherwise on whichever side has more room. It measures
// itself before showing, so content can be any size. pointer-events: none, so it never steals
// the hover from the map.
//
// On a phone, where a popup would cover most of the map, it's a sheet across the bottom of the
// screen instead, full width, scrolling if it's tall, with a button to close it (`onClose`).
export default function MapPopup({
  map, lngLat, sx, onClose, children,
}) {
  const phone = usePhone();
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  // Measured before it first shows, and again whenever its content changes size
  useLayoutEffect(() => {
    const element = ref.current;
    const measure = () => {
      const { offsetWidth: width, offsetHeight: height } = element;
      setSize(current => (current?.width === width && current?.height === height ? current : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (phone) {
    return createPortal(
      <Paper
        ref={ref}
        elevation={8}
        role="dialog"
        sx={{
          ...sx,
          position: 'fixed',
          zIndex: 1300,
          left: 0,
          right: 0,
          bottom: 0,
          width: 'auto',
          maxHeight: '60svh',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          borderRadius: '12px 12px 0 0',
          pb: 'max(12px, env(safe-area-inset-bottom))',
          '@keyframes rise': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
          animation: 'rise 180ms ease-out',
        }}
      >
        {/* A strip of its own along the top, so the close button covers nothing; what scrolls
            goes under it (its background the sheet's own, raised surface and all) */}
        {onClose && (
          <Box
            sx={{
              position: 'sticky', top: 0, zIndex: 1, height: 36, mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              bgcolor: 'inherit', backgroundImage: 'inherit',
            }}
          >
            <Box aria-hidden="true" sx={{ position: 'absolute', left: '50%', top: 6, width: 36, height: 4, ml: '-18px', borderRadius: 2, bgcolor: 'divider' }} />
            <IconButton aria-label="Close" onClick={onClose} sx={{ mr: -0.5 }}><Icon name="close" fontSize="small" /></IconButton>
          </Box>
        )}
        {children}
      </Paper>,
      document.body,
    );
  }
  let position = { left: 0, top: 0, visibility: 'hidden' };
  if (size) {
    const box = map.getContainer().getBoundingClientRect();
    const point = map.project(lngLat);
    const x = box.left + point.x;
    const y = box.top + point.y;
    const roomAbove = y - OFFSET - MARGIN;
    const roomBelow = window.innerHeight - y - OFFSET - MARGIN;
    const above = size.height <= roomAbove || roomAbove > roomBelow;
    position = {
      left: Math.min(Math.max(x - size.width / 2, MARGIN), window.innerWidth - size.width - MARGIN),
      top: above ? Math.max(y - OFFSET - size.height, MARGIN) : y + OFFSET,
    };
  }
  return createPortal(
    <Paper ref={ref} elevation={6} sx={{ position: 'fixed', zIndex: 1300, pointerEvents: 'none', ...position, ...sx }}>
      {children}
    </Paper>,
    document.body,
  );
}
