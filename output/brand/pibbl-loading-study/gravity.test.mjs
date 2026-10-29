import assert from 'node:assert/strict';
import {flight,massCenter} from './motion.mjs';
const a={x:205,y:250,rotation:0,sx:1,sy:.9},b={x:570,y:166,rotation:90,sx:1,sy:1};
const centers=Array.from({length:101},(_,n)=>massCenter(1,flight(1,a,b,n/100,150,.12)));
let acceleration;
for(let n=1;n<100;n++){
 assert.ok(Math.abs(centers[n+1][0]-2*centers[n][0]+centers[n-1][0])<1e-7,'steady sideways momentum');
 const ddy=centers[n+1][1]-2*centers[n][1]+centers[n-1][1];
 if(acceleration===undefined)acceleration=ddy;
 assert.ok(ddy>0&&Math.abs(ddy-acceleration)<1e-7,'constant downward acceleration');
}
console.log('PASS: ballistic center of mass, constant sideways velocity, constant gravity despite rotation and stretch');
