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
  const host = page.locator('iframe[srcdoc]');
  await host.waitFor(); await host.scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  await sandbox.evaluate(() => {
    const context = document.querySelector('canvas').getContext('2d');
    const original = context.fillText, draws = [];
    context.fillText = function(text, x, y, maxWidth) {
      if (text.startsWith('jobs')) draws.push({ text, point: this.getTransform().transformPoint({ x, y }).toJSON() });
      return original.call(this, text, x, y, maxWidth);
    };
    globalThis.__PIBBL_COLUMN_AUTO_DRAWS__ = draws;
  });
  const click = async (x, y) => {
    const box = await frame.locator('canvas').boundingBox();
    const scale = Math.min(box.width / 760, box.height / 460);
    await frame.locator('canvas').click({ position: { x: (box.width - 760 * scale) / 2 + x * scale, y: (box.height - 460 * scale) / 2 + y * scale } });
    await page.waitForTimeout(250);
  };
  const counters = () => sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  const hits = async () => Number((await frame.locator('pre').innerText()).match(/column hits: (\d+)/)[1]);
  const geometry = async () => {
    const basis = JSON.parse((await frame.locator('pre').innerText()).split('auto cross transform: ')[1]);
    return sandbox.evaluate(basis => {
      const draw = globalThis.__PIBBL_COLUMN_AUTO_DRAWS__.at(-1);
      const context = document.querySelector('canvas').getContext('2d');
      context.save(); context.font = '10px monospace'; const m = context.measureText(draw.text); context.restore();
      const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).inverse().transformPoint(draw.point);
      return { text: draw.text, x: point.x, y: point.y, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight };
    }, basis);
  };
  await click(500, 76);
  const initial = await geometry();
  assert.equal(initial.text, 'jobs jobs jobs');
  assert.ok(Math.abs(initial.x - (600 - initial.width)) < 1e-9);
  assert.ok(Math.abs(initial.y - 280) < 1e-9);
  await click(initial.x + 2, 284); assert.equal(await hits(), 1);
  await click(425, 305); assert.match(await frame.locator('pre').innerText(), /selected: column auto sibling/);
  const before = await counters();
  await click(500, 394);
  const changed = await geometry(), resized = await counters();
  assert.equal(changed.text, 'jobs jobs');
  assert.ok(changed.width < initial.width);
  assert.ok(Math.abs(changed.x - (600 - changed.width)) < 1e-9);
  assert.ok(Math.abs(changed.y - 280) < 1e-9);
  assert.equal(resized.nodeCreates, before.nodeCreates);
  assert.ok(resized.measuredLeaves > before.measuredLeaves);
  await click(initial.x + 2, 284); assert.equal(await hits(), 1);
  await click(changed.x + 2, 284); assert.equal(await hits(), 2);
  await click(425, 305); assert.match(await frame.locator('pre').innerText(), /selected: column auto sibling/);
  // Preserve the old five content states, then prove the sixth wrapped Text
  // state before restoring the original Text state.
  for (let step = 0; step < 4; step++) await click(500, 434);
  const wrappedLongStart = await sandbox.evaluate(() => globalThis.__PIBBL_COLUMN_AUTO_DRAWS__.length);
  await click(500, 434);
  const wrappedLong = await sandbox.evaluate(start => globalThis.__PIBBL_COLUMN_AUTO_DRAWS__.slice(start), wrappedLongStart);
  assert.ok(wrappedLong.length >= 2, `wrapped long text needs multiple glyph lines: ${JSON.stringify(wrappedLong)}`);
  const wrappedLongPoints = await sandbox.evaluate((draws) => {
    const context = document.querySelector('canvas').getContext('2d');
    context.save(); context.font = '10px monospace';
    const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
    const inverse = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).inverse();
    const points = draws.map(draw => inverse.transformPoint(draw.point));
    context.restore();
    return points.map(point => ({ x: point.x, y: point.y }));
  }, wrappedLong);
  assert.ok(wrappedLongPoints.every(point => Math.abs(point.x - 420) < 1e-9), `long run uses all available width: ${JSON.stringify(wrappedLongPoints)}`);
  await click(422, 284); assert.equal(await hits(), 3);
  const wrappedShortStart = await sandbox.evaluate(() => globalThis.__PIBBL_COLUMN_AUTO_DRAWS__.length);
  await click(500, 394);
  const wrappedShort = await sandbox.evaluate(start => globalThis.__PIBBL_COLUMN_AUTO_DRAWS__.slice(start), wrappedShortStart);
  assert.equal(wrappedShort.length, 1, `short natural run stays on one line: ${JSON.stringify(wrappedShort)}`);
  const wrappedShortPoint = await sandbox.evaluate((draw) => {
    const context = document.querySelector('canvas').getContext('2d');
    context.save(); context.font = '10px monospace';
    const width = context.measureText(draw.text).width;
    const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
    const point = new DOMMatrix([basis.a, basis.b, basis.c, basis.d, basis.e, basis.f]).inverse().transformPoint(draw.point);
    context.restore();
    return { x: point.x, y: point.y, width };
  }, wrappedShort[0]);
  assert.ok(Math.abs(wrappedShortPoint.x - (600 - wrappedShortPoint.width)) < 1e-9, `short run keeps its automatic margin: ${JSON.stringify(wrappedShortPoint)}`);
  await click(422, 284); assert.equal(await hits(), 3);
  await click(wrappedShortPoint.x + 2, 284); assert.equal(await hits(), 4);
  if (process.env.PIBBL_LAYOUT_WRAPPED_COLUMN_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_WRAPPED_COLUMN_SCREENSHOT });
  await click(500, 434);
  assert.match(await frame.locator('pre').innerText(), /column provider: text/);
  const beforePaint = await counters(); await click(250, 110); const painted = await counters();
  // The adjacent natural-width row keeps its automatic-minimum query; the two
  // intrinsic-owner strips each remeasure once. Isolated Text adds no measurement.
  assert.equal(painted.measuredLeaves, beforePaint.measuredLeaves + 3);
  assert.equal(painted.solves, beforePaint.solves);
  assert.equal(painted.nodeCreates, beforePaint.nodeCreates);
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/'))); }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0,0,0]);
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, initial, changed, builtInputs: proof?.coreInputs.length ?? null, cleanup: [0,0,0], errors }));
} finally { await browser.close(); }
