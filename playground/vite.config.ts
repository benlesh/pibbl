import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import tsconfig from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfig({
      projects: [
        fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
      ],
    }),
  ],
});
