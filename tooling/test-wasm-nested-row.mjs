import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv.slice(2).find(value => !value.startsWith('--')) ?? 'http://127.0.0.1:5192';
const source = process.argv.includes('--source');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#/examples/layout/wasm-flex-nested-intrinsic`);
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: { x: (bounds.width - 760 * scale) / 2 + x * scale, y: (bounds.height - 460 * scale) / 2 + y * scale } });
    await page.waitForTimeout(180);
    return state();
  };
  const initial = await click(672, 166);
  assert.equal(initial.nestedMeasurement, true);
  assert.deepEqual(initial.badgeBox, { x: 28, y: 148, width: 60, height: 20, stamp: initial.badgeBox.stamp });
  assert.equal(initial.badgeFollowerBox.y, 168);
  assert.equal(initial.layout.activeWasmInstances, 1);
  const narrow = await click(60, 110);
  assert.equal(narrow.nestedWidth, 60);
  assert.deepEqual(narrow.badgeBox, { x: 28, y: 148, width: 40, height: 60, stamp: initial.badgeBox.stamp });
  assert.equal(narrow.badgeFollowerBox.y, 208);
  assert.equal(narrow.badgeFollowerBox.stamp, initial.badgeFollowerBox.stamp);
  assert.equal(narrow.layout.nodeCreates, initial.layout.nodeCreates);
  assert.equal(narrow.layout.activeArenas, initial.layout.activeArenas);
  assert.equal(narrow.layout.wasmInstanceCreates, initial.layout.wasmInstanceCreates);
  assert.ok(narrow.layout.measurementSolves > initial.layout.measurementSolves);
  assert.equal((await click(33, 178)).badgeTarget, 'badge');
  assert.equal((await click(33, 218)).badgeTarget, 'follower');
  const raised = await click(432, 426);
  assert.equal(raised.badgeMinimum, 70);
  assert.equal(raised.badgeBox.height, 70);
  assert.equal(raised.badgeFollowerBox.y, 218);
  assert.equal(raised.badgeBox.stamp, initial.badgeBox.stamp);
  assert.equal(raised.layout.nodeCreates, initial.layout.nodeCreates);
  assert.equal((await click(33, 213)).badgeTarget, 'badge');
  assert.equal((await click(33, 228)).badgeTarget, 'follower');
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const painted = await click(432, 110);
  assert.equal(painted.layout.nodeCreates, raised.layout.nodeCreates);
  assert.equal(painted.layout.activeArenas, raised.layout.activeArenas);
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
  console.warn(`${source ? 'Source' : 'Built'} recursive row: width60→40, height20→60→70, footer168→208→218, distinct moved targets, keyed identity, one root WASM instance, native measurement arenas released, cleanup0000; ${proof?.coreInputs.length ?? 'source'} inputs. Aggregate paint reuse remains open.`);
} finally { await browser.close(); }
