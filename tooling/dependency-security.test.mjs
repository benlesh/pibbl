import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { satisfies } from "semver";
import { parse } from "yaml";

const lockfile = parse(
  readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8"),
);

test("every locked DOMPurify includes the GHSA-cg2g-xh64-v4q7 fix", () => {
  const versions = Object.keys(lockfile.packages)
    .filter((key) => key.startsWith("dompurify@"))
    .map((key) => key.slice("dompurify@".length));
  assert.ok(
    versions.length > 0,
    "Monaco's sanitizer must remain in the lockfile",
  );
  for (const version of versions) {
    assert.ok(satisfies(version, ">=3.4.17"), `Unpatched DOMPurify ${version}`);
  }
});

test("Monaco's browser sanitizer bundles patched DOMPurify, not its vendored copy", async () => {
  const { createRequire } = await import("node:module");
  const { build } = await import("esbuild");
  const require = createRequire(
    new URL("../playground/package.json", import.meta.url),
  );
  const result = await build({
    entryPoints: [require.resolve("monaco-editor/base/browser/domSanitize")],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    metafile: true,
  });
  const inputs = Object.keys(result.metafile.inputs).map((path) =>
    path.replaceAll("\\", "/"),
  );
  assert.ok(
    inputs.some((path) => path.endsWith("dompurify/dist/purify.es.mjs")),
  );
  assert.ok(
    !inputs.some((path) => path.endsWith("browser/dompurify/dompurify.js")),
  );
});
