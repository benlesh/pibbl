import assert from 'node:assert/strict';
import {projection} from './collision.mjs';
import {choreography,worldPoint,finishChoreography,FLOOR,checkpoints} from './motion.mjs';
assert.deepEqual(choreography(0),choreography(1));
for(let n=0;n<=1000;n++)for(const p of choreography(n/1000))for(const v of Object.values(p))assert.ok(Number.isFinite(v));
for(const t of [.18,.22,.27,.32]){
 const [,g,v]=choreography(t/1.1);
 for(const y of [0,140]){
  const a=worldPoint(g,[124,y]),b=worldPoint(v,[0,y]);
  assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8,'magnetic seam must remain locked');
 }
}
const final=finishChoreography(choreography(.32),1);
assert.deepEqual(final.map(p=>[p.x,p.y,p.rotation]),[[200,110,0],[200,250,0],[328,110,0]]);
console.warn('PASS: finite seekable poses, seamless loop, locked magnetic seam, exact final P');

for(const c of checkpoints)for(let n=0;n<=100;n++)finishChoreography(choreography(c),n/100).forEach((p,i)=>assert.ok(projection(i,p,[0,1])[1]<=FLOOR+1e-8));
console.warn("PASS: every ready checkpoint stays above the floor");
