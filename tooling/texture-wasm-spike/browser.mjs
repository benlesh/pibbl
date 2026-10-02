import { InkSimulation } from './reference-simulation.ts';
import { TextureRaster } from './reference-presentation.ts';
import { paletteLut, texturePalettes } from '../../packages/textures/src/lib/palette.ts';
import { crc, createElement, defineRenderLayer } from '../../packages/core/src/index.ts';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../../packages/core/src/lib/scheduler/testing.ts';
import { WasmSimulation } from './runtime.mjs';
import { OptimizedSimulation } from './optimized.mjs';
import { installInteractive } from './interactive.mjs';

const lut = paletteLut(texturePalettes.lagoon);
const coldStart = performance.now();
const bytes = await (await fetch('./kernel.wasm')).arrayBuffer();
const compileStart = performance.now();
const module = await WebAssembly.compile(bytes);
const compileMs = performance.now() - compileStart;
const fetchAndCompileMs = performance.now() - coldStart;
const modes = ['current-js', 'optimized-js', 'wasm-direct', 'wasm-copy'];
function resources(mode, width, height) {
  const initial = new (mode === 'optimized-js' ? OptimizedSimulation : InkSimulation)(width, height, 42, 'spots');
  let simulation, raster, pixels, surface, context;
  if (mode.startsWith('wasm')) {
    simulation = new WasmSimulation(module, initial);
    initial.dispose();
    simulation.setPalette(lut);
    pixels = mode === 'wasm-copy' ? new ImageData(width, height) : new ImageData(simulation.pixels, width, height);
    if (mode === 'wasm-direct' && pixels.data.buffer !== simulation.memory.buffer) throw new Error('ImageData copied WASM memory');
    surface = new OffscreenCanvas(width, height);
    context = surface.getContext('2d');
  } else {
    simulation = initial;
    raster = new TextureRaster(width, height);
    surface = raster.surface;
  }
  return {
    simulation, surface,
    update() {
      if (raster) raster.update(simulation.b, lut, 2.5);
      else {
        simulation.colorize(2.5);
        if (mode === 'wasm-copy') pixels.data.set(simulation.pixels);
        context.putImageData(pixels, 0, 0);
      }
    },
    dispose() { simulation.dispose(); raster?.dispose(); surface.width = surface.height = 0; },
  };
}
function layer(mode, w, h, steps, timing) {
  return defineRenderLayer({
    create() { return resources(mode, w, h); },
    render(r, frame, context) {
      const start = performance.now();
      r.simulation.advance(steps);
      const solved = performance.now();
      r.update();
      const uploaded = performance.now();
      const out = context.canvas.getContext('2d');
      out.clearRect(0, 0, context.size.backingWidth, context.size.backingHeight);
      out.drawImage(r.surface, 0, 0, context.size.backingWidth, context.size.backingHeight);
      timing.solver = solved - start;
      timing.rasterUpload = uploaded - solved;
      frame.invalidate();
    },
    dispose(r) { r.dispose(); },
  });
}
const stats = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return {median: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)], mean: values.reduce((a,b)=>a+b,0)/values.length, samples: values};
};

window.runBenchmark = async ({rounds = 3, samples = 80, warmup = 30} = {}) => {
  const results = [];
  const workloads = [[32,32,1], [128,128,1], [128,128,8], [256,144,8], [256,256,8], [512,512,8], [512,512,24]];
  for (let round = 0; round < rounds; round++) {
    for (const [width,height,steps] of workloads) {
      // Rotate order between rounds to reduce systematic thermal/tiering bias.
      for (let k = 0; k < modes.length; k++) {
        const mode = modes[(k + round) % modes.length];
        const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
        const canvas = document.createElement('canvas'); canvas.width = 832; canvas.height = 400;
        document.body.append(canvas);
        const timing = {}, Layer = layer(mode,width,height,steps,timing);
        let controller;
        try {
          const start = performance.now();
          controller = crc(canvas, createElement(Layer, {style:{width:832,height:400}}), {pixelRatio:1});
          driver.flush(0);
          const setupMs = performance.now()-start;
          let tick = 0;
          const frame = () => { driver.flush(++tick * 1000/60); };
          for (let i=0; i<warmup; i++) frame();
          const totals=[], solver=[], rasterUpload=[];
          for (let i=0; i<samples; i++) {
            const t=performance.now(); frame(); totals.push(performance.now()-t);
            solver.push(timing.solver); rasterUpload.push(timing.rasterUpload);
          }
          results.push({round, mode, width,height,steps,setupMs,total:stats(totals),solver:stats(solver),rasterUpload:stats(rasterUpload)});
          document.querySelector('#status').textContent = `Measured round ${round+1}: ${mode} ${width}×${height}, ${steps} steps`;
        } finally { controller?.dispose(); restore(); canvas.remove(); }
        await new Promise(resolve => setTimeout(resolve,0));
      }
    }
  }
  return {userAgent:navigator.userAgent, hardwareConcurrency:navigator.hardwareConcurrency, compileMs, fetchAndCompileMs, wasmBytes:bytes.byteLength, rounds,samples,warmup,display:'832x400@1',results};
};
const interactive=installInteractive(resources);
let liveControllers=[];
window.startPreview = () => {
  interactive.stop();
  for (const controller of liveControllers) controller.dispose();
  liveControllers=[];
  document.querySelector('#previews').replaceChildren();
  for (const mode of ['current-js','wasm-direct']) {
    const section=document.createElement('section'), heading=document.createElement('h2'), canvas=document.createElement('canvas');
    heading.textContent=mode; canvas.width=512; canvas.height=320;
    section.append(heading,canvas); document.querySelector('#previews').append(section);
    const Layer=layer(mode,256,160,8,{});
    liveControllers.push(crc(canvas,createElement(Layer,{style:{width:512,height:320}}),{pixelRatio:1}));
  }
  document.querySelector('#status').textContent='Live comparison: identical seed, palette and eight steps per scheduled frame.';
};
window.stopPreview = () => { interactive.stop(); for(const c of liveControllers)c.dispose(); liveControllers=[]; };
document.querySelector('#preview').onclick=window.startPreview;
document.querySelector('#benchmark').onclick=async () => {
  window.stopPreview();
  document.querySelector('#benchmark').disabled=true;
  document.querySelector('#preview').disabled=true;
  document.querySelector('#painting-controls').disabled=true;
  try { const report=await window.runBenchmark(); document.querySelector('#output').textContent=JSON.stringify(report,null,2); }
  finally {document.querySelector('#benchmark').disabled=false; document.querySelector('#preview').disabled=false; document.querySelector('#painting-controls').disabled=false;}
};
document.querySelector('#status').textContent='Ready';

function startPainting() {
  window.stopPreview();
  const [width,height,steps]=document.querySelector('#workload').value.split(',').map(Number);
  interactive.start({mode:document.querySelector('#backend').value,width,height,steps,paused:document.querySelector('#paused').checked,radius:Number(document.querySelector('#radius').value)});
}
document.querySelector('#paint').onclick=startPainting;
document.querySelector('#backend').onchange=startPainting;
document.querySelector('#workload').onchange=startPainting;
document.querySelector('#paused').onchange=event=>interactive.report()&&interactive.pause(event.target.checked);
document.querySelector('#radius').oninput=event=>{document.querySelector('#radius-value').textContent=event.target.value;interactive.report()&&interactive.setRadius(Number(event.target.value));};
