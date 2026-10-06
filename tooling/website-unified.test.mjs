import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDocumentation } from "../website/documentation.mjs";

test("signal reference combines authored guidance with public JSDoc and exact source", async () => {
  const { records } = await loadDocumentation(process.cwd(), "/playground/");
  const page = records.find(({ id }) => id === "reference/functions/signal");
  assert.match(page.content, /## API details from source/);
  assert.match(page.content, /Value stored before the first write/);
  assert.match(
    page.content,
    /\[SignalOptions\]\(\/reference\/types\/canvas-runtime\/#[^)]+\)/,
  );
  assert.match(page.content, /View source.*\/source\/.*#L\d+/);
  const source = records.find(
    ({ id }) => id.startsWith("source/") && id.endsWith("signals/graph"),
  );
  assert.match(source.content, /id="L\d+"/);
  assert.match(source.content, /export function signal&lt;T&gt;/);
});
