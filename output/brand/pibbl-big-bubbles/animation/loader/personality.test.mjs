import assert from 'node:assert/strict';
import {choreography as sample,worldPoint} from './motion.mjs';
import {projection} from './collision.mjs';
const choreography=t=>sample(t/1.1);
assert.ok(choreography(.09)[1].sy<1,'green crouches before jumping');
assert.ok(choreography(.111)[1].sy>1,'green stretches at lift-off');
assert.ok(choreography(.335)[2].sy<1,'violet crouches under the attached load');
assert.ok(choreography(.365)[2].sy>1,'violet stretches to hoist green');
for(const t of [.33,.35,.369]){const [,g,v]=choreography(t);for(const y of [0,140]){const a=worldPoint(g,[124,y]),b=worldPoint(v,[0,y]);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7);}}
assert.ok(choreography(.57)[2].sy<1);
assert.ok(choreography(.60)[1].sy<1);
assert.ok(choreography(.635)[0].sy<1);
for(const t of [.911,.92,.93,.945]){const [c,g,v]=choreography(t);const foot=projection(0,c,[0,1])[1];assert.ok(Math.abs(foot-projection(1,g,[0,1])[0])<1e-7);assert.ok(Math.abs(foot-projection(2,v,[0,1])[0])<1e-7);}
console.log('PASS: anticipation, lift-off stretch, attached hoist, shared laughter, supported pyramid catch');

assert.ok(choreography(.388)[1].sy<1,'green pushes off with its own compression');
assert.ok(choreography(.402)[1].sy>1,'green extends during its push-off');
assert.ok(choreography(.45)[2].x<choreography(.32)[2].x-30,'violet jumps toward coral');
let lastAngle=choreography(.39)[1].rotation;
for(let n=1;n<=100;n++){const angle=choreography(.39+.06*n/100)[1].rotation;assert.ok(angle>=lastAngle-1e-8,'ramp flight must rotate clockwise');lastAngle=angle;}
const lifts=[];
const cuts=[0,.2142,.5414,1];
for(let hop=0;hop<3;hop++){let height=0;for(let n=0;n<=100;n++){const p=.72+.08*(cuts[hop]+(cuts[hop+1]-cuts[hop])*n/100);const c=choreography(p)[0];height=Math.max(height,390-projection(0,c,[0,1])[1]);}lifts.push(height);}
assert.ok(lifts[0]<lifts[1]&&lifts[1]<lifts[2],'each preparation hop must get higher');
assert.deepEqual(choreography(.69),choreography(.71),'hold a beat after laughter');
console.log('PASS: forward hoist, green push-off, clockwise back-first slide, pause, escalating hops');
