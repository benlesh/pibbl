import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flow-padding`);
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const position = await sandbox.evaluate(({x,y,basis}) => {
      const canvas = document.querySelector('canvas'), bounds = canvas.getBoundingClientRect();
      const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({x,y});
      return {x:point.x*bounds.width/canvas.width,y:point.y*bounds.height/canvas.height};
    }, {x,y,basis:(await state()).basis});
    await frame.locator('canvas').click({position}); await page.waitForTimeout(180);
  };
  const expectAllocation = (actual, x, y, width, height, stamp) => {
    assert.ok(Math.abs(actual.x-x)<1e-9&&Math.abs(actual.y-y)<1e-9,JSON.stringify(actual));
    assert.equal(actual.width,width); assert.equal(actual.height,height); assert.equal(actual.stamp,stamp);
  };
  const expectBox = (actual, x, y, stamp) => expectAllocation(actual, x, y, 100, 40, stamp);
  const initial = await state(); assert.equal(initial.allocationWidth, 200); assert.equal(initial.containerWidth, 200); assert.equal(initial.padding, 0); expectBox(initial.box,0,0,1);
  await click(4, 4); assert.equal((await state()).hits, 1);
  await click(36, 118); const numeric = await state(); assert.equal(numeric.padding, 20); expectBox(numeric.box,20,20,1);
  await click(4, 4); await click(24, 24); assert.equal((await state()).hits, 2);
  await click(36, 118); const percentage = await state(); assert.equal(percentage.padding, '10%'); assert.deepEqual(percentage.box, numeric.box);
  await click(100, 118); const resized = await state(); assert.equal(resized.containerWidth, 160); assert.equal(resized.allocationWidth, 200); assert.deepEqual(resized.box, numeric.box);
  const beforePaint = resized.layout; await click(164, 118); const painted = await state(); for (const key of ['solves', 'flowPlacements', 'mainPlacements', 'crossPlacements', 'measuredLeaves', 'nodeCreates']) assert.equal(painted.layout[key], beforePaint[key], key);
  await click(164, 88); let grid = await state(); assert.equal(grid.container, 'grid');
  await click(36, 118); grid = await state(); assert.equal(grid.padding, 0);
  await click(100, 118); grid = await state(); assert.equal(grid.containerWidth, 200); expectBox(grid.box, 0, 0, grid.box.stamp);
  const gridStamp = grid.box.stamp, gridMounted = grid.layout;
  await click(36, 118); grid = await state(); assert.equal(grid.padding, 20); expectBox(grid.box, 20, 20, gridStamp); assert.equal(grid.layout.nodeCreates, gridMounted.nodeCreates);
  const gridHits = grid.hits; await click(4, 4); assert.equal((await state()).hits, gridHits);
  await click(24, 24); grid = await state(); assert.equal(grid.hits, gridHits + 1);
  await click(36, 118); grid = await state(); assert.equal(grid.padding, '10%'); expectBox(grid.box, 20, 20, gridStamp); assert.equal(grid.layout.nodeCreates, gridMounted.nodeCreates);
  await click(100, 118); grid = await state(); assert.equal(grid.containerWidth, 160); assert.equal(grid.allocationWidth, 200); expectBox(grid.box, 20, 20, gridStamp); assert.equal(grid.layout.nodeCreates, gridMounted.nodeCreates);
  const gridBeforePaint = grid.layout; await click(164, 118); const gridPainted = await state();
  for (const key of ['solves', 'gridTrackResolutions', 'gridCellPlacements', 'mainPlacements', 'crossPlacements', 'measuredLeaves', 'nodeCreates']) { assert.equal(typeof gridBeforePaint[key], 'number', key); assert.equal(gridPainted.layout[key], gridBeforePaint[key], `grid paint ${key}`); }
  let latest = gridPainted;
  for (const family of ['absolute', 'overlay']) {
    await click(164, 88); latest = await state(); assert.equal(latest.container, family);
    await click(36, 118); latest = await state(); assert.equal(latest.padding, 0);
    await click(100, 118); latest = await state(); assert.equal(latest.containerWidth, 200); expectBox(latest.box, 0, 0, latest.box.stamp);
    const stamp = latest.box.stamp, mounted = latest.layout, hits = latest.hits;
    await click(36, 118); latest = await state(); assert.equal(latest.padding, 20); expectBox(latest.box, 20, 20, stamp); assert.equal(latest.layout.nodeCreates, mounted.nodeCreates);
    await click(4, 4); latest = await state(); assert.equal(latest.hits, hits);
    await click(24, 24); latest = await state(); assert.equal(latest.hits, hits + 1);
    await click(36, 118); latest = await state(); assert.equal(latest.padding, '10%'); expectBox(latest.box, 20, 20, stamp); assert.equal(latest.layout.nodeCreates, mounted.nodeCreates);
    await click(100, 118); latest = await state(); assert.equal(latest.containerWidth, 160); assert.equal(latest.allocationWidth, 200); expectBox(latest.box, 20, 20, stamp); assert.equal(latest.layout.nodeCreates, mounted.nodeCreates);
    const beforePaint = latest.layout; await click(164, 118); latest = await state();
    for (const key of ['solves', 'nodeCreates']) { assert.equal(typeof beforePaint[key], 'number', `${family} ${key}`); assert.equal(latest.layout[key], beforePaint[key], `${family} paint ${key}`); }
  }
  // Direct-child mode carries the padding on a 160 × 80 Flow box, not on the selected outer container.
  await click(164, 88); latest = await state(); assert.equal(latest.container, 'flow');
  await click(36, 118); latest = await state(); assert.equal(latest.padding, 0);
  await click(100, 118); latest = await state(); assert.equal(latest.containerWidth, 200);
  await click(64, 88); latest = await state(); assert.equal(latest.paddingOwner, 'child');
  let childStamp = latest.box.stamp; expectAllocation(latest.box, 0, 0, 160, 80, childStamp);
  await click(36, 118); latest = await state(); assert.equal(latest.padding, 20); expectAllocation(latest.box, 20, 20, 120, 40, childStamp);
  const childHits = latest.hits; await click(4, 4); latest = await state(); assert.equal(latest.hits, childHits); await click(24, 24); latest = await state(); assert.equal(latest.hits, childHits + 1);
  await click(36, 118); latest = await state(); assert.equal(latest.padding, '10%'); expectAllocation(latest.box, 20, 20, 120, 40, childStamp);
  await click(100, 118); latest = await state(); assert.equal(latest.containerWidth, 160); expectAllocation(latest.box, 16, 16, 128, 48, childStamp);
  await click(164, 88); latest = await state(); assert.equal(latest.container, 'grid');
  await click(36, 118); latest = await state(); assert.equal(latest.padding, 0);
  await click(100, 118); latest = await state(); assert.equal(latest.containerWidth, 200);
  childStamp = latest.box.stamp; expectAllocation(latest.box, 0, 0, 160, 80, childStamp);
  await click(36, 118); latest = await state(); assert.equal(latest.padding, 20); expectAllocation(latest.box, 20, 20, 120, 40, childStamp);
  await click(36, 118); latest = await state(); assert.equal(latest.padding, '10%'); expectAllocation(latest.box, 16, 16, 128, 48, childStamp);
  const childBeforePaint = latest.layout; await click(164, 118); latest = await state();
  for (const key of ['solves', 'nodeCreates']) assert.equal(latest.layout[key], childBeforePaint[key], `child paint ${key}`);
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__); if (built) { assert.equal(proof?.mode, 'layout-wasm-built'); assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/'))); }
  if(process.env.PIBBL_LAYOUT_SCREENSHOT)await frame.locator('canvas').screenshot({path:process.env.PIBBL_LAYOUT_SCREENSHOT});
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); }); assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances], [0, 0, 0, 0]); assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, initial: initial.box, numeric: numeric.box, percentage: percentage.box, resized: resized.box, grid: grid.box, latest: latest.box, cleanup: [0, 0, 0], errors }));
} finally { await browser.close(); }
