import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import describeWind from '../src/utils/wind.js';

const kmh = v => v / 3.6; // OpenWeatherMap gives m/s

describe('describeWind', () => {
  it('converts to km/h, with gusts only when above the speed', () => {
    const wind = describeWind({ speed: kmh(33), gust: kmh(61), deg: 315 });
    assert.equal(wind.speed, 33);
    assert.equal(wind.gust, 61);
    assert.equal(describeWind({ speed: kmh(33), gust: kmh(20), deg: 0 }).gust, null);
    assert.equal(describeWind({ speed: kmh(33), deg: 0 }).gust, null);
  });

  it('gives where it blows from and towards', () => {
    const wind = describeWind({ speed: 10, deg: 315 }); // From the north-west
    assert.equal(wind.from.label, 'NW');
    assert.equal(wind.towards, 135);
  });

  it('flags windy and strong winds, by speed or gusts', () => {
    assert.equal(describeWind({ speed: kmh(15) }).windy, false);
    assert.equal(describeWind({ speed: kmh(25) }).windy, true);
    assert.equal(describeWind({ speed: kmh(25) }).strong, false);
    assert.equal(describeWind({ speed: kmh(55) }).strong, true);
    // Light on average but strongly gusting: worth showing, and strong
    const gusty = describeWind({ speed: kmh(15), gust: kmh(75) });
    assert.equal(gusty.windy, true);
    assert.equal(gusty.strong, true);
  });

  it('copes with missing data', () => {
    assert.equal(describeWind(undefined), null);
    assert.equal(describeWind({ speed: kmh(30) }).from, null);
  });
});
