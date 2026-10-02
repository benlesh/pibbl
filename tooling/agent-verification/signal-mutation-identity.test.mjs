import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { sourceSignalMutationIdentity, signalMutationFixturePath } from './signal-mutation-identity.mjs';
import { targetingIdentityPlugin } from './identity-plugin.mjs';
import { identityMarker } from './identity.mjs';
import { createReplayManifest, replayToolFiles } from './run-manifest.mjs';
const root = resolve(import.meta.dirname, '../..');
test('signal mutation fixture embeds its actual source identity and has a native replay recipe', async () => {
  const identity = await sourceSignalMutationIdentity(root);
  const code = await readFile(resolve(root, signalMutationFixturePath), 'utf8');
  const result = await targetingIdentityPlugin(root).transform(code, resolve(root, signalMutationFixturePath));
  assert.ok(result.code.includes(identity.sha256));
  assert.ok(!result.code.includes(identityMarker));
  const manifest = createReplayManifest({ repository: root, kind: 'signal-mutation', runId: 'signal-mutation-test', url: 'http://127.0.0.1:5199/#/testing/agent-signal-mutation' });
  assert.ok(manifest.rerun.arguments[0].endsWith('/signal-mutation-replay.mjs'));
  for (const file of ['signal-mutation-replay.mjs', 'signal-mutation-identity.mjs', 'recorded-check.mjs']) assert.ok(replayToolFiles('signal-mutation').includes(`tooling/agent-verification/${file}`));
});
