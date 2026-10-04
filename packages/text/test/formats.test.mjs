import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
async function fixture(name) {
  return loadOutlineFont(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url)),
  );
}
test("CFF outlines preserve cubic curves and the two contours of O", async () => {
  using font = await fixture("source-serif/SourceSerif4-Regular.otf");
  const result = createTextGeometry(font, "O", { fontSize: 100 });
  const segments = [...result.geometry];
  assert.ok(segments.some((s) => s.type === "cubic"));
  assert.equal(segments.filter((s) => s.type === "move").length, 2);
  assert.equal(segments.filter((s) => s.type === "close").length, 2);
  assert.ok(result.inkBounds.width > 0 && result.inkBounds.height > 0);
});
test("Arabic run keeps descending UTF-16 clusters and positioned nonadvancing marks", async () => {
  using font = await fixture("noto-naskh/NotoNaskhArabic-Regular.ttf");
  const text = "سَلَام";
  const inferred = createTextGeometry(font, text, { fontSize: 100 });
  const explicit = createTextGeometry(font, text, {
    fontSize: 100,
    direction: "rtl",
    script: "Arab",
    language: "ar",
  });
  assert.deepEqual(explicit.glyphs, inferred.glyphs);
  const clusters = inferred.glyphs.map((g) => g.cluster);
  assert.equal(clusters[0], text.length - 1);
  assert.equal(clusters.at(-1), 0);
  assert.ok(clusters.every((cluster, i) => !i || cluster <= clusters[i - 1]));
  assert.ok(new Set(clusters).size < clusters.length);
  assert.ok(
    inferred.glyphs.some(
      (g) => g.xAdvance === 0 && g.y !== 0 && g.segmentCount > 0,
    ),
  );
  assert.ok(inferred.advance.x > 0);
});
test("empty text has empty geometry and metrics", async () => {
  using font = await fixture("ABeeZee-Regular.ttf");
  const result = createTextGeometry(font, "", { fontSize: 100 });
  assert.equal(result.geometry.segmentCount, 0);
  assert.equal(result.glyphs.length, 0);
  assert.equal(result.advance.x, 0);
  assert.equal(result.advance.y, 0);
  assert.equal(result.inkBounds, null);
});
