import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createContext, runInContext } from 'node:vm';

async function runtimeBundle() {
  return (await build({ stdin: { contents: 'export * from "./tooling/agent-verification/runtime-identity.ts"; export * from "./tooling/agent-verification/runtime-inspection.ts";', resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false,
    format: 'iife', globalName: 'RuntimeIdentity', platform: 'browser', target: 'es2022', logLevel: 'silent' })).outputFiles[0].text;
}

test('distinguishes actual bundled runtime copies from independent JavaScript realms', async () => {
  const code = await runtimeBundle();
  const realm = createContext({});
  runInContext(code, realm);
  const first = realm.RuntimeIdentity.captureRuntimeBinding();
  assert.equal(realm.RuntimeIdentity.compareRuntimeBindings(first, first).relation, 'same-runtime');
  runInContext(code, realm); // A second execution creates another real module graph in this realm.
  const second = realm.RuntimeIdentity.captureRuntimeBinding();
  const duplicate = realm.RuntimeIdentity.compareRuntimeBindings(first, second);
  assert.equal(duplicate.relation, 'duplicate-runtime');
  assert.equal(duplicate.schedulers, 'independent');
  assert.equal(duplicate.versions, 'matching');
  const refused = realm.RuntimeIdentity.createRuntimeCheckedInspector(null, first);
  assert.equal(refused.status, 'blocked'); assert.equal(refused.inspector, null);
  assert.equal(refused.diagnostic.relation, 'duplicate-runtime');
  const separate = createContext({}); runInContext(code, separate);
  const third = separate.RuntimeIdentity.captureRuntimeBinding();
  const crossRealm = realm.RuntimeIdentity.compareRuntimeBindings(second, third);
  assert.equal(crossRealm.relation, 'separate-realms');
  assert.equal(crossRealm.schedulers, 'independent');
  assert.equal(Object.isFrozen(crossRealm), true);
  assert.equal(JSON.stringify(crossRealm).includes('pibblInstances'), false);
});

test('reports incompatible versions and unavailable or accessor bindings without evaluating user properties', async () => {
  const realm = createContext({}); runInContext(await runtimeBundle(), realm);
  const { captureRuntimeBinding, compareRuntimeBindings } = realm.RuntimeIdentity;
  const binding = captureRuntimeBinding(); let reads = 0;
  const mismatch = { ...binding, version: '99.0.0' };
  assert.equal(compareRuntimeBindings(binding, mismatch).versions, 'mismatched');
  const accessor = { ...binding, get runtime() { reads++; throw new Error('must not read'); } };
  assert.equal(compareRuntimeBindings(binding, accessor).relation, 'unavailable');
  assert.equal(reads, 0);
  assert.equal(compareRuntimeBindings(binding, {}).relation, 'unavailable');
  assert.equal(compareRuntimeBindings(binding, JSON.parse(JSON.stringify({ version: binding.version })) ).relation, 'unavailable');
  assert.equal(compareRuntimeBindings(binding, { ...binding, scheduler: () => {} }).relation, 'inconsistent-binding');
});
