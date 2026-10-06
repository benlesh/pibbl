import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Publish only the explicit release set. Keep the reviewed tarballs for retries.
const alpha = process.argv.includes('--alpha');
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'dist/npm');
const packages = ['core', 'three', 'text', 'pibbl'].map(directory => {
  const path = resolve(root, 'packages', directory);
  const manifest = JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8'));
  assert.equal(manifest.name, directory === 'pibbl' ? 'pibbl' : `@pibbl/${directory}`);
  assert.ok(!manifest.private);
  assert.match(readFileSync(resolve(path, 'README.md'), 'utf8').slice(0, 400), /ALPHA — NOT FOR PRODUCTION USE/);
  return { path, manifest, archive: resolve(output, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`) };
});
assert.equal(new Set(packages.map(({ manifest }) => manifest.version)).size, 1);
if (alpha) assert.match(packages[0].manifest.version, /^\d+\.\d+\.\d+-alpha\.\d+\.\d+$/, 'Continuous publishing requires a CI alpha version');
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'inherit' });
if (alpha) {
  const hash = process.env.PIBBL_ALPHA_INPUT_HASH;
  assert.match(hash ?? '', /^[a-f0-9]{64}$/, 'Alpha publishing requires the checked input hash');
  for (const { path, manifest } of packages) {
    manifest.pibblAlphaInputHash = hash;
    writeFileSync(resolve(path, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
}
mkdirSync(output, { recursive: true });
for (const { path, archive } of packages) run('corepack', ['pnpm@11.21.0', 'pack', '--out', archive], path);
if (process.argv.includes('--pack-only')) process.exit(0);
for (const { archive } of packages) run('npm', ['publish', archive, '--access', 'public', '--tag', alpha ? 'alpha' : 'next']);
if (!alpha) for (const { manifest } of packages) run('npm', ['dist-tag', 'add', `${manifest.name}@${manifest.version}`, 'latest']);
for (const { manifest } of packages) run('npm', ['view', `${manifest.name}@${manifest.version}`, 'version', 'dist-tags', '--json']);
