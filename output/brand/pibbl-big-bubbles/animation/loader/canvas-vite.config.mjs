import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    host: "127.0.0.1",
    port: 8766,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL("../../../../..", import.meta.url))] },
  },
  resolve: {
    alias: {
      "@pibbl/core": fileURLToPath(
        new URL(
          mode === "built"
            ? "../../../../../packages/core/dist/index.mjs"
            : "../../../../../packages/core/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
}));
