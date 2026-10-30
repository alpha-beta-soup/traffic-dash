// Draws a variable message sign as an amber LED dot matrix on a black panel
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyph } from '../consts/ledFont';

const PITCH = 3; // Canvas px between dots (1.5 CSS px at pixelRatio 2)
const CHAR_GAP = 1; // Dark columns between characters
const LINE_GAP = 2; // Dark rows between lines
const BORDER = 3; // Dark dots around the text
const LIT = '#ffae1a';
const UNLIT = '#2b1f0c'; // The matrix stays faintly visible, as on the real signs
const MAX_COLUMNS = 24;

// A message as pages of lines, uppercase. The server has already turned the sign markup
// into newlines ([nl]), blank lines ([np]) and tabs ([jl4]: right-justify what follows,
// e.g. "SH1[jl4]22" for a destination and its travel time).
// Each line is { left, right }: right is set only for a right-justified part.
export const signPages = message => message.toUpperCase()
  .split(/\n\s*\n/)
  .map(page => page.split('\n').map((line) => {
    const [left, ...rest] = line.split('\t');
    const right = rest.join(' ').trim();
    return { left: left.trim().slice(0, MAX_COLUMNS), right: right.slice(0, MAX_COLUMNS) };
  }))
  .filter(lines => lines.some(({ left, right }) => left || right));

const lineLength = ({ left, right }) => left.length + (right ? right.length + 1 : 0);

// The panel fits the sign's longest line and most lines across all its pages, so it doesn't
// change size as the pages alternate.
export const signSize = pages => ({
  columns: Math.max(...pages.flatMap(lines => lines.map(lineLength)), 1),
  rows: Math.max(...pages.map(lines => lines.length), 1),
});

// Where each character goes: centred, as on the signs, or for a line with a right-justified
// part, the rest flush left and that part flush right
const layoutLine = ({ left, right }, columns) => {
  if (!right) {
    const start = Math.floor((columns - left.length) / 2);
    return [...left].map((char, i) => [char, start + i]);
  }
  return [
    ...[...left].map((char, i) => [char, i]),
    ...[...right].map((char, i) => [char, columns - right.length + i]),
  ];
};

// The small icon a sign shows as until hovered: a few rows of lit dots suggesting text
const THUMBNAIL_DOTS = [
  '0111011110',
  '0000000000',
  '1111011100',
  '0000000000',
  '0011101110',
];

export function signThumbnail() {
  const width = THUMBNAIL_DOTS[0].length;
  const height = THUMBNAIL_DOTS.length;
  return drawDots(THUMBNAIL_DOTS.map(row => [...row].map(dot => dot === '1')), width + 2, height + 2, 1);
}

// Draws a panel of dotsWide × dotsHigh LEDs, lighting those in `lit` (rows of booleans) placed `inset` dots in
function drawDots(lit, dotsWide, dotsHigh, inset) {
  const canvas = Object.assign(document.createElement('canvas'), { width: dotsWide * PITCH + 4, height: dotsHigh * PITCH + 4 });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4a4a4a'; // Grey housing
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 3);
  ctx.fill();
  ctx.fillStyle = '#080808';
  ctx.fillRect(2, 2, canvas.width - 4, canvas.height - 4);
  const isLit = (x, y) => !!lit[y - inset]?.[x - inset];
  const dot = (x, y, radius) => {
    ctx.beginPath();
    ctx.arc(2 + (x + 0.5) * PITCH, 2 + (y + 0.5) * PITCH, radius, 0, 2 * Math.PI);
    ctx.fill();
  };
  ctx.fillStyle = UNLIT;
  for (let y = 0; y < dotsHigh; y++) for (let x = 0; x < dotsWide; x++) if (!isLit(x, y)) dot(x, y, PITCH * 0.32);
  ctx.fillStyle = LIT;
  ctx.shadowColor = 'rgba(255, 160, 20, 0.85)';
  ctx.shadowBlur = PITCH * 0.9; // A little glow, as LEDs have
  for (let y = 0; y < dotsHigh; y++) for (let x = 0; x < dotsWide; x++) if (isLit(x, y)) dot(x, y, PITCH * 0.42);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function drawSignPage(lines, { columns, rows }) {
  const dotsWide = columns * (GLYPH_WIDTH + CHAR_GAP) - CHAR_GAP + 2 * BORDER;
  const dotsHigh = rows * (GLYPH_HEIGHT + LINE_GAP) - LINE_GAP + 2 * BORDER;
  const lit = Array.from({ length: dotsHigh }, () => new Array(dotsWide).fill(false));
  const top = Math.floor((rows - lines.length) / 2); // Fewer lines than the panel holds: centre them
  lines.forEach((line, row) => {
    layoutLine(line, columns).forEach(([char, col]) => {
      const x0 = BORDER + col * (GLYPH_WIDTH + CHAR_GAP);
      const y0 = BORDER + (top + row) * (GLYPH_HEIGHT + LINE_GAP);
      glyph(char).forEach((dots, y) => dots.forEach((on, x) => { if (on) lit[y0 + y][x0 + x] = true; }));
    });
  });
  return drawDots(lit, dotsWide, dotsHigh, 0);
}
