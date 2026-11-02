// A dark version of a light MapLibre style (by default OpenFreeMap Liberty, which has no dark
// sibling): every colour's lightness flipped, hue kept and saturation muted, so both themes are
// the same map, with the same roads, labels, shields and buildings. Colours are worked in OKLab,
// where lightness matches how light a colour looks.

// Lightness (OKLab L, 0–1) after flipping: the lightest colours (the land) become DARKEST,
// the darkest (text) LIGHTEST
const DARKEST = 0.2;
const LIGHTEST = 0.9;
// Roads aren't flipped: on a dark map they should stand out lighter than the land, as they do
// darker on the light one. Their lightness is squeezed into this range instead, keeping their
// order (fills lighter than casings).
const ROAD_DARKEST = 0.27;
const ROAD_LIGHTEST = 0.45;
const CHROMA = 0.7; // Saturation kept: full colour looks garish on a dark map
const HILLSHADE_BRIGHTNESS = 0.3; // The shaded-relief raster's highlights, which would glare
const PATTERN_OPACITY = 0.15; // Pattern fills (e.g. hatched piers) are light images from the sprite

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// ---- Parsing and printing CSS colours (as used in MapLibre styles) ----

const hexColour = (hex) => {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a };
};

const hslToRgb = (h, s, l) => {
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map(v => v * 255);
};

const FUNCTION = /^(rgba?|hsla?)\(\s*([^)]*)\)$/i;
const number = (part, scale = 1) => (part.endsWith('%') ? (parseFloat(part) / 100) * scale : parseFloat(part));

// { r, g, b (0–255), a (0–1) }, or null if `text` isn't a colour
export function parseColour(text) {
  const value = text.trim().toLowerCase();
  if (value.startsWith('#')) return hexColour(value);
  const match = value.match(FUNCTION);
  if (!match) return null;
  const parts = match[2].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const a = parts[3] === undefined ? 1 : number(parts[3]);
  let rgb;
  if (match[1].startsWith('rgb')) rgb = parts.slice(0, 3).map(p => number(p, 255));
  else rgb = hslToRgb(parseFloat(parts[0]), number(parts[1]), number(parts[2]));
  const [r, g, b] = rgb;
  return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a };
}

export const printColour = ({ r, g, b, a }) => {
  const [R, G, B] = [r, g, b].map(v => Math.round(clamp(v, 0, 255)));
  return a >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${Math.round(a * 1000) / 1000})`;
};

// ---- sRGB ↔ OKLab (https://bottosson.github.io/posts/oklab/) ----

const toLinear = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

const rgbToOklab = ({ r, g, b }) => {
  const [R, G, B] = [r, g, b].map(v => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    A: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const oklabToRgb = ({ L, A, B }) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
  };
};

// ---- Darkening ----

const flip = L => DARKEST + (LIGHTEST - DARKEST) * (1 - L);
const squeezeRoad = L => ROAD_DARKEST + (ROAD_LIGHTEST - ROAD_DARKEST) * L;

// `text` darkened, if it's a colour (otherwise unchanged). road: a road's colour (see above).
export function darkenColour(text, { road = false } = {}) {
  const colour = parseColour(text);
  if (!colour) return text;
  const { L, A, B } = rgbToOklab(colour);
  const lightness = (road ? squeezeRoad : flip)(clamp(L));
  return printColour({ ...oklabToRgb({ L: lightness, A: A * CHROMA, B: B * CHROMA }), a: colour.a });
}

// Colours can sit anywhere in an expression (e.g. zoom stops): darken every string that is one
const darkenValue = (value, options) => {
  if (typeof value === 'string') return darkenColour(value, options);
  if (Array.isArray(value)) return value.map(v => darkenValue(v, options));
  return value;
};

const isRoad = layer => layer.type === 'line' && layer['source-layer'] === 'transportation';

// A new style: the same as `style`, darkened. Text drawn on an icon (road shields) keeps its
// colours, as the icons themselves (from the sprite) stay as they are.
export default function darkStyle(style) {
  return {
    ...style,
    name: style.name ? `${style.name} (dark)` : 'Dark',
    layers: style.layers.map((layer) => {
      const onIcon = !!layer.layout?.['icon-text-fit'];
      const options = { road: isRoad(layer) };
      const paint = Object.fromEntries(Object.entries(layer.paint ?? {}).map(([key, value]) => (
        key.endsWith('-color') && !(onIcon && key.startsWith('text-')) ? [key, darkenValue(value, options)] : [key, value]
      )));
      if (layer.type === 'raster') paint['raster-brightness-max'] = HILLSHADE_BRIGHTNESS;
      if (paint['fill-pattern']) paint['fill-opacity'] = PATTERN_OPACITY;
      return { ...layer, paint };
    }),
  };
}
