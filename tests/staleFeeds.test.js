import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import staleFeeds from '../src/utils/staleFeeds.js';

const MINUTE = 60_000;
const NOW = Date.parse('2026-11-04T01:00:00Z');
const feed = (name, minutesAgo, failed = false) => ({
  name, refresh: 2 * MINUTE, updated: minutesAgo === null ? null : NOW - minutesAgo * MINUTE, failed,
});

describe('staleFeeds', () => {
  it('names feeds whose latest try failed, or that are well overdue', () => {
    const feeds = [
      feed('fresh', 1),
      feed('failed', 1, true),
      feed('overdue', 6), // Over twice its 2 minutes, and a minute's grace
      feed('a little late', 4.5), // Within them: a background tab's timers are slowed
      feed('never loaded, failing', null, true),
      feed('not loaded yet', null),
    ];
    assert.deepEqual(staleFeeds(feeds, NOW).map(f => f.name), ['failed', 'overdue', 'never loaded, failing']);
  });
});
