import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBoxRelations } from './layout-box-relations.mjs';
const allocation = { x: 0, y: 0, width: 20, height: 20 };
const drawing = { x: 90, y: 0, width: 20, height: 20 };
test('reports overflow facts without inventing an application error', () => {
 const result = analyzeBoxRelations({ coordinateSpace: 'placed-child-local', allocation, drawing });
 assert.equal(result.status, 'available');
 assert.deepEqual(result.overflow, { left: 0, top: 0, right: 90, bottom: 0 });
 assert.equal(result.contained, false);
 assert.equal(result.assertions.containment, 'not-requested');
 assert.equal(result.scope, 'declared-axis-aligned-boxes-not-painted-visibility');
 assert.equal(analyzeBoxRelations({ coordinateSpace: 'placed-child-local', allocation, drawing, expectations: { containment: 'required' } }).assertions.containment, 'fail');
 assert.equal(analyzeBoxRelations({ coordinateSpace: 'placed-child-local', allocation, drawing: allocation, expectations: { containment: 'required' } }).assertions.containment, 'pass');
});
test('distinguishes positive overlap, touching, separation and degenerate boxes', () => {
 for (const [peer, relation, area] of [
  [{x:10,y:5,width:20,height:20}, 'overlap', 150],
  [{x:20,y:0,width:20,height:20}, 'touching', 0],
  [{x:21,y:0,width:20,height:20}, 'disjoint', 0],
  [{x:10,y:5,width:0,height:20}, 'degenerate', 0],
 ]) {
  const result=analyzeBoxRelations({coordinateSpace:'root-logical',allocation,drawing:allocation,peer,expectations:{separation:'required'}});
  assert.equal(result.overlap.relation,relation);assert.equal(result.overlap.area,area);
  assert.equal(result.assertions.separation,relation==='overlap'?'fail':'pass');
 }
 assert.equal(analyzeBoxRelations({coordinateSpace:'root-logical',allocation,drawing:allocation,expectations:{separation:'required'}}).assertions.separation,'unavailable');
});
test('refuses malformed and unrepresentable geometry and unknown policies', () => {
 for(const change of [{coordinateSpace:''},{drawing:{...drawing,width:-1}},{drawing:{...drawing,x:NaN}},{drawing:{...drawing,x:Number.MAX_VALUE,width:Number.MAX_VALUE}},{expectations:{containment:'guess'}}]) {
  assert.equal(analyzeBoxRelations({coordinateSpace:'root-logical',allocation,drawing,...change}).status,'invalid');
 }
});
test('returns detached frozen facts without mutating declared boxes', () => {
 const input={coordinateSpace:'root-logical',allocation:{...allocation},drawing:{...drawing},peer:{...drawing}};
 const result=analyzeBoxRelations(input);input.drawing.x=0;
 assert.equal(result.overflow.right,90);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.overflow));
 assert.ok(Object.isFrozen(result.overlap));assert.ok(Object.isFrozen(result.assertions));
});
