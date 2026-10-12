import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'pibbl-mirror-'));
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
try {
  for (const name of ['core', 'pibbl']) {
    const archive = join(temp, `${name}.tgz`);
    run('corepack', ['pnpm@11.21.0', 'pack', '--out', archive], join(root, 'packages', name));
    const directory = join(temp, 'node_modules', name === 'core' ? '@pibbl/core' : 'pibbl');
    mkdirSync(directory, { recursive: true });
    run('tar', ['-xzf', archive, '--strip-components=1', '-C', directory]);
    assert.match(readFileSync(join(directory, 'README.md'), 'utf8').slice(0, 400), /ALPHA — NOT FOR PRODUCTION USE/);
  }
  const core = JSON.parse(readFileSync(join(temp, 'node_modules/@pibbl/core/package.json')));
  const mirror = JSON.parse(readFileSync(join(temp, 'node_modules/pibbl/package.json')));
  assert.equal(mirror.dependencies['@pibbl/core'], core.version);
  assert.deepEqual(Object.keys(mirror.exports).sort(), Object.keys(core.exports).sort());
  writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
  writeFileSync(join(temp, 'runtime.mjs'), `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const core = JSON.parse(readFileSync(new URL('./node_modules/@pibbl/core/package.json', import.meta.url)));
for (const [key, entry] of Object.entries(core.exports)) {
  if (key === './package.json' || !entry.default) continue;
  const suffix = key === '.' ? '' : key.slice(1);
  const a = await import('pibbl' + suffix);
  const b = await import('@pibbl/core' + suffix);
  assert.deepEqual(Object.keys(a), Object.keys(b));
  for (const name of Object.keys(a)) assert.equal(a[name], b[name], suffix + ':' + name);
}
const { pibbl, signal, isSignal } = await import('pibbl');
assert.equal(typeof pibbl, 'function');
assert.equal(isSignal(signal(1)), true);
`);
  run(process.execPath, ['runtime.mjs'], temp);
  writeFileSync(join(temp, 'consumer.tsx'), `import { pibbl, Rectangle, type PibblElement } from 'pibbl';\nconst element: PibblElement = <Rectangle style={{ width: 10, height: 10, fill: 'red' }} />;\npibbl(document.createElement('canvas'), element);\n`);
  for (const mode of ['Bundler', 'NodeNext']) {
    writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { module: mode === 'Bundler' ? 'ESNext' : 'NodeNext', moduleResolution: mode, strict: true, noEmit: true, skipLibCheck: false, types: [], target: 'ESNext', jsx: 'react-jsx', jsxImportSource: 'pibbl' }, files: ['consumer.tsx'] }));
    run(join(root, 'node_modules/.bin/tsc'), ['-p', join(temp, 'tsconfig.json')]);
  }
  console.warn('Packed Pibbl mirror: exact dependency, all subpaths, runtime identity, ALPHA notices, Bundler and NodeNext JSX passed.');
} finally { rmSync(temp, { recursive: true, force: true }); }
