import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

test("nested minimal examples load the matching published layout WASM", async () => {
  const output = new URL("../website/dist/", import.meta.url);
  const origin = "https://pibbl.example";
  const entry = new URL(
    "minimal-runtime/lifecycle/prepare-layout-engine.js",
    output,
  );
  const visited = new Set();
  const loaders = [];
  async function inspect(url) {
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const code = await readFile(url, "utf8");
    const body = code.match(
      /function layoutAssetUrl\(\) \{([\s\S]*?)\n\}/,
    )?.[1];
    if (body) loaders.push({ url, body });
    for (const match of code.matchAll(/from\s+["'](\.[^"']+\.js)["']/g)) {
      await inspect(new URL(match[1], url));
    }
  }
  await inspect(entry);
  assert.equal(
    loaders.length,
    1,
    "the nested example reaches exactly one shared layout loader",
  );
  const { url, body } = loaders[0];
  const moduleURL = origin + "/" + url.href.slice(output.href.length);
  const asset = runInNewContext(
    "(function() {" +
      body.replaceAll("import.meta.url", JSON.stringify(moduleURL)) +
      "})()",
    {
      URL,
      document: {
        baseURI:
          origin + "/minimal-runtime/lifecycle/prepare-layout-engine.html",
      },
    },
  );
  assert.equal(
    asset.pathname,
    "/pibbl-layout/layout.wasm",
    "split chunks use the website's published layout asset",
  );
  const bytes = await readFile(new URL("." + asset.pathname, output));
  const source = await readFile(
    new URL(
      "../packages/core/src/lib/layout/wasm/layout.wasm",
      import.meta.url,
    ),
  );
  assert.deepEqual(
    bytes,
    source,
    "the published binary matches this checkout's runtime",
  );
  assert.ok(await WebAssembly.compile(bytes));
});
