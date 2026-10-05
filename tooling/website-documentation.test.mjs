import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
const output = new URL("../website/dist/", import.meta.url);
test("existing public reference and guides have static destinations and agent reading paths", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("catalog.json", output), "utf8"),
  );
  const apiRoot = new URL("../docs/site/api/", import.meta.url);
  const expectedSources = [];
  for (const path of await readdir(apiRoot, { recursive: true })) {
    if (
      path.endsWith(".md") &&
      /^kind: api$/m.test(await readFile(new URL(path, apiRoot), "utf8"))
    ) {
      expectedSources.push(`docs/site/api/${path}`);
    }
  }
  assert.deepEqual(
    catalog.entries
      .filter((entry) => entry.kind === "api")
      .map((entry) => entry.source)
      .sort(),
    expectedSources.sort(),
  );
  for (const route of [
    "guides/state-and-lifecycle",
    "guides/configure-jsx",
    "guides/procedural-textures",
    "agents/topics/lifecycle",
    "agents/topics/textures",
    "agents/topics/animation",
    "agents/topics/layout",
    "agents/topics/input",
    "agents/topics/physics",
    "agents/topics/visualization",
    "agents/topics/external-renderers",
  ]) {
    const markdown = await readFile(new URL(`${route}.md`, output), "utf8");
    assert.ok(markdown.length > 1500, route);
    assert.doesNotMatch(markdown, /\]\(#\/(api|learn)\//);
    if (route.startsWith("agents/topics")) {
      assert.match(markdown, /Verification/);
      assert.match(markdown, /[Oo]wnership/);
    }
  }
  const coverage = JSON.parse(
    await readFile(new URL("agents/coverage.json", output), "utf8"),
  );
  assert.ok(coverage.entries.length > 100);
  assert.ok(
    coverage.entries.every(
      (entry) => entry.symbol && entry.importPath && entry.kind,
    ),
  );
  assert.ok(
    coverage.entries.some((entry) => entry.symbol === "Circle" && entry.url),
  );
  assert.deepEqual(coverage.missing, []);
  assert.ok(
    coverage.entries.every((entry) => !entry.importPath.includes("physics/3d")),
  );
  assert.match(
    await readFile(new URL("reference.md", output), "utf8"),
    /Alphabetical/,
  );
  assert.match(
    await readFile(new URL("llms.txt", output), "utf8"),
    /agents\/topics\/lifecycle/,
  );
});
