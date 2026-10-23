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
      assert.equal(receipt.wrapReversePercentageMargins, true, 'Installed wrap-reverse percentages preserve numeric geometry, moved targets and identity');
      assert.equal(receipt.wrappedPercentageMargins, true, 'Installed wrapped percentage margins preserve physical offsets and moved targets');
      assert.equal(receipt.logicalPadding, true, 'Installed logical padding must preserve owner width, receiver direction, pixels, targets and identity');
      assert.equal(receipt.logicalBorders, true, 'Installed logical borders must preserve logical-edge precedence, receiver direction, pixels, targets and identity');
      assert.equal(receipt.intrinsicProvider, true, 'Installed custom intrinsic providers must query finite bounds, move targets, reuse paint and dispose exactly');
      assert.equal(receipt.intrinsicWrappedHeight, true, 'Installed nested row wrapping must settle auto height before placing the following column target');
      assert.equal(receipt.finalWidthIntrinsicProvider, true, 'Installed custom intrinsic leaves must remeasure at their settled finite width and update hit geometry');
      assert.equal(receipt.directionMatrix, true, 'Installed package must honor the finite logical-edge direction and wrap matrix');
      assert.equal(receipt.autoMargins, true, 'Installed package must honor finite physical auto margins and their alignment precedence');
      assert.equal(receipt.ownerCrossAuto, true, 'Installed package must measure direct wrapped Flex owners before automatic cross-margin placement');
      assert.equal(receipt.automaticTextCrossWidth, true, 'Installed package must settle automatic-width Text before automatic cross-margin placement');
      assert.equal(receipt.wrappedTextCrossAuto, true, 'Installed package must settle wrapped Text before cross-auto placement in its final line');
      assert.equal(receipt.sourceOrderCanvas, true, 'Installed package must preserve source paint order through reverse Flex, Group, Layer and filter composition');
      assert.equal(receipt.roundingScaleZero, true, 'Installed package must preserve the pinned Yoga scale-zero fractional Flex geometry and targets');
      assert.equal(receipt.roundingDensity, true, 'Installed package must round backing dimensions without rounding fractional logical Layer geometry, pointer routing, or focus');
      assert.equal(receipt.nestedCrossMin, true, 'Installed package must settle nested percentage cross minimums before wrapped following targets, preserve keyed leaves, reuse paint, and dispose exactly');
      assert.equal(receipt.nestedDecoratedCrossMin, true, 'Installed package must retain decorated row-reverse nested percentage cross geometry, targets, identity, bounded measurement, and cleanup');
      assert.equal(receipt.nestedDecoratedCrossMax, true, 'Installed package must retain decorated row-reverse nested percentage cross caps, expansion targets, identity, pure paint reuse, and cleanup');
      assert.equal(receipt.nestedDecoratedColumnCrossMax, true, 'Installed package must retain decorated column-reverse nested percentage cross caps, expansion targets, identity, pure paint reuse, and cleanup');
      assert.equal(receipt.nestedDecoratedColumnCrossMin, true, 'Installed package must retain decorated column-reverse nested percentage cross floors, C-to-leaf target movement, identity, pure paint reuse, and cleanup');
      assert.equal(receipt.customColumnMeasure, true, 'Installed package must measure a finite column custom queue at its exact width, move the follower target, reuse nodes on paint, and clean up');
      console.warn('Packed auto margins: 104 fixture cases passed');
      assert.equal(receipt.logicalMargins, true, 'Installed logical percentage margins must move Layer targets without new native nodes');
      assert.equal(receipt.layoutDirection, true, 'Installed direction must reach retained Layer geometry and targets');
      assert.equal(receipt.absoluteAlignment, true, 'Installed no-inset axes must use content alignment and preserve explicit inset axes');
      assert.equal(receipt.absoluteMainDirections, true, 'Installed fixed absolute boxes must preserve physical insets and align correctly across row/column forward/reverse and RTL directions');
      assert.equal(receipt.relativeMainDirections, true, 'Installed static/relative boxes must preserve physical final-world translation across all nowrap directions and classify Yoga reverse differences');
      assert.equal(receipt.absoluteMainBounds, true, 'Installed opposing-inset automatic boxes and numeric clamps must preserve physical geometry across every nowrap direction and RTL');
      assert.equal(receipt.absoluteMainAspect, true, 'Installed one-auto absolute aspect boxes must derive from declared dimensions, clamp after derivation, and preserve paired-inset precedence without measurement');
      assert.equal(receipt.absoluteContainingBlock, true, 'Installed static Flex inherits its ancestor box while relative and omitted Flex own their local absolute child');
      assert.equal(receipt.nestedContainingBlockDirections, true, 'Installed direct static and relative Flex chains must preserve ancestor/local containing boxes across nowrap main directions, targets, identity, paint reuse, and cleanup');
      assert.equal(receipt.absoluteDerivedSize, true, 'Installed opposing insets must derive a finite auto absolute size, preserve forwarding, source order, identity and cleanup');
      assert.equal(receipt.absoluteAspect, true, 'Installed absolute aspect sizing preserves declared-axis bounds and opposing-inset precedence without measurement');
      assert.equal(receipt.absoluteMeasuredWidth, true, 'Installed paired providers must measure an unbounded automatic absolute width at exact declared height, remeasure conservatively on owner resize and provider input, detach on keyed removal, and clean up');
      assert.equal(receipt.absoluteMeasuredHeight, true, 'Installed paired providers must measure an unbounded automatic absolute height at declared exact width and release their owned snapshots');
      assert.equal(receipt.absoluteMeasuredMain, true, 'Installed paired absolute providers must preserve all-nowrap direction geometry, Pibbl query envelopes, lifecycle cleanup, and the explicit column-width Yoga query difference');
      assert.equal(receipt.absoluteBounds, true, 'Installed absolute numeric bounds must clamp fixed and opposing-inset automatic axes before LTR/RTL placement, source-order targeting, identity and cleanup');
      assert.equal(receipt.absoluteParticipation, true, 'Installed absolute child must leave flow and preserve source-order interaction');
      assert.equal(receipt.absoluteWrappedParticipation, true, 'Installed wrapped absolute children must remain out of Flex lines while source order, targets, identity, paint reuse, and cleanup remain exact');
      assert.equal(receipt.absoluteTextHeight, true, 'Installed Text must measure one automatic absolute height through actual Canvas wrapping, preserve physical anchoring across nowrap directions, and clean up exactly');
      assert.equal(receipt.decoratedRelativeStatic, true, 'Installed decorated positioning must resolve padding/border before relative offsets');
      assert.equal(receipt.relativeStatic, true, 'Installed static/relative placement must preserve slots and move final geometry once');
      assert.equal(receipt.nestedPercentageWrapping, true, 'Installed nested percentages must use final row/column nowrap/wrap owners across all eight native cases');
      assert.equal(receipt.percentageMargins, true, 'Installed percentage margins must use allocated content width and move paint/targets');
      assert.equal(receipt.measuredColumnWrapText, true, 'Installed fixed-width Text must form wrapped columns before following paint and targets');
      assert.equal(receipt.wrappedCrossBounds, true, 'Installed wrapped columns must stretch automatic cross sizes and move the following line');
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
