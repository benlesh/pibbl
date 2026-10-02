import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {InkSimulation} from './reference-simulation.ts';
import {WasmSimulation} from './runtime.mjs';

test('batched brushes paint persistent WASM fields with JS parity before and after buffer swaps', async () => {
  const module = await WebAssembly.compile(await readFile(new URL('./kernel.wasm',import.meta.url)));
  for (const preset of ['spots','stripes']) {
    const js = new InkSimulation(128,96,42,preset);
    const wasm = new WasmSimulation(module,js);
    const buffer=wasm.memory.buffer;
    const strokes=[[32.25,40.75,6,.8],[65,60,24,1],[.1,.3,8,.9],[-10,40,3,1],[128,96,12,.6],[100,30,2,.2]];
    for (const steps of [0,1,8]) {
      strokes.forEach((stroke,i)=>wasm.stamps.set(stroke,i*4));
      for(const stroke of strokes) js.paint(...stroke);
      wasm.paintBatch(strokes.length);
      assert.deepEqual(wasm.a,js.a);
      assert.deepEqual(wasm.b,js.b);
      assert.equal(wasm.stamps.buffer,buffer);
      js.advance(steps);wasm.advance(steps);
      assert.deepEqual(wasm.a,js.a);
      assert.deepEqual(wasm.b,js.b);
    }
    assert.equal(wasm.memory.buffer,buffer);
    assert.throws(()=>wasm.paintBatch(8193), /stamp count/);
    js.dispose();wasm.dispose();
  }
});
