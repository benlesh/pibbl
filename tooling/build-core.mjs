import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/core/', import.meta.url));
const entries = ['index', 'internal', 'types', 'filters', 'jsx-runtime', 'jsx-dev-runtime'];
// Discover the production graph without publishing bundled initialization that
// would make unrelated exports observable to downstream consumers.
const graph = await build({
  absWorkingDir: root,
  entryPoints: entries.map(entry => `src/${entry}.ts`),
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  external: ['@crc/types'],
  outdir: 'dist',
  write: false,
  metafile: true,
  logLevel: 'silent',
});
await build({
  absWorkingDir: root,
  entryPoints: Object.keys(graph.metafile.inputs).map(path => resolve(root, path)),
  outbase: 'src',
  outdir: 'dist',
  bundle: false,
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  sourcemap: true,
  logLevel: 'warning',
});
// Keep established public entry names while preserving their implementation graph.
await Promise.all(entries.map(entry => writeFile(resolve(root, `dist/${entry}.mjs`), `export * from './${entry}.js';\n`)));
