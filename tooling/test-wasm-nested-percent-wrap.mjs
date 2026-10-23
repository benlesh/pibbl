import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const base=process.argv[2]??'http://127.0.0.1:5192',built=process.argv.includes('--built');
const reference=JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json',import.meta.url),'utf8'));
const cases=reference.cases.filter(value=>value.name.startsWith('nested-percent-gap-'));
assert.equal(cases.length,8);
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],catalogUrls=[];
 page.on('response',response=>{if(response.url().includes('/learning-catalog.ts'))catalogUrls.push(response.url());});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${base}/#/testing/layout-yoga-migration`);
 const host=page.locator('iframe[srcdoc]');await host.waitFor({state:'attached'});await host.scrollIntoViewIfNeeded();
 const frame=page.frameLocator('iframe[srcdoc]');await frame.locator('pre').waitFor();
 const sandbox=page.frames().find(value=>value.url()==='about:srcdoc');
 const click=async(x,y)=>{const box=await frame.locator('canvas').boundingBox(),scale=Math.min(box.width/760,box.height/540);await frame.locator('canvas').click({position:{x:(box.width-760*scale)/2+x*scale,y:(box.height-540*scale)/2+y*scale}});await page.waitForTimeout(240);};
 const state=async()=>JSON.parse((await frame.locator('pre').innerText()).split('nested state: ')[1]);
 const diagnostics=()=>sandbox.evaluate(()=>globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
 for(let i=0;i<7;i++)await click(520,158);
 let previous;
 for(const [index,fixture] of cases.entries()){
  if(index)await click(60,158);
  assert.ok((await frame.locator('pre').innerText()).includes(fixture.name));
  const current=await state();
  for(let i=0;i<4;i++)assert.deepEqual(current.boxes[String.fromCharCode(65+i)],fixture.boxes[i],fixture.name);
  assert.deepEqual(current.boxes.A1,fixture.nestedBoxes[0]);assert.deepEqual(current.boxes.A2,fixture.nestedBoxes[1]);
  const column=fixture.flexDirection==='column',wrapped=fixture.flexWrap==='wrap';
  if(fixture.name.endsWith('-resized')){
   assert.deepEqual(current.stamps,previous.state.stamps,'Resize retains all card/leaf identities');
   assert.equal((await diagnostics()).nodeCreates,previous.diagnostics.nodeCreates);
   const oldD=previous.fixture.boxes[3];
   const oldPoint=wrapped?column?{x:oldD.x+2,y:220}:{x:220,y:oldD.y+2}:{x:oldD.x+2,y:oldD.y+2};
   const hits=current.hits;await click(392+oldPoint.x,240+oldPoint.y);assert.equal((await state()).hits,hits,'Former footer is no longer a target');
   if(!wrapped){await click(column?394:442,column?290:242);assert.equal((await state()).hits,hits,'Former inner leaf point is now a gap');}
  }
  const leaf=fixture.nestedBoxes[1];await click(394+leaf.x,242+leaf.y);assert.ok((await frame.locator('pre').innerText()).includes('selected: A2'));
  const footer=fixture.boxes[3];await click(394+footer.x,242+footer.y);assert.ok((await frame.locator('pre').innerText()).includes('selected: D'));
  const before=await diagnostics();await click(300,158);const after=await diagnostics();for(const key of ['solves','lineFormations','measuredLeaves','nodeCreates'])assert.equal(after[key],before[key],key);
  if(!fixture.name.endsWith('-resized'))previous={fixture,state:await state(),diagnostics:after};
 }
 assert.ok(catalogUrls.length,'Replay observes the served Studio catalog');
 for(const url of catalogUrls){
  assert.ok(decodeURIComponent(new URL(url).pathname).endsWith(resolve(dirname(fileURLToPath(import.meta.url)),'../packages/scenarios/src/learning-catalog.ts').replaceAll('\\','/')));
  const response=await page.request.get(url);assert.ok(response.ok());
  const match=(await response.text()).match(/slug:\s*["']wasm-yoga-migration["'][\s\S]*?canvas:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
  assert.ok(match);assert.deepEqual([Number(match[1]),Number(match[2])],[760,540]);
 }
 const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_YOGA_REHEARSAL_PROOF__);
 assert.deepEqual(proof?.fixtureSource,{version:reference.version,commit:reference.commit,licenseSha256:reference.licenseSha256,probeSha256:reference.probeSha256});
 assert.deepEqual(proof.caseNames,reference.cases.map(value=>value.name));
 if(!built){assert.equal(proof.mode,'source');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/src/')));}
 if(built){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
 const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
 assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.deepEqual(errors,[]);
 console.warn(JSON.stringify({base,cases:cases.map(value=>value.name),coreInputs:proof?.coreInputs.length??null,builtInputs:built?proof?.coreInputs.length??null:null,catalogUrls,cleanup:[0,0,0],errors}));
}finally{await browser.close();}
