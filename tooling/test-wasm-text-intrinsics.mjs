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
  const installAutoCrossDrawProbe = () => sandbox.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const context = canvas.getContext('2d');
    const draws = [];
    const fillText = context.fillText;
    context.fillText = function(text, x, y, maxWidth) {
      if (text.includes('aaaa')) {
        const point = this.getTransform().transformPoint({x,y});
        draws.push({ x: point.x, y: point.y });
      }
      return fillText.call(this, text, x, y, maxWidth);
    };
    globalThis.__PIBBL_AUTO_CROSS_DRAWS__ = draws;
  });
  const autoCrossBasis = async () => JSON.parse((await frame.locator('pre').innerText()).split('auto cross transform: ')[1]);
  const autoCrossDraws = async () => sandbox.evaluate(basis => {
    const inverse = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).inverse();
    return globalThis.__PIBBL_AUTO_CROSS_DRAWS__.map(draw => {
      const point = inverse.transformPoint(draw);
      return {x:+point.x.toFixed(3),y:+point.y.toFixed(3)};
    });
  }, await autoCrossBasis());
  const autoCrossPixel = async (x, y) => sandbox.evaluate(({basis,x,y}) => {
    const context = document.querySelector('canvas').getContext('2d');
    const matrix = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]);
    const point = matrix.transformPoint({x,y});
    return [...context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data];
  }, {basis:await autoCrossBasis(),x,y});
  const autoCrossSiblingBox = async (left, width = 40) => {
    const box = {left,top:260,width,height:40};
    const colors = await sandbox.evaluate(({basis,box}) => {
      const context = document.querySelector('canvas').getContext('2d');
      const matrix = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]);
      return [[box.left+2,box.top+2],[box.left+box.width-2,box.top+38]].map(([x,y]) => {
        const point=matrix.transformPoint({x,y});
        return [...context.getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data];
      });
    }, {basis:await autoCrossBasis(),box});
    assert.deepEqual(colors,[[66,107,97,255],[66,107,97,255]],'host-transformed sibling corners');
    return box;
  };
  await click(500, 110); // Frozen proof.
  const frozen = await read();
  await click(250, 110); // Paint.
  const painted = await read();
  assert.equal(painted.allocationPasses, frozen.allocationPasses);
  assert.equal(painted.allocationItemVisits, frozen.allocationItemVisits);
  assert.ok(painted.allocationCacheHits > frozen.allocationCacheHits);

  await installAutoCrossDrawProbe();
  await click(500, 76); // Automatic-width cross-auto comparison.
  assert.match(await frame.locator('pre').innerText(), /AUTO CROSS COMPARISON/);
  assert.match(await frame.locator('pre').innerText(), /intrinsic auto contribution: 120 · final owner: 200/);
  assert.deepEqual(await autoCrossPixel(105, 416), [243, 240, 232, 255], 'automatic margin remains empty before A');
  assert.deepEqual(await autoCrossPixel(110, 416), [138, 50, 72, 255], 'A begins after the 80px automatic margin');
  assert.deepEqual(await autoCrossPixel(150, 416), [66, 107, 97, 255], 'B follows A at the final owner width');
  assert.deepEqual(await autoCrossPixel(285, 410), [243, 240, 232, 255], 'cross-auto space remains inert before A');
  assert.deepEqual(await autoCrossPixel(290, 420), [138, 50, 72, 255], 'cross-auto A sinks by the final 10px free space');
  assert.deepEqual(await autoCrossPixel(325, 410), [66, 107, 97, 255], 'B remains at the cross start');
  await click(290, 420); await selected('intrinsic cross A');
  const beforeIntrinsicLogical = await read();
  await click(80, 444);
  assert.match(await frame.locator('pre').innerText(), /intrinsic logical: true/);
  assert.deepEqual(await autoCrossPixel(70, 416), [138, 50, 72, 255]);
  assert.deepEqual(await autoCrossPixel(110, 416), [243, 240, 232, 255]);
  assert.deepEqual(await autoCrossPixel(150, 416), [66, 107, 97, 255]);
  assert.equal((await read()).nodeCreates, beforeIntrinsicLogical.nodeCreates);
  await click(80, 444);
  assert.match(await frame.locator('pre').innerText(), /intrinsic logical: false/);
  // Cycle the bounded column paired-provider proof, then restore Text before
  // the existing Text-only draw and counter checks below.
  await click(540, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: 40/);
  assert.deepEqual(await autoCrossPixel(550, 290), [243, 240, 232, 255]);
  assert.deepEqual(await autoCrossPixel(570, 290), [138, 50, 72, 255]);
  await click(570, 290); await selected('column provider A');
  await click(540, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: 80/);
  assert.deepEqual(await autoCrossPixel(530, 290), [138, 50, 72, 255]);
  await click(540, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: known60/);
  assert.deepEqual(await autoCrossPixel(530, 290), [243, 240, 232, 255], 'known 60px starts at 540px');
  assert.deepEqual(await autoCrossPixel(550, 290), [138, 50, 72, 255]);
  await click(530, 290);
  assert.doesNotMatch(await frame.locator('pre').innerText(), /selected: column known A/);
  await click(540, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: known100/);
  assert.deepEqual(await autoCrossPixel(530, 290), [138, 50, 72, 255], 'known 100px moves A to 500px');
  await click(530, 290); await selected('column known A');
  if (process.env.PIBBL_LAYOUT_COLUMN_PROVIDER_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_COLUMN_PROVIDER_SCREENSHOT });
  await click(540, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: text/);
  if (process.env.PIBBL_LAYOUT_AUTO_MARGIN_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_AUTO_MARGIN_SCREENSHOT });
  const naturalWidth = await sandbox.evaluate(() => {
    const context = document.querySelector('canvas').getContext('2d');
    context.save(); context.font = '10px monospace';
    const width = context.measureText('aaaa aaaa aaaa').width;
    context.restore(); return width;
  });
  assert.ok(naturalWidth > 80 && naturalWidth < 90, `browser natural width ${naturalWidth}`);
  const initialAutoDraws = await autoCrossDraws();
  assert.deepEqual(initialAutoDraws.slice(-1), [{ x: 28, y: 350 }]);
  await click(35, 345);
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 0/);
  await click(35, 355); await selected('auto cross text');
  const wideSibling = await autoCrossSiblingBox(28+naturalWidth);
  assert.deepEqual({ top: wideSibling.top, width: wideSibling.width, height: wideSibling.height }, { top: 260, width: 40, height: 40 });
  await click(wideSibling.left + 20, wideSibling.top + 20); await selected('auto cross sibling');
  const beforeAutoWidth = await read();
  await sandbox.evaluate(() => { globalThis.__PIBBL_AUTO_CROSS_DRAWS__.length = 0; });
  await click(90, 110); // 140 -> 100.
  assert.match(await frame.locator('pre').innerText(), /comparison width: 100/);
  assert.deepEqual((await autoCrossDraws()).slice(-2), [{ x: 28, y: 340 }, { x: 28, y: 350 }]);
  const narrowSibling = await autoCrossSiblingBox(88);
  assert.deepEqual({ top: narrowSibling.top, width: narrowSibling.width, height: narrowSibling.height }, { top: 260, width: 40, height: 40 });
  assert.ok(narrowSibling.left < wideSibling.left, 'Browser-measured Text must release main-axis width after wrapping');
  const narrowedAuto = await read();
  assert.ok(narrowedAuto.solves > beforeAutoWidth.solves);
  assert.ok(narrowedAuto.measuredLeaves > beforeAutoWidth.measuredLeaves);
  assert.equal(narrowedAuto.nodeCreates, beforeAutoWidth.nodeCreates);
  await click(wideSibling.left + 20, wideSibling.top + 20);
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 1/);
  await click(narrowSibling.left + 20, narrowSibling.top + 20); await selected('auto cross sibling');
  await click(35, 335);
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 1/);
  await click(35, 345); await selected('auto cross text');
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 2/);
  const beforeAutoPaint = await read();
  await click(250, 110); // Sibling-only paint.
  const autoPainted = await read();
  assert.equal(autoPainted.solves, beforeAutoPaint.solves);
  assert.equal(autoPainted.measuredLeaves, beforeAutoPaint.measuredLeaves + 3);
  assert.equal(autoPainted.nodeCreates, beforeAutoPaint.nodeCreates);

  // Restore the ordinary comparison, then exercise the bounded wrapped-row mode.
  await click(250, 110); // Restore green sibling paint.
  const beforeWide = await read();
  await click(90, 110); // 100 -> 140.
  const widened = await read();
  assert.equal(widened.solves, beforeWide.solves + 1);
  assert.equal(widened.nodeCreates, beforeWide.nodeCreates);
  await sandbox.evaluate(() => { globalThis.__PIBBL_AUTO_CROSS_DRAWS__.length = 0; });
  await click(500, 110); // Toggle wrapping.
  assert.match(await frame.locator('pre').innerText(), /wrapped: true/);
  const wrappedWide = await read();
  assert.equal(wrappedWide.solves, widened.solves + 1);
  assert.equal(wrappedWide.nodeCreates, widened.nodeCreates + 1);
  assert.deepEqual((await autoCrossDraws()).slice(-2), [{ x: 28, y: 280 }, { x: 28, y: 290 }]);
  const wrappedWideSibling = await autoCrossSiblingBox(118, 60);
  assert.deepEqual(wrappedWideSibling, { left: 118, top: 260, width: 60, height: 40 });
  await click(35, 270); // Empty automatic top margin.
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 2/);
  await click(35, 285); await selected('auto cross text');
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 3/);
  await click(148, 280); await selected('auto cross sibling');
  await click(35, 320); await selected('auto cross following');
  await sandbox.evaluate(() => { globalThis.__PIBBL_AUTO_CROSS_DRAWS__.length = 0; });
  await click(90, 110); // 80 -> 40 in wrapped mode.
  assert.match(await frame.locator('pre').innerText(), /comparison width: 100/);
  const wrappedNarrow = await read();
  assert.equal(wrappedNarrow.solves, wrappedWide.solves + 1);
  assert.equal(wrappedNarrow.nodeCreates, wrappedWide.nodeCreates);
  assert.deepEqual((await autoCrossDraws()).slice(-3), [{ x: 28, y: 270 }, { x: 28, y: 280 }, { x: 28, y: 290 }]);
  const wrappedNarrowSibling = await autoCrossSiblingBox(78, 60);
  assert.deepEqual(wrappedNarrowSibling, { left: 78, top: 260, width: 60, height: 40 });
  await click(35, 265); // Former Text margin remains empty.
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 3/);
  await click(35, 275); await selected('auto cross text');
  assert.match(await frame.locator('pre').innerText(), /auto cross hits: 4/);
  await click(148, 280); await selected('auto cross text'); // Former B target misses.
  await click(108, 280); await selected('auto cross sibling');
  const beforeWrappedPaint = await read();
  await click(250, 110); // Sibling-only paint remains a placement reuse.
  const wrappedPainted = await read();
  assert.equal(wrappedPainted.solves, beforeWrappedPaint.solves);
  assert.equal(wrappedPainted.measuredLeaves, beforeWrappedPaint.measuredLeaves + 2);
  assert.equal(wrappedPainted.nodeCreates, beforeWrappedPaint.nodeCreates);

  await click(500, 76); // Return to the existing controls.
  await click(500, 40); // Minimum comparison.
  await click(548, 320); await selected('empty left');
  await click(552, 320); await selected('empty right');
  await click(598, 320); await selected('empty right');
  await click(500, 400); await selected('empty right'); // Leading margin misses.
  await click(510, 400); await selected('margin left');
  assert.match(await frame.locator('pre').innerText(), /margin left: -5/);
  await click(500, 400); await selected('margin left'); // Shifted border now hits.
  assert.match(await frame.locator('pre').innerText(), /margin left: 5/);
  await click(560, 400); await selected('margin right');
  assert.match(await frame.locator('pre').innerText(), /margin wrap: wrap/);
  await click(510, 420); await selected('margin right');
  assert.match(await frame.locator('pre').innerText(), /margin wrap: nowrap/);
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
