import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("effect galleries publish runnable examples and complete agent-readable source", async () => {
  const root = new URL("../website/dist/", import.meta.url);
  for (const slug of [
    "rainy-window",
    "plasma-globe",
    "visibility-transitions",
    "energy-transitions",
  ]) {
    const html = await readFile(
      new URL(`examples/${slug}/index.html`, root),
      "utf8",
    );
    assert.match(html, /data-effect-demo/);
    const markdown = await readFile(
      new URL(`examples/${slug}.md`, root),
      "utf8",
    );
    assert.match(markdown, /## Complete source/);
    assert.match(markdown, /controller.dispose\(\)/);
    assert.match(markdown, /## Integration boundaries/);
    assert.match(
      await readFile(new URL("catalogs.md", root), "utf8"),
      new RegExp(slug),
    );
  }
});
