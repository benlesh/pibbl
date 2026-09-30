import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createReplayManifest } from './run-manifest.mjs';

test('records an executable rerun recipe without reusing evidence or copying ambient secrets', () => {
  const manifest = createReplayManifest({ runId: 'fixture-run', repository: '/tmp/crc fixture', kind: 'viz', url: 'http://127.0.0.1:5195/#/testing/viz-hover-lab', density: 2 });
  assert.equal(manifest.runId, 'fixture-run');
  assert.equal(manifest.rerun.executable, process.execPath);
  assert.deepEqual(manifest.rerun.arguments, [resolve('/tmp/crc fixture/tooling/agent-verification/viz-replay.mjs'), 'http://127.0.0.1:5195/#/testing/viz-hover-lab']);
  assert.deepEqual(manifest.rerun.environment, { CRC_VERIFY_DENSITY: '2' });
  assert.deepEqual(manifest.rerun.unsetEnvironment, ['CRC_VERIFY_BROWSER_ENDPOINT']);
  assert.equal(manifest.rerun.cwd, '/tmp/crc fixture');
  assert.equal(manifest.rerun.outputPolicy, 'fresh-default-directory');
  assert.equal(manifest.environment.node, process.version);
  assert.ok(Number.isFinite(Date.parse(manifest.startedAt)));
  assert.equal(manifest.clock, 'UTC-wall-clock');
});

test('targeting recipe keeps its fixed density and rejects invalid configurations', () => {
  const args = { runId: 'run', repository: '/tmp/crc', kind: 'targeting', url: 'http://localhost:5195/#/testing/agent-targeting-verification', density: 1 };
  const manifest = createReplayManifest(args);
  assert.ok(manifest.rerun.arguments[0].endsWith('/replay.mjs'));
  assert.deepEqual(manifest.rerun.environment, {});
  assert.throws(() => createReplayManifest({ ...args, kind: 'unknown' }), /kind/);
  assert.throws(() => createReplayManifest({ ...args, density: 2 }), /density/);
  assert.throws(() => createReplayManifest({ ...args, kind: 'viz', density: 3 }), /density/);
});
