import {crc,createElement,defineRenderLayer} from '../../packages/core/src/index.ts';
import {ManualSchedulerDriver,installSchedulerDriverForTest} from '../../packages/core/src/lib/scheduler/testing.ts';
import {materialField} from './reference-material-field.ts';
import {TextureRaster} from './reference-presentation.ts';
import {paletteLut} from '../../packages/textures/src/lib/palette.ts';
import {WasmMaterial,MatchedMaterial} from './materials-runtime.mjs';
import {createControl} from './materials-control.mjs';
const bytes=await (await fetch('./materials.wasm')).arrayBuffer(),compileStart=performance.now();
const module=await WebAssembly.compile(bytes),compileMs=performance.now()-compileStart;
const palettes={marble:['#f7f2e8','#cfc5b4','#757f83','#273b45'],paper:['#faf5e9','#e1d1b5','#b39574'],cellular:['#0b252c','#276065','#94c1a0','#edf1c4']};
function resource(mode,size,kind,quality) {
  const lut=paletteLut(palettes[kind]);
  const generator=mode==='wasm'?new WasmMaterial(module,size,size):mode==='matched-js'?new MatchedMaterial(createControl,size,size):null;
  const raster=mode==='wasm'?null:new TextureRaster(size,size);
  const surface=raster?.surface??new OffscreenCanvas(size,size),context=surface.getContext('2d');
  const pixels=mode==='wasm'?new ImageData(generator.pixels,size,size):null;
  if(pixels&&pixels.data.buffer!==generator.memory.buffer)throw new Error('Unexpected pixel copy');
  if(mode==='wasm')generator.lut.set(lut);
  return {generator,surface,field:null,
    generate(seed,scale,detail) {this.field=generator?generator.generate(kind,seed,scale,detail,quality):materialField(size,size,kind,seed,scale,detail);},
    upload() {if(raster)raster.update(this.field,lut);else {generator.colorize();context.putImageData(pixels,0,0);}},
    dispose() {generator?.dispose();raster?.dispose();surface.width=surface.height=0;this.field=null;},
  };
}
function makeLayer(mode,size,kind,quality,timing) {
  return defineRenderLayer({
    create(_context,props) {return {...resource(mode,size,kind,quality),props,key:`${props.seed}/${props.scale}/${props.detail}`,dirty:true};},
    update(r,props) {const key=`${props.seed}/${props.scale}/${props.detail}`;if(r.key!==key){r.key=key;r.dirty=true;}r.props=props;},
    render(r,_frame,context) {
      if(r.dirty) {
        const start=performance.now();r.generate(r.props.seed,r.props.scale,r.props.detail);
        const generated=performance.now();r.upload();
        timing.generate=generated-start;timing.rasterUpload=performance.now()-generated;timing.generations=(timing.generations??0)+1;
        r.dirty=false;
      }
      const output=context.canvas.getContext('2d');output.clearRect(0,0,context.size.backingWidth,context.size.backingHeight);
      const tiles=r.props.tiles??1,tw=context.size.backingWidth/tiles,th=context.size.backingHeight/tiles;
      for(let y=0;y<tiles;y++)for(let x=0;x<tiles;x++)output.drawImage(r.surface,x*tw,y*th,tw,th);
    },
    dispose(r) {r.dispose();},
  });
}
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return{median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],samples:values};};
let previews=[];
function stop(){for(const p of previews)p.dispose();previews=[];}
window.materials={
  stop,
  async benchmark({rounds=3,samples=12,warmup=4,sizes=[64,256,512,1024],qualities=[0,1],kinds=['marble','paper','cellular']}={}) {
    stop();const results=[];
    for(let round=0;round<rounds;round++)for(const quality of qualities)for(const kind of kinds)for(const size of sizes) {
      const modes=quality?['matched-js','wasm']:['current-js','matched-js','wasm'];
      for(let index=0;index<modes.length;index++) {
        const caseSamples=size===1024?Math.min(samples,6):samples,caseWarmup=size===1024?Math.min(warmup,2):warmup;
        const mode=modes[(index+round)%modes.length],driver=new ManualSchedulerDriver(),restore=installSchedulerDriverForTest(driver);
        const canvas=document.createElement('canvas');canvas.width=832;canvas.height=400;document.querySelector('#bench-host').append(canvas);
        const timing={},Layer=makeLayer(mode,size,kind,quality,timing);let controller,tick=0;
        const scene=(seed,detail=.65)=>createElement(Layer,{seed,scale:6,detail,style:{width:832,height:400}});
        try {
          const start=performance.now();controller=crc(canvas,scene(42),{pixelRatio:1});driver.flush(tick++*16.667);
          const firstGenerationMs=performance.now()-start,firstKernelMs=timing.generate;
          const update=i=>{crc(canvas,scene(42+i,.45+(i%10)*.045));driver.flush(tick++*16.667);};
          for(let i=0;i<caseWarmup;i++)update(i+1);
          const total=[],generate=[],rasterUpload=[];
          for(let i=0;i<caseSamples;i++) {const t=performance.now();update(caseWarmup+i+1);total.push(performance.now()-t);generate.push(timing.generate);rasterUpload.push(timing.rasterUpload);}
          const before=timing.generations;update(caseWarmup+caseSamples);
          if(timing.generations!==before||driver.pendingHostFrames!==0)throw new Error('Unchanged material regenerated or scheduled another frame');
          results.push({round,quality,kind,size,mode,samples:caseSamples,warmup:caseWarmup,firstGenerationMs,firstKernelMs,total:summarize(total),generate:summarize(generate),rasterUpload:summarize(rasterUpload)});
          document.querySelector('#status').textContent=`Round ${round+1}: ${kind}, ${size}², ${quality?'enhanced':'current'}, ${mode}`;
        } finally {controller?.dispose();restore();canvas.remove();}
        if(index===modes.length-1)console.warn(`Measured round ${round+1}: ${kind} ${size}² ${quality?'enhanced':'current'}`);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    return {compileMs,wasmBytes:bytes.byteLength,rounds,samples,warmup,sizes,qualities,display:'832x400@1',results};
  },
  async preview() {
    stop();document.querySelector('#gallery').replaceChildren();
    const kind=document.querySelector('#kind').value,size=Number(document.querySelector('#resolution').value),seed=Number(document.querySelector('#seed').value),mode=document.querySelector('#engine').value;
    const detail=Number(document.querySelector('#detail').value),scale=Number(document.querySelector('#scale').value);
    for(const quality of [0,1]) {
      const section=document.createElement('section'),heading=document.createElement('h2'),canvas=document.createElement('canvas');
      heading.textContent=quality?'Enhanced recipe':'Current recipe';canvas.width=512;canvas.height=512;
      const caption=document.createElement('p');caption.style.maxWidth='512px';caption.textContent=quality?({marble:'Finer veins, secondary hairlines and mineral clouds; four samples per pixel smooth the thin detail.',paper:'Layered fibers, finer grain and subtle relief.',cellular:'Beveled cells, directional shading and fine mottling.'})[kind]:'The shipped recipe, at the same resolution and with the same palette.';
      section.append(heading,canvas,caption);document.querySelector('#gallery').append(section);
      const timing={},Layer=makeLayer(mode,size,kind,quality,timing);
      previews.push(crc(canvas,createElement(Layer,{seed,scale,detail,tiles:document.querySelector('#tiles').checked?2:1,style:{width:512,height:512}}),{pixelRatio:1}));
    }
    document.querySelector('#status').textContent=`${kind} · ${size}×${size} · ${mode}${size>512?' · experimental resolution above the public 262,144-cell limit':''}`;
  },
  verify() {
    const report=[];
    for(const kind of ['marble','paper','cellular']) {
      const baseline=resource('current-js',128,kind,0);baseline.generate(42,6,.65);baseline.upload();
      const expected=baseline.surface.getContext('2d').getImageData(0,0,128,128).data;
      for(const mode of ['matched-js','wasm']) {
        const candidate=resource(mode,128,kind,0);candidate.generate(42,6,.65);candidate.upload();
        let maxFieldError=0,maxPixelError=0;
        for(let i=0;i<baseline.field.length;i++)maxFieldError=Math.max(maxFieldError,Math.abs(baseline.field[i]-candidate.field[i]));
        const actual=candidate.surface.getContext('2d').getImageData(0,0,128,128).data;
        for(let i=0;i<actual.length;i++)maxPixelError=Math.max(maxPixelError,Math.abs(actual[i]-expected[i]));
        if(maxFieldError>1e-6||maxPixelError>1)throw new Error(`${kind}/${mode} parity failed: ${maxFieldError}/${maxPixelError}`);
        report.push({kind,mode,maxFieldError,maxPixelError});candidate.dispose();
      }
      baseline.dispose();
    }
    for(const kind of ['marble','paper','cellular']) {
      const a=resource('matched-js',128,kind,1),b=resource('wasm',128,kind,1);
      a.generate(42,6,.65);b.generate(42,6,.65);a.upload();b.upload();
      let maxFieldError=0,maxPixelError=0;
      for(let i=0;i<a.field.length;i++)maxFieldError=Math.max(maxFieldError,Math.abs(a.field[i]-b.field[i]));
      const pa=a.surface.getContext('2d').getImageData(0,0,128,128).data,pb=b.surface.getContext('2d').getImageData(0,0,128,128).data;
      for(let i=0;i<pa.length;i++)maxPixelError=Math.max(maxPixelError,Math.abs(pa[i]-pb[i]));
      if(maxFieldError>1e-6||maxPixelError>1)throw new Error(`${kind} enhanced parity failed`);
      report.push({kind,quality:1,maxFieldError,maxPixelError});a.dispose();b.dispose();
    }
    return report;
  },
};
for(const id of ['kind','resolution','seed','engine','detail','scale','tiles'])document.querySelector(`#${id}`).onchange=()=>window.materials.preview();
document.querySelector('#render').onclick=()=>window.materials.preview();
document.querySelector('#benchmark').onclick=async()=>{
  document.querySelector('#controls').disabled=true;
  try {const result=await window.materials.benchmark();document.querySelector('#results').textContent=JSON.stringify(result,null,2);}
  finally {document.querySelector('#controls').disabled=false;}
};
document.querySelector('#status').textContent='Ready';
