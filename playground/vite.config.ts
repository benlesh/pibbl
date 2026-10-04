
import { targetingIdentityPlugin } from '../tooling/agent-verification/identity-plugin.mjs';
import { textAssets } from "../tooling/text-assets.ts";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { assertBuiltCore } from "../tooling/assert-built-core.ts";
import { crcRuntimeSource } from "../tooling/crc-runtime-source.ts";
import { crcStudioDocs } from "../tooling/studio-docs/vite-plugin.ts";

const studioDocsAcceptanceOutput = resolve(
  import.meta.dirname,
  ".studio-docs-acceptance-dist",
);
const sandboxAssetHeaders = { "Access-Control-Allow-Origin": "*" };

export default defineConfig(({ mode }) => {
  const isStudioDocsAcceptance = mode === "studio-docs-acceptance";
  const sourceAliases = [
    ["@crc/text", "../packages/text/src/index.ts"],
    ["@crc/core/filters", "../packages/core/src/filters.ts"],
    ["@crc/core/textures", "../packages/core/src/features/textures/index.ts"],
    ["@crc/core/viz", "../packages/core/src/features/viz/index.ts"],
    ["@crc/core/internal", "../packages/core/src/internal.ts"],
    ["@crc/core/jsx-dev-runtime", "../packages/core/src/jsx-dev-runtime.ts"],
    ["@crc/core/jsx-runtime", "../packages/core/src/jsx-runtime.ts"],
    ["@crc/core", "../packages/core/src/index.ts"],
    ["@crc/core/physics/2d/geometry", "../packages/core/src/features/physics/2d-geometry.ts"],
    ["@crc/core/physics/2d", "../packages/core/src/features/physics/2d.ts"],
    ["@crc/core/physics/3d/geometry", "../packages/core/src/features/physics/3d-geometry.ts"],
  ].map(([find, path]) => ({
    find: new RegExp(`^${find.replaceAll("/", "\\/")}$`, "u"),
    replacement: resolve(import.meta.dirname, path),
  }));
  return {
    plugins: [
      targetingIdentityPlugin(resolve(import.meta.dirname, "..")),
      textAssets(),
      ...(mode === "built" ? [assertBuiltCore()] : []),
      crcRuntimeSource(mode),
      crcStudioDocs({ repositoryRoot: resolve(import.meta.dirname, "..") }),
    ],
    resolve: {
      alias: mode === "built" ? [] : sourceAliases,
      tsconfigPaths: mode !== "built",
    },
    define: {
      __CRC_STUDIO_DOCS_ACCEPTANCE__: JSON.stringify(isStudioDocsAcceptance),
    },
    server: { headers: sandboxAssetHeaders },
    preview: { headers: sandboxAssetHeaders },
    build: isStudioDocsAcceptance
      ? { outDir: studioDocsAcceptanceOutput }
      : undefined,
  };
});
