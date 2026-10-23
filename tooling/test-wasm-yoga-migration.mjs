import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const reference = JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'));
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const marginOnly = process.argv.includes('--percentage-margins');
const intrinsicOnly = process.argv.includes('--intrinsic-wrap');
const logicalBordersOnly = process.argv.includes('--logical-borders');
const logicalPaddingOnly = process.argv.includes('--logical-padding');
const directionMatrixOnly = process.argv.includes('--direction-matrix');
const autoMarginsOnly = process.argv.includes('--auto-margins');
const autoOpposingOnly = process.argv.includes('--auto-opposing');
const autoShorthandOnly = process.argv.includes('--auto-shorthand');
const ownerCrossAutoOnly = process.argv.includes('--owner-cross-auto');
const customCrossAutoOnly = process.argv.includes('--custom-cross-auto');
const textCrossAutoOnly = process.argv.includes('--text-cross-auto');
const crossAutoDirectionsOnly = process.argv.includes('--cross-auto-directions');
const crossAutoMarginsOnly = process.argv.includes('--cross-auto-margins');
const wrappedAutoMarginsOnly = process.argv.includes('--wrapped-auto-margins');
const crossOnly = process.argv.includes('--wrapped-cross-bounds');
const paddingOnly = process.argv.includes('--percentage-padding');
const gapOnly = process.argv.includes('--percentage-gaps');
const aspectOnly = process.argv.includes('--wrapped-aspect');
const percentageOnly = process.argv.includes('--percentage-bounds');
const roundingOnly = process.argv.includes('--rounding');
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
  await sandbox.evaluate(() => {
    const marker = '__PIBBL_TEXT_CROSS_AUTO_DRAWS__';
    const originalMarker = '__PIBBL_TEXT_CROSS_AUTO_FILL_TEXT__';
    globalThis[marker] = [];
    if (globalThis[originalMarker]) return;
    const original = CanvasRenderingContext2D.prototype.fillText;
    globalThis[originalMarker] = original;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      if (String(text).includes('aaaa')) {
        const transform = this.getTransform();
        const point = transform.transformPoint({ x: Number(x), y: Number(y) });
        globalThis[marker].push({ worldDrawX: point.x, worldDrawY: point.y, transformE: transform.e, transformF: transform.f, font: this.font, text: String(text) });
      }
      return original.call(this, text, x, y, ...rest);
    };
  });
  const clearTextCrossAutoDraws = () => sandbox.evaluate(() => { globalThis.__PIBBL_TEXT_CROSS_AUTO_DRAWS__.length = 0; });
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 540);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 540 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(240);
  };
  const cases = roundingOnly ? reference.cases.filter(fixture => fixture.roundingFixture) : ownerCrossAutoOnly ? reference.cases.filter(fixture => fixture.ownerCrossAutoFixture) : customCrossAutoOnly ? reference.cases.filter(fixture => fixture.customCrossAutoFixture) : textCrossAutoOnly ? reference.cases.filter(fixture => fixture.textCrossAutoFixture) : autoOpposingOnly ? reference.cases.filter(fixture => fixture.autoOpposingMarginFixture) : autoShorthandOnly ? reference.cases.filter(fixture => fixture.autoShorthandMarginFixture) : crossAutoDirectionsOnly ? reference.cases.filter(fixture => fixture.autoCrossDirectionFixture) : crossAutoMarginsOnly ? reference.cases.filter(fixture => fixture.autoCrossMarginFixture) : wrappedAutoMarginsOnly ? reference.cases.filter(fixture => fixture.autoWrappedMarginFixture) : autoMarginsOnly ? reference.cases.filter(fixture => fixture.autoMarginFixture) : directionMatrixOnly ? reference.cases.filter(fixture => fixture.directionMatrixFixture) : intrinsicOnly ? reference.cases.filter(fixture => fixture.intrinsicFixture) : logicalBordersOnly ? reference.cases.filter(fixture => fixture.name.startsWith('logical-border-')) : logicalPaddingOnly ? reference.cases.filter(fixture => fixture.name.startsWith('logical-padding-')) : marginOnly ? reference.cases.filter(fixture => fixture.name.startsWith('margin-percent-')) : crossOnly ? reference.cases.filter(fixture => fixture.name.startsWith('cross-percent-')) : paddingOnly ? reference.cases.filter(fixture => fixture.name.startsWith('padding-percent-')) : gapOnly ? reference.cases.filter(fixture => fixture.name.startsWith('gap-percent-')) : aspectOnly ? reference.cases.filter(fixture => fixture.name.startsWith('aspect-wrap-')) : percentageOnly ? reference.cases.filter(fixture => fixture.name.startsWith('percent-')) : reference.cases;
  if (roundingOnly) { for(let section=0;section<21;section++) await click(520,158); }
  else if (ownerCrossAutoOnly) { for(let section=0;section<20;section++) await click(520,158); }
  else if (customCrossAutoOnly) { for(let section=0;section<19;section++) await click(520,158); }
  else if (textCrossAutoOnly) { for(let section=0;section<18;section++) { if (section === 17) await clearTextCrossAutoDraws(); await click(520,158); } }
  else if (autoOpposingOnly) { for(let section=0;section<17;section++) await click(520,158); }
  else if (autoShorthandOnly) { for(let section=0;section<16;section++) await click(520,158); }
  else if (crossAutoDirectionsOnly) { for(let section=0;section<15;section++) await click(520,158); }
  else if (crossAutoMarginsOnly) { for(let section=0;section<14;section++) await click(520,158); }
  else if (wrappedAutoMarginsOnly) { for(let section=0;section<13;section++) await click(520,158); }
  else if (autoMarginsOnly) { for(let section=0;section<12;section++) await click(520,158); }
  else if (directionMatrixOnly) { for(let section=0;section<11;section++) await click(520,158); }
  else if (intrinsicOnly) { for(let section=0;section<10;section++) await click(520,158); }
  else if (percentageOnly || aspectOnly || gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly || logicalBordersOnly) {
    assert.ok((await frame.locator('pre').innerText()).includes('grow'));
    await click(396,244);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: A'));
    await click(552,244);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: B'));
    await click(520,158);
    if (aspectOnly || gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (gapOnly || paddingOnly || crossOnly || marginOnly || logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (paddingOnly || crossOnly || marginOnly || logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (crossOnly || marginOnly || logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (marginOnly || logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (logicalPaddingOnly || logicalBordersOnly) await click(520,158);
    if (logicalPaddingOnly || logicalBordersOnly) await click(520,158);
  }
  if (logicalBordersOnly) await click(520,158);
  let previousOwner;
  let previousTextCrossSiblingStamp;
  let previousDirectionStamps;
  let previousLiveNames = [];
  for (const [index, fixture] of cases.entries()) {
    console.warn(`Replay ${index+1}/${cases.length}: ${fixture.name}`);
    if (index) { if (fixture.textCrossAutoFixture) await clearTextCrossAutoDraws(); await click(60, 158); }
    await frame.locator('pre').filter({ hasText: ` · ${fixture.name} ·` }).waitFor({ state: 'visible' });
    assert.ok((await frame.locator('pre').innerText()).includes(fixture.name));
    if (fixture.classification) assert.ok((await frame.locator('pre').innerText()).includes(fixture.comparisonLabel), 'Classified difference must be explicitly labeled');
    const expected = fixture.pibblBoxes ?? fixture.boxes;
    if (fixture.textCrossAutoFixture) {
      const inspector = await frame.locator('pre').innerText();
      const state = JSON.parse(inspector.split('auto margin state: ')[1]);
      const textBox = expected[0], sibling = expected[1];
      assert.deepEqual(state.boxes.B, sibling, `${fixture.name}: sibling semantic box`);
      if (previousTextCrossSiblingStamp !== undefined) assert.equal(state.stamps.B, previousTextCrossSiblingStamp, `${fixture.name}: sibling key remains stable`);
      const draws = await sandbox.evaluate(() => globalThis.__PIBBL_TEXT_CROSS_AUTO_DRAWS__.slice());
      const basis = state.canvasTransform, determinant = basis.a * basis.d - basis.b * basis.c;
      const normalize = (x, y) => ({ x: +((basis.d * (x - basis.e) - basis.c * (y - basis.f)) / determinant).toFixed(3), y: +((-basis.b * (x - basis.e) + basis.a * (y - basis.f)) / determinant).toFixed(3) });
      const textDraws = draws.filter(draw => draw.text.includes('aaaa')).slice(-textBox.height / 10).map(draw => {
        const point = normalize(draw.worldDrawX, draw.worldDrawY), origin = normalize(draw.transformE, draw.transformF);
        return { ...draw, worldDrawX: point.x, worldDrawY: point.y, transformE: origin.x, transformF: origin.y };
      });
      assert.equal(textDraws.length, textBox.height / 10, `${fixture.name}: measured line count`);
      assert.deepEqual(textDraws.map(draw => ({ worldDrawX: draw.worldDrawX, worldDrawY: draw.worldDrawY, transformE: draw.transformE, transformF: draw.transformF, font: draw.font })), Array.from({ length: textBox.height / 10 }, (_, line) => ({ worldDrawX: 392 + textBox.x, worldDrawY: 240 + textBox.y + line * 10, transformE: 392 + textBox.x, transformF: 240 + textBox.y, font: '10px monospace' })), `${fixture.name}: direct Text draw positions`);
      assert.ok(textDraws.every(draw => draw.text.includes('aaaa')), `${fixture.name}: direct Text draws only expected content`);
      await click(392 + 5, 240 + textBox.y - 5);
      assert.equal(JSON.parse((await frame.locator('pre').innerText()).split('auto margin state: ')[1]).hits, state.hits, `${fixture.name}: point above Text stays a miss`);
      await click(392 + 5, 240 + textBox.y + 5);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), `${fixture.name}: inside Text targets A`);
      assert.equal(JSON.parse((await frame.locator('pre').innerText()).split('auto margin state: ')[1]).hits, state.hits + 1);
      await click(392 + sibling.x + sibling.width / 2, 240 + sibling.y + sibling.height / 2);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: sibling center targets B`);
      previousTextCrossSiblingStamp = state.stamps.B;
      previousDirectionStamps = { B: state.stamps.B }; previousLiveNames = ['B'];
      continue;
    }
    if (fixture.roundingFixture) {
      const state = JSON.parse((await frame.locator('pre').innerText()).split('rounding state: ')[1]);
      assert.deepEqual(expected.map((_box, index) => state.boxes[String.fromCharCode(65 + index)]), expected, `${fixture.name}: unrounded logical boxes`);
      assert.ok(expected.some(box => !Number.isInteger(box.x) || !Number.isInteger(box.y) || !Number.isInteger(box.width) || !Number.isInteger(box.height)), `${fixture.name}: reference has fractional geometry`);
      for (const [boxIndex, box] of expected.entries()) {
        await click(392 + box.x + Math.min(1, box.width / 2), 240 + box.y + Math.min(1, box.height / 2));
        assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(65 + boxIndex)}`), `${fixture.name}: fractional target ${boxIndex}`);
      }
      previousDirectionStamps = state.stamps;
      previousLiveNames = expected.map((_box, index) => String.fromCharCode(65 + index));
      continue;
    }
    if (fixture.ownerCrossAutoFixture) {
      const state=JSON.parse((await frame.locator('pre').innerText()).split('auto margin state: ')[1]);
      assert.deepEqual(state.boxes.B, expected[1], `${fixture.name}: sibling geometry`);
      if(previousDirectionStamps?.B) assert.equal(state.stamps.B,previousDirectionStamps.B,`${fixture.name}: keyed sibling`);
      await click(397,240+expected[0].y-5);
      assert.equal(JSON.parse((await frame.locator('pre').innerText()).split('auto margin state: ')[1]).hits,state.hits,`${fixture.name}: empty margin miss`);
      for(const leaf of fixture.ownerNestedBoxes) {
        await click(397+leaf.x,245+leaf.y);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: A'),`${fixture.name}: nested job target`);
      }
      await click(397+expected[1].x,245+expected[1].y);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: B'));
      previousDirectionStamps={B:state.stamps.B};previousLiveNames=['B'];continue;
    }
    if (fixture.directionMatrixFixture || fixture.autoMarginFixture) {
      const state=JSON.parse((await frame.locator('pre').innerText()).split(fixture.autoMarginFixture ? 'auto margin state: ' : 'direction matrix state: ')[1]);
      assert.deepEqual(expected.map((_box,index)=>state.boxes[String.fromCharCode(65+index)]), expected, `${fixture.name}: semantic boxes`);
      const liveNames = expected.map((_box, index) => String.fromCharCode(65 + index));
      if (previousDirectionStamps) for (const name of liveNames) {
        if (previousLiveNames.includes(name)) assert.equal(state.stamps[name], previousDirectionStamps[name], `${fixture.name}: stable keyed panel ${name}`);
      }
      for (const [boxIndex, box] of expected.entries()) {
        await click(392+box.x+box.width/2,240+box.y+box.height/2);
        await frame.locator('pre').filter({ hasText: `selected: ${String.fromCharCode(65+boxIndex)}` }).waitFor({ state: 'visible' });
        assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(65+boxIndex)}`), `${fixture.name}: target ${boxIndex}`);
      }
      previousDirectionStamps=state.stamps;
      previousLiveNames=liveNames;
      continue;
    }
    if (fixture.intrinsicFixture) {
      const state=JSON.parse((await frame.locator('pre').innerText()).split('intrinsic state: ')[1]);
      assert.deepEqual(state.boxes.B,fixture.boxes[1]);
      const footer=fixture.boxes[1];await click(394+footer.x,242+footer.y);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: B'));
      continue;
    }
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
  if (!roundingOnly && !last.directionMatrixFixture && last.gap > 0) {
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
