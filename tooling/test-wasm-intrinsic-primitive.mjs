import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';

const base=process.argv[2]??'http://127.0.0.1:5192';
const built=process.argv.includes('--built');
const finalWidth=process.argv.includes('--final-width');
const columnMinimum=process.argv.includes('--column-minimum');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-intrinsic-primitive`);
  const host=page.locator('iframe[srcdoc]');await host.waitFor({state:'attached'});await host.scrollIntoViewIfNeeded();
  const frame=page.frameLocator('iframe[srcdoc]');await frame.locator('pre').waitFor();
  const text=async()=>frame.locator('pre').innerText();
  const value=async(label)=>{
    const match=(await text()).match(new RegExp(`${label}: (\\d+)`));
    assert.ok(match,`missing ${label} in inspector`);
    return Number(match[1]);
  };
  const state=async()=>({
    stamp:await value('stamp'),hits:await value('follower hits'),columnHits:await value('column follower hits'),providerCalls:await value('provider calls'),columnCalls:await value('column measure calls'),measuredLeaves:await value('measuredLeaves'),
  });
  const click=async(x,y)=>{
    const bounds=await frame.locator('canvas').boundingBox(),scale=Math.min(bounds.width/760,bounds.height/360);
    await frame.locator('canvas').click({position:{x:(bounds.width-760*scale)/2+x*scale,y:(bounds.height-360*scale)/2+y*scale}});
    await page.waitForTimeout(240);
  };
  if(columnMinimum){
    const columnInitial=await state();assert.equal(columnInitial.stamp,1);assert.ok(columnInitial.columnCalls>0,'initial exact-width column must query the paired provider');
    // min40 protects the 40px natural height, so the follower starts at y290.
    await click(33,295);assert.equal((await state()).columnHits,1);
    await click(108,114);const columnMinimum70=await state();assert.equal(columnMinimum70.stamp,1);assert.ok(columnMinimum70.columnCalls>columnInitial.columnCalls,'shared minimum must remeasure the exact-width column');
    // min70 moves the follower to y320; its former y295 target is now empty.
    await click(33,295);assert.equal((await state()).columnHits,1);await click(33,325);assert.equal((await state()).columnHits,2);
    const automaticPaint=await state();await click(636,114);const automaticPainted=await state();
    assert.equal(automaticPainted.columnCalls,automaticPaint.columnCalls,'automatic floor cache survives sibling paint');
    assert.equal(automaticPainted.measuredLeaves,automaticPaint.measuredLeaves);
    await click(636,114);
    await click(460,114);const columnEscaped=await state();assert.equal(columnEscaped.stamp,1);
    // Explicit minHeight:0 permits shrink to20px and moves the follower to y270.
    await click(33,325);assert.equal((await state()).columnHits,2);await click(33,275);assert.equal((await state()).columnHits,3);
    const beforeColumnPaint=await state();await click(636,114);const columnPainted=await state();
    assert.equal(columnPainted.columnCalls,beforeColumnPaint.columnCalls,'paint-only input must not query the exact-width column');assert.equal(columnPainted.measuredLeaves,beforeColumnPaint.measuredLeaves,'paint-only input must not measure the exact-width column');
    // Restore the shared controls before the existing row proof begins.
    await click(636,114);await click(460,114);await click(108,114);
  }
  const initial=await state();assert.equal(initial.stamp,1);assert.ok(initial.providerCalls>0,'initial finite Flex must query the provider');
  // owner80/min40: intrinsic first item occupies60px, then the follower is88..108.
  await click(93,174);assert.equal(await value('follower hits'),1);
  await click(108,114);const minimum70=await state();assert.equal(minimum70.stamp,1);assert.ok(minimum70.providerCalls>initial.providerCalls,'provider minimum change must remeasure');
  // owner80/min70: automatic minimum wins and follower moves to98..118.
  await click(93,174);assert.equal(await value('follower hits'),1);await click(103,174);assert.equal(await value('follower hits'),2);
  await click(284,114);const protectedOverflow=await state();assert.equal(protectedOverflow.stamp,1);
  // owner40/min70 keeps the protected contribution; follower remains98..118 outside the owner.
  await click(103,174);assert.equal(await value('follower hits'),3);
  await click(460,114);const escaped=await state();assert.equal(escaped.stamp,1);
  // Explicit minWidth:0 permits shrink: follower is48..68; its former location now misses.
  await click(103,174);assert.equal(await value('follower hits'),3);await click(53,174);assert.equal(await value('follower hits'),4);
  const beforePaint=await state();await click(636,114);const painted=await state();
  assert.equal(painted.stamp,1);assert.equal(painted.providerCalls,beforePaint.providerCalls,'paint-only input must not query intrinsic sizes');assert.equal(painted.measuredLeaves,beforePaint.measuredLeaves,'paint-only input must not measure');
  if(finalWidth){
    await click(410,194);assert.equal(await value('adaptive hits'),0);
    await click(460,268);await click(410,194);assert.equal(await value('adaptive hits'),1);
    const calls=await value('adaptive finite calls'),measures=await value('measuredLeaves');
    await click(636,268);assert.equal(await value('adaptive finite calls'),calls);assert.equal(await value('measuredLeaves'),measures);
    await click(460,268);await click(410,194);assert.equal(await value('adaptive hits'),1);
  }
  const sandbox=page.frames().find(value=>value.url()==='about:srcdoc');const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if(built){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
  const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.deepEqual(errors,[]);
  console.warn(JSON.stringify({base,finalWidth,columnMinimum,initial,minimum70,protectedOverflow,escaped,painted,builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
} finally { await browser.close(); }
