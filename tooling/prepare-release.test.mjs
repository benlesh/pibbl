import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const script = resolve('tooling/prepare-release.mjs');
test('prepares all published versions and exact peers without changing the private root', () => {
  const root = mkdtempSync(join(tmpdir(), 'pibbl-release-'));
  try {
    const write = (path, value) => writeFileSync(path, JSON.stringify(value));
    write(join(root, 'package.json'), { private: true, version: '0.0.0' });
    for (const name of ['core', 'three', 'text', 'pibbl']) {
      mkdirSync(join(root, 'packages', name), { recursive: true });
      write(join(root, 'packages', name, 'package.json'), {
        name: name === 'pibbl' ? 'pibbl' : `@pibbl/${name}`, version: '0.0.1',
        ...(name === 'pibbl' ? { dependencies: { '@pibbl/core': '0.0.1' } } : name === 'core' ? {} : { peerDependencies: { '@pibbl/core': '0.0.1', other: '^1.0.0' } }),
      });
    }
    const run = version => execFileSync(process.execPath, [script, version], { cwd: root, stdio: 'pipe' });
    for (const version of ['0.1.0-beta.0', '0.1.0']) {
      run(version);
      for (const name of ['core', 'three', 'text', 'pibbl']) {
        const value = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json')));
        assert.equal(value.version, version);
        if (name === 'pibbl') assert.equal(value.dependencies['@pibbl/core'], `workspace:${version}`);
        else if (name !== 'core') assert.deepEqual(value.peerDependencies, { '@pibbl/core': version, other: '^1.0.0' });
      }
    }
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.0.0');
    for (const invalid of ['v0.1.0', '0.1.0-beta.01', '^0.1.0', 'latest']) assert.throws(() => run(invalid));
    const corePath = join(root, 'packages/core/package.json');
    const before = readFileSync(corePath, 'utf8');
    write(join(root, 'packages/text/package.json'), { name: '@wrong/text', version: '0.1.0' });
    assert.throws(() => run('0.2.0'));
    assert.equal(readFileSync(corePath, 'utf8'), before, 'validate every manifest before writing any');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
