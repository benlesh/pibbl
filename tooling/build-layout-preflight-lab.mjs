import { strict as assert } from 'node:assert';
import { resolve } from 'node:path';
import { build } from 'esbuild';
export async function buildLayoutPreflightLab(built = false) {
const root = resolve(import.meta.dirname, '..');
const core = resolve(root, built ? 'packages/core/.layout-wasm-package/dist' : 'packages/core/src');
const result = await build({
  absWorkingDir: root, entryPoints: [resolve(root, 'playground/src/testing/layout-preflight.tsx')], bundle: true, write: false, format: 'esm', platform: 'browser', metafile: true,
  jsx: 'automatic', jsxImportSource: '@pibbl/core',
  alias: { '@pibbl/core/sync': resolve(core, 'sync.js'), '@pibbl/core/jsx-runtime': resolve(core, 'jsx-runtime.js'), '@pibbl/core': resolve(core, 'index.js') },
  define: { __PIBBL_LAYOUT_WASM__: 'true', 'import.meta.env': JSON.stringify({ MODE: 'layout-wasm', DEV: true }) },
});
const coreInputs = Object.keys(result.metafile.inputs).filter(path => path.includes('packages/core/'));
assert.ok(coreInputs.length > 0);
if (built) assert.ok(coreInputs.every(path => path.includes('packages/core/.layout-wasm-package/dist/')));
return { source: result.outputFiles[0].text, coreInputs, inputs: Object.keys(result.metafile.inputs).filter(path => !path.startsWith('<')).map(path => resolve(root, path)) };
}
