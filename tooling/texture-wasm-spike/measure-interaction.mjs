import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';

const verifyOnly=process.argv.includes('--verify-only');
const output=(verifyOnly?undefined:process.argv[2])??'/private/tmp/crc-texture-interaction-results.json';
const browser=await chromium.launch({headless:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  const page=await browser.newPage({viewport:{width:1200,height:950},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:4381');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
  assert.match(await page.title(),/interactive texture WASM/);
  assert.match(await page.locator('h1').innerText(),/Paint/);
  // Genuine browser mouse events exercise CRC hit testing, interpolation and capture.
  for(const mode of ['current-js','wasm-direct']) {
    await page.evaluate(mode=>window.interactive.start({mode,width:128,height:96,steps:8,paused:true,quiet:true}),mode);
    await page.waitForFunction(()=>window.interactive.report().frames.count>0);
    await page.evaluate(()=>{window.beforeStroke=window.interactive.snapshot();});
    const box=await page.locator('#paint-canvas').boundingBox();
    await page.mouse.move(box.x+80,box.y+70);
    await page.mouse.down();
    for(const [x,y] of [[200,130],[400,220],[700,280],[box.width+20,300]]) await page.mouse.move(box.x+x,box.y+y);
    assert.equal(await page.evaluate(()=>window.interactive.report().captured),true,'capture should survive leaving the surface');
    await page.mouse.move(box.x+500,box.y+240);
    await page.mouse.up();
    await page.waitForFunction(()=>window.interactive.report().pending===0&&window.interactive.report().completed>0);
    const check=await page.evaluate(mode=>{
      const current=window.interactive.snapshot(),report=window.interactive.report();
      const changed=current.b.some((v,i)=>v!==window.beforeStroke.b[i]);
      const visibleChange=current.pixels.some((v,i)=>v!==window.beforeStroke.pixels[i]);
      let parity=true;
      if(mode==='current-js')window.referenceStroke=current;
      else parity=['a','b','pixels'].every(key=>current[key].every((v,i)=>v===window.referenceStroke[key][i]));
      return {changed,visibleChange,parity,report};
    },mode);
    assert.equal(check.changed,true);assert.equal(check.visibleChange,true);assert.equal(check.parity,true);
    assert.equal(check.report.captured,false);assert.equal(check.report.stamps,check.report.applied);assert.equal(check.report.dropped,0);
    await page.mouse.move(box.x+100,box.y+100);
    assert.equal(await page.evaluate(()=>window.interactive.report().routed),check.report.routed,'hover after release must not paint');
  }
  await page.evaluate(()=>window.interactive.stop());
  await page.locator('#paused').check();
  await page.getByRole('button',{name:'Start / reset painting'}).click();
  await page.waitForFunction(()=>window.interactive.report().frames.count>0);
  const desktopBox=await page.locator('#paint-canvas').boundingBox();
  await page.mouse.move(desktopBox.x+100,desktopBox.y+80);await page.mouse.down();
  await page.mouse.move(desktopBox.x+600,desktopBox.y+250);await page.mouse.up();
  await page.waitForFunction(()=>window.interactive.report().completed>0);
  await page.screenshot({path:'/private/tmp/crc-texture-interaction-desktop.png'});
  await page.evaluate(()=>window.interactive.stop());
  // UI control path, including a narrow viewport and brush control.
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Start / reset painting'}).click();
  await page.locator('#paused').check();
  await page.locator('#backend').selectOption('current-js');
  await page.locator('#workload').selectOption('32,32,1');
  await page.locator('#radius').fill('12');
  await page.waitForFunction(()=>window.interactive.report().frames.count>0);
  const mobileBox=await page.locator('#paint-canvas').boundingBox();
  assert.ok(mobileBox.x+mobileBox.width<=390);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile controls must not cause horizontal overflow');
  await page.mouse.move(mobileBox.x+60,mobileBox.y+40);await page.mouse.down();
  await page.mouse.move(mobileBox.x+180,mobileBox.y+75);await page.mouse.up();
  await page.waitForFunction(()=>window.interactive.report().completed>0);
  await page.screenshot({path:'/private/tmp/crc-texture-interaction-mobile.png'});
  await page.evaluate(()=>window.interactive.stop());
  assert.deepEqual(errors,[]);
  console.warn('Verified painted field/pixel parity, capture outside bounds, release, pause, engine/workload/brush controls, mobile layout.');
  if(!verifyOnly) {
    await page.setViewportSize({width:1200,height:950});
    const cdp=await page.context().newCDPSession(page);
    const results=[];
    const rounds=3, moves=120, interval=1000/60;
    for(let round=0;round<rounds;round++)for(const [width,height,steps] of [[32,32,1],[512,512,8],[512,512,24]]) {
      for(const mode of round%2?['wasm-direct','current-js']:['current-js','wasm-direct']) {
        await page.evaluate(options=>window.interactive.start({...options,quiet:true}),{mode,width,height,steps});
        await page.waitForFunction(()=>window.interactive.report().frames.count>=30);
        await page.evaluate(()=>window.interactive.resetMetrics());
        const box=await page.locator('#paint-canvas').boundingBox();
        const point=i=>({x:box.x+60+(i/(moves-1))*(box.width-120),y:box.y+box.height*.5+Math.sin(i/(moves-1)*Math.PI*4)*box.height*.28});
        const press=point(0);
        await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...press,button:'left',buttons:1,clickCount:1,timestamp:Date.now()/1000});
        const started=performance.now(),promises=[],sent=[];
        // Wall-clock paced from Node, not the page's blocked event loop. Do not
        // await each dispatch; that would turn main-thread stalls into slower input.
        for(let i=0;i<moves;i++) {
          const deadline=started+i*interval;
          await sleep(Math.max(0,deadline-performance.now()));
          const timestamp=Date.now()/1000;
          sent.push({i,lateByMs:performance.now()-deadline,timestamp});
          promises.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point(i),button:'left',buttons:1,timestamp}));
        }
        await Promise.all(promises);
        await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...point(moves-1),button:'left',buttons:0,clickCount:1,timestamp:Date.now()/1000});
        await page.waitForFunction(()=>window.interactive.report().pending===0&&!window.interactive.report().captured);
        const report=await page.evaluate(()=>window.interactive.report());
        assert.equal(report.clockErrors,0,'input timestamps must share the performance clock');
        assert.equal(report.errors,0);assert.equal(report.dropped,0);assert.equal(report.stamps,report.applied);
        assert.ok(report.completed>0);
        results.push({round,...report,injectedMoves:moves,injectedPointerSamples:moves+1,sent});
        await page.evaluate(()=>window.interactive.stop());
        console.warn(`Round ${round+1} ${mode} ${width}×${height}/${steps}: event→frame median ${report.inputToFrame.median.toFixed(2)} ms, p95 ${report.inputToFrame.p95.toFixed(2)} ms; ${report.routed}/${moves+1} pointer samples routed`);
      }
    }
    assert.deepEqual(errors,[]);
    const sourceHashes={};
    for(const name of ['kernel.asc','kernel.wasm','runtime.mjs','interactive.mjs','browser.mjs','measure-interaction.mjs','./reference-simulation.ts','../../packages/core/src/lib/render-layer/controller.ts'])sourceHashes[name]=createHash('sha256').update(await readFile(new URL(name,import.meta.url))).digest('hex');
    const report={timestamp:new Date().toISOString(),environment:{node:process.version,platform:os.platform(),arch:os.arch(),cpu:os.cpus()[0].model,browser:browser.version()},rounds,moves,inputHz:60,display:'832x400@1',endpoint:'End of CRC synchronous frame, after Complete; excludes physical presentation',sourceHashes,results};
    await writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.warn(`Saved ${results.length} interactive cases to ${output}`);
  }
} finally {await browser.close();}
