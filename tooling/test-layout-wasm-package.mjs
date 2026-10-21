import { strict as assert } from 'node:assert';
import { readFile, mkdtemp, mkdir, symlink, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../packages/core/.layout-wasm-package/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root)));
assert.equal(manifest.name, '@pibbl/core');
assert.equal(manifest.private, true);
assert.equal(await readFile(new URL('THIRD_PARTY_NOTICES.txt', root), 'utf8'), await readFile(new URL('../packages/core/THIRD_PARTY_NOTICES.txt', import.meta.url), 'utf8')); 
const region = await readFile(new URL('dist/lib/layout/wasm/region.js', root), 'utf8');
assert.match(region, /experimentalLayout = true/);
assert.doesNotMatch(region, /import\.meta\.env/);
const normal = await readFile(new URL('../packages/core/dist/lib/layout/wasm/region.js', import.meta.url), 'utf8');
assert.doesNotMatch(normal, /experimentalLayout = true/);
let modules = 0, instances = 0, scheduled = 0;
const NativeInstance = WebAssembly.Instance;
const nativeRequest = globalThis.requestAnimationFrame;
globalThis.requestAnimationFrame = () => { scheduled++; throw new Error('Import scheduled a frame'); };
WebAssembly.Instance = class extends NativeInstance { constructor(...args) { super(...args); instances++; } };
const NativeModule = WebAssembly.Module;
WebAssembly.Module = class extends NativeModule { constructor(...args) { super(...args); modules++; } };
const runtime = await import(new URL('dist/index.mjs', root));
const jsx = await import(new URL('dist/jsx-runtime.mjs', root));
const value = runtime.signal(3);
assert.equal(runtime.isSignal(value), true);
assert.ok(jsx.jsx(runtime.Flex, {}));
assert.equal(modules, 0, 'Unused public imports must not compile WASM');
assert.equal(instances, 0, 'Unused public imports must not instantiate WASM');
assert.equal(scheduled, 0, 'Unused public imports must not schedule frames');
assert.equal(globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().activeArenas, 0);
assert.equal(globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().activeNodes, 0);
WebAssembly.Instance = NativeInstance;
if (nativeRequest) globalThis.requestAnimationFrame = nativeRequest;
else delete globalThis.requestAnimationFrame;
WebAssembly.Module = NativeModule;
console.warn('Private built WASM package: public root/JSX imports, nominal signal and normal-build isolation pass');

const consumer = await mkdtemp(join(tmpdir(), 'pibbl-built-layout-'));
try {
  await mkdir(join(consumer, 'node_modules/@pibbl'), { recursive: true });
  await symlink(fileURLToPath(root), join(consumer, 'node_modules/@pibbl/core'), 'dir');
  const fixtures = ['wasm-built-lifecycle', 'wasm-flex-wrap', 'wasm-flex-column-wrap', 'wasm-flex-keyed-wrap', 'wasm-flex-nested-intrinsic'];
  for (const fixture of fixtures) {
    await writeFile(join(consumer, `${fixture}.tsx`), await readFile(new URL(`../packages/scenarios/src/learning/layout/${fixture}.example.tsx`, import.meta.url), 'utf8'));
  }
  for (const resolution of ['Bundler', 'NodeNext']) {
    await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'ESNext', lib: ['ESNext', 'DOM'], module: resolution === 'Bundler' ? 'ESNext' : 'NodeNext', moduleResolution: resolution, jsx: 'react-jsx', jsxImportSource: '@pibbl/core', types: [], skipLibCheck: false }, files: fixtures.map(fixture => `${fixture}.tsx`) }));
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ type: 'module', private: true }));
    execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url)), '-p', join(consumer, 'tsconfig.json')], { stdio: 'inherit' });
  }
  execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { signal, isSignal, Flex } from '@pibbl/core';
    import { jsx } from '@pibbl/core/jsx-runtime';
    if (!isSignal(signal(1)) || !jsx(Flex, {})) throw Error('public identity');
    if (!import.meta.resolve('@pibbl/core').includes('.layout-wasm-package/dist/index.mjs')) throw Error('wrong artifact');
  `], { cwd: consumer, stdio: 'inherit' });
} finally { await rm(consumer, { recursive: true, force: true }); }
console.warn('Independent local consumer: Bundler/NodeNext declarations and package exports resolve built artifact');
