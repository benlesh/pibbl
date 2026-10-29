import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv.slice(2).find(argument => !argument.startsWith('--')) ?? 'http://127.0.0.1:5188';
const sourceLane = process.argv.includes('--source');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#/examples/layout/wasm-built-lifecycle`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.getByRole('button', { name: 'Remove content', exact: true }).waitFor({ timeout: 8000 });
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const wait = async predicate => {
    for (let i = 0; i < 60; i++) {
      const value = await state();
      if (predicate(value)) return value;
      await page.waitForTimeout(50);
    }
    throw new Error(`State did not settle: ${JSON.stringify(await state())}`);
  };
  const initial = await wait(s => s.mounted && s.rendererCreates === 1 && s.rendererWidth === 324);
  const ownership = s => ['activeNodes', 'activeArenas', 'cachedMeasurements', 'activeWasmInstances'].map(key => s.layout[key] - s.baseline[key]);
  assert.ok(ownership(initial)[0] > 0);
  assert.equal(ownership(initial)[1], 2); assert.equal(ownership(initial)[3], 1);
  const clickEdge = async (previousY) => {
    const box = await frame.locator('canvas').boundingBox();
    const logical = await state();
    const scale = Math.min(box.width / 760, box.height / 460);
    await frame.locator('canvas').click({ position: { x: (28 + logical.rendererWidth - 12) * scale + (box.width - 760 * scale) / 2, y: (148 + (previousY ?? logical.rendererY) + 12) * scale + (box.height - 460 * scale) / 2 } });
  };
  await clickEdge();
  await wait(s => s.hits === 1);
  await frame.getByRole('button', { name: 'Resize', exact: true }).click();
  await wait(s => s.rendererWidth === 144);
  await clickEdge();
  await wait(s => s.hits === 2);
  const beforeText = await state();
  await frame.getByRole('button', { name: 'Change text', exact: true }).click();
  await wait(s => s.rendererY > beforeText.rendererY);
  await clickEdge(beforeText.rendererY);
  await page.waitForTimeout(120);
  assert.equal((await state()).hits, 2, 'Old Text-dependent target must be removed');
  await clickEdge();
  await wait(s => s.hits === 3);
  const narrow = await state();
  for (let i = 0; i < 4; i++) {
    await frame.getByRole('button', { name: 'Remove content', exact: true }).click();
    const disposed = await wait(s => !s.mounted && s.rendererDisposes === s.rendererCreates);
    assert.deepEqual(ownership(disposed), [0, 0, 0, 1]);
    const before = { ...disposed.layout };
    await frame.getByRole('button', { name: 'Change text', exact: true }).click();
    await page.waitForTimeout(120);
    const detached = await state();
    assert.deepEqual(detached.layout, before, 'Detached input must request no layout work');
    await frame.getByRole('button', { name: 'Restore content', exact: true }).click();
    await wait(s => s.mounted && s.rendererCreates === i + 2 && s.layout.activeArenas === narrow.layout.activeArenas && s.layout.activeNodes === initial.layout.activeNodes);
    assert.equal(ownership(await state())[3], 1);
    assert.ok((await state()).layout.cachedMeasurements <= initial.layout.activeNodes * 2);
  }
  await frame.getByRole('button', { name: 'Remove content', exact: true }).click();
  const final = await wait(s => !s.mounted && s.rendererDisposes === 5);
  assert.deepEqual(ownership(final), [0, 0, 0, 1]);
  const sandbox = page.frames().find(item => item.url() === 'about:srcdoc');
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (!sourceLane) {
    assert.equal(proof?.mode, 'layout-wasm-built', 'Built proof required independently of server port');
    assert.ok(proof.coreInputs.length > 0);
    assert.ok(proof.coreInputs.every(path => path.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const rootDisposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual(['activeNodes', 'activeArenas', 'cachedMeasurements', 'activeWasmInstances'].map(key => rootDisposed[key]), [0, 0, 0, 0]);
  assert.deepEqual(errors, []);
  console.warn(`${sourceLane ? 'Source' : 'Built'} lifecycle: 5 creates/5 disposes, ownership ${ownership(initial).join('/')} to 0/0/0/1 while root lives, then 0/0/0/0 on root disposal, detached signals inert, final allocation hit targets agree; ${proof?.coreInputs.length ?? 'source'} core inputs`);
} finally { await browser.close(); }
