import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("text previews ship the matching engine, font, and license", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../website/package.json", import.meta.url), "utf8"),
  );
  assert.equal(
    manifest.dependencies["@crc/text"],
    "workspace:*",
    "build the text engine before website previews",
  );
  assert.equal(
    manifest.dependencies["@crc/three"],
    "workspace:*",
    "build the renderer adapter before website previews",
  );
  const base = new URL(
    "../website/public/generated/crc-text/",
    import.meta.url,
  );
  const wasm = await readFile(new URL("engine.wasm", base));
  assert.equal(wasm.subarray(0, 4).toString("hex"), "0061736d");
  assert.ok((await readFile(new URL("engine.mjs", base))).length > 100);
  assert.ok(
    (await readFile(new URL("ABeeZee-Regular.ttf", base))).length > 100,
  );
  assert.match(
    await readFile(new URL("OFL.txt", base), "utf8"),
    /OPEN FONT LICENSE/,
  );
});
