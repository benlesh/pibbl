import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { sourceTextIdentity } from './text-identity.mjs';
const root = resolve(import.meta.dirname, '../..');
for (const mismatch of [false, true]) {
  test(`text replay refuses ${mismatch ? 'stale identity' : 'unexpected private payload'} without retaining content`, { timeout: 20000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'crc-text-replay-'));
    const identity = { ...await sourceTextIdentity(root) };
    if (mismatch) identity.sha256 = '0'.repeat(64);
    const state = { status: 'ready', revision: 1, mode: 'seed', expected: 'Revenue: 42', assertion: 'fail',
      observation: { records: [{ content: { status: 'fixture', value: 'Revenue: 24' } }, { content: { status: 'redacted' } }], unexpected: 'PRIVATE_MUST_NOT_ENTER_REPORT' } };
    const envelope = { schema: 'crc-text-fixture/1', identity, state };
    const server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(`<pre data-testid="agent-text-evidence">${JSON.stringify(envelope)}</pre>`); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const child = spawn(process.execPath, ['tooling/agent-verification/text-replay.mjs', `http://127.0.0.1:${server.address().port}`, directory], { cwd: root, stdio: 'pipe' });
      let diagnostics = ''; child.stdout.on('data', chunk => { diagnostics += chunk; }); child.stderr.on('data', chunk => { diagnostics += chunk; });
      const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
      let code;
      try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
      finally { clearTimeout(timer); }
      assert.equal(code, 1, diagnostics);
      const report = JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'));
      assert.equal(report.status, mismatch ? 'blocked' : 'fail');
      assert.equal(report.steps.length, mismatch ? 0 : 1);
      assert.equal(report.steps[0]?.state, undefined);
      if (!mismatch) assert.equal(report.firstFailedCheck.checkId, 'initial.bounded-call-evidence');
      for (const filename of await readdir(directory)) {
        const text = await readFile(join(directory, filename), 'utf8');
        assert.ok(!text.includes('PRIVATE_MUST_NOT_ENTER_REPORT'));
      }
    } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
  });
}
