import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
const verifyOnly = process.argv.includes('--verify-only');
const output = (verifyOnly ? undefined : process.argv[2]) ?? '/private/tmp/crc-texture-wasm-results.json';
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:1});
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4381');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  const report=verifyOnly ? {results:[]} : await page.evaluate(()=>window.runBenchmark());
  if(errors.length)throw new Error(errors.join('\n'));
  report.environment={node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,browser:browser.version()};
  report.timestamp=new Date().toISOString();
  report.sourceHashes={};
  for(const path of ['kernel.asc','kernel.wasm','runtime.mjs','browser.mjs','./reference-simulation.ts','./reference-presentation.ts']) report.sourceHashes[path]=createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
  if (!verifyOnly) await writeFile(output,JSON.stringify(report,null,2)+'\n');
  await page.locator('details').evaluate(element=>{element.open=true;});
  await page.getByRole('button',{name:'Run live comparison'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#previews canvas').length===2);
  await page.waitForTimeout(1200);
  await page.screenshot({path:'/private/tmp/crc-texture-wasm-preview.png'});
  const pixelsMatch = await page.evaluate(()=>{
    window.stopPreview();
    const canvases=[...document.querySelectorAll('#previews canvas')];
    const images=canvases.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);
    return images[0].some(value=>value!==0) && images[0].every((value,i)=>value===images[1][i]);
  });
  if (!pixelsMatch) throw new Error('Live CRC output parity failed');
  if(errors.length)throw new Error(errors.join('\n'));
  console.warn(verifyOnly ? 'Live CRC output: exact nonempty pixel parity; no page errors' : `Saved ${report.results.length} measurements to ${output}; live pixel parity passed`);
} finally {await browser.close();}
