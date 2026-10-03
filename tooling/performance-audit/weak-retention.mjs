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
const report = { schema: 'crc-weak-retention/1', baseUrl, methodology: 'Each dereference happens in a new browser evaluation after CDP forced GC. WeakRef only distinguishes JavaScript reachability; it cannot prove native/GPU reclamation.', cases: [], errors: [] };
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
      let sentinel = { label: retain ? 'retained-stale-texture' : 'dropped-texture' }, stale;
      function Scene(_props) { const texture = textures.useTexture(textures.reactionDiffusion({ seed: 42 }), { resolution: { width: 64, height: 40 } }); if (retain) stale = texture; return core.createElement(core.Rectangle, { style: { width: 64, height: 40, fill: texture.paint({ mode: 'stretch' }) } }); }
      const weak = new WeakRef(sentinel); const canvas = document.createElement('canvas'); const controller = core.crc(canvas, core.createElement(Scene, { auditPayload: sentinel })); driver.flush(0); controller.dispose(); restore(); sentinel = undefined; window.__crcWeakAudit = { weak, stale, scheduler: scheduler.snapshotRealmScheduler() };
    }, { workspace: root, retain });
    const cdp = await page.context().newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage');
    const beforeDrop = await page.evaluate(({ retain }) => ({ retain, reachableWithConfiguredHandleState: window.__crcWeakAudit.weak.deref() !== undefined, scheduler: window.__crcWeakAudit.scheduler }), { retain });
    await page.evaluate(() => { window.__crcWeakAudit.stale = undefined; });
    await cdp.send('HeapProfiler.collectGarbage');
    report.cases.push({ ...beforeDrop, reachableAfterDroppingStaleAndSecondGC: await page.evaluate(() => window.__crcWeakAudit.weak.deref() !== undefined) });
    await page.close();
  }
} catch (error) { report.errors.push(error instanceof Error ? error.stack ?? error.message : String(error)); }
finally { await browser.close(); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); }
process.stdout.write(`${JSON.stringify({ output, errors: report.errors.length })}\n`);
