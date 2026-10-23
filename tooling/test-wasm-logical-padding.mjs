import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base=process.argv[2]??'http://127.0.0.1:5192',browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/#/examples/layout/wasm-logical-padding`);const host=page.locator('iframe[srcdoc]');await host.waitFor({state:'attached'});await host.scrollIntoViewIfNeeded();const frame=page.frameLocator('iframe[srcdoc]');await frame.locator('pre').waitFor();
 const read=async()=>JSON.parse(await frame.locator('pre').innerText());
 const click=async(x,y)=>{const bounds=await frame.locator('canvas').boundingBox(),scale=Math.min(bounds.width/760,bounds.height/360);await frame.locator('canvas').click({position:{x:(bounds.width-760*scale)/2+x*scale,y:(bounds.height-360*scale)/2+y*scale}});await page.waitForTimeout(240);};
 const initial=await read();assert.deepEqual(initial.box,{x:28,y:158,width:20,height:20,stamp:1});await click(33,163);assert.equal((await read()).hits,1);
 await click(200,105);const padded=await read();assert.equal(padded.box.x,64);await click(33,163);assert.equal((await read()).hits,1);await click(69,163);assert.equal((await read()).hits,2);
 await click(400,105);const resized=await read();assert.equal(resized.box.x,82);await click(87,163);assert.equal((await read()).hits,3);
 await click(50,105);const rtl=await read();assert.equal(rtl.box.x,314);assert.equal(rtl.box.stamp,1);await click(87,163);assert.equal((await read()).hits,3);await click(319,163);assert.equal((await read()).hits,4);
 const before=await read();await click(540,105);const painted=await read();for(const key of ['solves','mainPlacements','crossPlacements','measuredLeaves','nodeCreates'])assert.equal(painted.layout[key],before.layout[key],key);
 await click(200,105);const zero=await read();assert.equal(zero.box.x,368);await click(373,163);assert.equal((await read()).hits,5);assert.equal(zero.layout.nodeCreates,initial.layout.nodeCreates);
 if(process.argv.includes('--logical-borders')){
  await click(680,105);const zeroBorder=await read();assert.equal(zeroBorder.borderStartWidth,0);assert.equal(zeroBorder.box.x,368);assert.equal(zeroBorder.box.y,163);await click(373,168);assert.equal((await read()).hits,6);
  await click(680,105);const border=await read();assert.equal(border.borderStartWidth,30);assert.equal(border.box.x,338);assert.equal(border.box.y,163);await click(373,168);assert.equal((await read()).hits,6);await click(343,168);assert.equal((await read()).hits,7);
  await click(50,105);const ltrBorder=await read();assert.equal(ltrBorder.box.x,58);assert.equal(ltrBorder.box.y,163);assert.equal(ltrBorder.box.stamp,1);await click(343,168);assert.equal((await read()).hits,7);await click(63,168);assert.equal((await read()).hits,8);
  const before=await read();await click(540,105);const painted=await read();for(const key of ['solves','mainPlacements','crossPlacements','nodeCreates','measuredLeaves'])assert.equal(painted.layout[key],before.layout[key],key);
 }
 const sandbox=page.frames().find(value=>value.url()==='about:srcdoc'),proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);if(process.argv.includes('--built')){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
 const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.deepEqual(errors,[]);
 console.warn(JSON.stringify({base,logicalBorders:process.argv.includes('--logical-borders'),initial:initial.box,padded:padded.box,resized:resized.box,rtl:rtl.box,zero:zero.box,builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
}finally{await browser.close();}
