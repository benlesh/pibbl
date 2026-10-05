import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { valid } from 'semver';

// Keep exact lockstep pins, including beta releases; ranges remain unsupported.
const exactRelease = value => typeof value === 'string' && value.length <= 64 && valid(value) === value;
const label = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
export function auditCorePeerPins(core, peers) {
  if (core?.name !== '@crc/core' || !exactRelease(core.version)) throw new Error('Invalid or unsupported core manifest.');
  if (!Array.isArray(peers) || peers.length < 1 || peers.length > 32) throw new RangeError('Supply 1 through 32 peer manifests.');
  const names = new Set();
  const packages = peers.map(peer => {
    if (!label(peer?.name) || !label(peer.version)) throw new Error('Invalid peer manifest identity.');
    if (names.has(peer.name)) throw new Error('Duplicate peer manifest identity.');
    names.add(peer.name);
    const required = peer.peerDependencies?.['@crc/core'];
    const status = !exactRelease(required) ? 'unavailable' : required === core.version ? 'compatible' : 'incompatible';
    return Object.freeze({ name: peer.name, version: peer.version,
      requiredCore: label(required) ? required : null, observedCore: core.version, status });
  });
  return Object.freeze({ schema: 'crc-core-peer-audit/1', scope: 'declared-core-peer-pins',
    status: packages.some(peer => peer.status === 'incompatible') ? 'incompatible' : packages.some(peer => peer.status === 'unavailable') ? 'unavailable' : 'compatible',
    runtimeIdentity: 'not-observed', otherPeers: 'not-checked', packages: Object.freeze(packages),
  });
}

/** Explicit repository manifests only; no install, import or package execution. */
export async function readCorePeerAudit(root) {
  const manifests = [];
  const values = [];
  for (const name of ['core', 'three', 'text']) {
    const path = `packages/${name}/package.json`;
    const file = await open(resolve(root, path), 'r');
    let bytes;
    try {
      if (!(await file.stat()).isFile()) throw new Error('Package manifest must be a regular file.');
      const buffer = Buffer.alloc(65537); let length = 0;
      while (length < buffer.length) {
        const result = await file.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > 65536) throw new Error('Package manifest exceeds 64 KiB budget.');
      bytes = buffer.subarray(0, length);
    } finally { await file.close(); }
    const value = JSON.parse(bytes.toString('utf8'));
    if (value.name !== `@crc/${name}`) throw new Error(`Unexpected package identity at ${path}.`);
    values.push(value);
    manifests.push(Object.freeze({ path, sha256: createHash('sha256').update(bytes).digest('hex') }));
  }
  return Object.freeze({ ...auditCorePeerPins(values[0], values.slice(1)), manifests: Object.freeze(manifests) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3) throw new Error('Usage: node core-peer-compatibility.mjs [REPOSITORY]');
    const result = await readCorePeerAudit(resolve(process.argv[2] ?? import.meta.dirname, process.argv[2] ? '.' : '../..'));
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status !== 'compatible') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-core-peer-audit/1', status: 'unavailable', reason: String(error.message).slice(0, 512) }) + '\n');
    process.exitCode = 1;
  }
}
