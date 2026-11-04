import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { greyWater } from '../src/map/layers.js';

describe('greyWater', () => {
  it('greys the base map style’s water, and leaves the rest', () => {
    const style = {
      version: 8,
      layers: [
        { id: 'water', type: 'fill', 'source-layer': 'water', paint: { 'fill-color': '#a0c8f0', 'fill-opacity': 0.9 } },
        { id: 'river', type: 'line', 'source-layer': 'waterway', paint: { 'line-color': 'blue' } },
        { id: 'sea-name', type: 'symbol', 'source-layer': 'water_name', paint: { 'text-color': 'navy' } },
        { id: 'park', type: 'fill', 'source-layer': 'park', paint: { 'fill-color': 'green' } },
      ],
    };
    const [water, river, name, park] = greyWater(style, false).layers;
    assert.deepEqual(water.paint, { 'fill-color': '#d5d8dc', 'fill-opacity': 0.9 });
    assert.equal(river.paint['line-color'], '#c3c8ce');
    assert.equal(name.paint['text-color'], '#6b7178');
    assert.equal(park, style.layers[3]);
    assert.equal(greyWater(style, true).layers[0].paint['fill-color'], '#2f3338');
    assert.equal(style.layers[0].paint['fill-color'], '#a0c8f0'); // The style given is left as it was
  });
});
