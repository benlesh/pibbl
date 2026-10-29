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

  // The optional composition mode uses the same reverse/RTL controls but has two
  // overlapping keyed targets. B remains later in source paint and focus order
  // while its pixels pass through a translated Group, retained Layer, and filter.
  const beforeComposition = await state();
  if (beforeComposition.reverseAxes) await click(660,118);
  if (beforeComposition.layoutDirection !== 'ltr') await click(664,156);
  const composition = await click(500,78);
  assert.equal(composition.composition.mode, true);
  assert.deepEqual(composition.composition.boxes['composition:A'], { x: 30, y: 230, width: 60, height: 30, stamp: composition.composition.boxes['composition:A'].stamp });
  assert.deepEqual(composition.composition.boxes['composition:B'], { x: 70, y: 230, width: 60, height: 30, stamp: composition.composition.boxes['composition:B'].stamp });
  const compositionStamps = {
    A: composition.composition.boxes['composition:A'].stamp,
    B: composition.composition.boxes['composition:B'].stamp,
  };
  const compositionPixel = async (value, point = { x: 80, y: 235 }) => frame.locator('canvas').evaluate((canvas, { basis, fill, point }) => {
    const reference = document.createElement('canvas'); reference.width = 1; reference.height = 1;
    const expectedContext = reference.getContext('2d');
    expectedContext.fillStyle = '#19375b'; expectedContext.fillRect(0, 0, 1, 1);
    expectedContext.globalAlpha = 0.5; expectedContext.fillStyle = fill; expectedContext.fillRect(0, 0, 1, 1);
    const x = Math.floor(basis.a * point.x + basis.c * point.y + basis.e);
    const y = Math.floor(basis.b * point.x + basis.d * point.y + basis.f);
    const actual = [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];
    const expected = [...expectedContext.getImageData(0, 0, 1, 1).data];
    return { actual, expected };
  }, { basis: value.composition.rootBasis, fill: value.composition.bFill, point });
  const assertCompositionPixel = async (value, point) => {
    const { actual, expected } = await compositionPixel(value, point);
    for (let index = 0; index < 3; index++) assert.ok(Math.abs(actual[index] - expected[index]) <= 1, `composition RGB channel ${index}: ${actual[index]} !== ${expected[index]}`);
    assert.equal(actual[3], expected[3], 'composition alpha must remain exact');
  };
  await assertCompositionPixel(composition);
  await frame.locator('canvas').focus(); await page.waitForTimeout(180);
  assert.equal((await state()).composition.focus, 'A');
  await frame.locator('canvas').press('Tab'); await page.waitForTimeout(180);
  assert.equal((await state()).composition.focus, 'B');
  let compositionHit = await click(80,235);
  assert.deepEqual(compositionHit.composition.hits, ['B']);

  const compositionReverse = await click(660,118);
  assert.deepEqual([compositionReverse.composition.boxes['composition:A'].x, compositionReverse.composition.boxes['composition:B'].x], [70, 30]);
  assert.equal(compositionReverse.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(compositionReverse.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(compositionReverse);
  compositionHit = await click(80,235);
  assert.deepEqual(compositionHit.composition.hits, ['B', 'B']);

  const compositionRtl = await click(664,156);
  assert.equal(compositionRtl.layoutDirection, 'rtl');
  assert.deepEqual([compositionRtl.composition.boxes['composition:A'].x, compositionRtl.composition.boxes['composition:B'].x], [30, 70]);
  assert.equal(compositionRtl.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(compositionRtl.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(compositionRtl);
  compositionHit = await click(80,235);
  assert.deepEqual(compositionHit.composition.hits, ['B', 'B', 'B']);

  const disabledTarget = await click(660,78);
  assert.equal(disabledTarget.composition.targets, false);
  await assertCompositionPixel(disabledTarget);
  compositionHit = await click(80,235);
  assert.deepEqual(compositionHit.composition.hits, ['B', 'B', 'B', 'A']);

  const beforeCompositionPaint = await state();
  const compositionPainted = await click(496,118);
  assert.equal(compositionPainted.composition.bFill, '#426b61');
  assert.equal(compositionPainted.layout.solves, beforeCompositionPaint.layout.solves);
  assert.equal(compositionPainted.layout.nodeCreates, beforeCompositionPaint.layout.nodeCreates);
  assert.equal(compositionPainted.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(compositionPainted.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(compositionPainted);

  // The default composition proof above deliberately remains nowrap. Reverse
  // lines switches this same source-ordered Group → Layer → filter subtree to
  // two overlapping wrapped lines, without changing target or ownership rules.
  if (!compositionPainted.composition.targets) await click(660,78);
  if (compositionPainted.reverseAxes) await click(660,118);
  if (compositionPainted.layoutDirection !== 'ltr') await click(664,156);
  const wrappedComposition = await click(80,156);
  assert.equal(wrappedComposition.reverseLines, true);
  assert.deepEqual(wrappedComposition.composition.boxes['composition:A'], { x: 30, y: 250, width: 60, height: 30, stamp: compositionStamps.A });
  assert.deepEqual(wrappedComposition.composition.boxes['composition:B'], { x: 30, y: 240, width: 60, height: 30, stamp: compositionStamps.B });
  await assertCompositionPixel(wrappedComposition, { x: 50, y: 255 });
  await frame.locator('canvas').evaluate(canvas => canvas.blur());
  await frame.locator('canvas').focus(); await page.waitForTimeout(180);
  assert.equal((await state()).composition.focus, 'A');
  await frame.locator('canvas').press('Tab'); await page.waitForTimeout(180);
  assert.equal((await state()).composition.focus, 'B');
  compositionHit = await click(50,255);
  assert.equal(compositionHit.composition.hits.at(-1), 'B');
  const wrappedNoTarget = await click(660,78);
  assert.equal(wrappedNoTarget.composition.targets, false);
  await assertCompositionPixel(wrappedNoTarget, { x: 50, y: 255 });
  compositionHit = await click(50,255);
  assert.equal(compositionHit.composition.hits.at(-1), 'A');
  await click(660,78);
  const wrappedReverse = await click(660,118);
  assert.deepEqual([wrappedReverse.composition.boxes['composition:A'].x, wrappedReverse.composition.boxes['composition:B'].x], [70, 70]);
  assert.equal(wrappedReverse.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(wrappedReverse.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(wrappedReverse, { x: 80, y: 255 });
  compositionHit = await click(80,255);
  assert.equal(compositionHit.composition.hits.at(-1), 'B');
  const wrappedRtl = await click(664,156);
  assert.equal(wrappedRtl.layoutDirection, 'rtl');
  assert.deepEqual([wrappedRtl.composition.boxes['composition:A'].x, wrappedRtl.composition.boxes['composition:B'].x], [30, 30]);
  assert.equal(wrappedRtl.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(wrappedRtl.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(wrappedRtl, { x: 50, y: 255 });
  compositionHit = await click(50,255);
  assert.equal(compositionHit.composition.hits.at(-1), 'B');
  const beforeWrappedPaint = await state();
  const wrappedPainted = await click(496,118);
  assert.equal(wrappedPainted.layout.solves, beforeWrappedPaint.layout.solves);
  assert.equal(wrappedPainted.layout.nodeCreates, beforeWrappedPaint.layout.nodeCreates);
  assert.equal(wrappedPainted.composition.boxes['composition:A'].stamp, compositionStamps.A);
  assert.equal(wrappedPainted.composition.boxes['composition:B'].stamp, compositionStamps.B);
  await assertCompositionPixel(wrappedPainted, { x: 50, y: 255 });
  console.warn('wrappedReverseComposition=true');

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
