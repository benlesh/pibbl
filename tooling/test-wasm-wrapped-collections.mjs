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
  await page.goto(`${base}/#/examples/layout/wasm-flex-keyed-wrap`);
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor({ timeout: 10000 });
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: { x: (bounds.width - 760 * scale) / 2 + x * scale, y: (bounds.height - 460 * scale) / 2 + y * scale } });
    await page.waitForTimeout(180); return state();
  };
  await page.waitForTimeout(180);
  const initial = await state();
  assert.equal(initial.boxes['row:C'].y, 272); assert.equal(initial.boxes['column:C'].x, 582);
  assert.equal(initial.layout.activeNodes, 6); assert.equal(initial.layout.activeArenas, 2);
  const reordered = await click(40,118);
  assert.deepEqual(reordered.keys, ['C','B','A']);
  for (const id of Object.keys(initial.boxes)) assert.equal(reordered.boxes[id].stamp, initial.boxes[id].stamp);
  assert.equal(reordered.layout.nodeCreates, initial.layout.nodeCreates);
  assert.equal((await click(40,284)).selected, 'row:A');
  assert.equal((await click(594,192)).selected, 'column:A');
  const removed = await click(192,118);
  assert.deepEqual(removed.keys, ['C','A']); assert.equal(removed.layout.activeNodes, 4);
  assert.equal(removed.boxes['row:B'], undefined); assert.equal(removed.boxes['column:B'], undefined);
  assert.equal((await click(594,192)).hits, removed.hits, 'Former second-column target must miss');
  assert.equal((await click(226,192)).selected, 'row:A');
  assert.equal((await click(452,288)).selected, 'column:A');
  const restored = await click(344,118);
  assert.deepEqual(restored.keys, ['C','A','B']);
  assert.equal(restored.layout.activeNodes, 6); assert.equal(restored.layout.nodeCreates, initial.layout.nodeCreates + 2);
  for (const zone of ['row','column']) {
    for (const key of ['A','C']) assert.equal(restored.boxes[`${zone}:${key}`].stamp, initial.boxes[`${zone}:${key}`].stamp);
    assert.notEqual(restored.boxes[`${zone}:B`].stamp, initial.boxes[`${zone}:B`].stamp);
  }
  const painted = await click(496,118);
  assert.equal(painted.layout.solves, restored.layout.solves); assert.equal(painted.layout.lineFormations, restored.layout.lineFormations);
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const sandbox = page.frames().find(item => item.url() === 'about:srcdoc');
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (!sourceLane) {
    assert.equal(proof?.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length > 0 && proof.coreInputs.every(path => path.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const disposed = await sandbox.evaluate(() => {
    // Exercise Studio's normal pagehide -> returned public controller.dispose path.
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0,0,0]);
  await page.waitForTimeout(180);
  assert.deepEqual(await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__()), disposed);
  assert.deepEqual(errors, []);
  console.warn(`${sourceLane ? 'Source' : 'Built'} wrapped collection: ownership6→4→6→0, reorder keeps stamps/nodes, restore creates2, targets agree, paint reuses solves; ${proof?.coreInputs.length ?? 'source'} inputs`);
} finally { await browser.close(); }
