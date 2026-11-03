// Vehicle detection in camera frames: a COCO-trained object detector (by default D-FINE small,
// Apache-2.0, as ONNX) through onnxruntime, counting cars, motorcycles, buses and trucks. Used
// by the server (server/vehicles.js) and the offline evaluations (scripts/vehicle-eval).
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

const sigmoid = x => 1 / (1 + Math.exp(-x));

const overlap = (a, b) => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.w * a.h + b.w * b.h - w * h);
};

// The vehicles among the model's queries, with boxes in the frame's pixels. DETR-style models
// mostly give one box per object, but now and then a second, weaker one (often as another
// class, e.g. car and truck): those are dropped.
function vehicles(logits, boxes, width, height, minScore) {
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
    found.push({
      ...best, label: VEHICLES[best.cls].label, x: (cx - w / 2) * width, y: (cy - h / 2) * height, w: w * width, h: h * height,
    });
  }
  found.sort((a, b) => b.score - a.score);
  const kept = [];
  found.forEach(v => kept.some(k => overlap(k, v) > DUPLICATE_OVERLAP) || kept.push(v));
  return kept;
}

// { detect(image, minScore) → { found, ms, width, height } }, for an image as a file path or a
// Buffer. Warmed up on `warmUp` if given, so timings are of warm runs. onnxruntime and sharp
// are loaded here, so the server only needs them when counting is on.
export async function loadDetector(model = DEFAULT_MODEL, warmUp) {
  const [ort, { default: sharp }] = await Promise.all([import('onnxruntime-node'), import('sharp')]);
  const session = await ort.InferenceSession.create(model);
  const [inputName] = session.inputNames;
  const outputName = want => session.outputNames.find(n => n.includes(want)) ?? session.outputNames[want === 'logits' ? 0 : 1];

  // The frame as the model's input: RGB, channels first, 0–1
  const toTensor = async (image) => {
    const { data } = await sharp(image).removeAlpha().resize(INPUT, INPUT, { fit: 'fill' }).raw()
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
    async detect(image, minScore) {
      const input = await toTensor(image);
      const started = performance.now();
      const output = await session.run({ [inputName]: input });
      const ms = Math.round(performance.now() - started);
      const { width, height } = await sharp(image).metadata();
      return { found: vehicles(output[outputName('logits')], output[outputName('box')], width, height, minScore), ms, width, height };
    },
  };
}
