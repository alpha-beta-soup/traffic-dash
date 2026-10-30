import CameraPreview, { PREVIEW_WIDTH } from './CameraPreview';
import MapPopup from './MapPopup';

export const DIRECTION_ORDER = ['Northbound', 'Eastbound', 'Southbound', 'Westbound'];
const GAP = 6; // px between previews, and around them

// The hovered site's cameras, looping, two to a row
export default function SitePopup({ map, cameras, lngLat }) {
  const columns = Math.min(cameras.length, 2);
  return (
    <MapPopup
      map={map}
      lngLat={lngLat}
      sx={{ p: `${GAP}px`, display: 'grid', gridTemplateColumns: `repeat(${columns}, ${PREVIEW_WIDTH}px)`, gap: `${GAP}px` }}
    >
      {cameras.map(camera => <CameraPreview key={camera.id} camera={camera} />)}
    </MapPopup>
  );
}
