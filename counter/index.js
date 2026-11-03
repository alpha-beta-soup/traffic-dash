// The vehicle counter: a process of its own beside the server, so its heavy, steady work (seconds
// of CPU a frame) never slows the server, and can be given its own CPU, restarted, or moved to
// another machine with the same disk. It and the server share only files: it counts the frames
// the server caches (cache/), and writes counts the server serves (vehicle-counts/).
//
//   npm run counter
import { HEARTBEAT } from '../shared/vehicleCounts.js';
import {
  flush, heartbeat, scan, startVehicleCounting,
} from './counting.js';

const SCAN = 5000; // ms between looks for new frames
const MEMORY_LOG = 60 * 60_000; // ms between logging its memory, so a slow leak shows in the log

const MB = bytes => `${Math.round(bytes / 2 ** 20)} MB`;
// RSS is everything, onnxruntime's own memory included; the heap is JavaScript's
const logMemory = async () => {
  const { rss, heapUsed } = process.memoryUsage();
  console.log(`Vehicle counter memory: ${MB(rss)} (JavaScript heap ${MB(heapUsed)})`);
};

const every = (ms, task, what) => {
  const go = () => task().catch(err => console.error(`${what}: ${err.message}`));
  go();
  return setInterval(go, ms);
};

// Without the model, it stays up but idle (and the server shows no counts), rather than exiting:
// beside the server in `npm run dev` or a container, exiting would stop or restart the others
const timers = [];
if (await startVehicleCounting()) {
  console.log('Vehicle counter running');
  timers.push(every(SCAN, scan, 'Looking for frames'), every(HEARTBEAT, heartbeat, 'Heartbeat'), every(MEMORY_LOG, logMemory, 'Memory'));
} else timers.push(setInterval(() => {}, 2 ** 30));

const stop = async () => {
  timers.forEach(clearInterval);
  await flush().catch(err => console.error(`Saving vehicle counts: ${err.message}`));
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
