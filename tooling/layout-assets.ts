import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const assetPath = "packages/core/src/lib/layout/wasm/layout.wasm";

/** Publishes the generated external layout asset for Studio's opaque preview. */
export function layoutAssets(): Plugin {
  const root = resolve(import.meta.dirname, "..");
  return {
    name: "pibbl-layout-assets",
    configureServer(server) {
      server.middlewares.use("/pibbl-layout/layout.wasm", (_request, response, next) => {
        void readFile(resolve(root, assetPath)).then(bytes => {
          response.setHeader("Content-Type", "application/wasm");
          response.setHeader("Access-Control-Allow-Origin", "*");
          response.end(bytes);
        }).catch(next);
      });
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "pibbl-layout/layout.wasm",
        source: await readFile(resolve(root, assetPath)),
      });
    },
  };
}
