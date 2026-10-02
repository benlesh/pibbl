import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditCorePeerPins, readCorePeerAudit } from './core-peer-compatibility.mjs';

const core = { name: '@crc/core', version: '0.0.1' };
const peer = { name: '@crc/viz', version: '0.0.1', peerDependencies: { '@crc/core': '0.0.1' } };
test('checks declared core peer pins without confusing package versions with peer compatibility', () => {
  assert.equal(auditCorePeerPins(core, [peer]).status, 'compatible');
  const mismatch = auditCorePeerPins({ ...core, version: '0.0.2' }, [peer]);
  assert.equal(mismatch.status, 'incompatible');
  assert.deepEqual(mismatch.packages[0], { name: '@crc/viz', version: '0.0.1', requiredCore: '0.0.1', observedCore: '0.0.2', status: 'incompatible' });
  assert.equal(auditCorePeerPins(core, [{ ...peer, version: '99.0.0' }]).status, 'compatible');
});

test('does not infer compatibility from unsupported ranges, missing declarations or duplicate manifests', () => {
  for (const requirement of ['^0.0.1', 'workspace:*', '*', undefined]) {
    const result = auditCorePeerPins(core, [{ ...peer, peerDependencies: { '@crc/core': requirement } }]);
    assert.equal(result.status, 'unavailable');
  }
  assert.throws(() => auditCorePeerPins(core, [peer, peer]), /duplicate/i);
  assert.throws(() => auditCorePeerPins(core, []), /1 through 32/);
  assert.throws(() => auditCorePeerPins({ name: '@crc/not-core', version: '0.0.1' }, [peer]), /core manifest/);
});

test('audits current official manifests with provenance and explicitly limited scope', async () => {
  const result = await readCorePeerAudit(process.cwd());
  assert.equal(result.status, 'compatible');
  assert.equal(result.packages.length, 5);
  assert.equal(result.scope, 'declared-core-peer-pins');
  assert.equal(result.runtimeIdentity, 'not-observed');
  assert.equal(result.otherPeers, 'not-checked');
  assert.equal(result.manifests.length, 6);
  assert.ok(result.manifests.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
});

test('CLI retains incompatible peer evidence and exits nonzero for a mismatched core pin', async () => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const root = await mkdtemp(join(tmpdir(), 'crc-peer-audit-'));
  try {
    for (const name of ['core', 'three', 'viz', 'particles', 'physics', 'textures']) {
      const directory = join(root, 'packages', name); await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'package.json'), JSON.stringify(name === 'core' ? core : {
        name: `@crc/${name}`, version: '0.0.1', peerDependencies: { '@crc/core': name === 'viz' ? '0.0.2' : '0.0.1' },
      }));
    }
    await assert.rejects(promisify(execFile)(process.execPath, [resolve('tooling/agent-verification/core-peer-compatibility.mjs'), root]), error => {
      assert.equal(error.code, 1);
      const result = JSON.parse(error.stdout);
      assert.equal(result.status, 'incompatible');
      assert.equal(result.packages.find(item => item.name === '@crc/viz').requiredCore, '0.0.2');
      assert.equal(result.manifests.length, 6);
      return true;
    });
  } finally { await rm(root, { recursive: true, force: true }); }
});
