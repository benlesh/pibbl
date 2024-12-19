import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crcJSX from '@crc/vite-plugin-crc-jsx';
import vue from '@vitejs/plugin-vue';
import fileUrl from 'unplugin-file-url/vite';
import { defineConfig } from 'vite';
import Inspect from 'vite-plugin-inspect';
import tsconfig from 'vite-tsconfig-paths';

// const vueTsConfigPath = fileURLToPath(new URL('./node_modules/@vue/tsconfig/tsconfig.json', import.meta.url));

export default defineConfig({
  plugins: [
    Inspect(),

    fileUrl(),
    vue(),
    // tsconfig({
    //   projects: [
    //     vueTsConfigPath,
    //   ],
    // }),
    crcJSX(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  esbuild: { jsx: 'automatic' },
});
