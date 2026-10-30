import { BLACK } from '../consts';

const QUADRANT_FILL = { w: BLACK, o: '#b8c2cc', '-': 'white' };

// A circle split into N/E/S/W quarters, each filled if the site has a camera facing that way.
// pattern: one character per quarter, as made by groupCameraSites
export default function siteIcon(pattern) {
  const size = 48;
  const c = size / 2;
  const r = 19;
  const ctx = Object.assign(document.createElement('canvas'), { width: size, height: size }).getContext('2d');
  ctx.beginPath();
  ctx.arc(c, c, r + 3, 0, 2 * Math.PI);
  ctx.fillStyle = 'white'; // Halo, so the icon reads on any base map
  ctx.fill();
  [...pattern].forEach((state, i) => {
    const middle = (i - 1) * (Math.PI / 2); // Canvas angles start east; quarter 0 is north
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, middle - Math.PI / 4, middle + Math.PI / 4);
    ctx.closePath();
    ctx.fillStyle = QUADRANT_FILL[state];
    ctx.fill();
  });
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.beginPath();
  [Math.PI / 4, (3 * Math.PI) / 4].forEach((a) => {
    ctx.moveTo(c + r * Math.cos(a), c + r * Math.sin(a));
    ctx.lineTo(c - r * Math.cos(a), c - r * Math.sin(a));
  });
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, 2 * Math.PI);
  ctx.strokeStyle = BLACK;
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}
