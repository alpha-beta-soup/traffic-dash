import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import darkStyle, { darkenColour, parseColour, printColour } from '../server/darkStyle.js';

// Perceived lightness, roughly: enough to compare colours
const lightness = (text) => {
  const { r, g, b } = parseColour(text);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('parseColour', () => {
  it('reads the colour formats styles use', () => {
    assert.deepEqual(parseColour('#f8f4f0'), { r: 248, g: 244, b: 240, a: 1 });
    assert.deepEqual(parseColour('#fc8'), { r: 255, g: 204, b: 136, a: 1 });
    assert.deepEqual(parseColour('rgba(0, 0, 0, 0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
    assert.deepEqual(parseColour('hsl(0, 0%, 100%)'), { r: 255, g: 255, b: 255, a: 1 });
    assert.equal(parseColour('hsla(35,57%,88%,0.49)').a, 0.49);
  });

  it('gives null for anything else', () => {
    assert.equal(parseColour('zoom'), null);
    assert.equal(parseColour('#12'), null);
  });

  it('prints back what it read', () => {
    assert.equal(printColour(parseColour('#f8f4f0')), 'rgb(248, 244, 240)');
    assert.equal(printColour(parseColour('rgba(10, 20, 30, 0.25)')), 'rgba(10, 20, 30, 0.25)');
  });
});

describe('darkenColour', () => {
  it('flips light to dark and dark to light', () => {
    assert.ok(lightness(darkenColour('#f8f4f0')) < 50, 'the land goes dark');
    assert.ok(lightness(darkenColour('#333')) > 150, 'text goes light');
  });

  it('keeps transparency and hue', () => {
    assert.equal(parseColour(darkenColour('rgba(160, 200, 240, 0.4)')).a, 0.4);
    const { r, b } = parseColour(darkenColour('#a0c8f0')); // Light blue water stays blue
    assert.ok(b > r);
  });

  it('keeps roads lighter than the land, fills lighter than casings', () => {
    const land = darkenColour('#f8f4f0');
    const fill = darkenColour('#fff', { road: true });
    const casing = darkenColour('#cfcdca', { road: true });
    assert.ok(lightness(fill) > lightness(casing));
    assert.ok(lightness(casing) > lightness(land));
  });

  it('leaves anything that isn\'t a colour', () => {
    assert.equal(darkenColour('linear'), 'linear');
  });
});

describe('darkStyle', () => {
  const style = {
    version: 8,
    name: 'Liberty',
    sources: {},
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'relief', type: 'raster', paint: { 'raster-opacity': 0.5 } },
      { id: 'pier', type: 'fill', paint: { 'fill-pattern': 'hatch', 'fill-color': '#fff' } },
      {
        id: 'road', type: 'line', 'source-layer': 'transportation',
        paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5, '#fc8', 6, 'hsl(26,87%,62%)'], 'line-width': 2 },
      },
      {
        id: 'shield', type: 'symbol',
        layout: { 'icon-image': 'shield', 'icon-text-fit': 'both' }, paint: { 'text-color': '#000' },
      },
      { id: 'label', type: 'symbol', paint: { 'text-color': '#333', 'text-halo-color': '#fff' } },
    ],
  };
  const dark = darkStyle(style);
  const layer = id => dark.layers.find(l => l.id === id);

  it('darkens colours, including inside expressions', () => {
    assert.ok(lightness(layer('background').paint['background-color']) < 50);
    const [, , , , five, , six] = layer('road').paint['line-color'];
    assert.ok(parseColour(five) && parseColour(six));
    assert.notEqual(five, '#fc8');
    assert.equal(layer('road').paint['line-width'], 2);
  });

  it('flips labels and their halos', () => {
    const { paint } = layer('label');
    assert.ok(lightness(paint['text-color']) > lightness(paint['text-halo-color']));
  });

  it('leaves text on icons (road shields) alone', () => {
    assert.equal(layer('shield').paint['text-color'], '#000');
  });

  it('dims the relief and pattern fills, which are images', () => {
    assert.equal(layer('relief').paint['raster-brightness-max'], 0.3);
    assert.equal(layer('pier').paint['fill-opacity'], 0.15);
  });

  it('leaves the original style unchanged', () => {
    assert.equal(style.layers[0].paint['background-color'], '#f8f4f0');
  });
});
