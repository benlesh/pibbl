import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('Actions summaries identify the command and shard, list results, and retain failure annotations', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pibbl-reporter-'));
  try {
    const summary = join(directory, 'summary.md');
    const reporter = resolve('tooling/vitest-actions-reporter.mjs');
    writeFileSync(join(directory, 'vitest.config.mjs'), `export default { test: { reporters: [${JSON.stringify(reporter)}] } };`);
    writeFileSync(join(directory, 'example.test.js'), `import { test, expect } from ${JSON.stringify(resolve('node_modules/vitest/dist/index.js'))};
      test('passes', () => expect(1).toBe(1));
      test('useful failure name', () => expect(1).toBe(2));
      test.skip('skipped', () => {});`);
    const result = spawnSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--root', directory, '--shard=1/1'], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary, npm_lifecycle_event: 'test:lifecycle' },
    });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const report = readFileSync(summary, 'utf8');
    assert.match(report, /## test:lifecycle · shard 1\/1/);
    assert.match(report, /example.test.js/);
    assert.match(report, /1 passed · 1 failed · 1 skipped/);
    assert.match(report, /useful failure name/);
    assert.match(result.stdout, /::error .*useful failure name/);
    assert.doesNotMatch(report, /Vitest (Results|Test Report)/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
