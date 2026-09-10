import { defineConfig } from "vite";
import { resolve } from "node:path";
import { assertBuiltCore } from "../tooling/assert-built-core.ts";
import { crcRuntimeSource } from "../tooling/crc-runtime-source.ts";
import { crcStudioDocs } from "../tooling/studio-docs/vite-plugin.ts";

const studioDocsAcceptanceOutput = resolve(
  import.meta.dirname,
  ".studio-docs-acceptance-dist",
);

export default defineConfig(({ mode }) => {
  const isStudioDocsAcceptance = mode === "studio-docs-acceptance";
  return {
    plugins: [
      ...(mode === "built" ? [assertBuiltCore()] : []),
      crcRuntimeSource(mode),
      crcStudioDocs({ repositoryRoot: resolve(import.meta.dirname, "..") }),
    ],
    resolve: {
      tsconfigPaths: mode !== "built",
    },
    define: {
      __CRC_STUDIO_DOCS_ACCEPTANCE__: JSON.stringify(isStudioDocsAcceptance),
    },
    build: isStudioDocsAcceptance
      ? { outDir: studioDocsAcceptanceOutput }
      : undefined,
  };
});
