import assert from 'node:assert/strict';
import {choreography,bounds,FLOOR} from './motion.mjs';
import {projection} from './collision.mjs';
for(let n=0;n<=2000;n++)choreography(n/2000).forEach((p,i)=>assert.ok(projection(i,p,[0,1])[1]<=FLOOR+1e-8,`piece ${i} penetrates floor at ${n/2000}`));
for(let n=0;n<=100;n++){
 const t=.18+.14*n/100, [,g,v]=choreography(t/1.1);
 assert.ok(Math.abs(v.y+bounds(2,v.rotation).bottom-FLOOR)<1e-8);
 assert.ok(Math.abs(g.rotation-v.rotation)<1e-8);
}
console.log('PASS: no floor penetration, grounded curved support throughout ride');
