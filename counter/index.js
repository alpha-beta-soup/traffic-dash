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
  timers.push(every(SCAN, scan, 'Looking for frames'), every(HEARTBEAT, heartbeat, 'Heartbeat'));
} else timers.push(setInterval(() => {}, 2 ** 30));

const stop = async () => {
  timers.forEach(clearInterval);
  await flush().catch(err => console.error(`Saving vehicle counts: ${err.message}`));
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
