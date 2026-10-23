import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const reference = JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'));
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const marginOnly = process.argv.includes('--percentage-margins');
const logicalPaddingOnly = process.argv.includes('--logical-padding');
const crossOnly = process.argv.includes('--wrapped-cross-bounds');
const paddingOnly = process.argv.includes('--percentage-padding');
const gapOnly = process.argv.includes('--percentage-gaps');
const aspectOnly = process.argv.includes('--wrapped-aspect');
const percentageOnly = process.argv.includes('--percentage-bounds');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  const catalogUrls = [];
  page.on('response', response => { if (response.url().includes('/learning-catalog.ts')) catalogUrls.push(response.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-yoga-migration`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 540);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 540 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(240);
  };
  const cases = logicalPaddingOnly ? reference.cases.filter(fixture => 'contentBoxes' in fixture) : marginOnly ? reference.cases.filter(fixture => fixture.name.startsWith('margin-percent-')) : crossOnly ? reference.cases.filter(fixture => fixture.name.startsWith('cross-percent-')) : paddingOnly ? reference.cases.filter(fixture => fixture.name.startsWith('padding-percent-')) : gapOnly ? reference.cases.filter(fixture => fixture.name.startsWith('gap-percent-')) : aspectOnly ? reference.cases.filter(fixture => fixture.name.startsWith('aspect-wrap-')) : percentageOnly ? reference.cases.filter(fixture => fixture.name.startsWith('percent-')) : reference.cases;
  if (percentageOnly || aspectOnly || gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly) {
    assert.ok((await frame.locator('pre').innerText()).includes('grow'));
    await click(396,244);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: A'));
    await click(552,244);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: B'));
    await click(520,158);
    if (aspectOnly || gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly) await click(520,158);
    if (gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly) await click(520,158);
    if (paddingOnly || crossOnly || marginOnly || logicalPaddingOnly) await click(520,158);
    if (crossOnly || marginOnly || logicalPaddingOnly) await click(520,158);
    if (marginOnly || logicalPaddingOnly) await click(520,158);
    if (logicalPaddingOnly) await click(520,158);
    if (logicalPaddingOnly) await click(520,158);
  }
  let previousOwner;
  for (const [index, fixture] of cases.entries()) {
    console.warn(`Replay ${index+1}/${cases.length}: ${fixture.name}`);
    if (index) await click(60, 158);
    assert.ok((await frame.locator('pre').innerText()).includes(fixture.name));
    if (fixture.classification) assert.ok((await frame.locator('pre').innerText()).includes(fixture.comparisonLabel), 'Classified difference must be explicitly labeled');
    const expected = fixture.pibblBoxes ?? fixture.boxes;
    if ('contentBoxes' in fixture) {
      const leaf=fixture.contentBoxes[0];
      await click(392+leaf.x+2,240+leaf.y+2);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A1'), `${fixture.name}: logical padding leaf`);
      continue;
    }
    if ((fixture.name.startsWith('percent-cap-') || fixture.name.startsWith('aspect-wrap-') || fixture.name.startsWith('gap-percent-') || fixture.name.startsWith('padding-percent-') || fixture.name.startsWith('cross-percent-') || fixture.name.startsWith('margin-percent-')) && fixture.name.endsWith('-resized')) {
      assert.equal(previousOwner.name, fixture.name.replace('-resized',''));
      const resized = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      const crossBounds = fixture.name.startsWith('cross-percent-');
      if (crossBounds) {
        assert.equal(resized.solves, previousOwner.layout.solves, 'Cross-only resize must reuse the main solve');
        assert.equal(resized.lineFormations, previousOwner.layout.lineFormations);
        assert.ok(resized.crossPlacements > previousOwner.layout.crossPlacements);
      } else {
        assert.ok(resized.solves > previousOwner.layout.solves);
        assert.equal(resized.measuredLeaves, previousOwner.layout.measuredLeaves);
      }
      assert.equal(resized.nodeCreates, previousOwner.layout.nodeCreates);
      const column = fixture.flexDirection === 'column';
      if (crossBounds && fixture.name.includes('-max')) {
        await click(column ? 422 : 396, column ? 244 : 270);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), 'Expanded cross cap must expose the new target edge');
      }
      await click(396 + expected[0].x,244 + expected[0].y);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A'));
      const aspect = fixture.name.startsWith('aspect-wrap-');
      const percentageGap = fixture.name.startsWith('gap-percent-') || fixture.name.startsWith('padding-percent-');
      const oldCross = fixture.flexWrap === 'wrap-reverse' ? 45 : 145;
      if (crossBounds && fixture.name.includes('-min')) {
        await click(396 + previousOwner.boxes[2].x,244 + previousOwner.boxes[2].y);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), 'Former following-line target must move after cross minimum resize');
      }
      if (!fixture.name.startsWith('margin-percent-') && !crossBounds && (!fixture.name.startsWith('padding-percent-') || fixture.name.includes('content-box'))) {
      await click(percentageGap ? 396 + previousOwner.boxes[1].x : aspect ? column ? 392 + oldCross : 396 : column ? 396 : 458, percentageGap ? 244 + previousOwner.boxes[1].y : aspect ? column ? 244 : 240 + oldCross : column ? 306 : 244);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), 'Former target must stop selecting B after owner resize');
      }
    }
    for (const [index, box] of expected.entries()) {
      await click(392 + box.x + 4, 240 + box.y + 4);
      assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(65+index)}`), `${fixture.name}: target ${index}; ${(await frame.locator('pre').innerText()).slice(-350)}`);
    }
    if ((fixture.name.startsWith('percent-cap-') || fixture.name.startsWith('aspect-wrap-') || fixture.name.startsWith('gap-percent-') || fixture.name.startsWith('padding-percent-') || fixture.name.startsWith('cross-percent-') || fixture.name.startsWith('margin-percent-')) && !fixture.name.endsWith('-resized')) previousOwner = {name:fixture.name,boxes:expected,layout:await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__())};
  }
  assert.ok(catalogUrls.length > 0, 'Studio replay must observe its actual catalog source');
  let catalogSurface;
  for (const url of catalogUrls) {
    const expectedPath = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/scenarios/src/learning-catalog.ts').replaceAll('\\', '/');
    assert.ok(decodeURIComponent(new URL(url).pathname).endsWith(expectedPath), 'Studio catalog must belong to this checkout');
    const response = await page.request.get(url);
    assert.ok(response.ok(), 'Served catalog must be readable');
    const match = (await response.text()).match(/slug:\s*["']wasm-yoga-migration["'][\s\S]*?canvas:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
    assert.ok(match, 'Served catalog must declare the comparison surface');
    catalogSurface = {width:Number(match[1]),height:Number(match[2])};
    assert.deepEqual(catalogSurface, {width:760,height:540}, 'Served surface metadata must match the public example');
  }
  // Source-formed lines and reversed placement retain identities; gaps miss.
  const last = cases.at(-1);
  const lastBoxes = last.pibblBoxes ?? last.boxes;
  const column = last.flexDirection.startsWith('column');
  if (last.gap > 0) {
  const gap = column ? Math.min(...lastBoxes.map(box => box.y + box.height)) + 6 : Math.min(...lastBoxes.map(box => box.x + box.width)) + 6;
  await click(column ? 396+lastBoxes[0].x : 392+gap, column ? 240+gap : 244+lastBoxes[0].y);
  assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(64+lastBoxes.length)}`));
  }
  if (process.argv.includes('--screenshot')) await frame.locator('canvas').screenshot({ path: '/tmp/pibbl-yoga-comparison.png' });
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
  console.warn(JSON.stringify({ base, commit: reference.commit, cases: cases.map(value => value.name), builtInputs: proof?.coreInputs.length ?? null, catalogUrls, catalogSurface, matched: cases.filter(value => !value.pibblBoxes).length, classified: cases.filter(value => value.pibblBoxes).map(value => value.name), cleanup: [0, 0, 0], errors }));
} finally { await browser.close(); }
