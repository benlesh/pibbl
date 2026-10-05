import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("text outlines and multi-guide envelopes are discoverable with deployed fonts", async () => {
  const base = new URL("../website/public/generated/", import.meta.url);
  const catalog = JSON.parse(
    await readFile(new URL("catalog.json", base), "utf8"),
  );
  for (const id of [
    "catalogs/text",
    "examples/text-geometry",
    "examples/text-envelope",
    "guides/text-geometry",
    "agents/topics/text",
  ]) {
    assert.ok(
      catalog.entries.some((entry) => entry.id === id),
      `missing ${id}`,
    );
  }
  assert.ok(
    (await readFile(new URL("crc-text/Lato-Regular.ttf", base))).length > 100,
  );
  assert.match(
    await readFile(new URL("crc-text/Lato-OFL.txt", base), "utf8"),
    /OPEN FONT LICENSE/,
  );
});
