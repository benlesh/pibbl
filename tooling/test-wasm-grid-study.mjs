import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/grid`);
  const host = page.locator('iframe[srcdoc]'); await host.waitFor(); await host.scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = async () => JSON.parse((await frame.locator('pre').innerText()).split('grid state: ')[1]);
  const counters = () => sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  const click = async (x, y) => {
    const box = await frame.locator('canvas').boundingBox(), scale = Math.min(box.width / 720, box.height / 420);
    await frame.locator('canvas').click({ position: { x: (box.width - 720 * scale) / 2 + x * scale, y: (box.height - 420 * scale) / 2 + y * scale } });
    await page.waitForTimeout(180);
  };
  const boxes = (actual, wide) => {
    const expected = { A: [80,80,150,100], B: [244,80,wide ? 376 : 236,160], C: [80,194,wide ? 299 : 264,46], D: [wide ? 393 : 358,194,wide ? 227 : 122,46] };
    for (const id of ['A','B','C','D']) {
      assert.ok(Math.abs(actual[id].x - expected[id][0]) < 1e-9, `${id} x`);
      assert.ok(Math.abs(actual[id].y - expected[id][1]) < 1e-9, `${id} y`);
      assert.equal(actual[id].width, expected[id][2]); assert.equal(actual[id].height, expected[id][3]);
    }
  };
  const pixel = async (x,y) => sandbox.evaluate(({ basis, x, y }) => {
    const context = document.querySelector('canvas').getContext('2d');
    const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({x,y});
    return [...context.getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data];
  }, { basis: (await state()).basis, x, y });
  const initial = await state(); assert.equal(initial.width, 560); boxes(initial.boxes, false);
  await sandbox.evaluate(() => { const canvas = document.querySelector('canvas'); canvas.blur(); canvas.focus(); });
  for (let index = 0; index < 3; index++) await frame.locator('canvas').press('Tab');
  await page.waitForTimeout(180); assert.deepEqual((await state()).focused, ['A','B','C','D']);
  assert.deepEqual(await pixel(550,100), [247,240,223,255]);
  await click(550,100); assert.deepEqual((await state()).hits, []);
  const before = await counters(); await click(44,40);
  const resized = await state(); assert.equal(resized.width, 700); boxes(resized.boxes, true);
  assert.deepEqual(resized.stamps, initial.stamps); assert.equal((await counters()).nodeCreates, before.nodeCreates);
  await click(550,100); assert.equal((await state()).selected, 'B');
  assert.deepEqual(await pixel(550,100), [255,107,87,255]);
  await click(400,210); assert.equal((await state()).selected, 'D');
  assert.deepEqual(await pixel(400,210), [116,211,174,255]);
  await click(300,210); assert.equal((await state()).selected, 'C');
  const beforePaint = await counters(); await click(220,40); const painted = await counters();
  assert.equal(painted.gridTrackResolutions, beforePaint.gridTrackResolutions);
  assert.equal(painted.gridCellPlacements, beforePaint.gridCellPlacements);
  assert.equal(painted.nodeCreates, beforePaint.nodeCreates);
  assert.deepEqual(await pixel(550,100), [116,211,174,255]);
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/'))); }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements], [0,0,0]);
  assert.equal(await frame.locator('pre').count(), 0); assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, initial: initial.boxes, resized: resized.boxes, focused: ['A','B','C','D'], builtInputs: proof?.coreInputs.length ?? null, cleanup: [0,0,0], errors }));
} finally { await browser.close(); }
