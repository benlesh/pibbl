import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [], trace = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => trace.push(['console', message.type(), message.text()]));
  page.on('framenavigated', value => trace.push(['framenavigated', value.url()]));
  page.on('framedetached', value => trace.push(['framedetached', value.url()]));
  try {
    await page.goto(`${base}/#/examples/layout/wasm-grid-baseline`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Jump to Live Canvas', { exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('iframe[srcdoc]'));
    let sandbox;
    for (let attempt = 0; attempt < 300; attempt++) {
      const candidate = page.frames().find(value => value.url() === 'about:srcdoc');
      if (candidate && await candidate.evaluate(() => !!document.querySelector('pre')).catch(() => false)) { sandbox = candidate; break; }
      await page.waitForTimeout(100);
    }
    if (!sandbox) throw new Error('The Grid sandbox did not initialize.');
    const state = async () => JSON.parse(await sandbox.evaluate(() => {
      const panel = document.querySelector('pre');
      if (!panel) throw new Error('The Grid inspector is missing.');
      return panel.textContent ?? '';
    }));
    const click = async (x, y) => {
      const host = await page.evaluate(async () => {
        const iframe = document.querySelector('iframe[srcdoc]');
        if (!(iframe instanceof HTMLIFrameElement)) throw new Error('The Grid iframe is unavailable.');
        iframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const box = iframe.getBoundingClientRect(); return { x: box.left + iframe.clientLeft, y: box.top + iframe.clientTop };
      });
      await page.waitForTimeout(150);
      const current = await state();
      const point = await sandbox.evaluate(({ x, y, basis }) => {
        const canvas = document.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The Grid canvas is unavailable.');
        const bounds = canvas.getBoundingClientRect();
        const transformed = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).transformPoint({ x, y });
        return { x: bounds.left + transformed.x * bounds.width / canvas.width, y: bounds.top + transformed.y * bounds.height / canvas.height };
      }, { x, y, basis: current.basis });
      await page.mouse.move(host.x + point.x, host.y + point.y);
      await page.mouse.click(host.x + point.x, host.y + point.y);
      await page.waitForTimeout(150);
    };
    const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-4, `${message}: ${actual} !== ${expected}`);
    const expectBox = (actual, x, y, width, height) => { near(actual.x, x, 'x'); near(actual.y, y, 'y'); near(actual.width, width, 'width'); near(actual.height, height, 'height'); };
    let current = await state();
    expectBox(current.boxes.source, 48, 82, 40, 20); expectBox(current.boxes.peer, 108, 64, 40, 40);
    const stamps = { source: current.boxes.source.stamp, peer: current.boxes.peer.stamp };
    await click(52, 86); current = await state(); assert.deepEqual(current.hits, ['source']);
    await click(44, 180); current = await state(); assert.equal(current.first, 22); expectBox(current.boxes.source, 48, 82, 40, 20); expectBox(current.boxes.peer, 108, 74, 40, 40); assert.deepEqual({ source: current.boxes.source.stamp, peer: current.boxes.peer.stamp }, stamps);
    const oldHits = current.hits.length; await click(112, 68); current = await state(); assert.equal(current.hits.length, oldHits); await click(112, 78); current = await state(); assert.equal(current.hits.at(-1), 'peer');
    await click(136, 180); current = await state(); assert.equal(current.empty, true); assert.equal(current.boxes.source, undefined); expectBox(current.boxes.peer, 48, 72, 40, 40); assert.equal(current.boxes.peer.stamp, stamps.peer);
    await click(52, 86); current = await state(); assert.equal(current.hits.at(-1), 'peer');
    await click(136, 180); await click(44, 180); current = await state(); assert.equal(current.empty, false); assert.equal(current.first, 12); expectBox(current.boxes.source, 48, 82, 40, 20); expectBox(current.boxes.peer, 108, 64, 40, 40);
    if (process.env.PIBBL_LAYOUT_SCREENSHOT) await sandbox.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
    const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
    if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/') && !value.includes('packages/core/src/'))); }
    const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__?.(); });
    assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]);
    assert.deepEqual(errors, []);
    console.warn(JSON.stringify({ base, initial: stamps, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0, 0], errors }));
  } catch (error) {
    const failure = await Promise.all([page.evaluate(() => ({ iframeCount: document.querySelectorAll('iframe[srcdoc]').length, url: location.href })), Promise.resolve(trace)]);
    console.error(JSON.stringify({ gridDriverFailure: String(error), outer: failure[0], trace: failure[1] }));
    throw error;
  }
} finally { await browser.close(); }
