
import { targetingIdentityPlugin } from '../tooling/agent-verification/identity-plugin.mjs';
import { textAssets } from "../tooling/text-assets.ts";
import { defineConfig } from "vite";
import { resolve } from "node:path";
import { assertBuiltCore } from "../tooling/assert-built-core.ts";
import { pibblRuntimeSource } from "../tooling/pibbl-runtime-source.ts";
import { pibblStudioDocs } from "../tooling/studio-docs/vite-plugin.ts";

const studioDocsAcceptanceOutput = resolve(
  import.meta.dirname,
  ".studio-docs-acceptance-dist",
);
const sandboxAssetHeaders = { "Access-Control-Allow-Origin": "*" };

export default defineConfig(({ mode }) => {
  const isStudioDocsAcceptance = mode === "studio-docs-acceptance";
  const sourceAliases = [
    ["@pibbl/core/machines", "../packages/core/src/features/machines/index.ts"],
    ["@pibbl/core/machines/animation", "../packages/core/src/features/machines/animation.ts"],
    ["@pibbl/core/sprites", "../packages/core/src/features/sprites/index.ts"],
    ["@pibbl/core/sprites/formats/aseprite", "../packages/core/src/features/sprites/formats/aseprite.ts"],
    ["@pibbl/core/sprites/formats/texture-packer", "../packages/core/src/features/sprites/formats/texture-packer.ts"],

    ["@pibbl/text", "../packages/text/src/index.ts"],
    ["@pibbl/core/filters", "../packages/core/src/filters.ts"],
    ["@pibbl/core/textures", "../packages/core/src/features/textures/index.ts"],
    ["@pibbl/core/viz", "../packages/core/src/features/viz/index.ts"],
    ["@pibbl/core/internal", "../packages/core/src/internal.ts"],
    ["@pibbl/core/jsx-dev-runtime", "../packages/core/src/jsx-dev-runtime.ts"],
    ["@pibbl/core/jsx-runtime", "../packages/core/src/jsx-runtime.ts"],
    ["@pibbl/core", "../packages/core/src/index.ts"],
    ["@pibbl/core/physics/2d/geometry", "../packages/core/src/features/physics/2d-geometry.ts"],
    ["@pibbl/core/physics/2d", "../packages/core/src/features/physics/2d.ts"],
  ].map(([find, path]) => ({
    find: new RegExp(`^${find.replaceAll("/", "\\/")}$`, "u"),
    replacement: resolve(import.meta.dirname, path),
  }));
  return {
    plugins: [
      targetingIdentityPlugin(resolve(import.meta.dirname, "..")),
      textAssets(),
      ...(mode === "built" ? [assertBuiltCore()] : []),
      pibblRuntimeSource(mode),
      pibblStudioDocs({ repositoryRoot: resolve(import.meta.dirname, "..") }),
    ],
    resolve: {
      alias: mode === "built" ? [] : sourceAliases,
      tsconfigPaths: mode !== "built",
    },
    define: {
      __PIBBL_STUDIO_DOCS_ACCEPTANCE__: JSON.stringify(isStudioDocsAcceptance),
    },
    server: { headers: sandboxAssetHeaders },
    preview: { headers: sandboxAssetHeaders },
    build: isStudioDocsAcceptance
      ? { outDir: studioDocsAcceptanceOutput }
      : undefined,
  };
});
