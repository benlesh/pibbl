import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
const reference = JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'));
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-yoga-migration`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 460 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(240);
  };
  for (const [index, fixture] of reference.cases.entries()) {
    if (index) await click(60, 158);
    assert.ok((await frame.locator('pre').innerText()).includes(fixture.name));
    for (const [index, box] of fixture.boxes.entries()) {
      await click(392 + box.x + 4, 240 + box.y + 4);
      assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${index === 0 ? 'A' : 'B'}`));
    }
  }
  // The final column case must leave its 12px main-axis gap untargeted.
  const last = reference.cases.at(-1);
  if (last.flexDirection === 'column') {
    await click(396, 240 + last.boxes[0].height + 6);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: B'));
  }
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
  console.warn(JSON.stringify({ base, commit: reference.commit, cases: reference.cases.map(value => value.name), builtInputs: proof?.coreInputs.length ?? null, cleanup: [0, 0, 0], errors }));
} finally { await browser.close(); }
