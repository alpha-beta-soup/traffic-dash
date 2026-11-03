// A traffic counting site's square (see the counts layers in map/layers.js): rounded, in its
// level of change's colour, outlined so it reads on any base map. Square, where cameras are
// round, so the two are told apart at a glance. One drawn per level and theme, rather than one
// recoloured (an SDF icon), to keep its edges crisp at small sizes.
import { changeColour } from '../utils';

export const COUNT_ICON = 40; // Canvas px; 20 CSS px at pixelRatio 2, outline included
const OUTLINE = 3; // Canvas px
const CORNER = 7; // Canvas px

export default function countIcon(level, dark) {
  const ctx = Object.assign(document.createElement('canvas'), { width: COUNT_ICON, height: COUNT_ICON }).getContext('2d');
  ctx.fillStyle = dark ? '#0e1317' : 'white';
  ctx.beginPath();
  ctx.roundRect(0, 0, COUNT_ICON, COUNT_ICON, CORNER + OUTLINE);
  ctx.fill();
  ctx.fillStyle = changeColour(level, dark);
  ctx.beginPath();
  ctx.roundRect(OUTLINE, OUTLINE, COUNT_ICON - 2 * OUTLINE, COUNT_ICON - 2 * OUTLINE, CORNER);
  ctx.fill();
  return ctx.getImageData(0, 0, COUNT_ICON, COUNT_ICON);
}
