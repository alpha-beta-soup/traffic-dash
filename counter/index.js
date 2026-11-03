// The vehicle counter: a process of its own beside the server, so its heavy, steady work (about
// 2 s of CPU a frame) never slows the server, and can be given its own CPU, restarted, or moved to
// another machine with the same disk. It and the server share only files: it counts the frames
// the server caches (cache/), and writes counts the server serves (vehicle-counts/).
//
//   npm run counter
import { HEARTBEAT } from '../shared/vehicleCounts.js';
import {
  flush, heartbeat, scan, startVehicleCounting,
} from './counting.js';

const SCAN = 5000; // ms between looks for new frames

if (!await startVehicleCounting()) process.exit(0);
console.log('Vehicle counter running');

const every = (ms, task, what) => {
  const go = () => task().catch(err => console.error(`${what}: ${err.message}`));
  go();
  return setInterval(go, ms);
};
const timers = [every(SCAN, scan, 'Looking for frames'), every(HEARTBEAT, heartbeat, 'Heartbeat')];

const stop = async () => {
  timers.forEach(clearInterval);
  await flush().catch(err => console.error(`Saving vehicle counts: ${err.message}`));
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
