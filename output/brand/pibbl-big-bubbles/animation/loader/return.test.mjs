import assert from 'node:assert/strict';
import {choreography} from './motion.mjs';
import {projection} from './collision.mjs';
const start=choreography(0),x=start.map((p,i)=>projection(i,p,[1,0]));
assert.ok(x[1][0]-x[0][1]<70&&x[2][0]-x[1][1]<50,'compact starting group');
assert.ok(Math.abs((1-.95/1.1)*11-1.5)<1e-8,'return gets 1.5 seconds');
assert.deepEqual(choreography(.995),start,'rest together before starting again');
console.warn('PASS: compact home group, three times longer return, shared rest and seamless restart');
