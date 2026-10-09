import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Playback} from './playback.mjs';
import {choreography,finalPoses} from './motion.mjs';
test('approved loop is unchanged and closes exactly',()=>{const p=new Playback(); for(let i=0;i<110;i++){p.advance(100);assert.deepEqual(p.frame().poses,choreography((i+1)%110/110));}});
test('ready finishes an encounter, forms, blooms, and holds',()=>{const p=new Playback();p.advance(2400);p.complete();for(let i=0;i<200;i++)p.advance(50);assert.equal(p.phase,'complete');assert.deepEqual(p.frame().poses,finalPoses());assert.equal(p.frame().bubbles.length,9);const f=p.frame();p.advance(1000);assert.deepEqual(p.frame(),f);});
test('pause, resume, restart and immediate reduced motion completion',()=>{const p=new Playback();p.advance(500);p.pause();const f=p.frame();p.advance(1000);assert.deepEqual(p.frame(),f);p.resume();p.advance(100);assert.notDeepEqual(p.frame(),f);p.restart();assert.equal(p.time,0);p.complete(true);assert.equal(p.phase,'complete');});
