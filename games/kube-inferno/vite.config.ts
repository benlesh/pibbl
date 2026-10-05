import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: [
      {
        find: "@pibbl/core/jsx-runtime",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/core/src/jsx-runtime.ts",
        ),
      },
      {
        find: "@pibbl/core/jsx-dev-runtime",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/core/src/jsx-dev-runtime.ts",
        ),
      },
      {
        find: "@pibbl/core",
        replacement: resolve(
          import.meta.dirname,
          "../../packages/core/src/index.ts",
        ),
      },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5190,
    strictPort: true,
    fs: { allow: [resolve(import.meta.dirname, "../..")] },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
