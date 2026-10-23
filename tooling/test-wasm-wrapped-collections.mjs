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
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
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
  assert.equal(initial.layout.activeNodes, 6); assert.equal(initial.layout.activeArenas, 2); assert.equal(initial.layout.activeWasmInstances, 1);
  const rowA = initial.boxes['row:A'], rowB = initial.boxes['row:B'], rowC = initial.boxes['row:C'];
  const columnA = initial.boxes['column:A'], columnB = initial.boxes['column:B'], columnC = initial.boxes['column:C'];
  for (const [x,y] of [
    [(rowA.x+rowA.width+rowB.x)/2,rowA.y+4],
    [rowA.x+4,(rowA.y+rowA.height+rowC.y)/2],
    [columnA.x+4,(columnA.y+columnA.height+columnB.y)/2],
    [(columnA.x+columnA.width+columnC.x)/2,columnA.y+4],
  ]) assert.equal((await click(x,y)).hits, initial.hits, 'Main and cross gaps in both axes must miss');
  const reversedAxes = await click(660,118);
  assert.equal(reversedAxes.reverseAxes, true);
  assert.deepEqual(reversedAxes.keys, initial.keys);
  assert.equal(reversedAxes.boxes['row:A'].x, initial.boxes['row:B'].x);
  assert.equal(reversedAxes.boxes['column:A'].y, initial.boxes['column:B'].y);
  for (const id of Object.keys(initial.boxes)) assert.equal(reversedAxes.boxes[id].stamp, initial.boxes[id].stamp);
  assert.equal(reversedAxes.layout.nodeCreates, initial.layout.nodeCreates);
  assert.equal(reversedAxes.layout.solves, initial.layout.solves);
  assert.equal(reversedAxes.layout.measuredLeaves, initial.layout.measuredLeaves);
  assert.ok(reversedAxes.layout.mainPlacements > initial.layout.mainPlacements);
  assert.equal((await click(40,192)).selected, 'row:B');
  assert.equal((await click(226,192)).selected, 'row:A');
  assert.equal((await click(452,192)).selected, 'column:B');
  assert.equal((await click(452,288)).selected, 'column:A');
  assert.equal((await click(660,118)).reverseAxes, false);
  const beforeLines = await state();
  const reversedLines = await click(80,156);
  assert.equal(reversedLines.reverseLines, true);
  assert.deepEqual(reversedLines.keys, initial.keys);
  assert.equal(reversedLines.boxes['row:A'].y, 320);
  assert.equal(reversedLines.boxes['row:C'].y, 228);
  assert.equal(reversedLines.boxes['column:A'].x, 602);
  assert.equal(reversedLines.boxes['column:C'].x, 460);
  for (const id of Object.keys(initial.boxes)) assert.equal(reversedLines.boxes[id].stamp, initial.boxes[id].stamp);
  assert.equal(reversedLines.layout.solves, beforeLines.layout.solves);
  assert.equal(reversedLines.layout.mainPlacements, beforeLines.layout.mainPlacements);
  assert.equal(reversedLines.layout.measuredLeaves, beforeLines.layout.measuredLeaves);
  assert.ok(reversedLines.layout.crossPlacements > beforeLines.layout.crossPlacements);
  assert.equal((await click(40,192)).hits, reversedLines.hits);
  assert.equal((await click(40,332)).selected, 'row:A');
  assert.equal((await click(614,192)).selected, 'column:A');
  const logicalStart = await click(260,154);
  assert.equal(logicalStart.crossEdge, 'start');
  assert.equal(logicalStart.boxes['row:A'].y, 272);
  assert.equal(logicalStart.boxes['row:C'].y, 180);
  assert.equal(logicalStart.boxes['column:A'].x, 582);
  assert.equal(logicalStart.boxes['column:C'].x, 440);
  for (const id of Object.keys(initial.boxes)) assert.equal(logicalStart.boxes[id].stamp, reversedLines.boxes[id].stamp);
  assert.equal(logicalStart.layout.nodeCreates, reversedLines.layout.nodeCreates);
  assert.equal(logicalStart.layout.solves, reversedLines.layout.solves);
  assert.equal(logicalStart.layout.mainPlacements, reversedLines.layout.mainPlacements);
  assert.ok(logicalStart.layout.crossPlacements > reversedLines.layout.crossPlacements);
  const logicalEnd = await click(260,154);
  assert.equal(logicalEnd.crossEdge, 'end');
  assert.equal(logicalEnd.boxes['row:A'].y, 320);
  assert.equal(logicalEnd.boxes['row:C'].y, 228);
  assert.equal(logicalEnd.boxes['column:A'].x, 602);
  assert.equal(logicalEnd.boxes['column:C'].x, 460);
  for (const id of Object.keys(initial.boxes)) assert.equal(logicalEnd.boxes[id].stamp, logicalStart.boxes[id].stamp);
  assert.equal(logicalEnd.layout.nodeCreates, logicalStart.layout.nodeCreates);
  assert.equal(logicalEnd.layout.solves, logicalStart.layout.solves);
  assert.equal(logicalEnd.layout.mainPlacements, logicalStart.layout.mainPlacements);
  assert.ok(logicalEnd.layout.crossPlacements > logicalStart.layout.crossPlacements);
  const physicalStart = await click(260,154);
  assert.equal(physicalStart.crossEdge, 'flex-start');
  assert.equal(physicalStart.boxes['row:A'].y, 320);
  assert.equal(physicalStart.boxes['row:C'].y, 228);
  assert.equal(physicalStart.boxes['column:A'].x, 602);
  assert.equal(physicalStart.boxes['column:C'].x, 460);
  assert.equal((await click(80,156)).reverseLines, false);
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
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0,0,0,0]);
  await page.waitForTimeout(180);
  assert.deepEqual(await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__()), disposed);
  assert.deepEqual(errors, []);
  console.warn(`${sourceLane ? 'Source' : 'Built'} wrapped collection: ownership6→4→6→0, reorder keeps stamps/nodes, restore creates2, targets and four physical gap misses agree, paint reuses solves; ${proof?.coreInputs.length ?? 'source'} inputs`);
} finally { await browser.close(); }
