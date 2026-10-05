import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const manifest = name => JSON.parse(readFileSync(new URL(`../packages/${name}/package.json`, import.meta.url)));
test('Pibbl release names and versions are aligned', () => {
  for (const name of ['core', 'three', 'text', 'pibbl']) {
    const pkg = manifest(name);
    assert.equal(pkg.name, name === 'pibbl' ? 'pibbl' : `@pibbl/${name}`);
    assert.equal(pkg.version, '0.0.1');
  }
});
test('pibbl forwards every core subpath to one exact core dependency', () => {
  const core = manifest('core');
  const mirror = manifest('pibbl');
  assert.deepEqual(Object.keys(mirror.exports).sort(), Object.keys(core.exports).sort());
  assert.equal(mirror.dependencies['@pibbl/core'], `workspace:${core.version}`);
  for (const [subpath, entry] of Object.entries(mirror.exports)) {
    if (subpath === './package.json') continue;
    const specifier = '@pibbl/core' + (subpath === '.' ? '' : subpath.slice(1));
    for (const target of Object.values(entry)) {
      const source = readFileSync(new URL(`../packages/pibbl/${target}`, import.meta.url), 'utf8');
      assert.equal(source.trim(), `export * from '${specifier}';`);
    }
  }
});

test('root and every published README warn against production use', () => {
  for (const path of ['README.md', ...['core', 'three', 'text', 'pibbl'].map(name => `packages/${name}/README.md`)]) {
    const introduction = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').slice(0, 400);
    assert.match(introduction, /ALPHA — NOT FOR PRODUCTION USE/);
  }
});
