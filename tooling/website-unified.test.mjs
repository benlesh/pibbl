import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDocumentation } from "../website/documentation.mjs";
import { resolveWebsiteLegacyHash } from "./studio-docs/website-routes.ts";
import {
  buildSearchBundle,
  searchSearchBundle,
} from "./studio-docs/search-index.ts";
const documentation = loadDocumentation(process.cwd(), "/playground/");

test("search finds JSDoc member details without indexing implementation snapshots", async () => {
  const { searchPages } = await documentation;
  const bundle = buildSearchBundle({ pages: searchPages, examples: [] });
  assert.ok(
    searchSearchBundle(bundle, "SignalOptions.debugName").some((result) =>
      result.url.endsWith("#api-SignalOptions-debugName"),
    ),
  );
  assert.ok(
    bundle.searchRecords.every((record) => !record.url.includes("/source/")),
  );
});

test("legacy website routes preserve source shares and documentation anchors", () => {
  const routes = {
    "#/examples/start/signals": "/playground/#/examples/composition/signals",
    "#/api/types/canvas-runtime": "/reference/types/canvas-runtime/",
  };
  assert.equal(
    resolveWebsiteLegacyHash("#/examples/start/signals?code=v1.abc", routes),
    "/playground/#/examples/composition/signals?code=v1.abc",
  );
  assert.equal(
    resolveWebsiteLegacyHash(
      "#/api/types/canvas-runtime#signaloptions",
      routes,
    ),
    "/reference/types/canvas-runtime/#signaloptions",
  );
  assert.equal(
    resolveWebsiteLegacyHash("#ordinary-heading", routes),
    undefined,
  );
  assert.equal(
    resolveWebsiteLegacyHash(
      "#/api/types/canvas-runtime#signaloptions?from=old",
      routes,
    ),
    "/reference/types/canvas-runtime/?from=old#signaloptions",
  );
});

test("signal reference combines authored guidance with public JSDoc and exact source", async () => {
  const { records } = await documentation;
  const page = records.find(({ id }) => id === "reference/functions/signal");
  assert.match(page.content, /## API details from source/);
  assert.match(page.content, /Value stored before the first write/);
  assert.match(
    page.content,
    /\[SignalOptions\]\(\/reference\/types\/canvas-runtime\/#[^)]+\)/,
  );
  assert.match(page.content, /View source.*\/source\/.*#L\d+/);
  const source = records.find(
    ({ id }) => id.startsWith("source/") && id.endsWith("signals/graph-ts"),
  );
  assert.match(source.content, /id="L\d+"/);
  assert.match(source.content, /export function signal&lt;T&gt;/);
});

test("public components, hooks, adapter exports and type members receive generated documentation", async () => {
  const { records } = await documentation;
  for (const name of [
    "Circle",
    "useSignal",
    "defineThreeLayer",
    "SignalOptions",
    "SpriteFrame",
  ]) {
    const page = records.find((record) => record.meta.symbols?.includes(name));
    assert.ok(page, name);
    assert.match(page.content, /## API details from source/, name);
    assert.match(page.content, /View source.*\/source\/.*#L\d+/, name);
  }
  const types = records.find((record) =>
    record.meta.symbols?.includes("SignalOptions"),
  );
  assert.match(types.content, /id="api-SignalOptions"/);
  assert.match(types.content, /id="api-SignalOptions-equals"/);
  assert.match(types.content, /id="api-SignalOptions-debugName"/);
  assert.doesNotMatch(types.content.replace(/```[\s\S]*?```/g, ""), /\{@link/);
  assert.match(types.content, /interface SignalOptions<T>/);
  assert.doesNotMatch(types.content, /type SignalOptions = SignalOptions/);
  for (const record of records) {
    const ids = [...record.content.matchAll(/<span id="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${record.id}: duplicate generated anchors`,
    );
  }
});
