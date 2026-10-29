import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const reference = JSON.parse(
  readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'),
);
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const route = '#/testing/layout-yoga-migration';

assert.ok(reference.cases.length >= 320, 'private replay must retain the recorded full corpus');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/${route}`);
  assert.equal(new URL(page.url()).hash, route, 'direct private rehearsal route must not fall back');

  // The private virtual iframe owns the exhaustive records. The public lesson remains concise.
  await page.locator('iframe[title="Yoga layout rehearsal"]').waitFor({ state: 'attached' });
  await page.frameLocator('iframe[title="Yoga layout rehearsal"]').locator('pre').waitFor();
  assert.ok((await page.frameLocator('iframe[title="Yoga layout rehearsal"]').locator('pre').innerText()).includes(`fixture count: ${reference.cases.length}`), 'actual renderer receives the full corpus');
  const frame = page.frames().find(value => value.url() === 'about:srcdoc');
  assert.ok(frame, 'private rehearsal must execute in its own iframe realm');
  const proof = await frame.evaluate(() => globalThis.__PIBBL_YOGA_REHEARSAL_PROOF__);
  assert.ok(proof, 'private rehearsal must expose its machine-readable proof marker');
  assert.deepEqual(proof.fixtureSource, {
    version: reference.version,
    commit: reference.commit,
    licenseSha256: reference.licenseSha256,
    probeSha256: reference.probeSha256,
  }, 'private fixtures must retain the recorded Yoga provenance');
  assert.deepEqual(
    proof.caseNames,
    reference.cases.map(value => value.name),
    'private renderer must receive every recorded fixture in source order',
  );
  assert.equal(proof.caseNames.length, reference.cases.length, 'private renderer must retain all recorded cases');
  assert.ok(Array.isArray(proof.coreInputs) && proof.coreInputs.length > 0, 'private replay must report its actual core inputs');
  if (built) {
    assert.equal(proof.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')), 'built private replay must use generated package inputs');
  } else {
    assert.equal(proof.mode, 'source');
    assert.ok(proof.coreInputs.every(value => value.includes('packages/core/src/')), 'source private replay must use this checkout’s source inputs');
  }

  const disposed = await frame.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual(
    [disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements],
    [0, 0, 0],
    'private full replay must release its layout ownership',
  );
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, route, built, cases: proof.caseNames.length, coreInputs: proof.coreInputs.length, cleanup: [0, 0, 0] }));
} finally {
  await browser.close();
}
