import { build, version as esbuildVersion } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const probes = {
  tween: ['@pibbl/core', 'tween'], spring: ['@pibbl/core', 'spring'], stepper: ['@pibbl/core', 'stepper'],
  Flow: ['@pibbl/core', 'Flow'], Grid: ['@pibbl/core', 'Grid'], defineRenderLayer: ['@pibbl/core', 'defineRenderLayer'],
  defineThreeLayer: ['@pibbl/three', 'defineThreeLayer'],
  circleShape2D: ['@pibbl/core/physics/2d/geometry', 'circleShape2D'], PhysicsWorld2D: ['@pibbl/core/physics/2d', 'PhysicsWorld2D'],
  Axis: ['@pibbl/core/viz', 'Axis'], LineSeries: ['@pibbl/core/viz', 'LineSeries'], particleRange: ['@pibbl/core/particles', 'particleRange'], Particles2D: ['@pibbl/core/particles', 'Particles2D'],
};
const source = {
  '@pibbl/core': 'packages/core/src/index.ts', '@pibbl/three': 'packages/three/src/index.ts', '@pibbl/core/physics/2d': 'packages/core/src/features/physics/2d.ts',
  '@pibbl/core/physics/2d/geometry': 'packages/core/src/features/physics/2d-geometry.ts',
  '@pibbl/core/viz': 'packages/core/src/features/viz/index.ts', '@pibbl/core/particles': 'packages/core/src/features/particles/index.ts',
};
const packed = {
  '@pibbl/core': 'packages/core/dist/index.mjs', '@pibbl/three': 'packages/three/dist/index.mjs', '@pibbl/core/physics/2d': 'packages/core/dist/features/physics/2d.mjs',
  '@pibbl/core/physics/2d/geometry': 'packages/core/dist/features/physics/2d-geometry.mjs',
  '@pibbl/core/viz': 'packages/core/dist/features/viz/index.mjs', '@pibbl/core/particles': 'packages/core/dist/features/particles/index.mjs',
};
function aliases(table) { return { name: 'pibbl-public-entries', setup(api) { api.onResolve({ filter: /^@pibbl\// }, ({ path }) => table[path] ? ({ path: resolve(root, table[path]) }) : undefined); } }; }
function inputs(meta) { return Object.values(meta.outputs).flatMap(output => Object.entries(output.inputs ?? {}).map(([path, value]) => [path.replaceAll('\\', '/'), value.bytesInOutput ?? 0])); }
async function measure(table, specifier, value) {
  const result = await build({ absWorkingDir: root, stdin: { contents: `import { ${value} } from '${specifier}'; globalThis.keep=${value};`, resolveDir: root, loader: 'js' }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', treeShaking: true, minifySyntax: true, metafile: true, write: false, plugins: [aliases(table)], external: ['three'] });
  const bytes = result.outputFiles.reduce((sum, file) => sum + file.contents.byteLength, 0);
  const attributed = inputs(result.metafile).filter(([, bytes]) => bytes > 0);
  if (bytes === 0 || attributed.length === 0) throw new Error(`${specifier}:${value} was not retained`);
  return { bytes, inputs: attributed.sort((a, b) => b[1] - a[1]).slice(0, 5) };
}
const evidence = {};
for (const [name, [specifier, value]] of Object.entries(probes)) evidence[name] = { source: await measure(source, specifier, value), packed: await measure(packed, specifier, value) };
process.stdout.write(`${JSON.stringify({ node: process.version, esbuild: esbuildVersion, probes: evidence }, null, 2)}\n`);
