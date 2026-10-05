import { build, version as esbuildVersion } from 'esbuild';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const probes = {
  tween: ['@crc/core', 'tween'], spring: ['@crc/core', 'spring'], stepper: ['@crc/core', 'stepper'],
  Flow: ['@crc/core', 'Flow'], Grid: ['@crc/core', 'Grid'], defineRenderLayer: ['@crc/core', 'defineRenderLayer'],
  defineThreeLayer: ['@crc/three', 'defineThreeLayer'],
  circleShape2D: ['@crc/core/physics/2d/geometry', 'circleShape2D'], PhysicsWorld2D: ['@crc/core/physics/2d', 'PhysicsWorld2D'],
  Axis: ['@crc/core/viz', 'Axis'], LineSeries: ['@crc/core/viz', 'LineSeries'], particleRange: ['@crc/core/particles', 'particleRange'], Particles2D: ['@crc/core/particles', 'Particles2D'],
};
const source = {
  '@crc/core': 'packages/core/src/index.ts', '@crc/three': 'packages/three/src/index.ts', '@crc/core/physics/2d': 'packages/core/src/features/physics/2d.ts',
  '@crc/core/physics/2d/geometry': 'packages/core/src/features/physics/2d-geometry.ts',
  '@crc/core/viz': 'packages/core/src/features/viz/index.ts', '@crc/core/particles': 'packages/core/src/features/particles/index.ts',
};
const packed = {
  '@crc/core': 'packages/core/dist/index.mjs', '@crc/three': 'packages/three/dist/index.mjs', '@crc/core/physics/2d': 'packages/core/dist/features/physics/2d.mjs',
  '@crc/core/physics/2d/geometry': 'packages/core/dist/features/physics/2d-geometry.mjs',
  '@crc/core/viz': 'packages/core/dist/features/viz/index.mjs', '@crc/core/particles': 'packages/core/dist/features/particles/index.mjs',
};
function aliases(table) { return { name: 'crc-public-entries', setup(api) { api.onResolve({ filter: /^@crc\// }, ({ path }) => table[path] ? ({ path: resolve(root, table[path]) }) : undefined); } }; }
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
