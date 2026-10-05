import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const root = import.meta.dirname;
export default defineConfig({
  root,
  oxc: { jsx: { runtime: 'automatic', importSource: '@pibbl/core' } },
  resolve: { alias: [
    { find: '@pibbl/core/machines/animation', replacement: resolve(root, '../../packages/core/src/features/machines/animation.ts') },
    { find: '@pibbl/core/machines', replacement: resolve(root, '../../packages/core/src/features/machines/index.ts') },
    { find: '@pibbl/core/internal', replacement: resolve(root, '../../packages/core/src/internal.ts') },
    { find: '@pibbl/core/sprites/formats/aseprite', replacement: resolve(root, '../../packages/core/src/features/sprites/formats/aseprite.ts') },
    { find: '@pibbl/core/sprites', replacement: resolve(root, '../../packages/core/src/features/sprites/index.ts') },
    { find: '@pibbl/core/physics/2d', replacement: resolve(root, '../../packages/core/src/features/physics/2d.ts') },
    { find: '@pibbl/core/jsx-dev-runtime', replacement: resolve(root, '../../packages/core/src/jsx-dev-runtime.ts') },
    { find: '@pibbl/core/jsx-runtime', replacement: resolve(root, '../../packages/core/src/jsx-runtime.ts') },
    { find: /^@pibbl\/core$/, replacement: resolve(root, '../../packages/core/src/index.ts') },
  ] },
  server: { host: '127.0.0.1', port: 5191, strictPort: true, fs: { allow: [resolve(root, '../..')] } },
  build: { target: 'esnext', outDir: 'dist' },
});
