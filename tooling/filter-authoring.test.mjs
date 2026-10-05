import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {toRunnableScript} from '../playground/src/sandbox-module.ts';

test('Studio executes an explicitly imported filter factory through a public lesson', () => {
  const source = `import {pibbl, createElement, Rectangle} from '@pibbl/core';
import {blur} from '@pibbl/core/filters';
export default function mount(canvas) {
  return pibbl(canvas, createElement(Rectangle, {style:{width:20,height:20,filter:blur({radius:3})}}));
}`;
  const calls=[];
  const runtime={Rectangle:{},createElement:(type,props)=>({type,props}),blur:options=>({effect:'blur',options}),pibbl:(canvas,element)=>{calls.push({canvas,element});return {dispose(){}};}};
  const context={PIBBL_CORE:runtime};
  runInNewContext(toRunnableScript(source),context);
  context.__PIBBL_EXAMPLE_MOUNT__('canvas');
  assert.equal(calls[0].element.props.style.filter.options.radius,3);
  assert.equal(calls[0].element.type,runtime.Rectangle);
});

test('Studio still rejects internal filter implementation imports', () => {
  assert.throws(()=>toRunnableScript(`import {blur} from '@pibbl/core/lib/filter/blur'; export default function mount(canvas){return blur(canvas);}`),/named imports only/);
});
