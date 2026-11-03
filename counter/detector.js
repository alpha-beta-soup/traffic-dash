// Vehicle detection in camera frames: a COCO-trained object detector (by default D-FINE small,
// Apache-2.0, as ONNX) through onnxruntime, counting cars, motorcycles, buses and trucks. Used
// by the vehicle counter (counting.js) and the offline evaluations (scripts/vehicle-eval).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_MODEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'models', 'dfine_s_coco.onnx');

const INPUT = 640; // The model's input: frames are stretched to this square, as it was trained
// COCO classes counted as vehicles, and the colours the evaluations draw their boxes in
export const VEHICLES = {
  2: { label: 'car', colour: '#00e676' },
  3: { label: 'motorcycle', colour: '#ffea00' },
  5: { label: 'bus', colour: '#2979ff' },
  7: { label: 'truck', colour: '#ff9100' },
};
const DUPLICATE_OVERLAP = 0.7; // Intersection over union above which two boxes are one vehicle
// Across passes (the whole frame and its tiles), a box mostly inside another is the same vehicle:
// a tile often sees it larger, or cut off at its edge
const DUPLICATE_INSIDE = 0.6; // Intersection over the smaller box
const TILE_OVERLAP = 0.2; // Of a tile's width and height, shared with its neighbours
const TILE_EDGE = 2; // px: a box this close to a tile's inner edge is cut off by it

const sigmoid = x => 1 / (1 + Math.exp(-x));

const intersection = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

// DETR-style models mostly give one box per object, but now and then a second, weaker one
// (often as another class, e.g. car and truck); and a tile sees again what the whole frame did
const duplicate = (a, b) => {
  const shared = intersection(a, b);
  return shared / (a.w * a.h + b.w * b.h - shared) > DUPLICATE_OVERLAP
    || (a.pass !== b.pass && shared / Math.min(a.w * a.h, b.w * b.h) > DUPLICATE_INSIDE);
};

// Overlapping crops of about `size` pixels covering the frame ([] if one would do), row by row from
// the top: small, far-off vehicles shrink to a few pixels when the whole frame is resized for the
// model, but not in a tile. With `far`, only that share of the rows from the top (rounded up):
// cameras look down the road, so the top is far off, and near vehicles are big enough without.
export function tiles(width, height, size, far = 1) {
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  if (!size || cols * rows <= 1) return [];
  const w = Math.min(width, Math.round((width / cols) * (1 + TILE_OVERLAP)));
  const h = Math.min(height, Math.round((height / rows) * (1 + TILE_OVERLAP)));
  const at = (i, n, full, part) => (n > 1 ? Math.round((i * (full - part)) / (n - 1)) : 0);
  return Array.from({ length: Math.ceil(rows * far) * cols }, (_, i) => ({
    left: at(i % cols, cols, width, w), top: at(Math.floor(i / cols), rows, height, h), width: w, height: h,
  }));
}

// One box per vehicle, from the boxes of every pass: the most confident of each duplicate
export function merge(found) {
  const kept = [];
  [...found].sort((a, b) => b.score - a.score).forEach(v => kept.some(k => duplicate(k, v)) || kept.push(v));
  return kept;
}

// The vehicles among the model's queries, with boxes in the frame's pixels. A region (a tile)
// is where in the frame the input came from; boxes cut off by its inner edges are left out, as
// a neighbouring tile or the whole frame sees them whole.
function vehicles(logits, boxes, region, frame, minScore) {
  const [, queries, classes] = logits.dims;
  const found = [];
  for (let q = 0; q < queries; q++) {
    let best = null;
    for (const cls of Object.keys(VEHICLES).map(Number)) {
      const score = sigmoid(logits.data[q * classes + cls]);
      if (score >= minScore && (!best || score > best.score)) best = { cls, score };
    }
    if (!best) continue;
    const [cx, cy, w, h] = boxes.data.slice(q * 4, q * 4 + 4);
    const box = {
      x: region.left + (cx - w / 2) * region.width, y: region.top + (cy - h / 2) * region.height, w: w * region.width, h: h * region.height,
    };
    const cut = (region.left > 0 && box.x - region.left < TILE_EDGE)
      || (region.top > 0 && box.y - region.top < TILE_EDGE)
      || (region.left + region.width < frame.width && region.left + region.width - (box.x + box.w) < TILE_EDGE)
      || (region.top + region.height < frame.height && region.top + region.height - (box.y + box.h) < TILE_EDGE);
    if (!cut) found.push({ ...best, label: VEHICLES[best.cls].label, ...box });
  }
  return found;
}

// { detect(image, minScore, { tile, far }) → { found, seen, ms, width, height, passes } }, for an
// image as a file path or a Buffer. With `tile` (px), the frame's tiles (or the `far` share of
// their rows) are looked at too, each a pass of the model like the whole frame (see tiles());
// `seen` is every pass's boxes before merging. Warmed up on `warmUp` if given, so timings are
// of warm runs. onnxruntime and sharp
// are loaded here, so the server only needs them when counting is on.
export async function loadDetector(model = DEFAULT_MODEL, warmUp) {
  const [ort, { default: sharp }] = await Promise.all([import('onnxruntime-node'), import('sharp')]);
  // VEHICLE_THREADS: how many threads the model runs on (by default, one per core), to match the
  // CPU the counter is given
  const threads = Number(process.env.VEHICLE_THREADS) || 0;
  const session = await ort.InferenceSession.create(model, threads ? { intraOpNumThreads: threads, interOpNumThreads: 1 } : {});
  const [inputName] = session.inputNames;
  const outputName = want => session.outputNames.find(n => n.includes(want)) ?? session.outputNames[want === 'logits' ? 0 : 1];

  // The frame, or a region of it, as the model's input: RGB, channels first, 0–1
  const toTensor = async (image, region) => {
    const frame = region ? sharp(image).extract(region) : sharp(image);
    const { data } = await frame.removeAlpha().resize(INPUT, INPUT, { fit: 'fill' }).raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = INPUT * INPUT;
    const input = new Float32Array(3 * pixels);
    for (let i = 0; i < pixels; i++) {
      for (let c = 0; c < 3; c++) input[c * pixels + i] = data[i * 3 + c] / 255;
    }
    return new ort.Tensor('float32', input, [1, 3, INPUT, INPUT]);
  };

  if (warmUp) await session.run({ [inputName]: await toTensor(warmUp) });
  return {
    async detect(image, minScore, { tile = 0, far = 1 } = {}) {
      const { width, height } = await sharp(image).metadata();
      const regions = [{ left: 0, top: 0, width, height }, ...tiles(width, height, tile, far)];
      const found = [];
      let ms = 0;
      for (const [pass, region] of regions.entries()) {
        const input = await toTensor(image, pass ? region : null);
        const started = performance.now();
        const output = await session.run({ [inputName]: input });
        ms += performance.now() - started;
        vehicles(output[outputName('logits')], output[outputName('box')], region, { width, height }, minScore)
          .forEach(v => found.push({ ...v, pass }));
      }
      return {
        found: merge(found), seen: found, ms: Math.round(ms), width, height, passes: regions.length,
      };
    },
  };
}
