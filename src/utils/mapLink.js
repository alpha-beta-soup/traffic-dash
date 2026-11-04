// The dashboard's map as a link: its view, the layers on, and the traffic counts' choices, in the
// address's query, e.g. /?at=-40.855,175.06,11.5&layers=counts,traffic&vehicles=heavy&hide=same
// (defaults left out). The address is kept to what's shown, so it can be shared; following one
// sets the map so.

const round = (value, places) => Number(value.toFixed(places));
const VEHICLES = ['all', 'heavy', 'light'];
const LEVELS = ['much-busier', 'busier', 'same', 'quieter', 'much-quieter', 'unknown'];

// { view: { center: [lon, lat], zoom, bearing, pitch } | null, layers, vehicles, hidden } → query
// string (no ?), or '' with nothing to say
export function mapLinkQuery({
  view, layers, vehicles = 'all', hidden = [],
}) {
  const params = new URLSearchParams();
  if (view) {
    const { center: [lon, lat], zoom, bearing = 0, pitch = 0 } = view;
    params.set('at', [round(lat, 4), round(lon, 4), round(zoom, 2)].join(','));
    if (Math.round(bearing)) params.set('bearing', Math.round(bearing));
    if (Math.round(pitch)) params.set('pitch', Math.round(pitch));
  }
  if (layers) params.set('layers', Object.keys(layers).filter(key => layers[key]).join(','));
  if (vehicles !== 'all') params.set('vehicles', vehicles);
  if (hidden.length) params.set('hide', hidden.join(','));
  return params.toString().replaceAll('%2C', ',');
}

// A query string (from the address) → what it sets: { view?, layers?, vehicles?, hidden? }, each
// only if given and valid; `knownLayers` the layers there are (their names, to turn on or off)
export function readMapLink(search, knownLayers) {
  const params = new URLSearchParams(search);
  const link = {};
  const at = params.get('at')?.split(',').map(Number);
  if (at?.length === 3 && at.every(Number.isFinite)) {
    const [lat, lon, zoom] = at;
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && zoom >= 0 && zoom <= 22) {
      link.view = {
        center: [lon, lat], zoom, bearing: Number(params.get('bearing')) || 0, pitch: Math.min(85, Math.max(0, Number(params.get('pitch')) || 0)),
      };
    }
  }
  if (params.has('layers')) {
    const on = params.get('layers').split(',');
    link.layers = Object.fromEntries(knownLayers.map(key => [key, on.includes(key)]));
  }
  if (VEHICLES.includes(params.get('vehicles'))) link.vehicles = params.get('vehicles');
  if (params.has('hide')) link.hidden = params.get('hide').split(',').filter(level => LEVELS.includes(level));
  return link;
}
