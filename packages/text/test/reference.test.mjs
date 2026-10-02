import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
const reference = JSON.parse(
  await readFile(
    new URL("./fixtures/shaping-reference.json", import.meta.url),
    "utf8",
  ),
);
for (const entry of reference.cases)
  test(`native reference: ${entry.name}`, async () => {
    const bytes = await readFile(
      new URL("./fixtures/" + entry.font, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      entry.fontSha256,
    );
    using font = await loadOutlineFont(bytes);
    const value = createTextGeometry(font, entry.text, {
      fontSize: entry.expected.upem,
      features: entry.features,
      missingGlyphs: entry.missingGlyphs,
    });
    let x = 0,
      y = 0;
    const expected = entry.expected.glyphs.map(
      ([glyphId, cluster, xAdvance, yAdvance, xOffset, yOffset]) => {
        const glyph = {
          glyphId,
          cluster,
          x: x + xOffset,
          y: -(y + yOffset) || 0,
          xAdvance,
          yAdvance: -yAdvance || 0,
        };
        x += xAdvance;
        y += yAdvance;
        return glyph;
      },
    );
    assert.deepEqual(
      value.glyphs.map(({ glyphId, cluster, x, y, xAdvance, yAdvance }) => ({
        glyphId,
        cluster,
        x,
        y,
        xAdvance,
        yAdvance,
      })),
      expected,
    );
    assert.deepEqual(value.advance, { x, y: -y || 0 });
  });
