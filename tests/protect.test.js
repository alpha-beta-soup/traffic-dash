import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { inNz, tileInNz } from '../server/nz.js';
import rateLimit from '../server/rateLimit.js';

// Runs the limiter for a request from `ip`: 'next' if let through, else the status it sent
const request = (limit, ip) => {
  let result = 'next';
  const res = {
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { result = code; return this; },
    json() { return this; },
  };
  limit({ ip }, res, () => {});
  return { result, retryAfter: res.headers['Retry-After'] };
};

describe('rate limit', () => {
  it('lets a burst through, then refuses until it refills', () => {
    let time = 0;
    const limit = rateLimit({ burst: 3, perSecond: 1, now: () => time });
    assert.deepEqual([1, 2, 3].map(() => request(limit, 'a').result), ['next', 'next', 'next']);
    assert.deepEqual(request(limit, 'a'), { result: 429, retryAfter: '1' });
    time += 1000;
    assert.equal(request(limit, 'a').result, 'next');
    assert.equal(request(limit, 'a').result, 429);
  });

  it('counts each client on its own', () => {
    const limit = rateLimit({ burst: 1, perSecond: 1, now: () => 0 });
    assert.equal(request(limit, 'a').result, 'next');
    assert.equal(request(limit, 'a').result, 429);
    assert.equal(request(limit, 'b').result, 'next');
  });
});

describe('New Zealand', () => {
  it('knows its places', () => {
    assert.equal(inNz(-41.29, 174.78), true); // Wellington
    assert.equal(inNz(-46.9, 168.1), true); // Stewart Island
    assert.equal(inNz(-33.87, 151.21), false); // Sydney
    assert.equal(inNz(Number.NaN, 174), false);
  });

  it('knows its map tiles', () => {
    assert.equal(tileInNz(0, 0, 0), true);
    assert.equal(tileInNz(10, 1009, 641), true); // Wellington
    assert.equal(tileInNz(10, 942, 614), false); // Sydney
    assert.equal(tileInNz(10, 0, 0), false);
  });
});
