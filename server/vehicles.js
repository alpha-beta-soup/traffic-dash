// Vehicle counts, as the counter (counter/, a process of its own) writes them
// (shared/vehicleCounts.js). Each camera's file is read again only once it has changed.
import fs from 'node:fs/promises';

import {
  HEARTBEAT, countsDir, countsFile, statusFile,
} from '../shared/vehicleCounts.js';

const STALE = 3 * HEARTBEAT; // The counter is taken as stopped after this long without a heartbeat

const read = new Map(); // file -> { mtimeMs, counts: [[time, count], ...] }

// Whether the counter is running
export async function vehiclesEnabled(dir = countsDir) {
  const stat = await fs.stat(statusFile(dir)).catch(() => null);
  return !!stat && Date.now() - stat.mtimeMs < STALE;
}

// A camera's counts since `since` (ms), oldest first: [{ time, count }]
export async function vehicleCounts(id, since = 0, dir = countsDir) {
  const file = countsFile(dir, String(Number(id)));
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) return [];
  let entry = read.get(file);
  if (entry?.mtimeMs !== stat.mtimeMs) {
    try {
      entry = { mtimeMs: stat.mtimeMs, counts: JSON.parse(await fs.readFile(file, 'utf8')) };
      read.set(file, entry);
    } catch {
      if (!entry) return [];
    }
  }
  return entry.counts
    .filter(([time]) => time >= since)
    .sort(([a], [b]) => a - b)
    .map(([time, count]) => ({ time, count }));
}
