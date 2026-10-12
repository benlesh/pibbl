import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const generated = new URL("../website/public/generated/", import.meta.url);
test("every public export has a complete minimal program and discovery entry", async () => {
  const coverage = JSON.parse(
    await readFile(new URL("agents/coverage.json", generated), "utf8"),
  );
  const missing = coverage.entries.filter(
    (entry) => !entry.minimalExample || !entry.minimalPage,
  );
  assert.deepEqual(
    missing.map((entry) => `${entry.importPath}:${entry.symbol}`),
    [],
  );
  const index = await readFile(
    new URL("minimal-examples.md", generated),
    "utf8",
  );
  const manifest = JSON.parse(
    await readFile(new URL("minimal-examples.json", generated), "utf8"),
  );
  for (const example of manifest)
    assert.ok(index.includes(`/minimal-examples/${example.id}/`), example.id);
  const entrypoint = await readFile(new URL("llms.txt", generated), "utf8");
  assert.match(entrypoint, /minimal-examples\.md/);
  assert.match(entrypoint, /agents\/coverage\.json/);
});
