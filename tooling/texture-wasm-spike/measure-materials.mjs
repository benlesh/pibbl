import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import assert from 'node:assert/strict';
const isolate=process.argv.includes('--isolate');
const quick=process.argv.includes('--quick'),verifyOnly=process.argv.includes('--verify-only');
const output=process.argv.slice(2).find(x=>!x.startsWith('--'))??`/private/tmp/pibbl-materials-${isolate?'isolated':quick?'quick':'results'}.json`;
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:1050},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());else if(message.text().startsWith('Measured round'))console.warn(message.text());});
  await page.goto('http://127.0.0.1:4381/materials');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.title(),/material generation/);
  const parity=await page.evaluate(()=>window.materials.verify());
  console.warn('Browser material field and pixel parity:',JSON.stringify(parity));
  let result;
  if(isolate) {
    result={results:[],isolation:'One recipe per fresh page; no parity warmup in those pages'};
    for(const kind of ['marble','paper','cellular']) {
      await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
      const report=await page.evaluate(kind=>window.materials.benchmark({rounds:3,samples:12,warmup:8,sizes:[512],qualities:[0],kinds:[kind]}),kind);
      result.results.push(...report.results);
    }
  } else if(!verifyOnly)result=await page.evaluate(options=>window.materials.benchmark(options),quick?{rounds:1,samples:4,warmup:2,sizes:[256,512]}:{});
  for(const kind of ['marble','paper','cellular']) {
    await page.locator('#kind').selectOption(kind);
    await page.getByRole('button',{name:'Render comparison'}).click();
    await page.waitForTimeout(300);
    await page.screenshot({path:`/private/tmp/pibbl-material-${kind}.png`,fullPage:true});
  }
  await page.locator('#engine').selectOption('matched-js');
  await page.locator('#seed').fill('1234');await page.locator('#seed').press('Tab');
  await page.locator('#tiles').check();
  await page.waitForTimeout(300);
  await page.screenshot({path:'/private/tmp/pibbl-material-tiled.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/private/tmp/pibbl-material-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  if(result) {
    result.parity=parity;result.timestamp=new Date().toISOString();
    result.environment={node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,browser:browser.version()};
    result.sourceHashes={};
    for(const name of ['materials.asc','materials.wasm','materials-control.mjs','materials-runtime.mjs','materials-browser.mjs','./reference-material-field.ts'])result.sourceHashes[name]=createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex');
    await writeFile(output,JSON.stringify(result,null,2)+'\n');
    console.warn(`Saved ${result.results.length} material cases to ${output}`);
  } else console.warn('Verified material parity, controls, screenshots and mobile layout.');
}finally {await browser.close();}
