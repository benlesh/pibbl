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
    await lab.getByRole('button', { name: 'Fail later sibling', exact: true }).click();
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).failures === 1);
    assert.equal((await state()).evaluations, 1);
    assert.deepEqual(await lab.locator('#healthy').evaluate(canvas => [...canvas.getContext('2d').getImageData(65, 10, 1, 1).data]), [0,128,0,255]);
    await lab.locator('#subject').click({ position: { x: 91, y: 11 } }); assert.equal((await state()).hits, 0);
    await lab.getByRole('button', { name: 'Recover', exact: true }).click();
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).evaluations === 2);
    assert.equal((await state()).allocatedWidth, 100);
    assert.deepEqual(await lab.locator('#subject').evaluate(canvas => [...canvas.getContext('2d').getImageData(90, 10, 1, 1).data]), [196,81,57,255]);
    await lab.locator('#subject').click({ position: { x: 91, y: 11 } });
    await lab.waitForFunction(() => JSON.parse(document.querySelector('pre').textContent).hits === 1);
    const disposed = await lab.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide'));
      return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
    });
    assert.deepEqual(['activeNodes', 'activeArenas', 'activeWasmInstances', 'cachedMeasurements'].map(key => disposed[key]), [0,0,0,0]);
    assert.deepEqual(errors, []); console.warn(`${built ? 'Built' : 'Source'} preflight: later input failure prevents earlier evaluation, independent root updates, recovery100px/hit correct, root cleanup0/0/0/0; ${coreInputs.length} public core inputs`);
  } finally { await browser?.close(); if (server.listening) await new Promise(resolve => server.close(resolve)); }
}
