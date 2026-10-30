import Paper from '@mui/material/Paper';

import CameraPreview, { PREVIEW_WIDTH } from './CameraPreview';

export const DIRECTION_ORDER = ['Northbound', 'Eastbound', 'Southbound', 'Westbound'];
const POPUP_GAP = 6; // px between previews, and around them
const POPUP_OFFSET = 18; // px between the site icon and the popup

// The hovered site's cameras, looping. Above the site, or below it if there's no room; kept
// inside the map horizontally. pointer-events: none, so it never steals the hover from the map.
export default function SitePopup({ map, cameras, lngLat }) {
  const columns = Math.min(cameras.length, 2);
  const rows = Math.ceil(cameras.length / columns);
  const width = columns * PREVIEW_WIDTH + (columns + 1) * POPUP_GAP;
  const height = rows * (PREVIEW_WIDTH * 0.75 + 34) + (rows + 1) * POPUP_GAP; // Image plus a caption of up to 2 lines
  const point = map.project(lngLat);
  const container = map.getContainer();
  const left = Math.min(Math.max(point.x - width / 2, POPUP_GAP), container.clientWidth - width - POPUP_GAP);
  const above = point.y - POPUP_OFFSET - height >= POPUP_GAP;
  const top = above ? point.y - POPUP_OFFSET - height : point.y + POPUP_OFFSET;
  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute', left, top, zIndex: 3, p: `${POPUP_GAP}px`, pointerEvents: 'none',
        display: 'grid', gridTemplateColumns: `repeat(${columns}, ${PREVIEW_WIDTH}px)`, gap: `${POPUP_GAP}px`,
      }}
    >
      {cameras.map(camera => <CameraPreview key={camera.id} camera={camera} />)}
    </Paper>
  );
}
