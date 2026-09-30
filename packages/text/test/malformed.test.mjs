import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
import { nativeResources } from "../dist/testing.mjs";
const original = new Uint8Array(
  await readFile(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)),
);
function table(bytes, tag) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < view.getUint16(4); i++) {
    const offset = 12 + i * 16;
    if (String.fromCharCode(...bytes.subarray(offset, offset + 4)) === tag)
      return offset;
  }
  throw new Error(`Missing fixture table ${tag}`);
}
test("fonts without outline tables are rejected rather than returning empty visible text", async () => {
  const bytes = original.slice();
  bytes.set(new TextEncoder().encode("xxxx"), table(bytes, "glyf"));
  await assert.rejects(loadOutlineFont(bytes), /outline|invalid font/i);
});
test("truncated and out-of-range font table directories fail without acquiring native owners", async () => {
  const before = await nativeResources();
  for (const length of [0, 11, 12, 30, 100, original.length - 100])
    await assert.rejects(loadOutlineFont(original.slice(0, length)));
  const bytes = original.slice();
  new DataView(bytes.buffer).setUint32(table(bytes, "cmap") + 8, 0xfffffff0);
  await assert.rejects(loadOutlineFont(bytes));
  assert.equal((await nativeResources()).fonts, before.fonts);
});
test("conversion failure leaves the same font usable", async () => {
  using font = await loadOutlineFont(original);
  for (let i = 0; i < 50; i++) {
    assert.throws(
      () =>
        createTextGeometry(font, "Hello", { fontSize: 100, maxSegments: 1 }),
      /limit/,
    );
    assert.ok(
      createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount >
        0,
    );
  }
  assert.equal((await nativeResources()).results, 0);
});
test("missing glyph substitution is explicit and still returns owned geometry", async () => {
  using font = await loadOutlineFont(original);
  assert.throws(
    () => createTextGeometry(font, "\u{10ffff}", { fontSize: 100 }),
    /missing/,
  );
  const replacement = createTextGeometry(font, "\u{10ffff}", {
    fontSize: 100,
    missingGlyphs: "notdef",
  });
  assert.equal(replacement.glyphs.length, 1);
  assert.equal(replacement.glyphs[0].glyphId, 0);
  assert.equal(replacement.glyphs[0].cluster, 0);
  assert.ok(replacement.geometry.segmentCount > 0);
});
test("fonts declaring color presentation require explicit monochrome fallback", async () => {
  // This envelope-policy fixture declares a color table; its bytes are not
  // interpreted as color data because CRC only extracts the existing glyf outlines.
  const bytes = original.slice();
  bytes.set(new TextEncoder().encode("COLR"), table(bytes, "GPOS"));
  await assert.rejects(loadOutlineFont(bytes), /monochrome/i);
  using font = await loadOutlineFont(bytes, { monochromeFallback: true });
  assert.ok(
    createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount > 0,
  );
});
