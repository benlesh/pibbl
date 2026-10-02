import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const source = (await readFile(new URL('./reference-simulation.ts', import.meta.url), 'utf8'))
  .replace('class InkSimulation', 'class OptimizedSimulation')
  .replace('((y + h - 1) % h)', '(y === 0 ? h - 1 : y - 1)')
  .replace('((y + 1) % h)', '(y + 1 === h ? 0 : y + 1)')
  .replace('(x + w - 1) % w', '(x === 0 ? w - 1 : x - 1)')
  .replace('(x + 1) % w', '(x + 1 === w ? 0 : x + 1)');
await writeFile(`${root}optimized.mjs`, (await transform(source, {loader:'ts',format:'esm'})).code);
await build({entryPoints:[`${root}browser.mjs`],outfile:`${root}bundle.js`,bundle:true,format:'esm',platform:'browser',alias:{'@crc/core':fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url))}});
await build({entryPoints:[`${root}materials-browser.mjs`],outfile:`${root}materials-bundle.js`,bundle:true,format:'esm',platform:'browser',alias:{'@crc/core':fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url))}});
await build({entryPoints:[`${root}production-browser.ts`],outfile:`${root}production-bundle.js`,bundle:true,format:'esm',platform:'browser',jsx:'automatic',jsxImportSource:'@crc/core',alias:{'@crc/core/jsx-runtime':fileURLToPath(new URL('../../packages/core/src/jsx-runtime.ts',import.meta.url)),'@crc/core/internal':fileURLToPath(new URL('../../packages/core/src/internal.ts',import.meta.url)),'@crc/core':fileURLToPath(new URL('../../packages/core/src/index.ts',import.meta.url)),'@crc/textures':fileURLToPath(new URL('../../packages/textures/src/index.ts',import.meta.url)),'@crc/physics/2d':fileURLToPath(new URL('../../packages/physics/src/2d.ts',import.meta.url))}});
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CRC interactive texture WASM spike</title>
<style>body{font:16px system-ui;margin:32px;background:#10212b;color:#e4eee9;max-width:1200px}button,select{font:inherit;padding:8px 12px}button,select,input{accent-color:#50b8ad}button{cursor:pointer}fieldset{border:1px solid #3b5864;border-radius:8px;padding:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:center}label{display:flex;gap:8px;align-items:center}#previews{display:flex;flex-wrap:wrap;gap:24px}canvas{max-width:100%;height:auto;border:1px solid #3b5864}pre{white-space:pre-wrap}details{margin-top:24px}fieldset{min-inline-size:0}@media(max-width:600px){body{margin:20px}label{width:100%;flex-wrap:wrap}select{min-width:0;max-width:100%;flex:1}}small{color:#bed1d2}#status{min-height:2em}</style>
<h1>Paint with JavaScript or WASM</h1><p>Drag on the texture. Switch engines and workloads to feel the difference. Switching resets the same seed; only one engine runs during painting.</p>
<fieldset id="painting-controls"><legend>Interactive comparison</legend>
<label>Engine <select id="backend"><option value="wasm-direct">WASM · direct memory</option><option value="current-js">JavaScript</option></select></label>
<label>Workload <select id="workload"><option value="32,32,1">Light · 32×32, 1 step</option><option value="256,160,8" selected>Standard · 256×160, 8 steps</option><option value="512,512,8">Heavy · 512×512, 8 steps</option><option value="512,512,24">Extreme · 512×512, 24 steps</option></select></label>
<label>Brush <input id="radius" type="range" min="2" max="48" value="6"><span id="radius-value">6</span></label>
<label><input id="paused" type="checkbox">Pause evolution</label><button id="paint">Start / reset painting</button></fieldset>
<p id="status">Loading WASM…</p><div id="previews"></div><pre id="interactive-metrics"></pre>
<small>Latency ends after CRC completes the painted frame. It includes event delivery and frame waiting; it does not measure physical screen presentation. Light timings may be below the browser clock’s resolution.</small>
<details><summary>Original throughput experiment</summary><p>Pauses painting while measuring. The synchronized preview is for visual comparison, not latency measurement.</p><button id="preview">Run live comparison</button> <button id="benchmark">Run benchmark</button><pre id="output"></pre></details>
<script type="module" src="./bundle.js"></script></html>`;
createServer(async (req,res)=>{
  const name = new URL(req.url,'http://localhost').pathname.slice(1);
  res.setHeader('Cache-Control','no-store');
  if (!name) {res.setHeader('Content-Type','text/html');res.end(html);return;}
  if(name==='crc') {res.setHeader('Content-Type','text/html');res.end(await readFile(`${root}production.html`));return;}
  if(name==='materials') {res.setHeader('Content-Type','text/html');res.end(await readFile(`${root}materials.html`));return;}
  if (!['production-bundle.js','bundle.js','kernel.wasm','materials-bundle.js','materials.wasm'].includes(name)) {res.writeHead(404).end();return;}
  try {res.setHeader('Content-Type',name.endsWith('wasm')?'application/wasm':'text/javascript');res.end(await readFile(`${root}${name}`));}
  catch {res.writeHead(500).end();}
}).listen(4381,'127.0.0.1',()=>console.warn('Texture spike: http://127.0.0.1:4381'));
