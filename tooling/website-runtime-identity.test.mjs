import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { pibblRuntimeSource } from "./pibbl-runtime-source.ts";

test("Astro scripts and TSX components share the selected built runtime", async () => {
  const root = resolve(import.meta.dirname, "..");
  const require = createRequire(new URL("../website/package.json", import.meta.url));
  const { build } = await import(pathToFileURL(require.resolve("astro")).href);
  // Stay beneath website so Astro resolves its installed dependencies. Inherit
  // the real source aliases: these must not override the selected built mode.
  const fixture = await mkdtemp(resolve(root, "website/.runtime-identity-"));
  const telemetry = process.env.ASTRO_TELEMETRY_DISABLED;
  process.env.ASTRO_TELEMETRY_DISABLED = "1";
  try {
    await mkdir(resolve(fixture, "src/pages"), { recursive: true });
    await writeFile(resolve(fixture, "tsconfig.json"), JSON.stringify({ extends: "../../tsconfig.json" }));
    await writeFile(resolve(fixture, "src/pages/index.astro"), `<canvas width="720" height="420"></canvas>
<script>
import { pibbl, createElement } from "@pibbl/core";
import { Scene } from "../scene";
void pibbl(document.querySelector("canvas")!, createElement(Scene, {}));
</script>`);
    await writeFile(resolve(fixture, "src/scene.tsx"), `import { Rectangle } from "@pibbl/core";
export function Scene() {
  return <Rectangle style={{ left: 0, top: 0, width: 720, height: 420, fill: "#f7f0df" }} />;
}`);
    const modules = new Set();
    await build({
      root: fixture,
      configFile: false,
      logLevel: "silent",
      vite: {
        plugins: [
          pibblRuntimeSource("built"),
          {
            name: "capture-runtime-identity",
            generateBundle(_options, bundle) {
              for (const output of Object.values(bundle)) {
                if (output.type !== "chunk") continue;
                for (const id of Object.keys(output.modules)) modules.add(id.replaceAll("\\", "/"));
              }
            },
          },
        ],
      },
    });
    const core = [...modules].filter(id => id.includes("/packages/core/"));
    assert.ok(core.some(id => id.includes("/packages/core/dist/")), "the selected built runtime is bundled");
    assert.deepEqual(core.filter(id => id.includes("/packages/core/src/")), [],
      "Astro host and TSX component/JSX helpers must not mix built and source runtime identities");
  } finally {
    if (telemetry === undefined) delete process.env.ASTRO_TELEMETRY_DISABLED;
    else process.env.ASTRO_TELEMETRY_DISABLED = telemetry;
    await rm(fixture, { recursive: true, force: true });
  }
});
