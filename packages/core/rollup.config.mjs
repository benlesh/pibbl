// @ts-check
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { defineConfig } from 'rollup';
import dts from 'rollup-plugin-dts';
import ts from 'rollup-plugin-typescript2';

const entries = [
  'src/index.ts',
  'src/types.ts',
];

const plugins = [
  ts({
    check: false,
  }),
  nodeResolve(),
  commonjs(),
  json({
    namedExports: false,
    preferConst: true,
    compact: true,
  }),
];

export default defineConfig([
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: () => {
        return 'chunks-[name].mjs';
      },
    },
    plugins: [
      ...plugins,
    ],
  },
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      chunkFileNames: 'chunk-[name].d.mts',
      entryFileNames: f => `${f.name.replace(/src[\\/]/, '')}.d.mts`,
    },
    plugins: [
      dts({
        respectExternal: true,
      }),
    ],
    onwarn: (warning, warn) => {
      if (!/Circular|an empty chunk/.test(warning.message))
        warn(warning);
    },
  },
]);
