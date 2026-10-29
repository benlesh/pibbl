import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

await build({
  entryPoints: [join(root, 'packages/layout/src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'esnext',
  sourcemap: true,
  outfile: join(root, 'packages/layout/dist/index.mjs'),
  external: ['@pibbl/core/internal/layout'],
});
