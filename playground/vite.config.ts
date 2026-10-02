import { targetingIdentityPlugin } from '../tooling/agent-verification/identity-plugin.mjs';
<<<<<<< HEAD
=======
import { textAssets } from "../tooling/text-assets.ts";
>>>>>>> origin/main
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
    ["@crc/textures", "../packages/textures/src/index.ts"],
<<<<<<< HEAD
=======
    ["@crc/text", "../packages/text/src/index.ts"],
>>>>>>> origin/main
    ["@crc/viz", "../packages/viz/src/index.ts"],
    ["@crc/core/internal", "../packages/core/src/internal.ts"],
    ["@crc/core/jsx-dev-runtime", "../packages/core/src/jsx-dev-runtime.ts"],
    ["@crc/core/jsx-runtime", "../packages/core/src/jsx-runtime.ts"],
    ["@crc/core", "../packages/core/src/index.ts"],
    ["@crc/physics/2d/geometry", "../packages/physics/src/2d-geometry.ts"],
    ["@crc/physics/2d", "../packages/physics/src/2d.ts"],
    ["@crc/physics/3d/geometry", "../packages/physics/src/3d-geometry.ts"],
  ].map(([find, path]) => ({
    find: new RegExp(`^${find.replaceAll("/", "\\/")}$`, "u"),
    replacement: resolve(import.meta.dirname, path),
  }));
  return {
    plugins: [
      targetingIdentityPlugin(resolve(import.meta.dirname, "..")),
<<<<<<< HEAD
=======
      textAssets(),
>>>>>>> origin/main
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
