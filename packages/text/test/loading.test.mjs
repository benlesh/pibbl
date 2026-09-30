import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { loadOutlineFont, createTextGeometry } from "../dist/index.mjs";
import { nativeResources } from "../dist/testing.mjs";
const bytes = await readFile(
  new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
);
test("oversized HTTP font is rejected from its header without waiting for the body", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Length": 33 * 1024 * 1024 });
    response.flushHeaders(); // Deliberately never complete the body.
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const before = await nativeResources();
  try {
    await assert.rejects(
      loadOutlineFont(`http://127.0.0.1:${server.address().port}/font`, {
        signal: AbortSignal.timeout(1000),
      }),
      /32 MiB/,
    );
    const after = await nativeResources();
    assert.equal(after.fonts, before.fonts);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("font loading respects offset views and owns an independent copy", async () => {
  const padded = new Uint8Array(bytes.length + 20);
  padded.set(bytes, 10);
  const view = padded.subarray(10, 10 + bytes.length);
  const promise = loadOutlineFont(view);
  view.fill(0);
  using font = await promise;
  assert.ok(
    createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount > 0,
  );
});
test("chunked font downloads stop at the byte limit without acquiring a font", async () => {
  const chunk = Buffer.alloc(1024 * 1024);
  const server = createServer(async (_request, response) => {
    response.writeHead(200);
    for (let i = 0; i < 33 && !response.destroyed; i++) {
      response.write(chunk);
      await new Promise((resolve) => setImmediate(resolve));
    }
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const before = await nativeResources();
  try {
    await assert.rejects(
      loadOutlineFont(`http://127.0.0.1:${server.address().port}/font`, {
        signal: AbortSignal.timeout(5000),
      }),
      /32 MiB/,
    );
    const after = await nativeResources();
    assert.equal(after.fonts, before.fonts);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("canceling a partial font response closes it without acquiring a font", async () => {
  const controller = new AbortController();
  let sawRequest = false;
  const closed = Promise.withResolvers();
  const server = createServer((_request, response) => {
    sawRequest = true;
    response.once("close", closed.resolve);
    response.writeHead(200);
    response.write(bytes.subarray(0, 100));
    setImmediate(() =>
      controller.abort(new DOMException("Canceled by test", "AbortError")),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const before = await nativeResources();
  try {
    await assert.rejects(
      loadOutlineFont(`http://127.0.0.1:${server.address().port}/font`, {
        signal: controller.signal,
      }),
      { name: "AbortError" },
    );
    assert.equal(sawRequest, true);
    let timer;
    try {
      await Promise.race([
        closed.promise,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("Canceled response remained open")),
            1000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    assert.equal((await nativeResources()).fonts, before.fonts);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
test("Node Buffer input is copied before asynchronous engine initialization", async () => {
  const source = Buffer.from(
    await readFile(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)),
  );
  const pending = loadOutlineFont(source);
  source.fill(0);
  using font = await pending;
  assert.ok(
    createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount > 0,
  );
});
test("loading owns its original abort signal even if the options object changes", async () => {
  const { getEventListeners } = await import("node:events");
  const original = new AbortController();
  const replacement = new AbortController();
  const options = { signal: original.signal };
  const bytes = await readFile(
    new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url),
  );
  const before = getEventListeners(original.signal, "abort").length;
  const pending = loadOutlineFont(bytes, options);
  options.signal = replacement.signal;
  using font = await pending;
  assert.equal(getEventListeners(original.signal, "abort").length, before);
  assert.ok(
    createTextGeometry(font, "A", { fontSize: 100 }).geometry.segmentCount > 0,
  );
});
