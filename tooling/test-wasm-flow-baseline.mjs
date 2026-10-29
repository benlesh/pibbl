import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const trace = [];
  page.on('console', message => trace.push(['console', message.type(), message.text()]));
  page.on('framenavigated', value => trace.push(['framenavigated', value.url()]));
  page.on('framedetached', value => trace.push(['framedetached', value.url()]));
  try {
    await page.goto(`${base}/#/examples/layout/wasm-flow-baseline`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Jump to Live Canvas', { exact: true }).click();
    await page.waitForFunction(() => !!document.querySelector('iframe[srcdoc]'));
    let sandbox;
    for (let attempt = 0; attempt < 300; attempt++) {
      const candidate = page.frames().find(value => value.url() === 'about:srcdoc');
      if (candidate && await candidate.evaluate(() => !!document.querySelector('pre')).catch(() => false)) { sandbox = candidate; break; }
      await page.waitForTimeout(100);
    }
    if (!sandbox) throw new Error('The Flow sandbox did not initialize.');
    const state = async () => JSON.parse(await sandbox.evaluate(() => {
      const panel = document.querySelector('pre');
      if (!panel) throw new Error('The Flow inspector is missing.');
      return panel.textContent ?? '';
    }));
  const click = async (x, y) => {
    const host = await page.evaluate(async () => {
      const iframe = document.querySelector('iframe[srcdoc]');
      if (!(iframe instanceof HTMLIFrameElement)) throw new Error('The Flow iframe is unavailable.');
      iframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const box = iframe.getBoundingClientRect();
      return { x: box.left + iframe.clientLeft, y: box.top + iframe.clientTop };
    });
    await page.waitForTimeout(150);
    const current = await state();
    const point = await sandbox.evaluate(({ x, y, basis }) => {
      const canvas = document.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The Flow canvas is unavailable.');
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
  expectBox(current.boxes.flow, 8, 74, 40, 20); expectBox(current.boxes.peer, 48, 56, 40, 40);
  const stamps = { flow: current.boxes.flow.stamp, peer: current.boxes.peer.stamp };
  await click(12, 90); current = await state(); assert.deepEqual(current.hits, ['flow']);
  await click(20, 158); current = await state(); assert.equal(current.first, 22); expectBox(current.boxes.flow, 8, 64, 40, 20); expectBox(current.boxes.peer, 48, 56, 40, 40); assert.deepEqual({ flow: current.boxes.flow.stamp, peer: current.boxes.peer.stamp }, stamps);
  const movedHits = current.hits.length; await click(12, 90); current = await state(); assert.equal(current.hits.length, movedHits); await click(12, 70); current = await state(); assert.equal(current.hits.at(-1), 'flow');
  await click(100, 158); current = await state(); assert.equal(current.relative, true); expectBox(current.boxes.flow, 8, 74, 40, 20); expectBox(current.boxes.peer, 48, 56, 40, 40); assert.deepEqual({ flow: current.boxes.flow.stamp, peer: current.boxes.peer.stamp }, stamps);
  await click(196, 158); current = await state(); assert.equal(current.empty, true); assert.equal(current.boxes.flow, undefined); expectBox(current.boxes.peer, 48, 66, 40, 40); assert.equal(current.boxes.peer.stamp, stamps.peer);
  const hitsBeforeEmpty = current.hits.length; await click(12, 74); current = await state(); assert.equal(current.hits.length, hitsBeforeEmpty); await click(52, 74); current = await state(); assert.equal(current.hits.at(-1), 'peer');
  await click(196, 158); await click(100, 158); await click(20, 158);
  current = await state(); assert.equal(current.empty, false); assert.equal(current.relative, false); assert.equal(current.first, 12);
  expectBox(current.boxes.flow, 8, 74, 40, 20);
  expectBox(current.boxes.peer, 48, 56, 40, 40);
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await sandbox.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/') && !value.includes('packages/core/src/'))); }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__?.(); });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]);
  assert.deepEqual(errors, []);
    console.warn(JSON.stringify({ base, initial: stamps, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0, 0], errors }));
  } catch (error) {
    const failure = await Promise.all([
      page.evaluate(() => ({ iframeCount: document.querySelectorAll('iframe[srcdoc]').length, url: location.href })),
      Promise.resolve(trace),
    ]);
    console.error(JSON.stringify({ flowDriverFailure: String(error), outer: failure[0], trace: failure[1] }));
    throw error;
  }
} finally { await browser.close(); }
