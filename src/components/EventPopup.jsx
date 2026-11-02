import EventDetails, { impactOf } from './EventDetails';
import MapPopup from './MapPopup';

// The details of a hovered road event
export default function EventPopup({ map, event, lngLat }) {
  return (
    <MapPopup map={map} lngLat={lngLat} sx={{ p: 1.5, width: 300, borderTop: `4px solid ${impactOf(event).color}` }}>
      <EventDetails event={event} />
    </MapPopup>
  );
}
