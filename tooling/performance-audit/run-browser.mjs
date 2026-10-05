// Opt-in descriptive browser audit. Never use as a correctness or CI performance gate.
import { mkdir, writeFile } from 'node:fs/promises';
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const options = new Map(process.argv.slice(2).flatMap((value, index, values) =>
  value.startsWith('--') ? [[value.slice(2), values[index + 1]]] : []));
const extended = options.has('extended');
const cycles = Number(options.get('cycles') ?? (extended ? 1_000 : 100));
const frames = Number(options.get('frames') ?? (extended ? 6_000 : 300));
const baseUrl = options.get('base-url') ?? 'http://127.0.0.1:5204';
if (!Number.isSafeInteger(cycles) || cycles < 1 || !Number.isSafeInteger(frames) || frames < 1) {
  throw new RangeError('--cycles and --frames must be positive safe integers.');
}
const outputDirectory = resolve(root, 'docs/testing/runtime-performance-audit/2026-10-03/results');
await mkdir(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, `${new Date().toISOString().replaceAll(':', '-')}.json`);
const partialOutput = `${output}.partial.jsonl`;
const timeoutMilliseconds = Number(options.get('timeout-ms') ?? 1_200_000);
if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 10_000) throw new RangeError('--timeout-ms must be a safe integer of at least 10000.');
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const reactionDiffusionSha256 = createHash('sha256').update(
  await readFile(resolve(root, 'packages/textures/src/lib/reaction-diffusion.ts')),
).digest('hex');
const report = {
  schema: 'pibbl-current-performance-audit/1',
  baseline, reactionDiffusionSha256, timestamp: new Date().toISOString(),
  environment: { node: process.version, platform: platform(), architecture: arch(), baseUrl, cycles, frames },
  meaning: 'Source-mode, local descriptive measurements. Explicit resource release and weak reachability are separate observations; neither demonstrates native or GPU reclamation.',
  cases: [], errors: [],
};
let browser;
const save = () => writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
const deadline = setTimeout(() => {
  report.errors.push(`Outer audit deadline of ${timeoutMilliseconds} ms exceeded; browser shutdown requested.`);
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  void browser?.close();
}, timeoutMilliseconds);
try {
  browser = await chromium.launch({ headless: true });
  report.environment.browser = browser.version();
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.exposeFunction('__pibblAuditRecord', record => {
    report.cases.push(record);
    appendFileSync(partialOutput, `${JSON.stringify(record)}\n`);
  });
  await page.route('**/pibbl-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Pibbl audit</title>' }));
  await page.goto(`${baseUrl}/pibbl-audit.html`, { waitUntil: 'domcontentloaded' });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const mainSuite = await page.evaluate(async ({ workspace, frames, cycles }) => {
    const base = `/@fs${workspace}/`;
    const strongCanvases = []; // Deliberately retains canvases only to inspect explicit zero-dimension release.
    const memorySizes = [];
    const NativeCanvas = window.OffscreenCanvas;
    const NativeMemory = WebAssembly.Memory;
    window.OffscreenCanvas = new Proxy(NativeCanvas, { construct(Target, args) {
      const canvas = Reflect.construct(Target, args); strongCanvases.push(canvas); return canvas;
    } });
    WebAssembly.Memory = new Proxy(NativeMemory, { construct(Target, args) {
      const memory = Reflect.construct(Target, args); memorySizes.push(memory.buffer.byteLength); return memory;
    } });
    const [core, textures, scheduler, animation, graph, simulation, presentation] = await Promise.all([
      import(`${base}packages/core/src/index.ts`), import(`${base}packages/textures/src/index.ts`),
      import(`${base}packages/core/src/lib/scheduler/testing.ts`), import(`${base}packages/core/src/lib/animation/evaluate.ts`),
      import(`${base}packages/core/src/lib/signals/graph.ts`), import(`${base}packages/textures/src/lib/simulation.ts`),
      import(`${base}packages/textures/src/lib/presentation.ts`),
    ]);
    let rasterDisposals = 0, simulationDisposals = 0, uploads = 0;
    const disposeRaster = presentation.TextureRaster.prototype.dispose;
    presentation.TextureRaster.prototype.dispose = function (...args) { rasterDisposals++; return disposeRaster.apply(this, args); };
    const disposeSimulation = simulation.InkSimulation.prototype.dispose;
    simulation.InkSimulation.prototype.dispose = function (...args) { simulationDisposals++; return disposeSimulation.apply(this, args); };
    const put = OffscreenCanvasRenderingContext2D.prototype.putImageData;
    OffscreenCanvasRenderingContext2D.prototype.putImageData = function (...args) { uploads++; return put.apply(this, args); };
    const percentile = (samples, fraction) => { const ordered = [...samples].sort((a, b) => a - b); return ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * fraction))] ?? 0; };
    const counter = () => ({ canvasAllocations: strongCanvases.length, wasmMemoryAllocations: memorySizes.length, wasmBytes: memorySizes.reduce((sum, size) => sum + size, 0), rasterDisposals, simulationDisposals, uploads, zeroDimensionCanvases: strongCanvases.filter(canvas => canvas.width === 0 && canvas.height === 0).length, observedNonReleasedCanvasDimensions: strongCanvases.filter(canvas => canvas.width || canvas.height).map(canvas => [canvas.width, canvas.height]), observerRetainsCanvases: true, signalGraph: graph.signalGraphSnapshot() });
    if (textures.useTexture !== core.useTexture) throw new Error('Source-mode imports did not share the public useTexture runtime identity.');
    const h = core.createElement;
    const legacy = (props = {}) => h(textures.ReactionDiffusion, { resolution: { width: 128, height: 80 }, style: { width: 256, height: 160 }, ...props });
    const run = (name, scene, frame, frameCount = frames, record = true) => {
      const driver = new scheduler.ManualSchedulerDriver(), restore = scheduler.installSchedulerDriverForTest(driver);
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320; document.body.replaceChildren(canvas);
      const before = counter(), flushDurations = [], errors = []; let idleFrames = 0, controller;
      try {
        controller = core.pibbl(canvas, scene());
        for (let index = 0; index < frameCount; index++) {
          const actionMeasurement = frame?.({ index, canvas, driver });
          if (driver.pendingHostFrames) {
            const flushStart = performance.now(); driver.flush(index * 1000 / 60);
            const flushDuration = performance.now() - flushStart;
            if (actionMeasurement) Object.assign(actionMeasurement, { drainMilliseconds: flushDuration, pendingAfterDrain: driver.pendingHostFrames });
            if (index >= 10) flushDurations.push(flushDuration);
          } else idleFrames++;
        }
      } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
      finally { controller?.dispose(); restore(); }
      const summarize = values => ({ samples: values.length, median: percentile(values, .5), p95: percentile(values, .95), max: Math.max(0, ...values) });
      const observation = { name, frameCount, warmupFrames: Math.min(10, frameCount), idleFrames, before, after: counter(), scheduler: scheduler.snapshotRealmScheduler(), errors, flushDurationMs: summarize(flushDurations) };
      if (record) void window.__pibblAuditRecord?.(observation);
      return observation;
    };
    const safe = (name, execute) => { try { return execute(); } catch (error) { return { name, errors: [error instanceof Error ? error.message : String(error)] }; } };
    const resetRevision = core.signal(0), compactResolution = core.signal(false);
    function ResizingLegacy() { return legacy({ resetRevision: resetRevision.get(), resolution: compactResolution.get() ? { width: 64, height: 40 } : { width: 128, height: 80 } }); }
    const results = [
      { name: 'public useTexture runtime identity', matches: true },
      safe('reaction-diffusion legacy steady', () => run('reaction-diffusion legacy steady', () => legacy())),
      safe('reaction-diffusion legacy paused', () => run('reaction-diffusion legacy paused', () => legacy({ paused: true }))),
      safe('reaction-diffusion legacy resize-reset', () => run('reaction-diffusion legacy resize-reset', () => h(ResizingLegacy, {}), ({ index }) => {
        if (index > 0 && index % 20 === 0) { compactResolution.set(index % 40 !== 0); resetRevision.set(index / 20); }
      })),
      safe('reaction-diffusion legacy initial renderer failure', () => run('reaction-diffusion legacy initial renderer failure', () => legacy({ render: () => { throw new Error('audit initial renderer failure'); } }))),
    ];
    const lifecycle = [];
    for (let index = 0; index < cycles; index++) lifecycle.push(safe(`reaction-diffusion lifecycle ${index}`, () => run(`reaction-diffusion lifecycle ${index}`, () => legacy({ paused: true }), undefined, 3, false)));
    const legacyLifecycleFinal = counter();
    if (legacyLifecycleFinal.simulationDisposals <= lifecycle[0].before.simulationDisposals) throw new Error('RD disposal positive control did not observe InkSimulation.dispose during successful legacy lifecycle churn.');
    results.push({ name: 'reaction-diffusion legacy lifecycle', cycles, first: lifecycle[0], last: lifecycle.at(-1), final: legacyLifecycleFinal });
    function SharedRecipe() {
      const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 128, height: 80 } });
      const paint = texture.paint({ mode: 'stretch' });
      return h(core.Group, { children: [h(core.Rectangle, { style: { width: 200, height: 160, fill: paint } }), h(core.Rectangle, { style: { left: 210, width: 200, height: 160, fill: paint } })] });
    }
    results.push(safe('reaction-diffusion recipe shared paint consumers', () => run('reaction-diffusion recipe shared paint consumers', () => h(SharedRecipe, {}))));
    const recipeResolution = core.signal(false), recipeReset = core.signal(0);
    function ResizingRecipe() {
      const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 + recipeReset.get() }), { resolution: recipeResolution.get() ? { width: 64, height: 40 } : { width: 128, height: 80 } });
      return h(core.Rectangle, { style: { width: 200, height: 160, fill: texture.paint({ mode: 'stretch' }) } });
    }
    results.push(safe('reaction-diffusion recipe resize-reset churn', () => run('reaction-diffusion recipe resize-reset churn', () => h(ResizingRecipe, {}), ({ index }) => {
      if (index > 0 && index % 20 === 0) { recipeResolution.set(index % 40 !== 0); recipeReset.set(index / 20); }
    })));
    function PausedRecipe() { const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 128, height: 80 } }); return h(core.Rectangle, { style: { width: 200, height: 160, fill: texture.paint({ mode: 'stretch' }) } }); }
    const recipeLifecycle = [];
    for (let index = 0; index < cycles; index++) recipeLifecycle.push(safe(`reaction-diffusion recipe lifecycle ${index}`, () => run(`reaction-diffusion recipe lifecycle ${index}`, () => h(PausedRecipe, {}), undefined, 3, false)));
    const recipeLifecycleFinal = counter();
    if (recipeLifecycleFinal.simulationDisposals <= legacyLifecycleFinal.simulationDisposals) throw new Error('RD disposal positive control did not observe InkSimulation.dispose during successful recipe lifecycle churn.');
    results.push({ name: 'reaction-diffusion recipe lifecycle', cycles, first: recipeLifecycle[0], last: recipeLifecycle.at(-1), final: recipeLifecycleFinal });
    let stormTexture;
    function ResetStorm() {
      stormTexture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 128, height: 80 } });
      return h(core.Rectangle, { style: { width: 200, height: 160, fill: stormTexture.paint({ mode: 'stretch' }) } });
    }
    const burstMeasurements = [];
    const resetStorm = safe('reaction-diffusion recipe reset-paint overload', () => run('reaction-diffusion recipe reset-paint overload', () => h(ResetStorm, {}), ({ index }) => {
      const runBurst = (name, count, message) => { const measurement = { frame: index, name, count, enqueueMilliseconds: 0 }; const start = performance.now(); for (let sent = 0; sent < count; sent++) stormTexture.send(message); measurement.enqueueMilliseconds = performance.now() - start; burstMeasurements.push(measurement); return measurement; };
      if (index === 12) return runBurst('reset-656', 656, { type: 'reset' });
      if (index === 14) return runBurst('paint-1024-radius-128', 1_024, { type: 'paint', u: .5, v: .5, radius: 128, strength: .8 });
      if (index === 16) { const measurement = runBurst('stir-8192-radius-128', 8_192, { type: 'stir', u: .5, v: .5, du: .1, dv: -.1, radius: 128 }); try { stormTexture.send({ type: 'stir', u: .5, v: .5, du: .1, dv: -.1, radius: 128 }); measurement.overflow = 'accepted'; } catch (caught) { measurement.overflow = caught instanceof Error ? caught.message : String(caught); } return measurement; }
    }));
    resetStorm.bursts = burstMeasurements;
    stormTexture = undefined;
    results.push(resetStorm);
    const emission = core.repeat(core.sequence(core.wait(1), core.marker('emit')), { iterations: Infinity });
    for (const age of [1_000, 60_000, 300_000, 600_000]) {
      const activation = animation.activateProgram(emission, {}), samples = [];
      try { for (let index = 0; index < 8; index++) { const batch = graph.createSignalCommitBatch(), start = performance.now(); const result = animation.evaluateProgram(activation, { previousTime: age - 1, time: age, direction: 'forward', frameId: index + 1, writer: emission, batch }); samples.push(performance.now() - start); batch.clear(); if (!result.milestones.some(event => event.kind === 'marker' && event.programTime === age)) throw new Error(`missing marker at ${age}`); } results.push({ name: 'animation late-age interval', age, durationMs: { median: percentile(samples, .5), p95: percentile(samples, .95), max: Math.max(...samples) } }); }
      finally { animation.releaseProgramActivation(activation); }
    }
    return results;
  }, { workspace: root, frames, cycles });
  report.mainSuite = mainSuite;
  report.cases.push({ name: 'main-suite-summary', cases: mainSuite });
  report.pageErrors = pageErrors;
  await save();
  // This deliberately failing public recipe is terminal and isolated: an
  // initialization leak must remain visible in its own fresh page state.
  const faultPage = await browser.newPage();
  await faultPage.route('**/pibbl-audit-fault.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Pibbl audit fault</title>' }));
  await faultPage.goto(`${baseUrl}/pibbl-audit-fault.html`, { waitUntil: 'domcontentloaded' });
  try {
    report.cases.push(await faultPage.evaluate(async ({ workspace }) => {
      const base = `/@fs${workspace}/`;
      const [core, textures, scheduler] = await Promise.all([
        import(`${base}packages/core/src/index.ts`), import(`${base}packages/textures/src/index.ts`), import(`${base}packages/core/src/lib/scheduler/testing.ts`),
      ]);
      if (core.useTexture !== textures.useTexture) throw new Error('Source-mode public useTexture runtime identity mismatch.');
      const driver = new scheduler.ManualSchedulerDriver(), restore = scheduler.installSchedulerDriverForTest(driver);
      const canvas = document.createElement('canvas'); document.body.append(canvas); let controller, error;
      function Fault() {
        const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 128, height: 80 }, palette: ['#ffffff'] });
        return core.createElement(core.Rectangle, { style: { width: 128, height: 80, fill: texture.paint({ mode: 'stretch' }) } });
      }
      try { controller = core.pibbl(canvas, core.createElement(Fault, {})); driver.flush(0); }
      catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
      finally { controller?.dispose(); }
      const schedulerAfterDispose = scheduler.snapshotRealmScheduler(); let restoreError;
      try { restore(); } catch (caught) { restoreError = caught instanceof Error ? caught.message : String(caught); }
      return { name: 'reaction-diffusion recipe invalid initial palette isolated', error, schedulerAfterDispose, restoreError, note: 'Fresh page closes immediately after this observation; no clearSharedState is used.' };
    }, { workspace: root }));
  } finally { await faultPage.close(); await save(); }
  const rasterFaultPage = await browser.newPage();
  await rasterFaultPage.route('**/pibbl-audit-raster-fault.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Pibbl audit raster fault</title>' }));
  await rasterFaultPage.goto(`${baseUrl}/pibbl-audit-raster-fault.html`, { waitUntil: 'domcontentloaded' });
  try {
    report.cases.push(await rasterFaultPage.evaluate(async ({ workspace }) => {
      const base = `/@fs${workspace}/`;
      const [core, textures, scheduler, simulation] = await Promise.all([import(`${base}packages/core/src/index.ts`), import(`${base}packages/textures/src/index.ts`), import(`${base}packages/core/src/lib/scheduler/testing.ts`), import(`${base}packages/textures/src/lib/simulation.ts`)]);
      if (core.useTexture !== textures.useTexture) throw new Error('Source-mode public useTexture runtime identity mismatch.');
      const nativePut = OffscreenCanvasRenderingContext2D.prototype.putImageData; let remainingFaults = 1;
      OffscreenCanvasRenderingContext2D.prototype.putImageData = function (...args) { if (remainingFaults-- > 0) throw new Error('audit injected initial RD raster upload failure'); return nativePut.apply(this, args); };
      const driver = new scheduler.ManualSchedulerDriver(), restore = scheduler.installSchedulerDriverForTest(driver);
      const nativeDispose = simulation.InkSimulation.prototype.dispose; let simulationDisposals = 0;
      simulation.InkSimulation.prototype.dispose = function (...args) { simulationDisposals++; return nativeDispose.apply(this, args); };
      const canvas = document.createElement('canvas'); document.body.append(canvas); let controller, error; const followupErrors = [];
      function Fault() { const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 128, height: 80 } }); return core.createElement(core.Rectangle, { style: { width: 128, height: 80, fill: texture.paint({ mode: 'stretch' }) } }); }
      try { controller = core.pibbl(canvas, core.createElement(Fault, {})); driver.flush(0); }
      catch (caught) { error = caught instanceof Error ? caught.message : String(caught); }
      finally { controller?.dispose(); }
      const schedulerImmediatelyAfterDispose = scheduler.snapshotRealmScheduler();
      for (let frame = 1; frame <= 8; frame++) if (driver.pendingHostFrames) try { driver.flush(frame * 17); } catch (caught) { followupErrors.push(caught instanceof Error ? caught.message : String(caught)); }
      const pendingAfterFollowups = driver.pendingHostFrames;
      const schedulerAfterFollowups = scheduler.snapshotRealmScheduler();
      simulation.InkSimulation.prototype.dispose = nativeDispose; OffscreenCanvasRenderingContext2D.prototype.putImageData = nativePut; let restoreError;
      try { restore(); } catch (caught) { restoreError = caught instanceof Error ? caught.message : String(caught); }
      return { name: 'reaction-diffusion recipe injected initial raster failure isolated', error, simulationDisposals, schedulerImmediatelyAfterDispose, schedulerAfterFollowups, followupErrors, pendingAfterFollowups, orphanScheduledWorkPersists: pendingAfterFollowups > 0, restoreError, note: 'Fault is injected only around the actual public RD recipe upload; eight post-disposal scheduler opportunities distinguish a one-frame fault from orphaned work. The page closes immediately after observation.' };
    }, { workspace: root }));
  } finally { await rasterFaultPage.close(); await save(); }
} catch (error) {
  report.errors.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  clearTimeout(deadline);
  await browser?.close();
  await save();
}
process.stdout.write(`${JSON.stringify({ output, errors: report.errors.length })}\n`);
