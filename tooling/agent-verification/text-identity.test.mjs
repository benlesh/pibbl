import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { sourceTextIdentity, textFixturePath } from './text-identity.mjs';
import { targetingIdentityPlugin } from './identity-plugin.mjs';
import { identityMarker, assertIdentity } from './identity.mjs';
import { createReplayManifest, replayToolFiles } from './run-manifest.mjs';
const root = resolve(import.meta.dirname, '../..');
test('text fixture embeds its source identity and refuses unavailable or changed evidence', async () => {
  const identity = await sourceTextIdentity(root);
  const code = await readFile(resolve(root, textFixturePath), 'utf8');
  const transformed = await targetingIdentityPlugin(root).transform(code, resolve(root, textFixturePath));
  assert.ok(transformed.code.includes(identity.sha256));
  assert.ok(!transformed.code.includes(identityMarker));
  assertIdentity(identity, identity);
  assert.throws(() => assertIdentity(identity, null), /unavailable/);
  assert.throws(() => assertIdentity(identity, { ...identity, sha256: '0'.repeat(64) }), /mismatch/);
});
test('text replay has its own executable recipe and fingerprints its checks and tooling', () => {
  const recipe = createReplayManifest({ runId: 'text-test', repository: root, kind: 'text', url: 'http://127.0.0.1:5199/#/testing/agent-text-verification' });
  assert.ok(recipe.rerun.arguments[0].endsWith('/text-replay.mjs'));
  const files = replayToolFiles('text');
  for (const name of ['text-replay.mjs', 'text-identity.mjs', 'recorded-check.mjs']) assert.ok(files.includes(`tooling/agent-verification/${name}`));
});
