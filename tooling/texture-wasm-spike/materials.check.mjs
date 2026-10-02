import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {materialField} from './reference-material-field.ts';
import {WasmMaterial} from './materials-runtime.mjs';

test('WASM static materials preserve reference fields and tile seams without moving output memory',async()=>{
  const module=await WebAssembly.compile(await readFile(new URL('./materials.wasm',import.meta.url)));
  for(const kind of ['marble','paper','cellular']) {
    const wasm=new WasmMaterial(module,65,41),buffer=wasm.memory.buffer;
    for(const [seed,scale,detail] of [[42,6,.65],[0,3.5,0],[4294967295,12,1]]) {
      const reference=materialField(65,41,kind,seed,scale,detail);
      wasm.generate(kind,seed,scale,detail);
      let maxError=0;
      for(let i=0;i<reference.length;i++) {
        assert.ok(Number.isFinite(wasm.field[i]));
        maxError=Math.max(maxError,Math.abs(wasm.field[i]-reference[i]));
      }
      assert.ok(maxError<=1e-6,`${kind}: maximum error ${maxError}`);
      for(let x=0;x<65;x++)assert.ok(Math.abs(wasm.field[x]-wasm.field[40*65+x])<=1e-6);
      for(let y=0;y<41;y++)assert.ok(Math.abs(wasm.field[y*65]-wasm.field[y*65+64])<=1e-6);
      assert.equal(wasm.field.buffer,buffer);assert.equal(wasm.pixels.buffer,buffer);
    }
    wasm.dispose();assert.throws(()=>wasm.generate(kind,42,6,.65),/disposed/);
  }
});

test('matched JS control preserves the shipped recipe',async()=>{
  const {createControl}=await import('./materials-control.mjs');
  const {MatchedMaterial}=await import('./materials-runtime.mjs');
  const control=new MatchedMaterial(createControl,65,41);
  for(const kind of ['marble','paper','cellular'])for(const seed of [0,42,4294967295]) {
    assert.deepEqual(control.generate(kind,seed,6,.65),materialField(65,41,kind,seed,6,.65));
  }
});

test('enhanced recipes add visible structure while retaining periodic edges and JS/WASM parity',async()=>{
  const {createControl}=await import('./materials-control.mjs');
  const {MatchedMaterial}=await import('./materials-runtime.mjs');
  const module=await WebAssembly.compile(await readFile(new URL('./materials.wasm',import.meta.url)));
  const wasm=new WasmMaterial(module,97,65),js=new MatchedMaterial(createControl,97,65);
  for(const kind of ['marble','paper','cellular']) {
    const baseline=wasm.generate(kind,42,6,.65).slice();
    const actual=wasm.generate(kind,42,6,.65,1),expected=js.generate(kind,42,6,.65,1);
    let difference=0;
    for(let i=0;i<actual.length;i++) {
      assert.ok(Number.isFinite(actual[i])&&actual[i]>=0&&actual[i]<=1);
      assert.ok(Math.abs(actual[i]-expected[i])<=1e-6);
      difference+=Math.abs(actual[i]-baseline[i]);
    }
    assert.ok(difference/actual.length>.001,`${kind} enhanced recipe must differ from the baseline`);
    for(let x=0;x<97;x++)assert.ok(Math.abs(actual[x]-actual[64*97+x])<=1e-6,`${kind} vertical seam`);
    for(let y=0;y<65;y++)assert.ok(Math.abs(actual[y*97]-actual[y*97+96])<=1e-6,`${kind} horizontal seam`);
  }
});
