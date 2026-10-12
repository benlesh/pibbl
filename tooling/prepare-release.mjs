import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { valid } from 'semver';

const [version, ...extra] = process.argv.slice(2);
if (!version || valid(version) !== version || extra.length) {
  throw new Error('Usage: pnpm release <exact-version>, for example 0.1.0-beta.0');
}

// Validate the complete release set before changing any manifest. Preparation
// does not create commits or tags, push, or publish packages.
const manifests = ['core', 'three', 'text', 'pibbl'].map(name => {
  const path = resolve('packages', name, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.name !== (name === 'pibbl' ? 'pibbl' : `@pibbl/${name}`) || manifest.private) {
    throw new Error(`Unexpected publishable package at ${path}`);
  }
  if (name !== 'core' && name !== 'pibbl' && !manifest.peerDependencies?.['@pibbl/core']) {
    throw new Error(`Missing exact core peer in ${manifest.name}`);
  }
  manifest.version = version;
  if (name === 'pibbl') manifest.dependencies['@pibbl/core'] = `workspace:${version}`;
  else if (name !== 'core') manifest.peerDependencies['@pibbl/core'] = version;
  return { path, manifest };
});
for (const { path, manifest } of manifests) {
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}
process.stdout.write(`Prepared ${manifests.map(({ manifest }) => manifest.name).join(', ')} at ${version}. Run pnpm trust before publishing.\n`);
