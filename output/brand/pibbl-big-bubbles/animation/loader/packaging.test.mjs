import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {identity} from './identity.mjs';
import {bloom} from './playback.mjs';
test('release geometry and score match approved sources exactly',()=>{
 assert.deepEqual(identity,JSON.parse(fs.readFileSync(new URL('../../source/identity.json',import.meta.url))));
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('motion.mjs',import.meta.url))).digest('hex'),'d9282322b1f95f3715f59709cef6282be88c02da44f132830a63e310f7a1a948');
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('collision.mjs',import.meta.url))).digest('hex'),'d669325117509a4829af1f606afba805fbd641ba87e1063680e19cb39e25b317');
 const result=bloom(690);identity.bubbles.forEach((b,i)=>{assert.equal(result[i].x,b.destination.x);assert.equal(result[i].y,b.destination.y);assert.equal(result[i].r,b.destination.r);assert.equal(result[i].opacity,1);});
});
