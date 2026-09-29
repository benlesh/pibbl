import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const [baseline, dir, workload = "query", calibrationDirectory] = process.argv.slice(2);
if (!["query", "plain", "field", "whole", "frame-plain", "frame-field", "frame-whole", "frame-query"].includes(workload)) throw new Error("Unknown workload");
if (!baseline || !dir) throw new Error('Usage: node tooling/benchmark-responsive-preparation.mjs BASELINE_CORE_SRC OUTPUT_DIRECTORY [query|plain|field|whole]');
const priorCalibration = calibrationDirectory ? JSON.parse(await readFile(`${calibrationDirectory}/artifacts.json`, "utf8")) : undefined;
const candidate = `${process.cwd()}/packages/core/src`;
const entry = (root, queried) => `
import { resolvePrimitiveStyleInput } from '${root}/lib/element/resolve-primitive-inputs.ts';
import { signal } from '${root}/index.ts';
window.run = () => {
  let reads = 0;
  const base = signal(2), patch = signal(3);
  for (const s of [base, patch]) { const get = s.get; s.get = () => { reads++; return get(); }; }
  const basis = {width:700,height:160};
  const source = ${workload === "plain" ? "{width:3,height:4}" : workload === "field" ? "{width:base,height:4}" : workload === "whole" ? "signal({width:2,height:4})" : queried ? '{width:base, height:4, when:[{query:{minWidth:600},style:{width:patch}}]}' : '{width:base,height:4}'};
${workload === "whole" ? "const wholeGet=source.get; source.get=()=>{reads++;return wholeGet();};" : ""}
  let checksum = 0;
  function update() { for(let i=0;i<1000;i++) { const raw = ${workload !== 'query' || queried ? 'resolvePrimitiveStyleInput(source,undefined,basis)' : '(() => { const result={width:base.get(),height:4}; if(basis.width>=600) result.width=patch.get(); return result; })()'}; const selected = ${queried ? 'raw.style ?? raw' : 'raw'}; checksum += selected.width + selected.height; } }
  const setupStart=performance.now(); update(); const setupMs=performance.now()-setupStart;
  checksum=0; reads=0;
  for(let i=0;i<100;i++) update();
  const samples=[];
  for(let b=0;b<200;b++) { const start=performance.now(); for(let i=0;i<20;i++) update(); samples.push((performance.now()-start)/20); }
  if(checksum!==${workload === "field" || workload === "whole" ? 24600000 : 28700000} || reads!==${workload === "query" ? 8200000 : workload === "plain" ? 0 : 4100000}) throw new Error(JSON.stringify({checksum,reads}));
  const sorted=[...samples].sort((a,b)=>a-b);
  let tickStart=performance.now(), tick; while(!(tick=performance.now()-tickStart)) {}
  return {samples,median:sorted[100],p95:sorted[190],checksum,reads,setupMs,tick};
};`;
const frameEntry = (root) => `
import { crc, createElement, Rectangle, signal } from '${root}/index.ts';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '${root}/lib/scheduler/testing.ts';
import { signalGraphSnapshot } from '${root}/lib/signals/graph.ts';
window.run = () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width=1000;canvas.height=640;
  canvas.style.width='1000px';canvas.style.height='640px';document.body.append(canvas);
  const position=signal(0), whole=signal({x:0,y:0,width:1,height:1,fill:'black'});
  let next=0;
  const kind=${JSON.stringify(workload.slice(6))};
  function Root() {
    const value=kind==='plain'?position.get():0;
    return Array.from({length:1000},(_,index)=>createElement(Rectangle,{key:index,style:
      kind==='whole'?whole:kind==='field'?{x:position,y:index%640,width:1,height:1,fill:'black'}:{x:index,y:value%640,width:1,height:1,fill:'black'}}));
  }
  const setupStart=performance.now();const controller=crc(canvas,createElement(Root,{}),{pixelRatio:1});driver.flush(0);
  const setupMs=performance.now()-setupStart;
  function update(){next++;if(kind==='whole')whole.set({x:next%1000,y:0,width:1,height:1,fill:'black'});else position.set(next%1000);driver.flush(next);}
  for(let i=0;i<100;i++)update();
  const samples=[];
  for(let b=0;b<200;b++){const start=performance.now();for(let i=0;i<20;i++)update();samples.push((performance.now()-start)/20);}
  const ownership=signalGraphSnapshot();
  const expectedEdges=kind==='plain'?1:1000;
  if(ownership.rendererEdges!==expectedEdges||ownership.rendererConsumers!==expectedEdges||driver.pendingHostFrames!==0)throw new Error('Unexpected ownership '+JSON.stringify(ownership));
  const data=canvas.getContext('2d').getImageData(0,0,1000,640).data;
  let checksum=2166136261;
  for(let i=0;i<data.length;i+=4){
    const x=(i/4)%1000,y=Math.floor(i/4000),last=next%1000;
    const painted=kind==='plain'?y===last%640:kind==='field'?x===last:x===last&&y===0;
    if(data[i]!==0||data[i+1]!==0||data[i+2]!==0||data[i+3]!==Number(painted)*255)throw new Error('Unexpected pixel at '+x+','+y);
    for(let c=0;c<4;c++)checksum=Math.imul(checksum^data[i+c],16777619)>>>0;
  }
  controller.dispose();const after=signalGraphSnapshot();
  if(after.rendererEdges!==0||after.rendererConsumers!==0||after.receiverInputProvisions!==0||driver.pendingHostFrames!==0)throw new Error('Leaked ownership');
  restore();canvas.remove();
  const sorted=[...samples].sort((a,b)=>a-b);let tickStart=performance.now(),tick;while(!(tick=performance.now()-tickStart)){}
  return {samples,median:sorted[100],p95:sorted[190],checksum,setupMs,tick,ownership:{edges:ownership.rendererEdges,consumers:ownership.rendererConsumers},cleanup:{edges:after.rendererEdges,consumers:after.rendererConsumers}};
};`;
const queryFrameEntry = (root, queried) => `
import { crc, createElement, Rectangle, definePrimitive, signal } from '${root}/index.ts';
import { getPrimitiveDefinition } from '${root}/lib/element/metadata.ts';
import { getLayoutBox } from '${root}/lib/layout/context.ts';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '${root}/lib/scheduler/testing.ts';
import { signalGraphSnapshot } from '${root}/lib/signals/graph.ts';
window.run = () => {
  const driver=new ManualSchedulerDriver(),restore=installSchedulerDriverForTest(driver);
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=640;
  canvas.style.width='1000px';canvas.style.height='640px';document.body.append(canvas);
  const position=signal(0),baseWidth=signal(0),matchedWidth=signal(1);
  let baseReads=0,matchedReads=0,next=0;
  const baseGet=baseWidth.get,matchedGet=matchedWidth.get;
  baseWidth.get=()=>{baseReads++;return baseGet();};matchedWidth.get=()=>{matchedReads++;return matchedGet();};
  const when=[{query:{minWidth:600},style:{width:matchedWidth}}];
  const metadata=getPrimitiveDefinition(Rectangle);
  const Box=definePrimitive(metadata.render,{
    ...metadata,
    normalizeStyle(style){
      ${queried ? 'return style;' : 'const selected={...style};if(getLayoutBox().width>=600)selected.width=matchedWidth.get();return selected;'}
    },
  });
  function Root(){const value=position.get();return Array.from({length:1000},(_,index)=>createElement(Box,{key:index,style:{x:index,y:value%640,width:baseWidth,height:1,fill:'black'${queried ? ',when' : ''}}}));}
  const setupStart=performance.now();const controller=crc(canvas,createElement(Root,{}),{pixelRatio:1});driver.flush(0);const setupMs=performance.now()-setupStart;
  function update(){next++;position.set(next%1000);driver.flush(next);}
  for(let i=0;i<100;i++)update();
  const samples=[];
  for(let b=0;b<200;b++){const start=performance.now();for(let i=0;i<20;i++)update();samples.push((performance.now()-start)/20);}
  const ownership=signalGraphSnapshot();
  if(ownership.rendererEdges!==2001||ownership.rendererConsumers!==1001||driver.pendingHostFrames!==0||baseReads!==4101000||matchedReads!==4101000)throw new Error('Read/ownership mismatch '+JSON.stringify({ownership,baseReads,matchedReads}));
  const data=canvas.getContext('2d').getImageData(0,0,1000,640).data;let checksum=2166136261;
  for(let i=0;i<data.length;i+=4){const y=Math.floor(i/4000),painted=y===(next%1000)%640;if(data[i]!==0||data[i+1]!==0||data[i+2]!==0||data[i+3]!==Number(painted)*255)throw new Error('Wrong pixel '+i);for(let c=0;c<4;c++)checksum=Math.imul(checksum^data[i+c],16777619)>>>0;}
  controller.dispose();const after=signalGraphSnapshot();if(after.rendererEdges!==0||after.rendererConsumers!==0||after.receiverInputProvisions!==0||driver.pendingHostFrames!==0)throw new Error('Leaked ownership');restore();canvas.remove();
  const sorted=[...samples].sort((a,b)=>a-b);let tickStart=performance.now(),tick;while(!(tick=performance.now()-tickStart)){}
  return {samples,median:sorted[100],p95:sorted[190],checksum,baseReads,matchedReads,setupMs,tick,ownership:{edges:ownership.rendererEdges,consumers:ownership.rendererConsumers},cleanup:{edges:after.rendererEdges,consumers:after.rendererConsumers}};
};`;
const hashes={};
for(const [letter,root,queried] of [['A',baseline,false],['B',baseline,false],['C',candidate,true]]) {
 const output=`${dir}/${letter}.js`;
 await build({stdin:{contents:workload === "frame-query" ? queryFrameEntry(root,queried) : workload.startsWith("frame-") ? frameEntry(root) : entry(root,queried),resolveDir:root,loader:'ts'},bundle:true,minify:true,format:'iife',platform:'browser',outfile:output,define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false'}});
 hashes[letter]=createHash('sha256').update(await readFile(output)).digest('hex');
}
if(hashes.A!==hashes.B)throw new Error('Calibration requires identical independently built baseline artifacts');
const workloadName=workload === "query" ? "preparation-1000-receivers-one-width-rule-one-match" : `${workload.startsWith("frame-") ? "full" : "preparation"}-1000-${workload}`;
if(priorCalibration && (priorCalibration.hashes.A!==hashes.A || priorCalibration.hashes.B!==hashes.B || priorCalibration.workload!==workloadName || priorCalibration.node!==process.version))throw new Error('Frozen calibration does not match baseline artifacts, workload, or Node version');
await writeFile(`${dir}/artifacts.json`,JSON.stringify({hashes,baselineArchive:'cab31508006e2f947400a74db43b273526e8f2d29eaed332e98c0c75bce32eec',node:process.version,workload:workloadName,warmups:100,batches:200,updatesPerBatch:20},null,2));
const records=calibrationDirectory ? JSON.parse(await readFile(`${calibrationDirectory}/samples.json`,'utf8')).filter(record=>record.phase==='calibration') : [];
if(calibrationDirectory && records.length!==3)throw new Error('Frozen calibration requires all three sessions');
let outputChecksum;
let envelope=calibrationDirectory ? JSON.parse(await readFile(`${calibrationDirectory}/frozen-envelope.json`,'utf8')) : undefined;
if(envelope)await writeFile(`${dir}/frozen-envelope.json`,JSON.stringify(envelope,null,2));
for(const phase of calibrationDirectory ? ['candidate'] : ['calibration','candidate']) {
 for(let session=0;session<3;session++) {
  const browser=await chromium.launch({headless:true});
  if(calibrationDirectory && records[0].browser!==browser.version())throw new Error('Browser version differs from frozen calibration');
  const record={phase,session,browser:browser.version(),runs:[]};
  for(const letter of phase==='calibration'?['A','B','B','A']:['A','C','C','A']) {
   const page=await browser.newPage({viewport:{width:1000,height:640},deviceScaleFactor:1});
   await page.addScriptTag({path:`${dir}/${letter}.js`});
   const result=await page.evaluate(()=>window.run());
   outputChecksum ??= result.checksum;
   if(result.checksum!==outputChecksum)throw new Error('Paired output checksum mismatch');
   record.runs.push({letter,...result});
   await page.close();
  }
  await browser.close();
  record.delta=Object.fromEntries(['median','p95'].map(key=>[key,(record.runs[1][key]+record.runs[2][key]-record.runs[0][key]-record.runs[3][key])/2]));
  records.push(record);
  await writeFile(`${dir}/samples.json`,JSON.stringify(records,null,2));
  process.stdout.write(`${JSON.stringify({phase,session,delta:record.delta,envelope})}\n`);
 }
 if(phase==='calibration') {
  envelope=Object.fromEntries(['median','p95'].map(key=>[key,Math.max(...records.map(r=>Math.abs(r.delta[key])),...records.flatMap(r=>r.runs.map(x=>x.tick/20)))]));
  await writeFile(`${dir}/frozen-envelope.json`,JSON.stringify(envelope,null,2));
 }
}
