import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  countFrame, flush, heartbeat, resetVehicleCounting, scan, startVehicleCounting, vehicleCounts,
} from '../counter/counting.js';
import { vehicleCounts as servedCounts, vehiclesEnabled } from '../server/vehicles.js';

// A detector for images that are strings: a vehicle for each letter, placed by the letter (so
// the same letter in another frame is in the same place), noting the order it was asked in
const fakeDetector = (order = []) => ({
  async detect(image) {
    order.push(image);
    await new Promise(r => setTimeout(r, 5));
    return {
      found: [...path.basename(image)].map(letter => ({
        x: (letter.charCodeAt(0) % 32) * 20, y: 100, w: 15, h: 10,
      })),
    };
  },
});
const settle = () => new Promise(r => setTimeout(r, 60));
const NOW = Date.now(); // Counts older than the kept days are dropped, so tests use recent times
const at = minutes => NOW - minutes * 60_000;
const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'vehicle-counts-'));

describe('vehicle counter', () => {
  afterEach(resetVehicleCounting);

  it('is off without a model', async () => {
    assert.equal(await startVehicleCounting({ model: '/nowhere/model.onnx', dir: await tempDir() }), false);
    countFrame(1, at(1), 'abc');
    assert.deepEqual(vehicleCounts(1), []);
  });

  it('counts frames, and lists them oldest first', async () => {
    await startVehicleCounting({ detector: fakeDetector(), dir: await tempDir() });
    countFrame(7, at(1), 'abcd');
    countFrame(7, at(2), 'ab');
    await settle();
    assert.deepEqual(vehicleCounts(7), [{ time: at(2), count: 2 }, { time: at(1), count: 4 }]);
    assert.deepEqual(vehicleCounts(7, at(1.5)), [{ time: at(1), count: 4 }]);
  });

  it('counts new frames before the backlog, and each frame once', async () => {
    const order = [];
    await startVehicleCounting({ detector: fakeDetector(order), dir: await tempDir() });
    countFrame(3, at(3), 'old1', { backlog: true });
    countFrame(3, at(2), 'old2', { backlog: true });
    countFrame(3, at(1), 'new');
    countFrame(3, at(1), 'new');
    await settle();
    // The first backlog frame may already be under way when the new one arrives
    assert.deepEqual(order.filter(o => o !== 'old1'), ['new', 'old2']);
    assert.equal(vehicleCounts(3).length, 3);
  });

  it('finds frames in the cache once the server has finished writing them', async () => {
    const cache = await tempDir();
    await fs.mkdir(path.join(cache, '4'));
    const frame = async (time, age) => {
      const file = path.join(cache, '4', `${time}.jpg`);
      await fs.writeFile(file, '');
      const changed = new Date(Date.now() - age);
      await fs.utimes(file, changed, changed);
      return { id: '4', time, file };
    };
    const frames = [await frame(at(2), 60_000), await frame(at(1), 0)]; // The newest still being written
    await startVehicleCounting({ detector: fakeDetector(), dir: await tempDir() });
    await scan(async () => frames);
    await settle();
    assert.deepEqual(vehicleCounts(4).map(c => c.time), [at(2)]);
  });

  it('leaves out parked vehicles: in the same place in most recent frames', async () => {
    await startVehicleCounting({ detector: fakeDetector(), dir: await tempDir() });
    // P stays put; another vehicle passes each minute, somewhere new
    const passing = 'abcdefghij';
    for (const [i, letter] of [...passing].entries()) {
      countFrame(5, at(passing.length - i), `P${letter}`);
      await settle();
    }
    const found = vehicleCounts(5).map(c => c.count);
    // Until there are enough earlier frames to tell, P counts
    assert.deepEqual(found.slice(0, 6), [2, 2, 2, 2, 2, 2]);
    assert.deepEqual(found.slice(6), [1, 1, 1, 1]);
  });

  it('keeps counts across restarts', async () => {
    const dir = await tempDir();
    await startVehicleCounting({ detector: fakeDetector(), dir });
    countFrame(9, at(1), 'xyz');
    await settle();
    await flush();
    resetVehicleCounting();
    await startVehicleCounting({ detector: fakeDetector(), dir });
    assert.deepEqual(vehicleCounts(9), [{ time: at(1), count: 3 }]);
  });
});

describe('vehicle counts on the server', () => {
  afterEach(resetVehicleCounting);

  it('serves what the counter wrote, while it runs', async () => {
    const dir = await tempDir();
    assert.equal(await vehiclesEnabled(dir), false);
    assert.deepEqual(await servedCounts(9, 0, dir), []);
    await startVehicleCounting({ detector: fakeDetector(), dir });
    await heartbeat();
    countFrame(9, at(2), 'ab');
    countFrame(9, at(1), 'xyz');
    await settle();
    await flush();
    assert.equal(await vehiclesEnabled(dir), true);
    assert.deepEqual(await servedCounts(9, 0, dir), [{ time: at(2), count: 2 }, { time: at(1), count: 3 }]);
    assert.deepEqual(await servedCounts(9, at(1.5), dir), [{ time: at(1), count: 3 }]);
  });

  it('takes the counter as stopped when its heartbeat is old', async () => {
    const dir = await tempDir();
    await startVehicleCounting({ detector: fakeDetector(), dir });
    await heartbeat();
    const old = new Date(Date.now() - 10 * 60_000);
    await fs.utimes(path.join(dir, 'status.json'), old, old);
    assert.equal(await vehiclesEnabled(dir), false);
  });
});
