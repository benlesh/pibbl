import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Persistent ownership between cooperating replay writers, not a process lock. */
export async function reserveEvidenceDirectory(output) {
  await mkdir(output, { recursive: true });
  const entries = await readdir(output);
  if (entries.some(entry => entry !== 'watchdog.json')) {
    throw new Error('Evidence directory is nonempty; choose a fresh output directory.');
  }
  const reservation = {
    schema: 'pibbl-evidence-reservation/1',
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    meaning: 'persistent-reservation-not-liveness',
  };
  try {
    await writeFile(resolve(output, '.pibbl-evidence-reservation.json'), JSON.stringify(reservation, null, 2), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Evidence directory is already reserved; choose a fresh output directory.', { cause: error });
    throw error;
  }
  return reservation;
}
