import { preserveDeclarationJsdoc } from './preserve-declaration-jsdoc.mjs';
import { build } from 'esbuild';
import { writeFile, readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/core/', import.meta.url));
const experimental = process.argv.includes('--layout-wasm');
const output = experimental ? '.layout-wasm-package/dist' : 'dist';
const defines = { 'import.meta.env': 'undefined', __PIBBL_LAYOUT_WASM__: String(experimental) };
const entries = ['index', 'internal', 'types', 'filters', 'jsx-runtime', 'jsx-dev-runtime'];
const features = ['machines/index', 'machines/animation', 'sprites/index', 'sprites/formats/aseprite', 'sprites/formats/texture-packer', 'particles/index', 'viz/index', 'viz/inspection', 'textures/index', 'physics/2d', 'physics/2d-geometry', 'physics/2d-testing'];
// Preserve module boundaries and one shared runtime; only the private upstream
// engine is bundled. Root/geometry entry graphs never reach its initialization.
const graph = await build({
  absWorkingDir: root,
  entryPoints: [...entries, ...features.map(entry => `features/${entry}`)].map(entry => `src/${entry}.ts`),
  bundle: true, splitting: true, format: 'esm', platform: 'neutral', target: 'esnext',
  define: defines,
  external: ['@dimforge/rapier2d-compat'],
  outdir: output, write: false, metafile: true, logLevel: 'silent',
});
await build({
  absWorkingDir: root,
  entryPoints: Object.keys(graph.metafile.inputs).map(path => resolve(root, path)),
  outbase: 'src', outdir: output, bundle: false, format: 'esm', platform: 'neutral',
  target: 'esnext', sourcemap: true, logLevel: 'warning',
  define: defines,
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
  outfile: `${output}/features/physics/lib/2d/world/rapier-engine.js`, sourcemap: true,
});
await Promise.all([...entries, ...features.map(entry => `features/${entry}`)].map(entry => writeFile(resolve(root, `${output}/${entry}.mjs`), `export * from './${basename(entry)}.js';\n`)));

preserveDeclarationJsdoc(resolve(root, 'src'), resolve(root, output));
