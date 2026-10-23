import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base=process.argv[2]??'http://127.0.0.1:5192';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/#/examples/layout/wasm-flex-keyed-wrap`);
 const host=page.locator('iframe[srcdoc]');await host.waitFor({state:'attached'});await host.scrollIntoViewIfNeeded();
 const frame=page.frameLocator('iframe[srcdoc]');await frame.locator('pre').waitFor();
 const read=async()=>JSON.parse(await frame.locator('pre').innerText());
 const click=async(x,y)=>{const bounds=await frame.locator('canvas').boundingBox(),scale=Math.min(bounds.width/760,bounds.height/460);await frame.locator('canvas').click({position:{x:(bounds.width-760*scale)/2+x*scale,y:(bounds.height-460*scale)/2+y*scale}});await page.waitForTimeout(240);};
 const initial=await read();assert.equal(initial.layoutDirection,'ltr');
 await click(660,155);const rtl=await read();assert.equal(rtl.layoutDirection,'rtl');
 for(const [name,box]of Object.entries(initial.boxes)){
  const actual=rtl.boxes[name],left=name.startsWith('row:')?28:440,width=name.startsWith('row:')?360:292;
  assert.equal(actual.x,2*left+width-box.x-box.width,name);assert.equal(actual.y,box.y,name);assert.equal(actual.stamp,box.stamp,name);
 }
 const target=rtl.boxes['row:A'];await click(target.x+8,target.y+8);assert.equal((await read()).selected,'row:A');
 const beforePaint=await read();await click(520,118);const painted=await read();
 for(const key of ['solves','mainPlacements','crossPlacements','nodeCreates','measuredLeaves'])assert.equal(painted.layout[key],beforePaint.layout[key],key);
 await click(660,155);const restored=await read();assert.deepEqual(restored.boxes,initial.boxes);
 const sandbox=page.frames().find(value=>value.url()==='about:srcdoc');
 const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
 if(process.argv.includes('--built')){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
 const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
 assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.deepEqual(errors,[]);
 console.warn(JSON.stringify({base,ltr:initial.boxes,rtl:rtl.boxes,builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
}finally{await browser.close();}
