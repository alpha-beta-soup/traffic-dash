// Message signs on a map (see the sign layers in ./layers): their LED images, paging, and the
// full sign on hovering an icon. Shared by the dashboard map and the camera page's map.
import { SIGN_PAGE_TIME, signIcon, signImageId } from './layers';
import { drawSignPage, signPages, signSize } from '../utils';

const SHOW_NONE = ['==', ['get', 'id'], -1];

// Each map's sign images in use at the last update, kept until the next: the data swaps in
// asynchronously, so the outgoing signs still draw for a moment
const lastUsed = new WeakMap();

// Shows `signs` (those with a message) on the map, drawing each page's image once, and removing
// images no longer shown: travel times change every few minutes, and each change is a new image
export function setSigns(map, signs) {
  const features = signs.flatMap((sign) => {
    const pages = signPages(sign.message);
    if (!pages.length) return [];
    const size = signSize(pages);
    const icons = pages.map((lines, page) => {
      const id = signImageId(pages, size, page);
      if (!map.hasImage(id)) map.addImage(id, drawSignPage(lines, size), { pixelRatio: 2 });
      return [`page${page}`, id];
    });
    // Travel-time signs list destinations with right-aligned minutes, e.g. "SH1 … 21"
    const travelTimes = pages.some(lines => lines.some(({ right }) => /^\d+$/.test(right)));
    return [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [sign.lon, sign.lat] },
      properties: { id: sign.id, name: sign.name, travelTimes, pages: pages.length, ...Object.fromEntries(icons) },
    }];
  });
  map.getSource('signs').setData({ type: 'FeatureCollection', features });
  const used = new Set(features.flatMap(({ properties }) => Object.keys(properties)
    .filter(key => /^page\d+$/.test(key)).map(key => properties[key])));
  const previous = lastUsed.get(map) ?? new Set();
  map.listImages()
    .filter(id => id.startsWith('sign:') && !used.has(id) && !previous.has(id))
    .forEach(id => map.removeImage(id));
  lastUsed.set(map, used);
}

// Every multi-page sign steps to its next page together. Returns a function to stop.
export function startSignPaging(map) {
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    ['sign-expanded', 'sign-full'].forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'icon-image', signIcon(tick)));
  }, SIGN_PAGE_TIME);
  return () => clearInterval(timer);
}

export const hideExpandedSign = (map) => {
  if (map.getLayer('sign-expanded')) map.setFilter('sign-expanded', SHOW_NONE);
};

// Hovering a sign's icon shows the sign itself (unless `disabled()`)
export function addSignHover(map, disabled = () => false) {
  map.on('mousemove', 'signs', (e) => {
    if (disabled()) return;
    const { id } = e.features[0].properties;
    // Not when that sign is already showing in full
    if (map.getLayer('sign-full') && map.queryRenderedFeatures(e.point, { layers: ['sign-full'] })
      .some(f => f.properties.id === id)) return;
    map.getCanvas().style.cursor = 'pointer';
    map.setFilter('sign-expanded', ['==', ['get', 'id'], id]);
  });
  map.on('mouseleave', 'signs', () => {
    map.getCanvas().style.cursor = '';
    hideExpandedSign(map);
  });
}
