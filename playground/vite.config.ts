import { fileURLToPath } from 'node:url';
import crcJSX from '@crc/vite-plugin-crc-jsx';
import fileUrl from 'unplugin-file-url/vite';
import { defineConfig } from 'vite';
import Inspect from 'vite-plugin-inspect';
import tsconfig from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    Inspect(),
    crcJSX(),
    fileUrl(),
    tsconfig({
      projects: [
        fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
      ],
    }),
  ],
  esbuild: { jsx: 'automatic' },
});
