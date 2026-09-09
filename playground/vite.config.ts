import { defineConfig } from "vite";
import { resolve } from "node:path";
import { assertBuiltCore } from "../tooling/assert-built-core.ts";
import { crcRuntimeSource } from "../tooling/crc-runtime-source.ts";
import { crcStudioDocs } from "../tooling/studio-docs/vite-plugin.ts";

export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === "built" ? [assertBuiltCore()] : []),
    crcRuntimeSource(mode),
    crcStudioDocs({ repositoryRoot: resolve(import.meta.dirname, "..") }),
  ],
  resolve: {
    tsconfigPaths: mode !== "built",
  },
}));
