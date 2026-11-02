import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import jpegSize, { resolutionLabel } from '../src/utils/jpegSize.js';

// A JPEG header: SOI, an APP0 segment, then a baseline start of frame
const jpeg = (width, height, sof = 0xc0) => new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x06, 0x4a, 0x46, 0x49, 0x46, // APP0, length 6
  0xff, sof, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

describe('jpegSize', () => {
  it('reads the size from the start of frame', () => {
    assert.deepEqual(jpegSize(jpeg(1920, 1080)), { width: 1920, height: 1080 });
    assert.deepEqual(jpegSize(jpeg(800, 450, 0xc2)), { width: 800, height: 450 }); // Progressive
  });

  it('skips other segments, such as the Huffman tables', () => {
    const bytes = jpeg(640, 360);
    const dht = [0xff, 0xc4, 0x00, 0x04, 0x00, 0x00];
    assert.deepEqual(jpegSize(new Uint8Array([...bytes.slice(0, 10), ...dht, ...bytes.slice(10)])), { width: 640, height: 360 });
  });

  it('gives null for anything else', () => {
    assert.equal(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null); // PNG
    assert.equal(jpegSize(jpeg(800, 450).slice(0, 12)), null); // Cut short
  });
});

describe('resolutionLabel', () => {
  it('names the familiar HD sizes', () => {
    assert.equal(resolutionLabel({ width: 1920, height: 1080 }), '1080p');
    assert.equal(resolutionLabel({ width: 1280, height: 720 }), '720p');
  });

  it('gives other sizes in full', () => {
    assert.equal(resolutionLabel({ width: 800, height: 450 }), '800×450');
    assert.equal(resolutionLabel({ width: 1280, height: 960 }), '1280×960');
  });
});
