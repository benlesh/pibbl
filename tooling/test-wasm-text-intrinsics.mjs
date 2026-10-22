import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-text`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const read = () => sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 460 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(230);
  };
  const selected = async name => assert.match(await frame.locator('pre').innerText(), new RegExp(`selected: ${name}`));
  await click(500, 110); // Frozen proof.
  const frozen = await read();
  await click(250, 110); // Paint.
  const painted = await read();
  assert.equal(painted.allocationPasses, frozen.allocationPasses);
  assert.equal(painted.allocationItemVisits, frozen.allocationItemVisits);
  assert.ok(painted.allocationCacheHits > frozen.allocationCacheHits);
  await click(500, 40); // Minimum comparison.
  await click(500, 110); // Natural basis.
  assert.match(await frame.locator('pre').innerText(), /basis: auto/);
  await click(205, 290); await selected('auto minimum sibling');
  await click(50, 160); // Shorter text changes basis and minimum.
  await click(90, 400); await selected('zero minimum sibling');
  await click(205, 290); await selected('zero minimum sibling'); // Old target misses.
  await click(90, 290); await selected('auto minimum sibling');
  await click(50, 160); // Alternate short text.
  await click(50, 160); // Long text again.
  await click(60, 110); // Narrow.
  assert.match(await frame.locator('pre').innerText(), /used width: 320/);
  await click(90, 400); await selected('zero minimum sibling');
  await click(205, 290); await selected('auto minimum sibling');
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) {
    assert.equal(proof?.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0, 0, 0]);
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, frozen, painted, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0], errors }));
} finally { await browser.close(); }
