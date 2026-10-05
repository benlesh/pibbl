import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
const output = new URL("../website/dist/", import.meta.url);
test("existing public reference and guides have static destinations and agent reading paths", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("catalog.json", output), "utf8"),
  );
  assert.ok(
    catalog.entries.filter((entry) => entry.kind === "api").length >= 141,
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
  assert.match(
    await readFile(new URL("reference.md", output), "utf8"),
    /Alphabetical/,
  );
  assert.match(
    await readFile(new URL("llms.txt", output), "utf8"),
    /agents\/topics\/lifecycle/,
  );
});
