import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
import { nativeResources } from "../dist/testing.mjs";
const bytes = await readFile(
  new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
);
test("repeated success, limit errors, and missing glyphs return native owners to baseline", async () => {
  const initial = await nativeResources();
  async function cycle() {
    const font = await loadOutlineFont(bytes);
    try {
      createTextGeometry(font, "Hello Pibbl ".repeat(100), { fontSize: 100 });
      assert.throws(
        () =>
          createTextGeometry(font, "Hello", { fontSize: 100, maxSegments: 2 }),
        /limit/i,
      );
      assert.throws(
        () => createTextGeometry(font, "\u{10ffff}", { fontSize: 100 }),
        /missing/i,
      );
    } finally {
      font[Symbol.dispose]();
      font.dispose();
    }
    const current = await nativeResources();
    assert.equal(current.fonts, initial.fonts);
    assert.equal(current.results, initial.results);
  }
  for (let i = 0; i < 10; i++) await cycle();
  const warm = await nativeResources();
  for (let i = 0; i < 200; i++) await cycle();
  const final = await nativeResources();
  assert.ok(
    final.allocatedBytes <= warm.allocatedBytes + 4096,
    JSON.stringify({ warm, final }),
  );
});
test("using scopes release on return and exceptions; returned geometry stays valid", async () => {
  const baseline = await nativeResources();
  async function convert() {
    using font = await loadOutlineFont(bytes);
    return createTextGeometry(font, "A", { fontSize: 100 });
  }
  const result = await convert();
  assert.ok(result.geometry.segmentCount > 0);
  await assert.rejects(async () => {
    using font = await loadOutlineFont(bytes);
    font.dispose();
    throw new Error("intentional");
  }, /intentional/);
  const after = await nativeResources();
  assert.equal(after.fonts, baseline.fonts);
  assert.equal(after.results, baseline.results);
});
test("invalid and canceled loading create no native owner", async () => {
  const before = await nativeResources();
  await assert.rejects(loadOutlineFont(new Uint8Array(20)), /TTF|OTF/);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    loadOutlineFont(bytes, { signal: abort.signal }),
    /abort/i,
  );
  const after = await nativeResources();
  assert.equal(after.fonts, before.fonts);
  assert.equal(after.results, before.results);
});
test("overflowing whitespace metrics fail without leaking a native result", async () => {
  using font = await loadOutlineFont(bytes);
  const before = await nativeResources();
  assert.throws(
    () =>
      createTextGeometry(font, " ".repeat(100), { fontSize: Number.MAX_VALUE }),
    /nonfinite|overflow/i,
  );
  const after = await nativeResources();
  assert.equal(after.results, before.results);
});
test("draw allocation failures release scratch leases and preserve font usability", async () => {
  const { failNextDrawAfter } = await import("../dist/testing.mjs");
  using font = await loadOutlineFont(bytes);
  createTextGeometry(font, "Hello Pibbl", { fontSize: 100 });
  const before = await nativeResources();
  for (let i = 0; i < 100; i++) {
    await failNextDrawAfter(4);
    assert.throws(
      () => createTextGeometry(font, "Hello Pibbl", { fontSize: 100 }),
      /allocation/i,
    );
    assert.ok(
      createTextGeometry(font, "Hello Pibbl", { fontSize: 100 }).geometry
        .segmentCount > 0,
    );
  }
  const after = await nativeResources();
  assert.equal(after.fonts, before.fonts);
  assert.equal(after.results, before.results);
  assert.ok(
    after.allocatedBytes <= before.allocatedBytes + 4096,
    JSON.stringify({ before, after }),
  );
});
test("WASM growth cannot invalidate earlier geometry or leave borrowed result storage", async () => {
  using font = await loadOutlineFont(bytes);
  const first = createTextGeometry(font, "A", { fontSize: 100 });
  const snapshot = [...first.geometry];
  const before = await nativeResources();
  const large = createTextGeometry(font, "A".repeat(50000), { fontSize: 100 });
  assert.equal(large.glyphs.length, 50000);
  assert.equal(
    large.geometry.segmentCount,
    first.geometry.segmentCount * 50000,
  );
  const after = await nativeResources();
  assert.ok(
    after.capacityBytes > before.capacityBytes,
    "fixture must actually grow WASM memory",
  );
  assert.equal(after.results, 0);
  assert.ok(
    after.allocatedBytes <= before.allocatedBytes + 4096,
    JSON.stringify({ before, after }),
  );
  assert.deepEqual([...first.geometry], snapshot);
  font.dispose();
  assert.deepEqual([...first.geometry], snapshot);
  const segment = large.geometry.getSegment(0);
  large.geometry.setSegment(0, { ...segment, x: segment.x + 1 });
  assert.deepEqual([...first.geometry], snapshot);
});
test("HarfBuzz empty allocation singletons reject instead of returning blank geometry", async () => {
  const { failNextSetupAllocation } = await import("../dist/testing.mjs");
  using font = await loadOutlineFont(bytes);
  createTextGeometry(font, "A", { fontSize: 100 });
  const before = await nativeResources();
  for (const phase of ["buffer", "draw"]) {
    await failNextSetupAllocation(phase);
    assert.throws(
      () => createTextGeometry(font, "A", { fontSize: 100 }),
      /allocation/i,
    );
    assert.ok(
      createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount >
        0,
    );
  }
  const after = await nativeResources();
  assert.equal(after.fonts, before.fonts);
  assert.equal(after.results, before.results);
  assert.ok(after.allocatedBytes <= before.allocatedBytes + 4096);
});
test("shaping configurations cannot grow a live font cache without bound", async () => {
  using font = await loadOutlineFont(bytes);
  const original = createTextGeometry(font, "A", { fontSize: 100 });
  const convert = (i) =>
    createTextGeometry(font, "A", {
      fontSize: 100,
      features: { [i.toString(36).padStart(4, "0")]: true },
    });
  // The default configuration above plus 63 feature configurations fills
  // the bounded cache before measuring its steady-state retention.
  for (let i = 0; i < 63; i++) convert(i);
  const warm = await nativeResources();
  for (let i = 63; i < 2063; i++) convert(i);
  const after = await nativeResources();
  assert.equal(after.fonts, warm.fonts);
  assert.equal(after.results, 0);
  assert.ok(
    after.allocatedBytes <= warm.allocatedBytes + 4096,
    JSON.stringify({ warm, after }),
  );
  assert.deepEqual(
    [...createTextGeometry(font, "A", { fontSize: 100 }).geometry],
    [...original.geometry],
  );
});
