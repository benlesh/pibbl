import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {toRunnableScript} from '../playground/src/sandbox-module.ts';

test('Studio executes an explicitly imported filter factory through a public lesson', () => {
  const source = `import {crc, createElement, Rectangle} from '@crc/core';
import {blur} from '@crc/core/filters';
export default function mount(canvas) {
  return crc(canvas, createElement(Rectangle, {style:{width:20,height:20,filter:blur({radius:3})}}));
}`;
  const calls=[];
  const runtime={Rectangle:{},createElement:(type,props)=>({type,props}),blur:options=>({effect:'blur',options}),crc:(canvas,element)=>{calls.push({canvas,element});return {dispose(){}};}};
  const context={CRC_CORE:runtime};
  runInNewContext(toRunnableScript(source),context);
  context.__CRC_EXAMPLE_MOUNT__('canvas');
  assert.equal(calls[0].element.props.style.filter.options.radius,3);
  assert.equal(calls[0].element.type,runtime.Rectangle);
});

test('Studio still rejects internal filter implementation imports', () => {
  assert.throws(()=>toRunnableScript(`import {blur} from '@crc/core/lib/filter/blur'; export default function mount(canvas){return blur(canvas);}`),/named imports only/);
});
