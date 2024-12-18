import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    'src/index',
    'src/jsx-runtime',
    'src/jsx-dev-runtime',
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    esbuild: {
      target: 'node14',
    },
  },
  externals: [
    'vite',
    '@swc/core',
    '@swc/wasm',
    '@crc/core',
  ],
});
