import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-intrinsic-primitive`);
  const host = page.locator('iframe[srcdoc]'); await host.waitFor(); await host.scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const box = await frame.locator('canvas').boundingBox(), scale = Math.min(box.width / 760, box.height / 360);
  await frame.locator('canvas').click({ position: { x: (box.width - 760 * scale) / 2 + 450 * scale, y: (box.height - 360 * scale) / 2 + 315 * scale } });
  await assert.doesNotReject(() => frame.locator('pre').filter({ hasText: '"invalid":12' }).waitFor());
  const receipt = JSON.parse((await frame.locator('pre').innerText()).split('bound validation: ')[1].split('\n')[0]);
  assert.deepEqual(receipt, { invalid: 12, unresolved: 4, providerCalls: 0, resourcesUnchanged: true });
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) { assert.equal(proof.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('/.layout-wasm-package/dist/'))); }
  const cleanup = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); const d = globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); return [d.activeNodes, d.activeArenas, d.cachedMeasurements]; });
  assert.deepEqual(cleanup, [0, 0, 0]); assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, receipt, builtInputs: built ? proof.coreInputs.length : null, cleanup, errors }));
} finally { await browser.close(); }
