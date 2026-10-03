// Opt-in natural browser soak: no forced GC until the separately labeled post-disposal sample.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const options = new Map(process.argv.slice(2).flatMap((value, index, values) => value.startsWith('--') ? [[value.slice(2), values[index + 1]]] : []));
const baseUrl = options.get('base-url') ?? 'http://127.0.0.1:5204';
const scale = Number(options.get('scale') ?? 1);
if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new RangeError('--scale must be in (0,1].');
const outputDirectory = resolve(root, 'docs/testing/runtime-performance-audit/2026-10-03/results');
await mkdir(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, `natural-soak-${new Date().toISOString().replaceAll(':', '-')}.json`);
const result = {
  schema: 'crc-natural-soak/1', baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  node: process.version, baseUrl, scale, mode: 'source',
  methodology: 'No forced GC during each workload. A forced-GC sample occurs only after disposal and is explicitly separate. Scheduler begin-to-idle wall time excludes presentation.',
  samples: [], errors: [],
};
const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
try {
  for (const [slug, seconds] of [['living-ink', 600], ['stirred-ink', 300], ['isolated-512', 300]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => result.errors.push({ slug, error: error.message }));
    await page.route('**/crc-natural-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>CRC natural audit</title>' }));
    await page.goto(`${baseUrl}/crc-natural-audit.html`);
    const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
    await page.evaluate(async ({ workspace, slug }) => {
      const base = `/@fs${workspace}/`;
      const [core, textures, catalog, scheduler] = await Promise.all([import(`${base}packages/core/src/index.ts`), import(`${base}packages/textures/src/index.ts`), import(`${base}packages/scenarios/src/learning-catalog.ts`), import(`${base}packages/core/src/lib/scheduler/realm-scheduler.ts`)]);
      const durations = new Float64Array(4096); let count = 0, start = 0, worst = 0, overBudget = 0;
      const release = scheduler.installSchedulerTraceCollectorForTest(event => { if (event.kind !== 'scheduler-phase') return; const now = performance.now(); if (event.phase === 'begin') start = now; if (event.phase === 'idle') { const duration = now - start; durations[count++ % durations.length] = duration; worst = Math.max(worst, duration); if (duration > 16.667) overBudget++; } });
      const canvas = document.createElement('canvas'); document.body.append(canvas); let controller;
      if (slug === 'isolated-512') { canvas.width = canvas.height = 512; function Scene() { const ink = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 512, height: 512 } }); return core.createElement(core.Rectangle, { style: { width: 512, height: 512, fill: ink } }); } controller = core.crc(canvas, core.createElement(Scene, {})); }
      else { const entry = catalog.learningExampleCatalog.find(entry => entry.slug === slug); canvas.width = entry.canvas.width; canvas.height = entry.canvas.height; controller = (await catalog.loadLearningExample(entry)).default(canvas); }
      window.__crcAudit = { snapshot() { const values = Array.from(durations.subarray(0, Math.min(count, durations.length))).sort((a, b) => a - b); const snapshot = { frames: count, medianMs: values[Math.floor(values.length * .5)] ?? 0, p95Ms: values[Math.floor(values.length * .95)] ?? 0, worstMs: worst, overBudget }; count = 0; worst = 0; overBudget = 0; return snapshot; }, dispose() { controller.dispose(); release(); } };
    }, { workspace: root, slug });
    for (let elapsed = 30; elapsed <= seconds * scale; elapsed += 30) {
      await new Promise(resolve => setTimeout(resolve, 30_000));
      const metrics = await cdp.send('Performance.getMetrics');
      result.samples.push({ slug, elapsedSeconds: elapsed, scheduler: await page.evaluate(() => window.__crcAudit.snapshot()), metrics: Object.fromEntries(metrics.metrics.filter(metric => /Heap|Documents|Nodes|Frames/.test(metric.name)).map(metric => [metric.name, metric.value])) });
      await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    }
    await page.evaluate(() => window.__crcAudit.dispose());
    result.samples.push({ slug, stage: 'disposed-natural', scheduler: await page.evaluate(() => window.__crcAudit.snapshot()) });
    await cdp.send('HeapProfiler.collectGarbage');
    result.samples.push({ slug, stage: 'disposed-forced-GC-separate', scheduler: await page.evaluate(() => window.__crcAudit.snapshot()) });
    await page.close();
  }
} catch (error) { result.errors.push(error instanceof Error ? error.stack ?? error.message : String(error)); }
finally { await browser.close(); await writeFile(output, `${JSON.stringify(result, null, 2)}\n`); }
process.stdout.write(`${JSON.stringify({ output, errors: result.errors.length })}\n`);
