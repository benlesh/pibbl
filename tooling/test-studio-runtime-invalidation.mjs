import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { pibblRuntimeSource } from './pibbl-runtime-source.ts';

for (const mode of ['layout-wasm', 'layout-wasm-built']) {
  const plugin = pibblRuntimeSource(mode);
  const id = plugin.resolveId('virtual:pibbl-runtime-source');
  const virtualModule = { id };
  const watched = new Set();
  const invalidated = [];
  const server = {
    watcher: { add(paths) { for (const path of paths) watched.add(path); } },
    moduleGraph: {
      getModuleById(value) { assert.equal(value, id); return virtualModule; },
      invalidateModule(value) { invalidated.push(value); },
    },
  };
  assert.equal(typeof plugin.configureServer, 'function', 'runtime must register bundled dependencies');
  plugin.configureServer(server);
  await plugin.load(id);
  const coreInput = resolve(import.meta.dirname, mode === 'layout-wasm-built'
    ? '../packages/core/.layout-wasm-package/dist/lib/layout/box.js'
    : '../packages/core/src/lib/layout/box.ts');
  assert.ok(watched.has(coreInput), `${mode}: actual core input must be watched`);
  assert.deepEqual(plugin.handleHotUpdate({ file: coreInput, server }), [virtualModule]);
  assert.deepEqual(invalidated, [virtualModule]);
  assert.equal(plugin.handleHotUpdate({ file: resolve(import.meta.dirname, '../README.md'), server }), undefined);
  assert.deepEqual(invalidated, [virtualModule]);
  console.warn(`${mode}: bundled core changes invalidate virtual runtime; unrelated changes do not`);
}

if (process.argv.includes('--live')) {
const root = resolve(import.meta.dirname, '..');
const file = `${root}/packages/core/.layout-wasm-package/dist/lib/layout/box.js`;
const original = await readFile(file, 'utf8');
const server = await createServer({ configFile: false, root, plugins: [pibblRuntimeSource('layout-wasm-built')], server: { host: '127.0.0.1', port: 0, strictPort: true }, optimizeDeps: { noDiscovery: true } });
try {
  await server.listen();
  const before = await server.transformRequest('virtual:pibbl-runtime-source');
  assert.ok(before.code.includes('boxSizing'));
  const updated = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Runtime input did not invalidate the live virtual module')), 15000);
    const invalidate = server.moduleGraph.invalidateModule.bind(server.moduleGraph);
    server.moduleGraph.invalidateModule = (module, ...args) => {
      const result = invalidate(module, ...args);
      if (module?.id === '\0virtual:pibbl-runtime-source') { clearTimeout(timeout); resolve(); }
      return result;
    };
  });
  await writeFile(file, original + '\nglobalThis.__PIBBL_RUNTIME_REFRESH_TEST__ = "slice69-live-refresh";\n');
  await updated;
  const after = await server.transformRequest('virtual:pibbl-runtime-source');
  assert.ok(after.code.includes('slice69-live-refresh'));
  assert.notEqual(before.code, after.code);
  console.warn('Live built Vite server regenerated virtual runtime after bundled core edit, without restart or source fallback');
} finally { await writeFile(file, original); await server.close(); }

}
