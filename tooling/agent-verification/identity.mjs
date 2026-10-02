import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const fixturePath = 'packages/scenarios/src/agent-targeting-verification.ts';
export const vizFixturePath = 'packages/scenarios/src/viz-hover-lab.ts';
export const identityMarker = 'const fixtureIdentity = null;';
const fixedFiles = [fixturePath,
  'packages/scenarios/src/agent-targeting-verification.example.tsx',
  'tooling/agent-verification/targeting.ts',
  'tooling/agent-verification/runtime-identity.ts',
  'tooling/agent-verification/runtime-inspection.ts',
  'packages/core/package.json',
  'tooling/agent-verification/signals.ts',
  'tooling/agent-verification/component-diff.ts',
  'tooling/agent-verification/scheduler.ts',
  'tooling/agent-verification/signal-ownership.ts',
  'tooling/agent-verification/browser.ts',
  'tooling/agent-verification/identity.mjs',
  'tooling/agent-verification/identity-plugin.mjs',
  'playground/vite.config.ts', 'pnpm-lock.yaml'];

export async function fingerprint(root, files, revision) {
  const hash = createHash('sha256');
  const sorted = [...new Set(files)].sort();
  for (const file of sorted) {
    const content = await readFile(resolve(root, file));
    hash.update(JSON.stringify([file, content.length])).update('\n').update(content);
  }
  return Object.freeze({ schema: 'crc-targeting-identity/1', revision,
    sha256: hash.digest('hex'), files: sorted.length });
}

export async function sourceIdentity(root, scope = 'targeting') {
  if (scope !== 'targeting' && scope !== 'viz') throw new Error('Unknown verification identity scope');
  const files = scope === 'targeting' ? [...fixedFiles] : [vizFixturePath,
    'packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx',
    'tooling/agent-verification/identity.mjs', 'tooling/agent-verification/identity-plugin.mjs',
    'playground/vite.config.ts', 'pnpm-lock.yaml'];
  async function walk(relative) {
    for (const item of await readdir(resolve(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${item.name}`;
      if (item.isDirectory()) await walk(file);
      else if (/\.(?:ts|tsx)$/.test(file) && !/\.(?:test|spec)\./.test(file)) files.push(file);
    }
  }
  await walk('packages/core/src');
  if (scope === 'viz') await walk('packages/viz/src');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return fingerprint(root, files, revision);
}

export function assertIdentity(expected, served) {
  if (!served || served.schema !== 'crc-targeting-identity/1') {
    throw new Error('Served fixture identity unavailable; use the source development Studio with provenance enabled.');
  }
  if (served.revision !== expected.revision || served.sha256 !== expected.sha256 || served.files !== expected.files) {
    throw new Error('Served fixture identity mismatch; reload the intended checkout before verifying.');
  }
}
