import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
import { profileTextGeometry, nativeResources } from "../dist/testing.mjs";
test("private profiling preserves conversion and releases results after success and failure", async () => {
  using font = await loadOutlineFont(
    await readFile(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)),
  );
  const ordinary = createTextGeometry(font, "Hello CRC", { fontSize: 100 });
  const { result, timings } = profileTextGeometry(font, "Hello CRC", {
    fontSize: 100,
  });
  assert.deepEqual([...result.geometry], [...ordinary.geometry]);
  for (const name of [
    "inputMs",
    "nativeSetupMs",
    "shapingMs",
    "outlineMs",
    "bufferViewsMs",
    "materializationMs",
    "boundsMs",
    "totalMs",
  ]) {
    assert.ok(Number.isFinite(timings[name]) && timings[name] >= 0, name);
  }
  assert.ok(timings.totalMs > 0);
  assert.throws(
    () =>
      profileTextGeometry(font, "Hello CRC", { fontSize: 100, maxSegments: 1 }),
    /limit/,
  );
  assert.deepEqual(
    [...createTextGeometry(font, "Hello CRC", { fontSize: 100 }).geometry],
    [...ordinary.geometry],
  );
  assert.equal((await nativeResources()).results, 0);
});
