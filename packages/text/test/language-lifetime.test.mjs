import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
import { nativeResources } from "../dist/testing.mjs";

test("language interning is bounded across font lifetimes and existing tags remain reusable", async () => {
  const bytes = await readFile(
    new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
  );
  let font = await loadOutlineFont(bytes);
  try {
    for (let i = 0; i < 256; i++)
      createTextGeometry(font, "A", { fontSize: 10, language: `x-pibbl-${i}` });
    font.dispose();
    font = await loadOutlineFont(bytes);
    const before = await nativeResources();
    for (let i = 256; i < 1256; i++)
      assert.throws(
        () =>
          createTextGeometry(font, "A", {
            fontSize: 10,
            language: `x-pibbl-${i}`,
          }),
        /256 distinct language tags/,
      );
    const after = await nativeResources();
    assert.equal(after.results, 0);
    assert.equal(after.allocatedBytes, before.allocatedBytes);
    assert.ok(
      createTextGeometry(font, "A", { fontSize: 10, language: "X-Pibbl-0" })
        .geometry.segmentCount > 0,
    );
    assert.ok(
      createTextGeometry(font, "A", { fontSize: 10 }).geometry.segmentCount > 0,
    );
  } finally {
    font.dispose();
  }
});
