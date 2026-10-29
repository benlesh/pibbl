import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192'; const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }); const errors = [], trace = [];
  page.on('pageerror', error => errors.push(error.message)); page.on('console', message => trace.push([message.type(), message.text()]));
  try {
    await page.goto(`${base}/#/examples/layout/wasm-flex-last-baseline`, { waitUntil: 'domcontentloaded' }); await page.getByText('Jump to Live Canvas', { exact: true }).click();
    let sandbox;
    for (let attempt = 0; attempt < 300; attempt++) { const frame = page.frames().find(value => value.url() === 'about:srcdoc'); if (frame && await frame.evaluate(() => !!document.querySelector('pre')).catch(() => false)) { sandbox = frame; break; } await page.waitForTimeout(100); }
    if (!sandbox) throw new Error('The last-baseline sandbox did not initialize.');
    const state = async () => JSON.parse(await sandbox.evaluate(() => document.querySelector('pre')?.textContent ?? ''));
    const click = async (x, y) => {
      const host = await page.evaluate(async () => { const iframe = document.querySelector('iframe[srcdoc]'); if (!(iframe instanceof HTMLIFrameElement)) throw new Error('The iframe is unavailable.'); iframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); const box = iframe.getBoundingClientRect(); return { x: box.left + iframe.clientLeft, y: box.top + iframe.clientTop }; });
      await page.waitForTimeout(150); const current = await state(); const point = await sandbox.evaluate(({ x, y, basis }) => { const canvas = document.querySelector('canvas'); if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The canvas is unavailable.'); const bounds = canvas.getBoundingClientRect(), logical = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).transformPoint({ x, y }); return { x: bounds.left + logical.x * bounds.width / canvas.width, y: bounds.top + logical.y * bounds.height / canvas.height }; }, { x, y, basis: current.basis });
      await page.mouse.move(host.x + point.x, host.y + point.y); await page.mouse.click(host.x + point.x, host.y + point.y); await page.waitForTimeout(150);
    };
    const box = (value, x, y, width, height) => { for (const key of ['x','y','width','height']) assert.ok(Math.abs(value[key]-({x,y,width,height})[key]) < 1e-4, key + ': ' + JSON.stringify(value)); };
    let current = await state(); box(current.boxes.A, 8, 88, 40, 40); box(current.boxes.B, 48, 68, 40, 60); const stamps = { A: current.boxes.A.stamp, B: current.boxes.B.stamp };
    await click(12, 94); current = await state(); assert.deepEqual(current.hits, ['A']); await click(42, 172); current = await state(); assert.equal(current.last, 20); box(current.boxes.A, 8, 88, 40, 40); box(current.boxes.B, 48, 58, 40, 60); assert.deepEqual({ A: current.boxes.A.stamp, B: current.boxes.B.stamp }, stamps);
    await click(140, 172); current = await state(); box(current.boxes.A, 68, 88, 40, 40); box(current.boxes.B, 28, 58, 40, 60);
    await click(236, 172); current = await state(); assert.equal(current.wrapped, true); box(current.boxes.A, 48, 58, 60, 20); box(current.boxes.B, 8, 48, 40, 40); box(current.boxes.C, 48, 103, 60, 20); box(current.boxes.D, 8, 88, 40, 30);
    await click(236, 172); current = await state(); assert.equal(current.wrapped, false);
    await click(78, 202); current = await state(); assert.equal(current.structural, true); box(current.boxes.A, 68, 88, 40, 40); box(current.boxes.B, 28, 58, 40, 60);
    const structuralStamps = { A: current.boxes.A.stamp, B: current.boxes.B.stamp };
    await click(72,94);current=await state();assert.equal(current.hits.at(-1),'A');
    await click(42,172);current=await state();box(current.boxes.A,68,88,40,40);box(current.boxes.B,28,68,40,60);
    assert.deepEqual({A:current.boxes.A.stamp,B:current.boxes.B.stamp},structuralStamps);
    const beforeMoved=current.hits.length;await click(32,60);await click(32,74);current=await state();assert.equal(current.hits.length,beforeMoved+1);assert.equal(current.hits.at(-1),'B');
    await click(72, 202); current = await state(); assert.equal(current.structural, false); assert.notEqual(current.boxes.A.stamp, structuralStamps.A); assert.equal(current.boxes.B.stamp, structuralStamps.B);
    await click(72,202);current=await state();assert.equal(current.structural,true);
    if (process.env.PIBBL_LAYOUT_SCREENSHOT) await sandbox.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
    const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__); if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/') && !value.includes('packages/core/src/'))); }
    const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__?.(); }); assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]); assert.deepEqual(errors, []);
    console.warn(JSON.stringify({ base, initial: stamps, lastBaseline: true, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0, 0], errors }));
  } catch (error) { console.error(JSON.stringify({ lastBaselineDriverFailure: String(error), trace, body: (await page.locator('body').innerText()).slice(-12000), frames: page.frames().map(frame=>frame.url()) })); throw error; }
} finally { await browser.close(); }
