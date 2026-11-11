import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
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

// Regression coverage for the dependency audit taken on 2026-11-11.
// This guards known fixes; it does not replace a current registry audit.
test("known November dependency advisories stay patched", () => {
  const vulnerableRanges = {
    "@humanfs/node": "<0.16.8",
    vitest: ">=2.1.0 <4.1.11",
    "@vitest/mocker": ">=2.1.0-beta.7 <4.1.12",
    "brace-expansion": ">=4.0.0 <5.0.12",
    "source-map-js": ">=1.0.0 <1.2.2",
    sharp: "<0.35.5",
    "markdown-it": ">=15.0.0 <15.0.3",
    zod: "<4.6.6",
    undici: ">=8.0.0 <8.12.2",
    "postcss-selector-parser": "<6.1.5",
    glob: ">=9.0.0 <=14.0.1",
    minimatch: ">=7.0.0 <11.0.1",
  };
  for (const key of Object.keys(lockfile.packages)) {
    const separator = key.lastIndexOf("@");
    const name = key.slice(0, separator);
    const version = key.slice(separator + 1);
    const range = vulnerableRanges[name];
    if (range) {
      assert.ok(!satisfies(version, range), `Unpatched dependency ${key}`);
    }
  }
});

test("patched lint matching keeps source coverage and generated-file exclusions", async () => {
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL("../", import.meta.url)),
  });
  for (const path of [
    "packages/core/src/index.ts",
    "playground/test/editor-sanitizer.test.mjs",
    "tooling/dependency-security.test.mjs",
  ]) {
    assert.equal(await eslint.isPathIgnored(path), false, path);
  }
  for (const path of [
    "packages/core/dist/index.mjs",
    "node_modules/example/index.js",
    "packages/core/test/fixtures/example.js",
    "packages/core/src/vendor/example.js",
  ]) {
    assert.equal(await eslint.isPathIgnored(path), true, path);
  }
  const [result] = await eslint.lintText("const unused = 1;", {
    filePath: "tooling/security-lint-probe.mjs",
  });
  assert.ok(result.messages.some((message) => message.ruleId === "no-unused-vars"));
});
