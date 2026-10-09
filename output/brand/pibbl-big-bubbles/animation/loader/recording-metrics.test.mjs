import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "./recording-metrics.mjs";
test("capture metrics retain timing distribution and report raw storage", () => {
  const result = summarize([1, 2, 3, 4, 10]);
  assert.equal(result.p95, 10);
  assert.equal(result.median, 3);
  assert.equal(result.mean, 4);
  assert.deepEqual(summarize([]), {
    count: 0,
    mean: 0,
    median: 0,
    p95: 0,
    max: 0,
  });
});

import { recordingWasmBytes } from "./recording-wasm.mjs";
test("real WASM stores two complete independent RGBA bitmaps", async () => {
  const { instance } = await WebAssembly.instantiate(recordingWasmBytes);
  const pixels = new Uint8Array(instance.exports.memory.buffer);
  const frame = Uint8Array.from({ length: 4096 }, (_, i) => (i * 17) % 256);
  pixels.set(frame);
  instance.exports.record(4096, 0, 4096);
  pixels.fill(7, 0, 4096);
  instance.exports.record(8192, 0, 4096);
  assert.deepEqual(pixels.slice(4096, 8192), frame);
  assert.deepEqual(pixels.slice(8192, 12288), new Uint8Array(4096).fill(7));
});
import { estimateRecording } from "./recording-metrics.mjs";
test("recording budget follows backing dimensions, duration and capture rate", () => {
  const budget = estimateRecording({
    width: 640,
    height: 450,
    duration: 3000,
    fps: 120,
  });
  assert.equal(budget.frameBytes, 1152000);
  assert.equal(budget.expectedFrames, 360);
  assert.equal(budget.frameCapacity, 414);
  assert.ok(budget.allocatedBytes >= 1152000 * 415);
  assert.equal(
    estimateRecording({ width: 1280, height: 900, duration: 3000, fps: 120 })
      .frameBytes,
    budget.frameBytes * 4,
  );
});
