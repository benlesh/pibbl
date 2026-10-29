import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [], trace = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => trace.push(['console', message.type(), message.text()]));
  try {
    await page.goto(`${base}/#/examples/layout/wasm-column-baseline-fallback`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Jump to Live Canvas', { exact: true }).click();
    let sandbox;
    for (let attempt = 0; attempt < 300; attempt++) {
      const candidate = page.frames().find(frame => frame.url() === 'about:srcdoc');
      if (candidate && await candidate.evaluate(() => !!document.querySelector('pre')).catch(() => false)) { sandbox = candidate; break; }
      await page.waitForTimeout(100);
    }
    if (!sandbox) throw new Error('The column fallback sandbox did not initialize.');
    const state = async () => JSON.parse(await sandbox.evaluate(() => document.querySelector('pre')?.textContent ?? ''));
    const click = async (x, y) => {
      const host = await page.evaluate(async () => {
        const iframe = document.querySelector('iframe[srcdoc]');
        if (!(iframe instanceof HTMLIFrameElement)) throw new Error('The column fallback iframe is unavailable.');
        iframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const box = iframe.getBoundingClientRect(); return { x: box.left + iframe.clientLeft, y: box.top + iframe.clientTop };
      });
      await page.waitForTimeout(150);
      const current = await state();
      const point = await sandbox.evaluate(({ x, y, basis }) => {
        const canvas = document.querySelector('canvas'); if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The canvas is unavailable.');
        const bounds = canvas.getBoundingClientRect(); const logical = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).transformPoint({ x, y });
        return { x: bounds.left + logical.x * bounds.width / canvas.width, y: bounds.top + logical.y * bounds.height / canvas.height };
      }, { x, y, basis: current.basis });
      await page.mouse.move(host.x + point.x, host.y + point.y); await page.mouse.click(host.x + point.x, host.y + point.y); await page.waitForTimeout(150);
    };
    const box = (value, x, y, width, height) => { for (const key of ['x','y','width','height']) assert.ok(Math.abs(value[key]-({x,y,width,height})[key]) < 1e-4, key + ': ' + JSON.stringify(value)); };
    let current = await state();
    box(current.boxes.A, 8, 48, 40, 20); box(current.boxes.B, 8, 68, 60, 40); assert.equal(current.baselineQueries, 0);
    const stamps = { A: current.boxes.A.stamp, B: current.boxes.B.stamp };
    await click(12, 54); current = await state(); assert.deepEqual(current.hits, ['A']);
    const expected = [
      [[8,48,8,68],[68,48,48,68],[8,128,8,88],[68,128,48,88]],
      [[8,48,48,48],[68,48,8,48],[8,88,48,88],[68,88,8,88]],
      [[68,48,8,48],[8,48,48,48],[68,88,8,88],[8,88,48,88]],
    ];
    for (let wrap = 0; wrap < 3; wrap++) {
      if (wrap) await click(190,167);
      for (let mode = 0; mode < 4; mode++) {
        current = await state(); const [ax,ay,bx,by] = expected[wrap][mode];
        box(current.boxes.A,ax,ay,40,wrap?60:20); box(current.boxes.B,bx,by,60,wrap?60:40);
        assert.equal(current.mode,mode); assert.equal(current.baselineQueries,0);
        assert.deepEqual({A:current.boxes.A.stamp,B:current.boxes.B.stamp},stamps);
        await click(ax+3,ay+3);current=await state();assert.equal(current.hits.at(-1),'A');
        await click(bx+3,by+3);current=await state();assert.equal(current.hits.at(-1),'B');
        await click(40,167);
      }
    }
    if (process.env.PIBBL_LAYOUT_SCREENSHOT) await sandbox.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
    const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
    if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/') && !value.includes('packages/core/src/'))); }
    const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__?.(); });
    assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]);
    assert.deepEqual(errors, []);
    console.warn(JSON.stringify({ base, initial: stamps, fallback: true, cleanup: [0, 0, 0, 0], errors }));
  } catch (error) {
    console.error(JSON.stringify({ columnFallbackDriverFailure: String(error), trace })); throw error;
  }
} finally { await browser.close(); }
