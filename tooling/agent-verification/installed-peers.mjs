import { createHash } from 'node:crypto';
import { open, realpath, lstat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import semver from 'semver';

async function manifest(path) {
  const file = await open(path, 'r');
  try {
    if (!(await file.stat()).isFile()) throw new Error('Manifest must be a regular file.');
    const buffer = Buffer.alloc(65537); let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > 65536) throw new Error('Manifest exceeds 64 KiB budget.');
    const bytes = buffer.subarray(0, length);
    return { value: JSON.parse(bytes.toString('utf8')), path: await realpath(path), sha256: createHash('sha256').update(bytes).digest('hex') };
  } finally { await file.close(); }
}
async function installedManifest(entry, name) {
  let directory = dirname(await realpath(entry));
  for (let depth = 0; depth < 16; depth++) {
    try {
      const found = await manifest(join(directory, 'package.json'));
      if (found.value.name === name) return found;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(directory); if (parent === directory) break; directory = parent;
  }
  throw new Error('Resolved entry has no matching package manifest within 16 ancestors.');
}
async function absentFromLookupPaths(require, name) {
  const locations = require.resolve.paths(name);
  if (!locations || locations.length > 32) return false;
  for (const location of locations) {
    try { await lstat(join(location, name)); return false; }
    catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') return false; }
  }
  return true;
}
const packageName = value => typeof value === 'string' && value.length <= 128 && /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value);

/** Node require/default resolution only. Never imports or executes resolved code. */
export async function auditInstalledPeers(consumerManifests) {
  if (!Array.isArray(consumerManifests) || consumerManifests.length < 1 || consumerManifests.length > 16) throw new Error('Supply 1 through 16 consumer manifest paths.');
  const peers = [], consumers = [], paths = new Set(), coreInstallations = new Set();
  for (const supplied of consumerManifests) {
    const consumer = await manifest(resolve(supplied));
    if (paths.has(consumer.path)) throw new Error('Duplicate consumer manifest path.');
    paths.add(consumer.path);
    if (!packageName(consumer.value.name)) throw new Error('Invalid consumer package name.');
    const declarations = consumer.value.peerDependencies ?? {};
    if (typeof declarations !== 'object' || Array.isArray(declarations) || declarations === null) throw new Error('Invalid peer dependency declarations.');
    const entries = Object.entries(declarations);
    if (peers.length + entries.length > 128) throw new Error('Peer audit exceeds 128 dependency budget.');
    consumers.push({ name: consumer.value.name, path: consumer.path, sha256: consumer.sha256 });
    const require = createRequire(consumer.path);
    for (const [name, range] of entries) {
      if (!packageName(name)) throw new Error('Invalid peer package name.');
      const record = { consumer: consumer.value.name, consumerManifest: consumer.path, name,
        range: typeof range === 'string' ? range.slice(0, 256) : null,
        optional: consumer.value.peerDependenciesMeta?.[name]?.optional === true };
      if (typeof range !== 'string' || range.length > 256 || !semver.validRange(range)) {
        peers.push({ ...record, status: 'unsupported-range' }); continue;
      }
      let entry;
      try { entry = require.resolve(name); }
      catch (error) {
        const missing = error.code === 'MODULE_NOT_FOUND' && consumer.value.name !== name && await absentFromLookupPaths(require, name);
        peers.push({ ...record, status: missing ? record.optional ? 'optional-missing' : 'missing' : 'unavailable', reason: String(error.code ?? error.message).slice(0, 256) }); continue;
      }
      try {
        const found = await installedManifest(entry, name);
        const version = found.value.version;
        const validVersion = typeof version === 'string' && version.length <= 64 && semver.valid(version);
        if (name === '@crc/core') coreInstallations.add(dirname(found.path));
        peers.push({ ...record, entry: await realpath(entry), manifest: found.path, sha256: found.sha256,
          version: typeof version === 'string' ? version.slice(0, 64) : null,
          status: !validVersion ? 'unavailable' : semver.satisfies(version, range) ? 'compatible' : 'incompatible' });
      } catch (error) { peers.push({ ...record, status: 'unavailable', reason: String(error.message).slice(0, 256) }); }
    }
  }
  return { schema: 'crc-installed-peer-audit/1', resolution: 'node-require-default', runtimeIdentity: 'not-observed',
    status: peers.some(peer => peer.status === 'incompatible') ? 'incompatible' : peers.some(peer => !['compatible', 'optional-missing'].includes(peer.status)) ? 'unavailable' : 'compatible',
    consumers, peers, coreInstallations: [...coreInstallations].sort(), duplicateCoreInstallations: coreInstallations.size > 1,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(import.meta.dirname, '../..');
    const paths = process.argv.slice(2);
    const result = await auditInstalledPeers(paths.length ? paths : ['three', 'viz', 'particles', 'physics', 'textures'].map(name => join(root, 'packages', name, 'package.json')));
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status !== 'compatible') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-installed-peer-audit/1', status: 'unavailable', reason: String(error.message).slice(0, 512) }) + '\n');
    process.exitCode = 1;
  }
}
