// Wind barbs, one per speed in 5-knot steps (see the wind layer in map/layers.js). The shaft
// points up (north), into the wind, with the feathers at its far end: a half feather for 5
// knots, a full one for 10, a pennant for 50; a small circle for calm. Feathers are on the
// right, as in the Southern Hemisphere. Drawn in one colour for use as SDF icons, so the map can
// colour them.
const SIZE = 48; // Canvas px; 24 CSS px at pixelRatio 2
export const BARB_STEP = 5; // knots
export const BARB_MAX = 65; // knots: stronger winds use this barb

const C = SIZE / 2;
const TOP = 5; // The shaft's far (upwind) end
const BOTTOM = SIZE - 5;
const FEATHER = 13; // Length of a full feather
const GAP = 5; // Between feathers along the shaft
const SLANT = 5; // How far a feather leans up the shaft

export function barbIcon(knots) {
  const ctx = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }).getContext('2d');
  ctx.fillStyle = 'black';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3.5; // 1.75 CSS px
  ctx.lineCap = 'round';
  if (knots < BARB_STEP) {
    ctx.beginPath();
    ctx.arc(C, C, 4, 0, 2 * Math.PI);
    ctx.stroke();
    return ctx.getImageData(0, 0, SIZE, SIZE);
  }
  ctx.beginPath();
  ctx.moveTo(C, BOTTOM);
  ctx.lineTo(C, TOP);
  ctx.stroke();
  let pennants = Math.floor(knots / 50);
  let full = Math.floor((knots % 50) / 10);
  const half = (knots % 10) >= 5;
  let y = TOP;
  while (pennants-- > 0) {
    ctx.beginPath();
    ctx.moveTo(C, y);
    ctx.lineTo(C + FEATHER, y - SLANT / 2);
    ctx.lineTo(C, y + GAP + 1);
    ctx.closePath();
    ctx.fill();
    y += GAP + 3;
  }
  while (full-- > 0) {
    ctx.beginPath();
    ctx.moveTo(C, y);
    ctx.lineTo(C + FEATHER, y - SLANT);
    ctx.stroke();
    y += GAP;
  }
  if (half) {
    // A lone half feather sits a step in from the end, so it isn't mistaken for a full one
    if (y === TOP) y += GAP;
    ctx.beginPath();
    ctx.moveTo(C, y);
    ctx.lineTo(C + FEATHER / 2, y - SLANT / 2);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, SIZE, SIZE);
}

// [id, image] for each barb
export const barbIcons = () => Array.from({ length: BARB_MAX / BARB_STEP + 1 }, (_, i) => i * BARB_STEP)
  .map(knots => [`barb-${knots}`, barbIcon(knots)]);
