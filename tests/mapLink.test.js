import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapLinkQuery, readMapLink } from '../src/utils/mapLink.js';

const KNOWN = ['labels', 'counts', 'traffic'];

describe('map links', () => {
  it('writes the map as a short query, and reads it back', () => {
    const state = {
      view: { center: [175.060012, -40.855049], zoom: 11.5049, bearing: 0, pitch: 0 },
      layers: { labels: false, counts: true, traffic: true },
      vehicles: 'heavy',
      hidden: ['same', 'unknown'],
    };
    const query = mapLinkQuery(state);
    assert.equal(query, 'at=-40.855,175.06,11.5&layers=counts,traffic&vehicles=heavy&hide=same,unknown');
    assert.deepEqual(readMapLink(`?${query}`, KNOWN), {
      view: { center: [175.06, -40.855], zoom: 11.5, bearing: 0, pitch: 0 },
      layers: { labels: false, counts: true, traffic: true },
      vehicles: 'heavy',
      hidden: ['same', 'unknown'],
    });
  });

  it('leaves out defaults, and keeps a turned or tilted view', () => {
    assert.equal(mapLinkQuery({ view: null, layers: null }), '');
    const turned = mapLinkQuery({ view: { center: [174.78, -41.29], zoom: 12, bearing: -20.4, pitch: 45 } });
    assert.equal(turned, 'at=-41.29,174.78,12&bearing=-20&pitch=45');
    assert.deepEqual(readMapLink(turned, KNOWN).view, { center: [174.78, -41.29], zoom: 12, bearing: -20, pitch: 45 });
  });

  it('ignores what isn’t valid', () => {
    assert.deepEqual(readMapLink('?at=91,0,5&vehicles=bikes&hide=same,nonsense', KNOWN), { hidden: ['same'] });
    assert.deepEqual(readMapLink('?at=a,b,c', KNOWN), {});
    assert.deepEqual(readMapLink('', KNOWN), {});
  });
});
