import assert from 'node:assert/strict';
import {choreography,finishChoreography,checkpoints} from './motion.mjs';
import {overlaps,projection} from './collision.mjs';
function check(poses,label){for(let i=0;i<3;i++){assert.ok(projection(i,poses[i],[0,1])[1]<=390+1e-7,`floor ${label} ${i}`);for(let j=i+1;j<3;j++)assert.ok(!overlaps(i,poses[i],j,poses[j]),`overlap ${label}: ${i}/${j}`);}}
for(let n=0;n<=5000;n++)check(choreography(n/5000),`loop ${n/5000}`);
for(const t of checkpoints)for(let n=0;n<=500;n++)check(finishChoreography(choreography(t),n/500),`ready ${t} ${n/500}`);
console.log('PASS: exact cubic support checks — 5,001 loop samples and every ready transition; no overlapping outlines or floor penetration');
