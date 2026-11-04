import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { stale } from '../server/caching.js';

const HOUR = 3_600_000;
// Disk stand-ins: what's saved, by name
const disk = (saved = {}) => ({
  saved,
  read: async name => saved[name],
  write: async (name, value) => { saved[name] = value; },
});
const settle = () => new Promise((resolve) => { setImmediate(resolve); });

describe('stale', () => {
  it('starts from what was saved, refreshing it in the background if old', async () => {
    const { saved, read, write } = disk({ counts: { version: 1, fetched: Date.now() - 7 * HOUR, value: 'saved' } });
    let fetches = 0;
    const get = stale(6 * HOUR, async () => { fetches += 1; return 'fresh'; }, { stored: 'counts', read, write });
    assert.equal(await get(), 'saved'); // At once, not after a fetch
    await settle();
    assert.equal(fetches, 1);
    assert.equal(await get(), 'fresh');
    assert.equal(saved.counts.value, 'fresh');
  });

  it('fetches first when nothing was saved, and saves it', async () => {
    const { saved, read, write } = disk();
    const get = stale(HOUR, async () => 'fresh', { stored: 'counts', read, write });
    assert.equal(await get(), 'fresh');
    await settle();
    assert.equal(saved.counts.value, 'fresh');
  });

  it('ignores a value saved in another form', async () => {
    const { read, write } = disk({ counts: { version: 1, fetched: Date.now(), value: 'old form' } });
    const get = stale(HOUR, async () => 'fresh', {
      stored: 'counts', version: 2, read, write,
    });
    assert.equal(await get(), 'fresh');
  });

  it('keeps a recent saved value without fetching', async () => {
    const { read, write } = disk({ counts: { version: 1, fetched: Date.now() - HOUR, value: 'saved' } });
    const get = stale(6 * HOUR, async () => assert.fail('fetched'), { stored: 'counts', read, write });
    assert.equal(await get(), 'saved');
  });
});
