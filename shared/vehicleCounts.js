// Vehicle counts, as the counter (counter/) writes them and the server reads them, in
// vehicle-counts/:
// - <camera id>.json: [[time (ms), count], ...]
// - status.json: { updated (ms) }, rewritten every HEARTBEAT while the counter is running
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const countsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vehicle-counts');

export const HEARTBEAT = 30_000;

export const countsFile = (dir, id) => path.join(dir, `${id}.json`);
export const statusFile = dir => path.join(dir, 'status.json');
export const isCountsFile = name => /^\d+\.json$/.test(name);
