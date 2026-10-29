import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base=process.argv[2]??'http://127.0.0.1:5192',built=process.argv.includes('--built');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/#/examples/layout/wasm-flex-intrinsic-wrap`);
 const host=page.locator('iframe[srcdoc]');await host.waitFor({state:'attached'});await host.scrollIntoViewIfNeeded();
 const frame=page.frameLocator('iframe[srcdoc]');await frame.locator('pre').waitFor();
 const read=()=>frame.locator('pre').innerText();
 const click=async(x,y)=>{const bounds=await frame.locator('canvas').boundingBox(),scale=Math.min(bounds.width/760,bounds.height/360);await frame.locator('canvas').click({position:{x:(bounds.width-760*scale)/2+x*scale,y:(bounds.height-360*scale)/2+y*scale}});await page.waitForTimeout(240);};
 const hits=async expected=>assert.ok((await read()).includes(`footer hits: ${expected}`));
 await click(40,235);await hits(1);
 await click(108,114);await click(40,235);await hits(1);await click(40,265);await hits(2);
 assert.ok((await read()).includes('stamp: 1'));
 await click(284,114);await click(40,265);await hits(3);
 await click(108,114);await click(40,265);await hits(3);await click(40,235);await hits(4);
 const sandbox=page.frames().find(value=>value.url()==='about:srcdoc');
 const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
 if(built){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
 const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
 assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.deepEqual(errors,[]);
 console.warn(JSON.stringify({base,footerY:[230,260,230],hits:4,stamp:1,builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
}finally{await browser.close();}
