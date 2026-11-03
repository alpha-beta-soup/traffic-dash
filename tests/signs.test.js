import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { setSigns } from '../src/map/signs.js';

// Enough of a canvas to draw a sign on (the drawing itself isn't looked at)
const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
globalThis.document = { createElement: () => ({ getContext: () => context }) };

// Enough of a map to hold images and a signs source
const fakeMap = () => {
  const images = new Map();
  return {
    hasImage: id => images.has(id),
    addImage: (id, image) => images.set(id, image),
    removeImage: id => images.delete(id),
    listImages: () => [...images.keys()],
    getSource: () => ({ setData: () => {} }),
  };
};
const sign = (id, minutes) => ({ id, lat: -41.2, lon: 174.8, message: `PORIRUA \t${minutes}` });
const signImages = map => map.listImages().filter(id => id.startsWith('sign:'));

describe('setSigns', () => {
  it('removes images no longer shown, a refresh later', () => {
    const map = fakeMap();
    map.addImage('sign-icon', {});
    setSigns(map, [sign(1, 12), sign(2, 30)]);
    setSigns(map, [sign(1, 13), sign(2, 30)]);
    assert.equal(signImages(map).length, 3); // 12 kept while the data swaps in
    setSigns(map, [sign(1, 14), sign(2, 30)]);
    assert.deepEqual(signImages(map).map(id => id.match(/\d+$/)[0]).sort(), ['13', '14', '30']);
    assert.ok(map.hasImage('sign-icon')); // Not a sign page
  });
});
