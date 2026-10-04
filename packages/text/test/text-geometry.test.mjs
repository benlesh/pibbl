import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
const bytes = await readFile(
  new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
);
test("font outlines become independent, editable geometry with shared idempotent disposal", async () => {
  const font = await loadOutlineFont(bytes);
  const label = createTextGeometry(font, "AV office", { fontSize: 100 });
  assert.ok(label.geometry.segmentCount > 0);
  assert.ok(
    [...label.geometry].some((segment) => segment.type === "quadratic"),
  );
  assert.ok([...label.geometry].some((segment) => segment.type === "close"));
  const twice = createTextGeometry(font, "AV office", { fontSize: 200 });
  assert.equal(twice.advance.x, label.advance.x * 2);
  font.dispose();
  font[Symbol.dispose]();
  font.dispose();
  assert.throws(
    () => createTextGeometry(font, "A", { fontSize: 100 }),
    /disposed/i,
  );
  const before = label.geometry.revision;
  const first = label.geometry.getSegment(0);
  label.geometry.setSegment(0, { ...first, x: first.x + 5 });
  assert.ok(label.geometry.revision > before);
});
test("shaping feature switches preserve whole-run kerning and ligatures", async () => {
  const font = await loadOutlineFont(
    await readFile(
      new URL("./fixtures/lato/Lato-Regular.ttf", import.meta.url),
    ),
  );
  try {
    const kern = createTextGeometry(font, "AV", {
      fontSize: 100,
      features: { kern: true },
    });
    const plain = createTextGeometry(font, "AV", {
      fontSize: 100,
      features: { kern: false },
    });
    assert.notEqual(kern.advance.x, plain.advance.x);
    const ligature = createTextGeometry(font, "fi", {
      fontSize: 100,
      features: { liga: true },
    });
    const letters = createTextGeometry(font, "fi", {
      fontSize: 100,
      features: { liga: false },
    });
    assert.ok(ligature.glyphs.length < letters.glyphs.length);
  } finally {
    font.dispose();
  }
});
test("ink bounds exclude trailing space and are independent of advance", async () => {
  const font = await loadOutlineFont(bytes);
  try {
    const a = createTextGeometry(font, "A", { fontSize: 100 });
    const spaced = createTextGeometry(font, "A ", { fontSize: 100 });
    assert.ok(a.inkBounds && a.inkBounds.width > 0);
    assert.deepEqual(spaced.inkBounds, a.inkBounds);
    assert.ok(spaced.advance.x > a.advance.x);
    assert.equal(
      createTextGeometry(font, " ", { fontSize: 100 }).inkBounds,
      null,
    );
  } finally {
    font.dispose();
  }
});
