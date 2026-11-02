import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  insideRing, warningFeatures, warningTextColour, warningsAt,
} from '../src/utils/weatherWarnings.js';

const square = (lon, lat, size) => [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]];
const warning = (id, colour, colourHex, ring) => ({ id, colour, colourHex, areas: [{ name: id, polygons: [ring] }] });

describe('insideRing', () => {
  it('tells inside from outside', () => {
    const ring = square(174, -42, 1);
    assert.equal(insideRing([174.5, -41.5], ring), true);
    assert.equal(insideRing([175.5, -41.5], ring), false);
  });

  it('handles concave shapes', () => {
    // A U shape: the notch in the middle is outside
    const u = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
    assert.equal(insideRing([1.5, 2], u), false);
    assert.equal(insideRing([0.5, 2], u), true);
  });
});

describe('warningsAt', () => {
  const yellow = warning('rain', 'Yellow', '#FFEB18', square(174, -42, 2));
  const orange = warning('wind', 'Orange', '#FFA500', square(174.5, -41.5, 1));
  const camera = { lat: -41, lon: 175 };

  it('finds the warnings covering a camera, most serious first', () => {
    assert.deepEqual(warningsAt(camera, [yellow, orange]).map(w => w.id), ['wind', 'rain']);
    assert.deepEqual(warningsAt({ lat: -45, lon: 170 }, [yellow, orange]), []);
  });

  it('draws the more serious on top', () => {
    assert.deepEqual(warningFeatures([orange, yellow]).features.map(f => f.properties.id), ['rain', 'wind']);
  });

  it('picks readable text for the colour', () => {
    assert.equal(warningTextColour(yellow), '#000');
    assert.equal(warningTextColour({ colourHex: '#D10000' }), '#fff');
  });
});
