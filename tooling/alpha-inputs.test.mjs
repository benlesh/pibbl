import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alphaInputHash, needsAlphaPublish } from './alpha-inputs.mjs';

const entry = (path, id = 'a'.repeat(40)) => `100644 blob ${id}\t${path}\0`;
const hash = alphaInputHash(entry('packages/core/src/index.ts'));
const released = () => Array.from({ length: 4 }, () => ({ version: '0.0.3-alpha.10.1', pibblAlphaInputHash: hash }));

test('alpha inputs ignore presentation-only changes but include package and build changes', () => {
  for (const path of ['docs/site/index.md', 'website/src/main.ts', 'playground/src/main.ts', 'packages/scenarios/src/example.tsx', 'games/example.ts']) {
    assert.equal(alphaInputHash(entry('packages/core/src/index.ts') + entry(path)), hash);
  }
  for (const path of ['packages/core/src/new.ts', 'packages/text/native/build.c', 'packages/three/README.md', 'packages/pibbl/package.json', 'pnpm-lock.yaml', 'tooling/build-core.mjs', '.github/workflows/trust.yml', 'new-build-config.json']) {
    assert.notEqual(alphaInputHash(entry('packages/core/src/index.ts') + entry(path)), hash);
  }
  assert.notEqual(alphaInputHash(entry('packages/core/src/index.ts', 'b'.repeat(40))), hash);
  assert.notEqual(alphaInputHash(''), hash);
});

test('skip only when every package has the same completed release and input hash', () => {
  assert.equal(needsAlphaPublish(released(), hash), false);
  assert.equal(needsAlphaPublish(released(), 'b'.repeat(64)), true);
  for (const replacement of [null, {}, { version: '0.0.3-alpha.9.1', pibblAlphaInputHash: hash }, { version: '0.0.3-alpha.10.1', pibblAlphaInputHash: 'old' }]) {
    const packages = released();
    packages[2] = replacement;
    assert.equal(needsAlphaPublish(packages, hash), true);
  }
});
