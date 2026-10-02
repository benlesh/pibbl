import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blur, dropShadow } from '../packages/core/src/filters.ts';
import { resolveFilterList } from '../packages/core/src/lib/style/filter.ts';
const context={allocation:{x:0,y:0,width:100,height:100},percentageBasis:{x:0,y:0,width:100,height:100},constraints:{minWidth:0,maxWidth:100,minHeight:0,maxHeight:100},component:'ValidationProbe',algorithm:'render-dispatch'};
test('factories preserve contextual and balanced color token validation',()=>{
 for(const color of ['CanvasText','c\\75rrentColor','var(--paint)','rgb(0 0 0)) blur(50px) drop-shadow(0px 0px red']){
  assert.throws(()=>resolveFilterList(dropShadow({offsetX:0,offsetY:0,color}),context),/filter.color.*(contextual|balanced)/);
 }
});
test('explicit null radius is invalid and nonfinite values have finite diagnostics',()=>{
 assert.throws(()=>resolveFilterList(dropShadow({offsetX:0,offsetY:0,color:'black',blurRadius:null}),context),/filter.blurRadius.*finite/);
 assert.throws(()=>resolveFilterList(blur({radius:NaN}),context),/filter.radius.*finite/);
});
