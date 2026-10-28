import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-intrinsic-sizing`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Jump to Live Canvas', { exact: true }).click();
  await page.waitForFunction(() => !!document.querySelector('iframe[srcdoc]'));
  let sandbox;
  for (let attempt = 0; attempt < 300; attempt++) {
    const candidate = page.frames().find(value => value.url() === 'about:srcdoc');
    if (candidate && await candidate.evaluate(() => !!document.querySelector('pre')).catch(() => false)) { sandbox = candidate; break; }
    await page.waitForTimeout(100);
  }
  if (!sandbox) throw new Error('The intrinsic sizing sandbox did not initialize.');
  const state = async () => JSON.parse(await sandbox.evaluate(() => document.querySelector('pre')?.textContent ?? ''));
  const click = async (x, y) => {
    const host = await page.evaluate(async () => {
      const iframe = document.querySelector('iframe[srcdoc]'); if (!(iframe instanceof HTMLIFrameElement)) throw new Error('Missing intrinsic sizing iframe.');
      iframe.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const box = iframe.getBoundingClientRect(); return { x: box.left + iframe.clientLeft, y: box.top + iframe.clientTop };
    });
    await page.waitForTimeout(150);
    const current = await state();
    const point = await sandbox.evaluate(({ x, y, basis }) => {
      const canvas = document.querySelector('canvas'); if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing intrinsic sizing canvas.');
      const rect = canvas.getBoundingClientRect(), transformed = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).transformPoint({ x, y });
      return { x: rect.left + transformed.x * rect.width / canvas.width, y: rect.top + transformed.y * rect.height / canvas.height };
    }, { x, y, basis: current.basis });
    await page.mouse.click(host.x + point.x, host.y + point.y); await page.waitForTimeout(150);
  };
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-4, `${label}: ${actual} !== ${expected}`);
  const same = (actual, expected, label) => { near(actual.width, expected.width, `${label}.width`); near(actual.height, expected.height, `${label}.height`); };
  let current = await state();
  same(current.boxes.min, { width: 40, height: 20 }, 'min'); same(current.boxes.fit, { width: 80, height: 20 }, 'fit'); same(current.boxes.tail, { width: 20, height: 20 }, 'tail');
  const stamps = Object.fromEntries(Object.entries(current.boxes).map(([key, value]) => [key, value.stamp]));
  await click(current.boxes.fit.x + 4, current.boxes.fit.y + 4); current = await state(); assert.equal(current.hits.at(-1), 'fit');
  await click(current.boxes.tail.x + 4, current.boxes.tail.y + 4); current = await state(); assert.equal(current.hits.at(-1), 'tail');
  await click(50, 184); current = await state(); assert.equal(current.minimum, 60); assert.equal(current.maximum, 140); same(current.boxes.min, { width: 60, height: 20 }, 'min after content'); same(current.boxes.fit, { width: 80, height: 20 }, 'fit after content'); same(current.boxes.tail, { width: 20, height: 20 }, 'tail after content');
  await click(current.boxes.tail.x + 4, current.boxes.tail.y + 4); current = await state(); assert.equal(current.hits.at(-1), 'tail');
  assert.deepEqual(Object.fromEntries(Object.entries(current.boxes).map(([key, value]) => [key, value.stamp])), stamps);
  const beforePaint = current.intrinsicCalls; await click(50, 222); current = await state(); assert.equal(current.intrinsicCalls, beforePaint, 'paint-only input must not remeasure intrinsic contributions');
  for (let i = 0; i < 3; i++) { await click(160, 184); current = await state(); assert.equal(current.direction, ['Reverse · LTR', 'Row · RTL', 'Reverse · RTL'][i]); same(current.boxes.min, { width: 60, height: 20 }, `min direction ${i}`); same(current.boxes.fit, { width: 80, height: 20 }, `fit direction ${i}`); same(current.boxes.tail, { width: 20, height: 20 }, `tail direction ${i}`); }
  await click(160, 184); current = await state(); assert.equal(current.direction, 'Row · LTR');
  const textTail = current.boxes['text-tail']; assert.ok(textTail, 'Text intrinsic row exposes its following target');
  await click(textTail.x + 4, textTail.y + 4); current = await state(); assert.equal(current.hits.at(-1), 'text-tail');
  const textTailStamp = current.boxes['text-tail'].stamp, oldTextTailX = current.boxes['text-tail'].x;
  await click(160, 222); current = await state(); assert.equal(current.text, 'omega zeta'); assert.equal(current.boxes['text-tail'].stamp, textTailStamp); assert.ok(current.boxes['text-tail'].x < oldTextTailX, 'shorter Canvas run moves the following target');
  const hitsBeforeMovedTarget = current.hits.length;
  await click(oldTextTailX + 4, current.boxes['text-tail'].y + 4); current = await state(); assert.equal(current.hits.length, hitsBeforeMovedTarget, 'old Text tail target is cleared');
  await click(current.boxes['text-tail'].x + 4, current.boxes['text-tail'].y + 4); current = await state(); assert.equal(current.hits.length, hitsBeforeMovedTarget + 1); assert.equal(current.hits.at(-1), 'text-tail');
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await sandbox.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/') && !value.includes('packages/core/src/'))); }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__?.(); });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]); assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, stamps, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0, 0], errors }));
} finally { await browser.close(); }
