import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { buildLayoutPreflightLab } from './build-layout-preflight-lab.mjs';
import { chromium } from 'playwright';
const built = process.argv.includes('--built');
const serve = process.argv.includes('--serve');
const studio = process.argv.find(value => value.startsWith('http'));

const port = Number(process.env.PORT ?? (built ? 5195 : 5194));
const { source, coreInputs } = studio ? { source: '', coreInputs: [] } : await buildLayoutPreflightLab(built);
const html = '<!doctype html><meta charset="utf-8"><title>Layout preflight lab</title><style>body{font:16px system-ui;max-width:800px;margin:40px auto}button{margin:12px;padding:10px}canvas{margin:12px}</style><script type="module">' + source + '</script>';
const server = createServer((_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(html); });
if (!studio) await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${port}/`;
if (serve) console.warn(`${built ? 'Built' : 'Source'} preflight lab: ${url}; ${coreInputs.length} core inputs`);
else {
  let browser;
  try {
    browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message)); await page.goto(studio ? `${studio}/#/testing/layout-preflight` : url);
    let lab = page;
    if (studio) {
      await page.locator('iframe[srcdoc]').waitFor(); await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
      lab = page.frames().find(frame => frame.url() === 'about:srcdoc');
      await lab.locator('pre').waitFor();
      const proof = await lab.evaluate(() => globalThis.__PIBBL_PREFLIGHT_PROOF__);
      assert.equal(proof.mode, built ? 'layout-wasm-built' : 'layout-wasm');
      assert.ok(proof.coreInputs.length > 0);
      if (built) assert.ok(proof.coreInputs.every(path => path.includes('packages/core/.layout-wasm-package/dist/')));
      coreInputs.push(...proof.coreInputs);
    }
    const state = () => lab.locator('pre').evaluate(element => JSON.parse(element.textContent));
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).evaluations === 1);
    if (process.argv.includes('--native-flow')) {
      const placements = () => lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().flowPlacements);
      const before = await placements();
      await lab.getByRole('button', { name: 'Use native Flow wrap', exact: true }).click();
      await lab.waitForFunction(before => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().flowPlacements === before + 1, before);
      assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(37, 2, 1, 1).data]), [0,0,0,0]);
      assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(37, 7, 1, 1).data]), [0,128,0,255]);
      await lab.locator('#subject').click({ position: { x: 6, y: 31 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeHits === 1);
      await lab.getByRole('button', { name: 'Widen native Flow', exact: true }).click();
      await lab.waitForFunction(before => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().flowPlacements === before + 2, before);
      await lab.locator('#subject').click({ position: { x: 6, y: 31 } }); assert.equal((await state()).nativeHits, 1);
      await lab.locator('#subject').click({ position: { x: 66, y: 11 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeHits === 2);
      await lab.getByRole('button', { name: 'Paint native Flow', exact: true }).click();
      await lab.waitForFunction(() => [...document.querySelector('#subject').getContext('2d').getImageData(65, 10, 1, 1).data].join() === '255,165,0,255');
      assert.equal(await placements() - before, 2);
    const disposed = await lab.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
      assert.deepEqual(['activeNodes', 'activeArenas', 'activeWasmInstances', 'cachedMeasurements'].map(key => disposed[key]), [0,0,0,0]);
      assert.deepEqual(errors, []);
      console.warn(`${built ? 'Built' : 'Source'} native Flow: centered short item/wrapped line→one row, moved hit, one native placement per geometry change/zero paint work, cleanup0/0/0/0; ${coreInputs.length} public core inputs`);
    } else if (process.argv.includes('--native-spans')) {
      const placements = () => lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().gridCellPlacements);
      const before = await placements();
      await lab.getByRole('button', { name: 'Use native Grid spans', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeWidths[2] === 170);
      assert.equal(await placements() - before, 1);
      await lab.locator('#subject').click({ position: { x: 211, y: 41 } }); assert.equal((await state()).nativeHits, 0);
      await lab.getByRole('button', { name: 'Resize native tracks', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeWidths[2] === 230);
      assert.equal(await placements() - before, 2);
      assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(210, 40, 1, 1).data]), [0,0,255,255]);
      await lab.locator('#subject').click({ position: { x: 211, y: 41 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeHits === 1);
      await lab.getByRole('button', { name: 'Paint native tracks', exact: true }).click();
      await lab.waitForFunction(() => [...document.querySelector('#subject').getContext('2d').getImageData(210, 40, 1, 1).data].join() === '255,165,0,255');
      assert.equal(await placements() - before, 2);
      const disposed = await lab.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
      assert.deepEqual(['activeNodes', 'activeArenas', 'activeWasmInstances', 'cachedMeasurements'].map(key => disposed[key]), [0,0,0,0]);
      assert.deepEqual(errors, []);
      console.warn(`${built ? 'Built' : 'Source'} native Grid spans:170×45→230×45, moved target, one native batch per geometry change/zero paint-only work, cleanup0/0/0/0; ${coreInputs.length} public core inputs`);
    } else if (process.argv.includes('--native-grid')) {
      const resolutions = () => lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__().gridTrackResolutions);
      const before = await resolutions();
      await lab.getByRole('button', { name: 'Use native Grid tracks', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeWidths[2] === 110);
      assert.deepEqual((await state()).nativeWidths, [20,50,110]); assert.equal(await resolutions() - before, 2);
      await lab.locator('#subject').click({ position: { x: 101, y: 11 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeHits === 1);
      await lab.getByRole('button', { name: 'Resize native tracks', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeWidths[2] === 155);
      assert.deepEqual((await state()).nativeWidths, [20,65,155]); assert.equal(await resolutions() - before, 3);
      await lab.locator('#subject').click({ position: { x: 101, y: 11 } }); assert.equal((await state()).nativeHits, 1);
      await lab.locator('#subject').click({ position: { x: 111, y: 11 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).nativeHits === 2);
      await lab.getByRole('button', { name: 'Paint native tracks', exact: true }).click();
      await lab.waitForFunction(() => [...document.querySelector('#subject').getContext('2d').getImageData(10, 10, 1, 1).data].join() === '255,165,0,255');
      assert.equal(await resolutions() - before, 3);
      const disposed = await lab.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
      assert.deepEqual(['activeNodes', 'activeArenas', 'activeWasmInstances', 'cachedMeasurements'].map(key => disposed[key]), [0,0,0,0]);
      assert.deepEqual(errors, []);
      console.warn(`${built ? 'Built' : 'Source'} native Grid tracks: mixed geometry200→260, moved target, two initial axes/one resized axis/zero paint-only native resolutions, cleanup0/0/0/0; ${coreInputs.length} public core inputs`);
    } else if (process.argv.includes('--html')) {
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).htmlMounts === 1);
      await lab.getByRole('button', { name: 'Fail HTML projection', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).htmlFailures === 1);
      assert.equal((await state()).htmlUpdates, 0);
      assert.equal((await state()).htmlAborts, 1);
      assert.equal(await lab.locator('#projection-overlay').evaluate(element => element.childNodes.length), 0);
      assert.deepEqual(await lab.locator('#healthy').evaluate(canvas => [...canvas.getContext('2d').getImageData(65, 10, 1, 1).data]), [0,128,0,255]);
      await lab.getByRole('button', { name: 'Recover HTML', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).htmlMounts === 2);
      await lab.getByRole('button', { name: 'Native HTML host', exact: true }).click();
      assert.equal((await state()).htmlClicks, 1);
      await lab.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')));
      assert.equal(await lab.locator('#projection-overlay').evaluate(element => element.childNodes.length), 0);
      assert.equal((await state()).htmlUpdates, 0);
      assert.deepEqual(errors, []);
      console.warn(`${built ? 'Built' : 'Source'} HTML projection: overflow rejected before earlier update, abort/DOM cleanup, independent root and native recovery pass; ${coreInputs.length} public core inputs`);
    } else {
    let expectedEvaluations = 1;
    if (process.argv.includes('--flow-root') || process.argv.includes('--grid-root') || process.argv.includes('--flow') || process.argv.includes('--grid') || process.argv.includes('--layer') || process.argv.includes('--nested') || process.argv.includes('--direct') || process.argv.includes('--described')) {
      await lab.getByRole('button', { name: process.argv.includes('--flow-root') ? 'Use prepared Flow root' : process.argv.includes('--grid-root') ? 'Use prepared Grid root' : process.argv.includes('--flow') ? 'Use Flow sequence' : process.argv.includes('--grid') ? 'Use Grid cells' : process.argv.includes('--layer') ? 'Use Layer boundary' : process.argv.includes('--described') ? 'Use described layout' : process.argv.includes('--direct') ? 'Use direct root' : 'Use nested layout', exact: true }).click();
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).evaluations === 2);
      expectedEvaluations = 2;
    }

    await lab.getByRole('button', { name: process.argv.includes('--sizing') ? 'Fail later sizing' : 'Fail later sibling', exact: true }).click();
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).failures === 1);
    assert.equal((await state()).evaluations, expectedEvaluations);
    assert.deepEqual(await lab.locator('#healthy').evaluate(canvas => [...canvas.getContext('2d').getImageData(65, 10, 1, 1).data]), [0,128,0,255]);
    await lab.locator('#subject').click({ position: { x: 91, y: 11 } }); assert.equal((await state()).hits, 0);
    const flowBeforeRecovery = process.argv.includes('--flow-root') ? await lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__()) : undefined;
    const gridBeforeRecovery = process.argv.includes('--grid-root') ? await lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__()) : undefined;
    await lab.getByRole('button', { name: 'Recover', exact: true }).click();
    await lab.waitForFunction(expected => JSON.parse(document.querySelector('pre').textContent).evaluations === expected, expectedEvaluations + 1);
    assert.equal((await state()).allocatedWidth, 100);
    assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(90, 10, 1, 1).data]), [196,81,57,255]);
    await lab.locator('#subject').click({ position: { x: 91, y: 11 } });
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).hits === 1);
    if (process.argv.includes('--layer')) {
      assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(150, 10, 1, 1).data]), [52,76,119,255]);
      await lab.locator('#subject').click({ position: { x: 151, y: 11 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).layerHits === 1);
    }
    if (process.argv.includes('--flow-root') || process.argv.includes('--grid-root') || process.argv.includes('--grid') || process.argv.includes('--flow')) {
      assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(150, 10, 1, 1).data]), [52,76,119,255]);
      await lab.locator('#subject').click({ position: { x: 151, y: 11 } });
      await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).layerHits === 1);
    }
      if (gridBeforeRecovery) {
      const recovered = await lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      assert.equal(recovered.gridTrackResolutions - gridBeforeRecovery.gridTrackResolutions, 2);
      assert.equal(recovered.gridCellPlacements - gridBeforeRecovery.gridCellPlacements, 1);
      assert.equal(recovered.activeArenas, 3);
    }
    if (flowBeforeRecovery) {
      const recovered = await lab.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      assert.equal(recovered.flowPlacements - flowBeforeRecovery.flowPlacements, 1);
      assert.equal(recovered.activeArenas, 3);
    }
    const disposed = await lab.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide'));
      return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
    });
    assert.deepEqual(['activeNodes', 'activeArenas', 'activeWasmInstances', 'cachedMeasurements'].map(key => disposed[key]), [0,0,0,0]);
    assert.deepEqual(errors, []); console.warn(`${built ? 'Built' : 'Source'} preflight: later input failure prevents earlier evaluation, independent root updates, recovery100px/hit correct, root cleanup0/0/0/0; ${coreInputs.length} public core inputs`);
    }
  } finally { await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
