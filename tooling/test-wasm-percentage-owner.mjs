import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv.slice(2).find(value => !value.startsWith('--')) ?? 'http://127.0.0.1:5192';
const source = process.argv.includes('--source');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1150 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#/examples/layout/wasm-flex-percentage-owner`);
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(220);
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 540);
    await frame.locator('canvas').click({ position: { x: (bounds.width - 760 * scale) / 2 + x * scale, y: (bounds.height - 540 * scale) / 2 + y * scale } });
    await page.waitForTimeout(160);
    return state();
  };
  const pixel = async (x, y) => frame.locator('canvas').evaluate((canvas, point) => {
    const scale = Math.min(canvas.width / 760, canvas.height / 540);
    return [...canvas.getContext('2d').getImageData(Math.floor((canvas.width - 760 * scale) / 2 + point.x * scale), Math.floor((canvas.height - 540 * scale) / 2 + point.y * scale), 1, 1).data];
  }, { x, y });
  const red = [182, 61, 61, 255], green = [66, 107, 97, 255];
  const initial = await state();
  assert.equal(initial.externalOwner, 200);
  assert.deepEqual(await pixel(59, 210), red); assert.deepEqual(await pixel(62, 210), green);
  assert.deepEqual((await click(59, 210)).hits, ['A']);
  assert.deepEqual((await click(62, 210)).hits, ['A', 'B']);
  const medium = await click(60, 138); assert.equal(medium.externalOwner, 160);
  assert.deepEqual(await pixel(57, 210), red); assert.deepEqual(await pixel(59, 210), green);
  assert.deepEqual((await click(59, 210)).hits, ['A', 'B', 'B']);
  const small = await click(60, 138); assert.equal(small.externalOwner, 80);
  assert.deepEqual(await pixel(47, 210), red); assert.deepEqual(await pixel(49, 210), green);
  assert.deepEqual((await click(120, 210)).hits, ['A', 'B', 'B', 'B']);
  const restored = await click(60, 138); assert.equal(restored.externalOwner, 200);
  assert.deepEqual(await pixel(59, 210), red);
  assert.equal(restored.layout.nodeCreates, initial.layout.nodeCreates);
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (!source) {
    assert.equal(proof.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]);
  assert.deepEqual(errors, []);
  console.warn(`${source ? 'Source' : 'Built'} staged percentage owner: external200→160→80→200 preserves native nodes; exact paint boundaries and hit transfer agree; disposal0000; ${proof?.coreInputs.length ?? 'source'} inputs.`);
} finally { await browser.close(); }
