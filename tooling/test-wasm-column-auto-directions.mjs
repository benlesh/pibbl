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
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = () => frame.locator('pre').innerText();
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 460 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(180);
  };
  const pixel = (x, y) => sandbox.evaluate(({ x, y }) => {
    const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
    const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({ x, y });
    return [...document.querySelector('canvas').getContext('2d').getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data];
  }, { x, y });
  await click(500, 76);
  const initial = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  for (const family of ['text', 'provider', 'known']) {
    if (family === 'provider') await click(500, 434);
    if (family === 'known') { await click(500, 434); await click(500, 434); }
    for (const reverse of [false, true]) {
      if (reverse) await click(700, 430);
      for (const rtl of [false, true]) {
        if (rtl) await click(700, 394);
        const y = reverse ? 344 : 284;
        const x = family === 'text' ? 598 : family === 'provider' ? 564 : 544;
        await click(rtl ? 564 : 424, reverse ? 324 : 304);
        assert.match(await state(), new RegExp(`selected: column ${family === 'text' ? 'auto sibling' : family === 'provider' ? 'provider sibling' : 'known sibling'}`));
        await click(x, y);
        assert.match(await state(), new RegExp(`selected: column ${family === 'text' ? 'auto text' : family === 'provider' ? 'provider A' : 'known A'}`));
        if (family !== 'text') assert.deepEqual(await pixel(x,y), [138,50,72,255]);
        if (rtl) await click(700, 394);
      }
    }
    await click(700, 430);
  }
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) {
    assert.equal(proof.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances],[0,0,0,0]);
  assert.deepEqual(errors, []);
  console.warn(`${built ? 'Built' : 'Source'} column directions: Text/provider/known physical-left auto targets and paint across column/reverse × LTR/RTL; initial nodes ${initial.nodeCreates}; cleanup0000; ${proof?.coreInputs.length ?? 'source'} inputs.`);
} finally { await browser.close(); }
