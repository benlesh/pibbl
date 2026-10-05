import { build } from 'esbuild';
import { writeFile, readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/core/', import.meta.url));
const entries = ['index', 'internal', 'types', 'filters', 'jsx-runtime', 'jsx-dev-runtime'];
const features = ['particles/index', 'viz/index', 'textures/index', 'physics/2d', 'physics/2d-geometry', 'physics/2d-testing'];
// Preserve module boundaries and one shared runtime; only the private upstream
// engine is bundled. Root/geometry entry graphs never reach its initialization.
const graph = await build({
  absWorkingDir: root,
  entryPoints: [...entries, ...features.map(entry => `features/${entry}`)].map(entry => `src/${entry}.ts`),
  bundle: true, splitting: true, format: 'esm', platform: 'neutral', target: 'esnext',
  external: ['@dimforge/rapier2d-compat'],
  outdir: 'dist', write: false, metafile: true, logLevel: 'silent',
});
await build({
  absWorkingDir: root,
  entryPoints: Object.keys(graph.metafile.inputs).map(path => resolve(root, path)),
  outbase: 'src', outdir: 'dist', bundle: false, format: 'esm', platform: 'neutral',
  target: 'esnext', sourcemap: true, logLevel: 'warning',
  plugins: [{
    name: 'private-rapier-engine',
    setup(builder) {
      builder.onLoad({ filter: /features\/physics\/lib\/2d\/world\/rapier\.ts$/ }, async ({ path }) => ({
        contents: (await readFile(path, 'utf8')).replace('"@dimforge/rapier2d-compat"', '"./rapier-engine.js"'),
        loader: 'ts',
      }));
    },
  }],
});
await build({
  absWorkingDir: root,
  stdin: { contents: "export { default } from '@dimforge/rapier2d-compat';", resolveDir: root },
  bundle: true, format: 'esm', platform: 'neutral', target: 'esnext',
  outfile: 'dist/features/physics/lib/2d/world/rapier-engine.js', sourcemap: true,
});
await Promise.all([...entries, ...features.map(entry => `features/${entry}`)].map(entry => writeFile(resolve(root, `dist/${entry}.mjs`), `export * from './${basename(entry)}.js';\n`)));
