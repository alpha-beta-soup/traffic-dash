// What the server keeps on disk between restarts (server-state/, a volume in Docker): things slow
// to fetch again, so a restart doesn't keep its first visitors waiting on them. Not served.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const stateDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server-state');

const fileOf = (dir, name) => path.join(dir, `${name}.json`);

// The value saved as `name`, or undefined if there's none (or it can't be read)
export async function readStored(name, dir = stateDir) {
  try {
    return JSON.parse(await fs.readFile(fileOf(dir, name), 'utf8'));
  } catch {
    return undefined;
  }
}

// Saves a value as `name`, whole: written aside, then moved into place, so a crash midway never
// leaves half a file
export async function writeStored(name, value, dir = stateDir) {
  await fs.mkdir(dir, { recursive: true });
  const file = fileOf(dir, name);
  await fs.writeFile(`${file}.tmp`, JSON.stringify(value));
  await fs.rename(`${file}.tmp`, file);
}
