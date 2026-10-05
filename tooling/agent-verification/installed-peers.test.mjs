import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { auditInstalledPeers } from './installed-peers.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'crc-installed-peers-'));
  async function pkg(path, manifest) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ main: 'index.js', ...manifest }));
    await writeFile(join(path, 'index.js'), 'throw new Error("Package execution forbidden during audit");');
    return join(path, 'package.json');
  }
  try { await run(root, pkg); } finally { await rm(root, { recursive: true, force: true }); }
}

test('uses installed manifests and standard peer ranges without executing resolved packages', async () => {
  await fixture(async (root, pkg) => {
    const consumer = await pkg(root, { name: 'consumer', version: '1.0.0', peerDependencies: { three: '^0.186.0' } });
    await pkg(join(root, 'node_modules/three'), { name: 'three', version: '0.186.2' });
    const pass = await auditInstalledPeers([consumer]);
    assert.equal(pass.status, 'compatible'); assert.equal(pass.peers[0].version, '0.186.2');
    assert.equal(pass.resolution, 'node-require-default'); assert.equal(pass.runtimeIdentity, 'not-observed');
    await pkg(join(root, 'node_modules/three'), { name: 'three', version: '0.187.0' });
    const failed = await auditInstalledPeers([consumer]);
    assert.equal(failed.status, 'incompatible'); assert.equal(failed.peers[0].status, 'incompatible');
  });
});

test('reports required missing, optional missing and invalid ranges distinctly', async () => {
  await fixture(async (root, pkg) => {
    const consumer = await pkg(root, { name: 'consumer', version: '1.0.0', peerDependencies: { absent: '*', optional: '*', unknown: 'workspace:*' }, peerDependenciesMeta: { optional: { optional: true } } });
    const result = await auditInstalledPeers([consumer]);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.peers.map(item => item.status), ['missing', 'optional-missing', 'unsupported-range']);
  });
});

test('distinguishes duplicate physical core installations from proof of loaded duplicate runtimes', async () => {
  await fixture(async (root, pkg) => {
    const consumers = [];
    for (const name of ['a', 'b']) {
      consumers.push(await pkg(join(root, name), { name, version: '1.0.0', peerDependencies: { '@crc/core': '0.0.1' } }));
      await pkg(join(root, name, 'node_modules/@crc/core'), { name: '@crc/core', version: '0.0.1' });
    }
    const result = await auditInstalledPeers(consumers);
    assert.equal(result.status, 'compatible');
    assert.equal(result.coreInstallations.length, 2);
    assert.equal(result.duplicateCoreInstallations, true);
    assert.equal(result.runtimeIdentity, 'not-observed');
  });
});

test('observes current official consumers including the Three.js peer', async () => {
  const result = await auditInstalledPeers(['three'].map(name => resolve('packages', name, 'package.json')));
  assert.equal(result.status, 'compatible'); assert.equal(result.peers.length, 2);
  assert.equal(result.coreInstallations.length, 1);
  assert.equal(result.peers.find(peer => peer.name === 'three').version, '0.186.0');
});

test('does not call an installed but broken optional peer absent', async () => {
  await fixture(async (root, pkg) => {
    const consumer = await pkg(root, { name: 'consumer', version: '1.0.0', peerDependencies: { broken: '*' }, peerDependenciesMeta: { broken: { optional: true } } });
    await pkg(join(root, 'node_modules/broken'), { name: 'broken', version: '1.0.0', exports: './missing.js' });
    const result = await auditInstalledPeers([consumer]);
    assert.equal(result.status, 'unavailable'); assert.equal(result.peers[0].status, 'unavailable');
  });
});

test('default CLI audits both published core consumers', async () => {
  const { execFileSync } = await import('node:child_process');
  const result = JSON.parse(execFileSync(process.execPath, [resolve('tooling/agent-verification/installed-peers.mjs')], { encoding: 'utf8' }));
  assert.deepEqual(result.consumers.map(consumer => consumer.name).sort(), ['@crc/text', '@crc/three']);
  assert.equal(result.peers.length, 3);
});
