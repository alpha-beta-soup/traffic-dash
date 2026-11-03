import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  countFrame, resetVehicleCounting, startVehicleCounting, vehicleCounts, vehiclesEnabled,
} from '../server/vehicles.js';

// A detector that finds as many vehicles as the image (a string, here) is long, noting the order
// it was asked in
const fakeDetector = (order = []) => ({
  async detect(image) {
    order.push(image);
    await new Promise(r => setTimeout(r, 5));
    return { found: Array.from({ length: image.length }) };
  },
});
const settle = () => new Promise(r => setTimeout(r, 60));
const NOW = Date.now(); // Counts older than the kept days are dropped, so tests use recent times
const at = minutes => NOW - minutes * 60_000;
const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'vehicle-counts-'));

describe('vehicle counting', () => {
  afterEach(resetVehicleCounting);

  it('is off without a model', async () => {
    assert.equal(await startVehicleCounting({ model: '/nowhere/model.onnx', dir: await tempDir() }), false);
    assert.equal(vehiclesEnabled(), false);
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
    await startVehicleCounting({
      detector: fakeDetector(order),
      dir: await tempDir(),
      backlog: [{ id: '3', time: at(3), file: 'old1' }, { id: '3', time: at(2), file: 'old2' }],
    });
    countFrame(3, at(1), 'new');
    countFrame(3, at(1), 'new');
    await settle();
    // The first backlog frame may already be under way when the new one arrives
    assert.deepEqual(order.filter(o => o !== 'old1'), ['new', 'old2']);
    assert.equal(vehicleCounts(3).length, 3);
  });

  it('keeps counts across restarts', async () => {
    const dir = await tempDir();
    await startVehicleCounting({ detector: fakeDetector(), dir, saveDelay: 10 });
    countFrame(9, at(1), 'xyz');
    await settle();
    resetVehicleCounting();
    await startVehicleCounting({ detector: fakeDetector(), dir });
    assert.deepEqual(vehicleCounts(9), [{ time: at(1), count: 3 }]);
  });
});
