import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { imageHash, isPlaceholder } from '../server/placeholders.js';
import { normaliseCamera, normaliseSign } from '../server/normalise.js';

describe('placeholder images', () => {
  it('recognises NZTA\'s known "temporarily unavailable" image by its hash', () => {
    assert.equal(isPlaceholder('d5b5811e2185b878ba0c21d16e4266d8a2cd1cd461789befbbd1f40d69f17346', 1), true);
  });

  it('treats an image served identically by two cameras as a placeholder', () => {
    const hash = imageHash(Buffer.from('a stock image'));
    assert.equal(isPlaceholder(hash, 101), false); // Seen once: could be a real image
    assert.equal(isPlaceholder(hash, 101), false); // The same camera again is no evidence
    assert.equal(isPlaceholder(hash, 102), true); // A second camera: it's a stock image
    assert.equal(isPlaceholder(hash, 103), true); // And remembered from then on
  });

  it('leaves real, distinct images alone', () => {
    assert.equal(isPlaceholder(imageHash(Buffer.from('view A')), 201), false);
    assert.equal(isPlaceholder(imageHash(Buffer.from('view B')), 202), false);
  });
});

describe('normalise', () => {
  it('reshapes a trafficnz.info camera', () => {
    const camera = normaliseCamera({
      id: 714,
      name: 'SH1 Tinwald ',
      description: 'South along Hinds Highway from Lagmhor Rd',
      direction: 'Southbound',
      highway: 'SH1',
      region: { id: 11, name: 'Canterbury' },
      latitude: -43.919632,
      longitude: 171.721055,
      offline: false,
      underMaintenance: false,
      imageUrl: '/camera/714.jpg',
    });
    assert.deepEqual(camera, {
      id: 714,
      name: 'SH1 Tinwald',
      description: 'South along Hinds Highway from Lagmhor Rd',
      direction: 'Southbound',
      highway: 'SH1',
      region: 'Canterbury',
      lat: -43.919632,
      lon: 171.721055,
      offline: false,
      underMaintenance: false,
      imageUrl: 'https://trafficnz.info/camera/714.jpg',
    });
  });

  it('turns sign markup into text', () => {
    const sign = normaliseSign({
      id: 1,
      name: 'SH1 Belfast',
      latitude: -43.45,
      longitude: 172.64,
      currentMessage: 'TRAVEL TIMES[np]BEALEY AVE[jl4]11[nl]CBD[jl4]14',
      lastMessageUpdate: '2026-10-30T09:30:13.687+13:00',
    });
    assert.equal(sign.message, 'TRAVEL TIMES\n\nBEALEY AVE\t11\nCBD\t14');
    assert.equal(sign.lastUpdate, '2026-10-30T09:30:13.687+13:00');
  });

  it('copes with a sign that has no message', () => {
    assert.equal(normaliseSign({ id: 2, name: 'Blank', latitude: 0, longitude: 0 }).message, '');
  });
});
