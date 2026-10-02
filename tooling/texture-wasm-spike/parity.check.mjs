import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { InkSimulation } from './reference-simulation.ts';
import { WasmSimulation } from './runtime.mjs';

test('WASM retains exact JS fields across odd/even batches and exposes persistent pixel memory', async () => {
  const module = await WebAssembly.compile(await readFile(new URL('./kernel.wasm', import.meta.url)));
  for (const preset of ['spots', 'stripes']) {
    for (const [w, h] of [[32, 24], [65, 37]]) {
      const js = new InkSimulation(w, h, 1234, preset);
      const wasm = new WasmSimulation(module, js);
      const buffer = wasm.memory.buffer;
      for (const steps of [0, 1, 2, 8, 24, 65]) {
        js.advance(steps);
        wasm.advance(steps);
        assert.deepEqual(wasm.a, js.a);
        assert.deepEqual(wasm.b, js.b);
        assert.equal(wasm.memory.buffer, buffer);
      }
      const lut = Uint8ClampedArray.from({length: 1024}, (_, i) => i % 256);
      wasm.setPalette(lut);
      wasm.colorize(2.5);
      assert.equal(wasm.pixels.buffer, buffer);
      for (let i = 0; i < w * h; i++) {
        const v = Math.max(0, Math.min(255, Math.round(js.b[i] * 255 * 2.5)));
        assert.deepEqual([...wasm.pixels.subarray(i * 4, i * 4 + 4)], [lut[v * 4], lut[v * 4 + 1], lut[v * 4 + 2], 255]);
      }
      js.dispose();
      wasm.dispose();
      assert.throws(() => wasm.advance(1), /disposed/);
    }
  }
});
