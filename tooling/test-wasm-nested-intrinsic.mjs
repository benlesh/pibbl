import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv.slice(2).find(argument => !argument.startsWith('--')) ?? 'http://127.0.0.1:5188';
const sourceLane = process.argv.includes('--source');
const packedLane = process.argv.includes('--packed');
const structural = process.argv.includes('--structural');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  const layoutDownloads = [];
  page.on('response', response => { if (new URL(response.url()).pathname.endsWith('/layout.wasm')) layoutDownloads.push({url:response.url(),status:response.status()}); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#/examples/layout/wasm-flex-nested-intrinsic`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  try { await frame.locator('pre').waitFor({ timeout: 10000 }); }
  catch (error) { throw new Error(`${error.message}; browser errors: ${JSON.stringify(errors)}`, { cause: error }); }
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: { x: (bounds.width - 760 * scale) / 2 + x * scale, y: (bounds.height - 460 * scale) / 2 + y * scale } });
    await page.waitForTimeout(180); return state();
  };
  await page.waitForTimeout(180);
  if (structural) {
    const selected = await click(620, 40);
    assert.equal(selected.structuralCard, true);
    assert.equal(selected.descriptions, 1);
    assert.equal(selected.paragraphDescriptions, 1);
  }
  const initial = await state(); assert.equal(initial.footerBox.y, initial.cardBottom+12);
  const narrow = await click(60,110);
  assert.ok(narrow.footerBox.y > initial.footerBox.y); assert.equal(narrow.footerBox.y, narrow.cardBottom+12);
  assert.equal(narrow.layout.nodeCreates, initial.layout.nodeCreates);
  assert.equal(narrow.layout.layoutInputInvalidations, initial.layout.layoutInputInvalidations+1);
  assert.equal(narrow.layout.paintInputInvalidations, initial.layout.paintInputInvalidations);
  assert.equal(narrow.layout.measurementInputInvalidations, initial.layout.measurementInputInvalidations);
  assert.equal(narrow.probeRenders, initial.probeRenders+1, 'Measurement must not invoke the opaque probe');
  if (structural) {
    assert.equal(narrow.descriptions, initial.descriptions+1);
    assert.equal(narrow.paragraphDescriptions, initial.paragraphDescriptions+1);
  }
  assert.equal((await click(40,initial.footerBox.y+12)).footerHits, 0);
  assert.equal((await click(40,narrow.footerBox.y+12)).footerHits, 1);
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const short = await click(236,110);
  assert.ok(short.footerBox.y < narrow.footerBox.y); assert.equal(short.footerBox.y, short.cardBottom+12);
  assert.ok(short.layout.measurementInputInvalidations > narrow.layout.measurementInputInvalidations);
  const painted = await click(432,110);
  assert.ok(painted.layout.paintInputInvalidations > short.layout.paintInputInvalidations);
  assert.equal(painted.layout.layoutInputInvalidations, short.layout.layoutInputInvalidations);
  assert.equal(painted.layout.measurementInputInvalidations, short.layout.measurementInputInvalidations);
  assert.equal(painted.layout.unknownInputInvalidations, short.layout.unknownInputInvalidations);
  assert.equal(painted.layout.solves, short.layout.solves);
  if (!structural) assert.equal(painted.layout.measuredLeaves, short.layout.measuredLeaves, 'Nested aggregate paint reuse');
  // Structural Cards currently remeasure aggregate height each transaction.
  const reversed = await click(40,426);
  assert.equal(reversed.layout.nodeCreates, painted.layout.nodeCreates);
  assert.deepEqual(reversed.keys, ['note','main']);
  assert.ok(reversed.layout.measuredLeaves > painted.layout.measuredLeaves);
  const removed = await click(240,426);
  assert.ok(removed.footerBox.y < reversed.footerBox.y);
  assert.equal(removed.layout.activeNodes, reversed.layout.activeNodes-1);
  const detached = await click(240,110);
  if (!structural) assert.equal(detached.layout.measuredLeaves, removed.layout.measuredLeaves);
  assert.equal(detached.probeRenders, removed.probeRenders);
  assert.equal((await click(40,reversed.footerBox.y+30)).footerHits, 1);
  assert.equal((await click(40,removed.footerBox.y+12)).footerHits, 2);
  const restored = await click(240,426);
  assert.equal(restored.layout.nodeCreates, painted.layout.nodeCreates+1);
  assert.ok(restored.footerBox.y > removed.footerBox.y);
  assert.equal(restored.footerBox.y, restored.cardBottom+12);
  assert.equal(restored.footerBox.y, narrow.footerBox.y);
  assert.ok(restored.layout.cachedMeasurements <= 2*restored.layout.activeNodes);
  const repainted = await click(432,110);
  if (!structural) assert.equal(repainted.layout.measuredLeaves, restored.layout.measuredLeaves);
  // Isolate the settled-owner percentage cap with short text so both sizes fit.
  await click(236,110);
  await click(60,110);
  const capped = await click(620,78);
  assert.equal(capped.percentageCap, true);
  assert.equal(capped.width, 420);
  const cappedNarrow = await click(60,110);
  assert.equal(cappedNarrow.width, 220);
  assert.ok(cappedNarrow.footerBox.y > capped.footerBox.y, 'Percentage cap must track the settled column width');
  assert.equal(cappedNarrow.footerBox.y, cappedNarrow.cardBottom+12);
  assert.equal(cappedNarrow.layout.nodeCreates, capped.layout.nodeCreates);
  const previousHits = cappedNarrow.footerHits;
  assert.equal((await click(40,capped.footerBox.y+4)).footerHits, previousHits, 'Old percentage-constrained target must miss');
  assert.equal((await click(40,cappedNarrow.footerBox.y+4)).footerHits, previousHits+1);
  const sandbox = page.frames().find(item => item.url() === 'about:srcdoc');
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (!sourceLane) {
    assert.equal(proof?.mode, packedLane ? 'layout-wasm-packed' : 'layout-wasm-built');
    assert.ok(proof.coreInputs.length > 0 && proof.coreInputs.every(path => path.includes(packedLane ? '/node_modules/@pibbl/core/dist/' : 'packages/core/.layout-wasm-package/dist/')));
    if (packedLane) {
      const receipt = await sandbox.evaluate(() => ({...globalThis.__PIBBL_PACKED_PROOF__, request: undefined}));
      assert.equal(receipt.importInert, true);
      assert.equal(receipt.aspectRatio, true, 'Installed package must honor final-main outer aspect geometry');
      assert.equal(receipt.wrappedAspectRatio, true, 'Installed package must move wrapped ratio paint and targets after resize');
      assert.equal(receipt.frozenPartial, true, 'Installed package must use initially frozen sizes for partial factors');
      assert.equal(receipt.safeOverflow, true, 'Installed package must use safe overflow start');
      assert.equal(receipt.percentagePadding, true, 'Installed percentage padding must move actual inner paint and targets');
      assert.equal(receipt.percentageGaps, true, 'Installed percentage gaps must use resized content axes and move targets');
      assert.equal(receipt.percentageBounds, true, 'Installed percentage caps must recompute against the resized owner and move targets');
      assert.equal(receipt.textCrossHits, 1, 'Measured auto-cross target must agree with installed placement');
      assert.ok(receipt.modules > 0 && receipt.instances > 0, 'Installed package must execute embedded WASM');
      assert.match(proof.sha256, /^[a-f0-9]{64}$/);
    }
  }
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0,0,0]);
  await page.waitForTimeout(180);
  assert.deepEqual(await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__()), disposed);
  assert.deepEqual(errors, []);
  if (!base.includes('/offline') && !packedLane) {
    assert.ok(layoutDownloads.some(download => download.status === 200), 'Async public mounting must fetch the external layout asset');
  } else assert.equal(layoutDownloads.length, 0, 'Embedded sync must work without any external layout request');
  console.warn(`${sourceLane ? 'Source' : 'Built'} nested intrinsic: footer ${initial.footerBox.y}→${narrow.footerBox.y}→${short.footerBox.y}, probe normal-only, moved targets, keyed remove/restore, detached source inert, ${structural ? 'per-transaction Card preparation' : 'bounded paint reuse'}, receiver roles, percentage cross cap with moved targets, zero disposal ownership; ${proof?.coreInputs.length ?? 'source'} inputs`);
} finally { await browser.close(); }
