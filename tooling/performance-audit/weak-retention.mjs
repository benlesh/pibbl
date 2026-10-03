// Explicitly separate WeakRef/forced-GC reachability probe; it does not measure natural memory.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5204';
const outputDirectory = resolve(root, 'docs/testing/runtime-performance-audit/2026-10-03/results');
await mkdir(outputDirectory, { recursive: true });
const output = resolve(outputDirectory, `weak-retention-${new Date().toISOString().replaceAll(':', '-')}.json`);
const browser = await chromium.launch({ headless: true });
const report = { schema: 'crc-weak-retention/2', baseUrl, methodology: 'Each dereference happens in a new browser evaluation after CDP forced GC. The probe weakly observes the actual root CRCElement and HTMLCanvasElement; the retain case keeps only the public Texture handle. WeakRef only distinguishes JavaScript reachability; it cannot prove native/GPU reclamation.', cases: [], errors: [] };
try {
  for (const retain of [false, true]) {
    const page = await browser.newPage();
    await page.route('**/crc-weak-audit.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>CRC WeakRef audit</title>' }));
    await page.goto(`${baseUrl}/crc-weak-audit.html`);
    await page.evaluate(async ({ workspace, retain }) => {
      const base = `/@fs${workspace}/`;
      const [core, textures, scheduler] = await Promise.all([import(`${base}packages/core/src/index.ts`), import(`${base}packages/textures/src/index.ts`), import(`${base}packages/core/src/lib/scheduler/testing.ts`)]);
      if (core.useTexture !== textures.useTexture) throw new Error('Source-mode public useTexture runtime identity mismatch.');
      const driver = new scheduler.ManualSchedulerDriver(), restore = scheduler.installSchedulerDriverForTest(driver);
      let stale, rootElement, canvas, controller, renders = 0;
      function Scene({ retainHandle }) { renders++; const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 64, height: 40 } }); if (retainHandle) stale = texture; return core.createElement(core.Rectangle, { style: { width: 64, height: 40, fill: texture.paint({ mode: 'stretch' }) } }); }
      canvas = document.createElement('canvas');
      rootElement = core.createElement(Scene, { retainHandle: retain });
      const weakRoot = new WeakRef(rootElement), weakCanvas = new WeakRef(canvas);
      controller = core.crc(canvas, rootElement);
      const pendingBeforeInitialFlush = driver.pendingHostFrames;
      driver.flush(0);
      const hasConfiguredStaleHandle = retain ? stale !== undefined : stale === undefined;
      window.__crcWeakAudit = { weakRoot, weakCanvas, stale, hasConfiguredStaleHandle, renders, pendingBeforeInitialFlush, controller, scheduler, restore };
      rootElement = undefined;
      canvas = undefined;
    }, { workspace: root, retain });
    const positiveControl = await page.evaluate(({ retain }) => ({
      retain,
      hasConfiguredStaleHandle: window.__crcWeakAudit.hasConfiguredStaleHandle,
      renders: window.__crcWeakAudit.renders,
      pendingBeforeInitialFlush: window.__crcWeakAudit.pendingBeforeInitialFlush,
      rootReachableBeforeDispose: window.__crcWeakAudit.weakRoot.deref() !== undefined,
      canvasReachableBeforeDispose: window.__crcWeakAudit.weakCanvas.deref() !== undefined,
    }), { retain });
    if (!positiveControl.hasConfiguredStaleHandle || positiveControl.renders < 1 || !positiveControl.rootReachableBeforeDispose || !positiveControl.canvasReachableBeforeDispose) throw new Error(`WeakRef pre-disposal positive control failed: ${JSON.stringify(positiveControl)}`);
    const disposeState = await page.evaluate(() => {
      const state = window.__crcWeakAudit;
      state.controller.dispose();
      state.controller = undefined;
      let restoreError;
      try { state.restore(); } catch (error) { restoreError = error instanceof Error ? error.message : String(error); }
      state.scheduler = state.scheduler.snapshotRealmScheduler();
      return { restoreError };
    });
    if (disposeState.restoreError) throw new Error(`WeakRef probe scheduler restore failed: ${disposeState.restoreError}`);
    const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
    const beforeDrop = await page.evaluate(({ retain, positiveControl }) => ({
      ...positiveControl,
      retain,
      rootReachableWithConfiguredHandleState: window.__crcWeakAudit.weakRoot.deref() !== undefined,
      canvasReachableWithConfiguredHandleState: window.__crcWeakAudit.weakCanvas.deref() !== undefined,
      scheduler: window.__crcWeakAudit.scheduler,
    }), { retain, positiveControl });
    await page.evaluate(() => { window.__crcWeakAudit.stale = undefined; });
    await cdp.send('HeapProfiler.collectGarbage');
    report.cases.push({ ...beforeDrop, ...await page.evaluate(() => ({
      rootReachableAfterDroppingStaleAndSecondGC: window.__crcWeakAudit.weakRoot.deref() !== undefined,
      canvasReachableAfterDroppingStaleAndSecondGC: window.__crcWeakAudit.weakCanvas.deref() !== undefined,
    })) });
    await page.close();
  }
} catch (error) { report.errors.push(error instanceof Error ? error.stack ?? error.message : String(error)); }
finally { await browser.close(); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); }
process.stdout.write(`${JSON.stringify({ output, errors: report.errors.length })}\n`);
