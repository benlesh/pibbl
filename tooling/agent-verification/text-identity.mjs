import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprint } from './identity.mjs';
export const textFixturePath = 'packages/scenarios/src/agent-text-verification.ts';
/** Loaded source fixture binding; not installed dependency or browser asset attestation. */
export async function sourceTextIdentity(root) {
  const files = [textFixturePath, 'packages/scenarios/src/agent-text-verification.example.tsx',
    'tooling/agent-verification/text.ts', 'tooling/agent-verification/text-identity.mjs',
    'tooling/agent-verification/identity.mjs', 'tooling/agent-verification/identity-plugin.mjs',
    'playground/vite.config.ts', 'packages/core/package.json', 'pnpm-lock.yaml'];
  async function walk(relative) {
    for (const item of await readdir(resolve(root, relative), { withFileTypes: true })) {
      const path = `${relative}/${item.name}`;
      if (item.isDirectory()) await walk(path);
      else if (/\.(ts|tsx)$/.test(path) && !/\.(test|spec)\./.test(path)) files.push(path);
    }
  }
  await walk('packages/core/src');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return fingerprint(root, files, revision);
}
