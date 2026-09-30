import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, relative } from 'node:path';
import { replayToolFiles, captureReplayToolIdentity, finalizeReplayToolIdentity } from './run-manifest.mjs';

const repository = resolve(import.meta.dirname, '../..');
test('tool fingerprint changes when an assertion helper changes without a revision change', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crc-tool-identity-'));
  try {
    for (const path of replayToolFiles('viz')) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), `// ${path}`); }
    const before = await captureReplayToolIdentity(root, 'viz', 'same-revision');
    await writeFile(join(root, 'tooling/agent-verification/numeric-assertion.mjs'), '// changed tolerance');
    const after = await captureReplayToolIdentity(root, 'viz', 'same-revision');
    assert.notEqual(before.sha256, after.sha256);
    assert.equal(before.revision, after.revision);
    assert.equal(before.schema, 'crc-replay-tool-identity/1');
    assert.equal(before.files, replayToolFiles('viz').length);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('declared replay fingerprint includes every current static local dependency', async () => {
  for (const kind of ['targeting', 'viz']) {
    const files = new Set(replayToolFiles(kind));
    for (const path of files) {
      const source = await readFile(resolve(repository, path), 'utf8');
      for (const match of source.matchAll(new RegExp("from\\s+['\"]([.][./][^'\"]+)['\"]", 'g'))) {
        const dependency = relative(repository, resolve(repository, dirname(path), match[1]));
        assert.ok(files.has(dependency), `${path} imports uncovered ${dependency}`);
      }
    }
  }
  assert.throws(() => replayToolFiles('unknown'), /kind/);
});


test('tool changes fail finalization without replacing the original operation failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crc-tool-finalization-'));
  try {
    for (const path of replayToolFiles('viz')) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), `// ${path}`); }
    const initial = await captureReplayToolIdentity(root, 'viz', 'revision');
    const original = { message: 'Original geometry failure' };
    const report = { status: 'fail', failure: original, run: { kind: 'viz', toolIdentity: initial } };
    await finalizeReplayToolIdentity(report, root);
    assert.equal(report.toolVerification.status, 'matching-on-disk');
    assert.equal(report.status, 'fail');
    await writeFile(join(root, 'tooling/agent-verification/numeric-assertion.mjs'), '// changed');
    report.status = 'pass';
    await finalizeReplayToolIdentity(report, root);
    assert.equal(report.status, 'fail');
    assert.equal(report.toolVerification.status, 'failed');
    assert.equal(report.toolVerification.code, 'ERR_ASSERTION');
    assert.equal(report.failure, original);
    assert.notEqual(report.run.toolIdentityAfter.sha256, initial.sha256);
    await rm(join(root, 'tooling/agent-verification/numeric-assertion.mjs'));
    await finalizeReplayToolIdentity(report, root);
    assert.equal(report.toolVerification.status, 'failed');
    assert.equal(report.run.toolIdentityAfter, undefined);
    assert.equal(report.failure, original);
  } finally { await rm(root, { recursive: true, force: true }); }
});
