// A JPEG's size in pixels, read from its header (the start-of-frame segment) without decoding
// it: { width, height }, or null if `bytes` (a Uint8Array) isn't a JPEG it can read

// Start-of-frame markers: 0xC0–0xCF, except DHT (C4), JPG (C8) and DAC (CC)
const isStartOfFrame = marker => marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);

export default function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) { // Fill byte
      i += 1;
    } else if (isStartOfFrame(marker)) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width && height ? { width, height } : null;
    } else if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { // No length
      i += 2;
    } else {
      i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3]);
    }
  }
  return null;
}

const NAMED = { 1080: 1920, 720: 1280, 576: 1024 }; // 16:9 sizes with familiar names

// "1080p" for the familiar HD sizes, otherwise e.g. "800×450"
export const resolutionLabel = ({ width, height }) => (NAMED[height] === width ? `${height}p` : `${width}×${height}`);
