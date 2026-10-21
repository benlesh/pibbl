import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const packageRoot = new URL("../packages/core/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("package.json", packageRoot), "utf8"),
);

assert.deepEqual(
  manifest.exports["./sync"],
  { types: "./dist/sync.d.ts", default: "./dist/sync.mjs" },
  "The explicit synchronous host must be published from @pibbl/core/sync.",
);

const rootBundle = await build({
  absWorkingDir: new URL("..", import.meta.url).pathname,
  entryPoints: ["packages/core/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
  logLevel: "silent",
});
const source = rootBundle.outputFiles[0]?.text ?? "";
const embeddedSource = await readFile(
  new URL("src/lib/layout/wasm/bytes.ts", packageRoot),
  "utf8",
);
const embeddedBytes = JSON.parse(
  embeddedSource.match(/export const bytes = (.+);/u)?.[1] ?? "\"\"",
);
assert.doesNotMatch(
  source,
  new RegExp(embeddedBytes.slice(0, 256)),
  "An async-only root bundle must not contain the embedded layout WASM Base64 payload.",
);

console.warn("Loading package boundary: sync export and inert async-only root bundle pass");
