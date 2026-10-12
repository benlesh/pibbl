import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fingerprint } from './identity.mjs';
export const signalMutationFixturePath = 'packages/scenarios/src/agent-signal-mutation.ts';
/** Scoped loaded fixture identity, not general dependency or asset attestation. */
export async function sourceSignalMutationIdentity(root) {
  const files = [signalMutationFixturePath, 'packages/scenarios/src/agent-signal-mutation.example.tsx',
    'tooling/agent-verification/signal-mutation-identity.mjs', 'tooling/agent-verification/signals.ts',
    'tooling/agent-verification/component-diff.ts', 'tooling/agent-verification/signal-ownership.ts',
    'tooling/agent-verification/scheduler.ts', 'tooling/agent-verification/identity.mjs',
    'tooling/agent-verification/identity-plugin.mjs', 'playground/vite.config.ts', 'packages/core/package.json', 'pnpm-lock.yaml'];
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
