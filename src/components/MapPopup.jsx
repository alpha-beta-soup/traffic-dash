import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Paper from '@mui/material/Paper';

const MARGIN = 6; // px kept clear of the window's edges
const OFFSET = 18; // px between the hovered icon and the popup

// A popup for something hovered on the map. It's rendered outside the map (which clips its
// contents) and positioned against the window, so it can spill over the cards rather than be
// cut off: above the icon if it fits, otherwise on whichever side has more room. It measures
// itself before showing, so content can be any size. pointer-events: none, so it never steals
// the hover from the map.
export default function MapPopup({ map, lngLat, sx, children }) {
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
