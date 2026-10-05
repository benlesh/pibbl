import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reserveEvidenceDirectory } from './evidence-directory.mjs';

test('only one concurrent replay can reserve an output directory', async () => {
  const output = await mkdtemp(join(tmpdir(), 'pibbl-output-owner-'));
  try {
    const results = await Promise.allSettled([reserveEvidenceDirectory(output), reserveEvidenceDirectory(output)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    await assert.rejects(reserveEvidenceDirectory(output), /reserved|nonempty/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('legacy evidence and unrelated files are preserved; watchdog preparation is allowed', async () => {
  const output = await mkdtemp(join(tmpdir(), 'pibbl-output-legacy-'));
  try {
    await writeFile(join(output, 'report.json'), 'previous report');
    await assert.rejects(reserveEvidenceDirectory(output), /nonempty/);
    assert.equal(await readFile(join(output, 'report.json'), 'utf8'), 'previous report');
    await rm(join(output, 'report.json'));
    await writeFile(join(output, 'watchdog.json'), 'parent preparation');
    await reserveEvidenceDirectory(output);
    assert.equal(await readFile(join(output, 'watchdog.json'), 'utf8'), 'parent preparation');
    const reservation = JSON.parse(await readFile(join(output, '.pibbl-evidence-reservation.json'), 'utf8'));
    assert.equal(reservation.meaning, 'persistent-reservation-not-liveness');
  } finally { await rm(output, { recursive: true, force: true }); }
});

import { spawnSync } from 'node:child_process';
import { runWithWatchdog } from './watchdog.mjs';

test('both direct replay commands reject old evidence before browser startup', async () => {
  const output = await mkdtemp(join(tmpdir(), 'pibbl-output-cli-'));
  try {
    await writeFile(join(output, 'report.json'), 'previous report');
    for (const runner of ['replay.mjs', 'viz-replay.mjs']) {
      const result = spawnSync(process.execPath, [join(import.meta.dirname, runner), 'http://127.0.0.1:1', output], { encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Evidence directory is nonempty/);
      assert.equal(await readFile(join(output, 'report.json'), 'utf8'), 'previous report');
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('watchdog child reserves its prepared directory and evidence survives exit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pibbl-output-watchdog-'));
  try {
    const script = join(directory, 'child.mjs');
    const output = join(directory, 'evidence');
    await writeFile(script, `import { reserveEvidenceDirectory } from ${JSON.stringify(new URL('./evidence-directory.mjs', import.meta.url).href)};
      import { writeFile } from 'node:fs/promises';
      await reserveEvidenceDirectory(process.argv[2]);
      await writeFile(process.argv[2] + '/report.json', 'retained child evidence');`);
    const report = await runWithWatchdog({ script, args: [output], output, deadlineMs: 10000 });
    assert.equal(report.exitCode, 0);
    assert.equal(await readFile(join(output, 'report.json'), 'utf8'), 'retained child evidence');
    await assert.rejects(reserveEvidenceDirectory(output), /nonempty/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
