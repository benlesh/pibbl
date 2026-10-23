import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const reference = JSON.parse(readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'));
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const publicConcise = process.argv.includes('--public');
const publicFixtureNames = new Set(['grow', 'cap', 'shrink', 'custom-column-measure', 'custom-column-measure-resized']);
const nestedCrossMatrixOnly = process.argv.includes('--nested-cross-matrix');
const nestedPercentagesOnly = process.argv.includes('--nested-percentages');
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
const nestedCrossMinOnly = process.argv.includes('--nested-cross-min');
const nestedDecoratedCrossMinOnly = process.argv.includes('--nested-decorated-cross-min');
const nestedDecoratedCrossMaxOnly = process.argv.includes('--nested-decorated-cross-max');
const nestedDecoratedColumnCrossMaxOnly = process.argv.includes('--nested-decorated-column-cross-max');
const nestedDecoratedColumnCrossMinOnly = process.argv.includes('--nested-decorated-column-cross-min');
const customColumnMeasureOnly = process.argv.includes('--custom-column-measure');
const relativePositionOnly = process.argv.includes('--relative-position');
const decoratedRelativePositionOnly = process.argv.includes('--decorated-relative-position');
const absoluteParticipationOnly = process.argv.includes('--absolute-participation');
const absoluteAlignmentOnly = process.argv.includes('--absolute-alignment');
const absoluteMeasuredOnly = process.argv.includes('--absolute-measured-width');
const absoluteAspectOnly = process.argv.includes('--absolute-aspect');
const absoluteBoundsOnly = process.argv.includes('--absolute-bounds');
const containingBlockOnly = process.argv.includes('--containing-block');
const absoluteDerivedOnly = process.argv.includes('--absolute-derived-size');
const latestProof = process.argv.includes('--latest-proof');
const focusedReplay = nestedCrossMatrixOnly || nestedPercentagesOnly || marginOnly || intrinsicOnly || logicalBordersOnly || logicalPaddingOnly || directionMatrixOnly || autoMarginsOnly || autoOpposingOnly || autoShorthandOnly || ownerCrossAutoOnly || customCrossAutoOnly || textCrossAutoOnly || crossAutoDirectionsOnly || crossAutoMarginsOnly || wrappedAutoMarginsOnly || crossOnly || paddingOnly || gapOnly || aspectOnly || percentageOnly || roundingOnly || nestedCrossMinOnly || nestedDecoratedCrossMinOnly || nestedDecoratedCrossMaxOnly || nestedDecoratedColumnCrossMaxOnly || nestedDecoratedColumnCrossMinOnly || relativePositionOnly || decoratedRelativePositionOnly || absoluteParticipationOnly || absoluteAlignmentOnly || absoluteDerivedOnly;
if (publicConcise && focusedReplay) throw new Error('--public replays only the concise default corpus; focused family replay belongs to the private full lab');
const route = publicConcise ? '#/examples/layout/wasm-yoga-migration' : '#/testing/layout-yoga-migration';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  const catalogUrls = [];
  const privateCorpusRequests = [];
  page.on('request', request => { if (decodeURIComponent(request.url()).includes('pibbl-layout-yoga-rehearsal')) privateCorpusRequests.push(request.url()); });
  page.on('response', response => { if (response.url().includes('/learning-catalog.ts')) catalogUrls.push(response.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/${route}`);
  assert.equal(new URL(page.url()).hash, route, 'replay route must not fall back');
  const frameSelector = publicConcise ? 'iframe[srcdoc]' : 'iframe[title="Yoga layout rehearsal"]';
  await page.locator(frameSelector).waitFor({ state: 'attached' });
  await page.locator(frameSelector).scrollIntoViewIfNeeded();
  const frame = page.frameLocator(frameSelector);
  await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  assert.ok(sandbox, 'replay must execute in its own iframe realm');
  assert.ok((await frame.locator('pre').innerText()).includes(`fixture count: ${publicConcise ? 5 : reference.cases.length}`), 'renderer must receive the selected corpus');
  const privateProof = publicConcise ? undefined : await sandbox.evaluate(() => globalThis.__PIBBL_YOGA_REHEARSAL_PROOF__);
  if (!publicConcise) {
    assert.ok(privateProof, 'private full replay must expose its proof marker');
    assert.deepEqual(privateProof.fixtureSource, { version: reference.version, commit: reference.commit, licenseSha256: reference.licenseSha256, probeSha256: reference.probeSha256 }, 'private full replay must retain recorded Yoga provenance');
    assert.deepEqual(privateProof.caseNames, reference.cases.map(value => value.name), 'private full replay must retain every fixture in source order');
    assert.ok(privateProof.caseNames.length >= 320, 'private full replay must retain the accepted corpus floor');
    assert.ok(Array.isArray(privateProof.coreInputs) && privateProof.coreInputs.length > 0, 'private full replay must report actual core inputs');
  }
  await sandbox.evaluate(() => {
    const canvas = document.querySelector('canvas');
    canvas.addEventListener('mousedown', event => {
      const rect = canvas.getBoundingClientRect(), style = getComputedStyle(canvas);
      globalThis.__PIBBL_REPLAY_MOUSE__ = {clientX:event.clientX,clientY:event.clientY,offsetX:event.offsetX,offsetY:event.offsetY,
        rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},backing:{width:canvas.width,height:canvas.height},
        borderLeft:style.borderLeftWidth,borderTop:style.borderTopWidth,paddingLeft:style.paddingLeft,paddingTop:style.paddingTop};
    });
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
    const iframe = page.locator('iframe[srcdoc]');
    const iframeBounds = await iframe.boundingBox();
    const chrome = await iframe.evaluate(element => ({ left: element.clientLeft, top: element.clientTop }));
    const canvasBounds = await frame.locator('canvas').evaluate(canvas => {
      const rect = canvas.getBoundingClientRect();
      return {left: rect.left, top: rect.top};
    });
    await page.mouse.click(
      iframeBounds.x + chrome.left + canvasBounds.left + (bounds.width - 760 * scale) / 2 + x * scale,
      iframeBounds.y + chrome.top + canvasBounds.top + (bounds.height - 540 * scale) / 2 + y * scale,
    );
    await page.waitForTimeout(240);
  };
  const availableCases = publicConcise ? reference.cases.filter(fixture => publicFixtureNames.has(fixture.name)) : reference.cases;
  const cases = nestedCrossMatrixOnly ? availableCases.filter(fixture => fixture.nestedCrossMinFixture || fixture.nestedDecoratedCrossMinFixture || fixture.nestedDecoratedCrossMaxFixture || fixture.nestedDecoratedColumnCrossMaxFixture || fixture.nestedDecoratedColumnCrossMinFixture) : absoluteMeasuredOnly ? availableCases.filter(fixture => fixture.absoluteMeasuredWidthFixture) : absoluteAspectOnly ? availableCases.filter(fixture => fixture.absoluteAspectFixture) : absoluteBoundsOnly ? availableCases.filter(fixture => fixture.absoluteBoundsFixture) : containingBlockOnly ? availableCases.filter(fixture => fixture.nestedContainingBlockFixture) : absoluteDerivedOnly ? availableCases.filter(fixture => fixture.absoluteDerivedSizeFixture) : absoluteAlignmentOnly ? availableCases.filter(fixture => fixture.absoluteAlignmentFixture) : absoluteParticipationOnly ? availableCases.filter(fixture => fixture.absoluteParticipationFixture) : decoratedRelativePositionOnly ? availableCases.filter(fixture => fixture.decoratedRelativeStaticFixture) : relativePositionOnly ? availableCases.filter(fixture => fixture.relativeStaticFixture) : nestedPercentagesOnly ? availableCases.filter(fixture => fixture.name.startsWith('nested-percent-gap-')) : customColumnMeasureOnly ? availableCases.filter(fixture => fixture.customColumnMeasureFixture) : nestedDecoratedColumnCrossMinOnly ? availableCases.filter(fixture => fixture.nestedDecoratedColumnCrossMinFixture) : nestedDecoratedColumnCrossMaxOnly ? availableCases.filter(fixture => fixture.nestedDecoratedColumnCrossMaxFixture) : nestedDecoratedCrossMaxOnly ? availableCases.filter(fixture => fixture.nestedDecoratedCrossMaxFixture) : nestedDecoratedCrossMinOnly ? availableCases.filter(fixture => fixture.nestedDecoratedCrossMinFixture) : nestedCrossMinOnly ? availableCases.filter(fixture => fixture.nestedCrossMinFixture) : roundingOnly ? availableCases.filter(fixture => fixture.roundingFixture) : ownerCrossAutoOnly ? availableCases.filter(fixture => fixture.ownerCrossAutoFixture) : customCrossAutoOnly ? availableCases.filter(fixture => fixture.customCrossAutoFixture) : textCrossAutoOnly ? availableCases.filter(fixture => fixture.textCrossAutoFixture) : autoOpposingOnly ? availableCases.filter(fixture => fixture.autoOpposingMarginFixture) : autoShorthandOnly ? availableCases.filter(fixture => fixture.autoShorthandMarginFixture) : crossAutoDirectionsOnly ? availableCases.filter(fixture => fixture.autoCrossDirectionFixture) : crossAutoMarginsOnly ? availableCases.filter(fixture => fixture.autoCrossMarginFixture) : wrappedAutoMarginsOnly ? availableCases.filter(fixture => fixture.autoWrappedMarginFixture) : autoMarginsOnly ? availableCases.filter(fixture => fixture.autoMarginFixture) : directionMatrixOnly ? availableCases.filter(fixture => fixture.directionMatrixFixture) : intrinsicOnly ? availableCases.filter(fixture => fixture.intrinsicFixture) : logicalBordersOnly ? availableCases.filter(fixture => fixture.name.startsWith('logical-border-')) : logicalPaddingOnly ? availableCases.filter(fixture => fixture.name.startsWith('logical-padding-')) : marginOnly ? availableCases.filter(fixture => fixture.name.startsWith('margin-percent-')) : crossOnly ? availableCases.filter(fixture => fixture.name.startsWith('cross-percent-')) : paddingOnly ? availableCases.filter(fixture => fixture.name.startsWith('padding-percent-')) : gapOnly ? availableCases.filter(fixture => fixture.name.startsWith('gap-percent-')) : aspectOnly ? availableCases.filter(fixture => fixture.name.startsWith('aspect-wrap-')) : percentageOnly ? availableCases.filter(fixture => fixture.name.startsWith('percent-')) : availableCases;
  assert.ok(cases.length > 0, 'requested replay must have fixtures');
  if (publicConcise) assert.equal(availableCases.length, 5, 'public corpus must stay concise');
  if (nestedCrossMatrixOnly) { for (let section = 0; section < 22; section++) await click(520, 158); }
  else if (nestedPercentagesOnly) { for (let section = 0; section < 7; section++) await click(520, 158); }
  else if (customColumnMeasureOnly) {
    if (publicConcise || latestProof) await click(650, 158);
    else for(let section=0;section<27;section++) await click(520,158);
  }
  else if (absoluteMeasuredOnly) { await click(650, 158); }
  else if (absoluteAspectOnly) { for (let section = 0; section < 35; section++) await click(520, 158); }
  else if (absoluteBoundsOnly) { for (let section = 0; section < 34; section++) await click(520, 158); }
  else if (containingBlockOnly) { for (let section = 0; section < 33; section++) await click(520, 158); }
  else if (absoluteDerivedOnly) { for (let section = 0; section < 32; section++) await click(520, 158); }
  else if (absoluteAlignmentOnly) { for (let section = 0; section < 31; section++) await click(520, 158); }
  else if (absoluteParticipationOnly) { for (let section = 0; section < 30; section++) await click(520, 158); }
  else if (decoratedRelativePositionOnly) {
    for (let section = 0; section < 29; section++) await click(520, 158);
  }
  else if (relativePositionOnly) {
    for (let section = 0; section < 28; section++) await click(520, 158);
  }
  else if (nestedDecoratedColumnCrossMinOnly) {
    if (latestProof) await click(650, 158);
    else for(let section=0;section<26;section++) await click(520,158);
  }
  else if (nestedDecoratedColumnCrossMaxOnly) {
    if (latestProof) await click(650, 158);
    else for(let section=0;section<25;section++) await click(520,158);
  }
  else if (nestedDecoratedCrossMaxOnly) { for(let section=0;section<24;section++) await click(520,158); }
  else if (nestedDecoratedCrossMinOnly) { for(let section=0;section<23;section++) await click(520,158); }
  else if (nestedCrossMinOnly) { for(let section=0;section<22;section++) await click(520,158); }
  else if (roundingOnly) { for(let section=0;section<21;section++) await click(520,158); }
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
  let previousNestedCross;
  let previousCustomColumn;
  let previousTextCrossSiblingStamp;
  let previousDirectionStamps;
  const coveredTargets = [];
  let previousLiveNames = [];
  for (const [index, fixture] of cases.entries()) {
    console.warn(`Replay ${index+1}/${cases.length}: ${fixture.name}`);
    if (index) { if (fixture.textCrossAutoFixture) await clearTextCrossAutoDraws(); await click(60, 158); }
    await frame.locator('pre').filter({ hasText: ` · ${fixture.name} ·` }).waitFor({ state: 'visible' });
    assert.ok((await frame.locator('pre').innerText()).includes(fixture.name));
    if (fixture.classification) assert.ok((await frame.locator('pre').innerText()).includes(fixture.comparisonLabel), 'Classified difference must be explicitly labeled');
    const expected = fixture.pibblBoxes ?? fixture.boxes;
    if (fixture.nestedContainingBlockFixture) {
      const state = JSON.parse((await frame.locator('pre').innerText()).split('containing block state: ')[1]);
      assert.deepEqual(state.boxes.A, expected[0], `${fixture.name}: nested owner world box`);
      assert.deepEqual(state.boxes.B, expected[1], `${fixture.name}: outer sibling slot`);
      assert.deepEqual(state.boxes.ABS, fixture.nestedBoxes[0], `${fixture.name}: ancestor-relative absolute world box`);
      if (previousDirectionStamps) for (const name of ['A','ABS','B']) assert.equal(state.stamps[name], previousDirectionStamps[name], `${fixture.name}: stable ${name}`);
      for (const name of ['ABS','B','A']) {
        const box = state.boxes[name];
        const x = name === 'A' ? box.x + box.width - 4 : box.x + 4;
        const y = name === 'A' ? box.y + box.height - 4 : box.y + 4;
        await click(392 + x, 240 + y);
        assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${name}`), `${fixture.name}: exposed ${name} targets`);
      }
      previousDirectionStamps = state.stamps; previousLiveNames = ['A','ABS','B'];
      continue;
    }
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
    if (fixture.customColumnMeasureFixture) {
      const state = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
      assert.deepEqual([state.boxes.A, state.boxes.B], expected, `${fixture.name}: exact measured column boxes`);
      const layout = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      if (previousCustomColumn) {
        assert.equal(state.stamps.A, previousCustomColumn.stamps.A, `${fixture.name}: provider key remains stable`);
        assert.equal(state.stamps.B, previousCustomColumn.stamps.B, `${fixture.name}: sibling key remains stable`);
        assert.ok(state.measureCalls > previousCustomColumn.measureCalls, `${fixture.name}: width change queries the paired provider`);
        assert.ok(layout.measuredLeaves > previousCustomColumn.layout.measuredLeaves, `${fixture.name}: width change records constrained measurement`);
        assert.equal(layout.nodeCreates, previousCustomColumn.layout.nodeCreates, `${fixture.name}: width change reuses native nodes`);
        await click(392 + 10, 240 + 55);
        const oldPoint = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
        assert.equal(oldPoint.hits, state.hits, `${fixture.name}: former B point is empty`);
        await click(392 + 10, 240 + 35);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: moved B targets`);
      } else {
        await click(392 + 10, 240 + 55);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: initial B targets`);
      }
      await click(392 + expected[0].x + 4, 240 + expected[0].y + 4);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), `${fixture.name}: provider targets`);
      const beforePaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      const beforePaintState = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
      await click(354, 158);
      const afterPaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      const afterPaintState = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
      assert.equal(afterPaint.measuredLeaves, beforePaint.measuredLeaves, `${fixture.name}: paint does not measure`);
      assert.equal(afterPaint.solves, beforePaint.solves, `${fixture.name}: paint reuses main solve`);
      assert.equal(afterPaint.nodeCreates, beforePaint.nodeCreates, `${fixture.name}: paint reuses nodes`);
      assert.equal(afterPaintState.measureCalls, beforePaintState.measureCalls, `${fixture.name}: paint preserves provider cache`);
      previousCustomColumn = { stamps: state.stamps, layout, measureCalls: state.measureCalls };
      previousDirectionStamps = state.stamps;
      previousLiveNames = ['A', 'B'];
      continue;
    }
    if (fixture.absoluteParticipationFixture || fixture.absoluteAlignmentFixture || fixture.absoluteDerivedSizeFixture || fixture.absoluteBoundsFixture || fixture.absoluteAspectFixture || fixture.absoluteMeasuredWidthFixture) {
      const label = fixture.absoluteMeasuredWidthFixture ? 'absolute measured width state: ' : fixture.absoluteAspectFixture ? 'absolute aspect state: ' : fixture.absoluteBoundsFixture ? 'absolute bounds state: ' : fixture.absoluteDerivedSizeFixture ? 'absolute derived size state: ' : fixture.absoluteAlignmentFixture ? 'absolute alignment state: ' : 'absolute participation state: ';
      const state = JSON.parse((await frame.locator('pre').innerText()).split(label)[1]);
      assert.deepEqual([state.boxes.A, state.boxes.B, state.boxes.C], expected, `${fixture.name}: flow and absolute boxes`);
      for (const name of ['A', 'B', 'C']) {
        if (previousDirectionStamps && previousLiveNames.includes(name)) assert.equal(state.stamps[name], previousDirectionStamps[name], `${fixture.name}: stable ${name} key`);
      }
      // Find an exposed point for each authored box; later paint wins overlap.
      for (let target = 0; target < expected.length; target++) {
        const box = expected[target];
        let point;
        const xs = [box.x, box.x + box.width], ys = [box.y, box.y + box.height];
        for (let later = target + 1; later < expected.length; later++) {
          const cover = expected[later];
          if (cover.x > box.x && cover.x < box.x + box.width) xs.push(cover.x);
          if (cover.x + cover.width > box.x && cover.x + cover.width < box.x + box.width) xs.push(cover.x + cover.width);
          if (cover.y > box.y && cover.y < box.y + box.height) ys.push(cover.y);
          if (cover.y + cover.height > box.y && cover.y + cover.height < box.y + box.height) ys.push(cover.y + cover.height);
        }
        xs.sort((first, second) => first - second); ys.sort((first, second) => first - second);
        for (let yi = 0; yi < ys.length - 1 && !point; yi++) {
          if (ys[yi] === ys[yi + 1]) continue;
          for (let xi = 0; xi < xs.length - 1; xi++) {
            if (xs[xi] === xs[xi + 1]) continue;
            const x = (xs[xi] + xs[xi + 1]) / 2, y = (ys[yi] + ys[yi + 1]) / 2;
            if (!expected.slice(target + 1).some(later => x >= later.x && x <= later.x + later.width && y >= later.y && y <= later.y + later.height)) { point = {x, y}; break; }
          }
        }
        if (!point) {
          const cover = expected[1];
          assert.ok((fixture.absoluteDerivedSizeFixture || fixture.absoluteBoundsFixture) && fixture.layoutDirection === 'rtl' && target === 0 &&
            cover.x <= box.x && cover.y <= box.y && cover.x + cover.width >= box.x + box.width && cover.y + cover.height >= box.y + box.height,
            `${fixture.name}: only the natively fully covered RTL A may lack an exposed point`);
          coveredTargets.push(`${fixture.name}:A`);
          continue; // Exact boxes and overlap assertions still prove its occlusion.
        }
        await click(392 + point.x, 240 + point.y);
        assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(65 + target)}`), `${fixture.name}: exposed target ${target} at ${JSON.stringify(point)}; mouse ${JSON.stringify(await sandbox.evaluate(() => globalThis.__PIBBL_REPLAY_MOUSE__))}; ${(await frame.locator('pre').innerText()).match(/selected: [^\n]+/)?.[0]}`);
      }
      for (let earlier = 0; earlier < expected.length; earlier++) {
        for (let later = earlier + 1; later < expected.length; later++) {
          const first = expected[earlier], second = expected[later];
          const left = Math.max(first.x, second.x), right = Math.min(first.x + first.width, second.x + second.width);
          const top = Math.max(first.y, second.y), bottom = Math.min(first.y + first.height, second.y + second.height);
          if (left >= right || top >= bottom) continue;
          const x = (left + right) / 2, y = (top + bottom) / 2;
          let topmost = later;
          for (let index = later + 1; index < expected.length; index++) {
            const box = expected[index];
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) topmost = index;
          }
          await click(392 + x, 240 + y);
          assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(65 + topmost)}`), `${fixture.name}: authored paint order wins overlap`);
        }
      }
      const beforePaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      await click(354, 158);
      const afterPaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      assert.equal(afterPaint.solves, beforePaint.solves, `${fixture.name}: paint reuses solve`);
      assert.equal(afterPaint.nodeCreates, beforePaint.nodeCreates, `${fixture.name}: paint preserves nodes`);
      if (fixture.absoluteMeasuredWidthFixture) {
        const painted = JSON.parse((await frame.locator('pre').innerText()).split(label)[1]);
        assert.equal(painted.measureCalls, state.measureCalls, `${fixture.name}: stable provider paint reuses measurement`);
        assert.equal(afterPaint.measuredLeaves, beforePaint.measuredLeaves, `${fixture.name}: paint preserves measured leaves`);
        assert.deepEqual(painted.query, {minWidth:0,maxWidth:'unbounded',minHeight:20,maxHeight:20}, `${fixture.name}: native callback constraint envelope`);
      }
      previousDirectionStamps = state.stamps;
      previousLiveNames = ['A', 'B', 'C'];
      continue;
    }
    if (fixture.relativeStaticFixture || fixture.decoratedRelativeStaticFixture) {
      const stateLabel = fixture.decoratedRelativeStaticFixture ? 'decorated relative position state: ' : 'relative position state: ';
      const state = JSON.parse((await frame.locator('pre').innerText()).split(stateLabel)[1]);
      assert.deepEqual([state.boxes.A, state.boxes.B], expected, `${fixture.name}: exact physical placement boxes`);
      if (previousDirectionStamps) {
        assert.equal(state.stamps.A, previousDirectionStamps.A, `${fixture.name}: A key remains stable`);
        assert.equal(state.stamps.B, previousDirectionStamps.B, `${fixture.name}: B key remains stable`);
      }
      const a = expected[0], b = expected[1];
      await click(392 + a.x + a.width - 4, 240 + a.y + 4);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), `${fixture.name}: exposed A edge targets A`);
      await click(392 + b.x + b.width / 2, 240 + b.y + b.height / 2);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: B center targets B`);
      const overlapLeft = Math.max(a.x, b.x), overlapRight = Math.min(a.x + a.width, b.x + b.width);
      const overlapTop = Math.max(a.y, b.y), overlapBottom = Math.min(a.y + a.height, b.y + b.height);
      if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        await click(392 + (overlapLeft + overlapRight) / 2, 240 + (overlapTop + overlapBottom) / 2);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: later B stays topmost in overlap`);
      }
      const beforePaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      await click(354, 158);
      const afterPaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      assert.equal(afterPaint.solves, beforePaint.solves, `${fixture.name}: paint does not solve`);
      assert.equal(afterPaint.nodeCreates, beforePaint.nodeCreates, `${fixture.name}: paint does not create nodes`);
      previousDirectionStamps = state.stamps;
      previousLiveNames = ['A', 'B'];
      continue;
    }
    if (fixture.nestedCrossMinFixture || fixture.nestedDecoratedCrossMinFixture || fixture.nestedDecoratedCrossMaxFixture || fixture.nestedDecoratedColumnCrossMaxFixture || fixture.nestedDecoratedColumnCrossMinFixture) {
      const inspector = await frame.locator('pre').innerText();
      const state = JSON.parse(inspector.split('nested cross min state: ')[1]);
      const columnMaximum = Boolean(fixture.nestedDecoratedColumnCrossMaxFixture);
      const columnMinimum = Boolean(fixture.nestedDecoratedColumnCrossMinFixture);
      const maximum = Boolean(fixture.nestedDecoratedCrossMaxFixture || columnMaximum);
      const nestedBoxes = fixture.nestedCrossBoxes ?? fixture.nestedDecoratedBoxes ?? fixture.nestedDecoratedMaxBoxes ?? fixture.nestedDecoratedColumnMaxBoxes ?? fixture.nestedDecoratedColumnMinBoxes;
      assert.equal(state.decorated, Boolean(fixture.nestedDecoratedCrossMinFixture || maximum || columnMinimum), `${fixture.name}: inspector marks decorated root`);
      assert.equal(state.maximum, maximum, `${fixture.name}: inspector marks maximum branch`);
      assert.equal(state.column, Boolean(columnMaximum || columnMinimum), `${fixture.name}: inspector marks column branch`);
      assert.equal(state.minimum, columnMinimum, `${fixture.name}: inspector marks column minimum branch`);
      assert.deepEqual([state.boxes.A1, state.boxes.A2], nestedBoxes, `${fixture.name}: fixed nested leaves`);
      assert.deepEqual([state.boxes.B, state.boxes.C], expected.slice(1), `${fixture.name}: following sibling boxes`);
      const layout = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      if (fixture.name.endsWith('-resized')) {
        assert.equal(previousNestedCross?.name, fixture.name.replace(/-resized$/, ''), 'resize must compare only its matching initial fixture');
        assert.equal(state.stamps.A1, previousNestedCross.stamps.A1, `${fixture.name}: A1 key remains stable`);
        assert.equal(state.stamps.A2, previousNestedCross.stamps.A2, `${fixture.name}: A2 key remains stable`);
        assert.equal(state.stamps.B, previousNestedCross.stamps.B, `${fixture.name}: B key remains stable`);
        assert.equal(state.stamps.C, previousNestedCross.stamps.C, `${fixture.name}: C key remains stable`);
        assert.equal(layout.solves, previousNestedCross.layout.solves, `${fixture.name}: height-only resize reuses main solves`);
        assert.equal(layout.lineFormations, previousNestedCross.layout.lineFormations, `${fixture.name}: height-only resize reuses line formation`);
        assert.ok(layout.crossPlacements > previousNestedCross.layout.crossPlacements, `${fixture.name}: height-only resize replaces cross placements`);
        assert.equal(layout.nodeCreates, previousNestedCross.layout.nodeCreates, `${fixture.name}: stable keys reuse native nodes`);
        if (!maximum && !columnMinimum) {
          await click(392 + expected[1].x + 4, 240 + expected[1].y + 4);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: sibling remains selectable`);
          const oldFollowing = previousNestedCross.following;
          await click(392 + oldFollowing.x + 4, 240 + oldFollowing.y + 4);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: former C point is now empty`);
        } else if (maximum) {
          await click(392 + expected[1].x + 4, 240 + expected[1].y + 4);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: sibling remains selectable`);
          const maximumPoint = columnMaximum ? { x: 52, y: 136 } : { x: 136, y: 52 };
          await click(392 + maximumPoint.x, 240 + maximumPoint.y);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: A1'), `${fixture.name}: newly exposed leaf targets`);
        } else {
          await click(392 + 100, 240 + 136);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: A1'), `${fixture.name}: former C point becomes minimum leaf`);
          await click(392 + 134, 240 + 136);
          assert.ok((await frame.locator('pre').innerText()).includes('selected: C'), `${fixture.name}: moved C targets`);
        }
      } else if (maximum) {
        await click(392 + expected[1].x + 4, 240 + expected[1].y + 4);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: sibling selects before maximum leaf exists`);
        const maximumPoint = columnMaximum ? { x: 52, y: 136 } : { x: 136, y: 52 };
        await click(392 + maximumPoint.x, 240 + maximumPoint.y);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), `${fixture.name}: capped leaf point begins outside allocation`);
      } else if (columnMinimum) {
        await click(392 + 100, 240 + 136);
        assert.ok((await frame.locator('pre').innerText()).includes('selected: C'), `${fixture.name}: minimum leaf point begins in C`);
      }
      for (const [leafIndex, leaf] of nestedBoxes.entries()) {
        await click(392 + leaf.x + 4, 240 + leaf.y + 4);
        assert.ok((await frame.locator('pre').innerText()).includes(`selected: A${leafIndex + 1}`), `${fixture.name}: nested leaf ${leafIndex + 1} targets`);
      }
      const following = expected[2];
      await click(392 + following.x + 4, 240 + following.y + 4);
      assert.ok((await frame.locator('pre').innerText()).includes('selected: C'), `${fixture.name}: moved C targets`);
      const beforePaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      await click(354, 158);
      const afterPaint = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
      assert.equal(afterPaint.solves, beforePaint.solves, `${fixture.name}: paint reuse preserves main solve`);
      assert.equal(afterPaint.lineFormations, beforePaint.lineFormations, `${fixture.name}: paint reuse preserves lines`);
      assert.equal(afterPaint.nodeCreates, beforePaint.nodeCreates, `${fixture.name}: paint reuse preserves nodes`);
      assert.equal(afterPaint.measuredLeaves, beforePaint.measuredLeaves + (maximum || columnMinimum ? 0 : 1), `${fixture.name}: ${maximum || columnMinimum ? 'definite cross bound avoids measurement' : 'row owner remeasures once for paint'}`);
      previousNestedCross = { name: fixture.name, stamps: state.stamps, layout, following };
      previousDirectionStamps = state.stamps;
      previousLiveNames = ['A1', 'A2', 'B', 'C'];
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
  if (customColumnMeasureOnly) {
    const beforeMutation = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
    assert.equal(beforeMutation.jobs, 8, 'pinned replay leaves the provider at eight jobs');
    assert.equal(beforeMutation.comparison, 'pinned Yoga reference uses 8 jobs; More jobs is a Pibbl-only content mutation');
    const beforeMutationLayout = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
    await click(666, 66);
    const mutated = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
    assert.equal(mutated.jobs, 12, 'more-jobs control changes only the measured content input');
    assert.deepEqual([mutated.boxes.A, mutated.boxes.B], [{ x: 0, y: 0, width: 60, height: 40 }, { x: 0, y: 40, width: 20, height: 20 }], 'twelve jobs move the following target without claiming a Yoga fixture');
    const mutatedLayout = await sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
    assert.ok(mutated.measureCalls > beforeMutation.measureCalls, 'content mutation queries the provider');
    assert.ok(mutatedLayout.measuredLeaves > beforeMutationLayout.measuredLeaves, 'content mutation records measurement');
    assert.equal(mutatedLayout.nodeCreates, beforeMutationLayout.nodeCreates, 'content mutation preserves native nodes');
    await click(402, 275);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: A'), 'former follower point becomes queue content');
    await click(402, 285);
    assert.ok((await frame.locator('pre').innerText()).includes('selected: B'), 'moved follower targets after content mutation');
    if (process.argv.includes('--screenshot')) await frame.locator('canvas').screenshot({ path: '/tmp/pibbl-slice118-content-mutation.png' });
    await click(666, 66);
    const reset = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
    assert.equal(reset.jobs, 8, 'more-jobs control restores pinned reference content');
    assert.deepEqual([reset.boxes.A, reset.boxes.B], cases.at(-1).boxes, 'reset restores the pinned resized geometry');
    await click(666, 66);
    await click(publicConcise ? 60 : 520, 158);
    await click(650, 158);
    const revisited = JSON.parse((await frame.locator('pre').innerText()).split('custom column state: ')[1]);
    assert.equal(revisited.jobs, 8, 'navigation restores the pinned content instead of leaking mutation into another fixture');
    assert.deepEqual([revisited.boxes.A, revisited.boxes.B], cases[0].boxes);
    await click(60, 158);
  }
  let catalogSurface;
  if (publicConcise) {
    assert.deepEqual(privateCorpusRequests, [], 'public lesson must not load the private exhaustive bundle');
    assert.ok(catalogUrls.length > 0, 'public concise replay must observe its actual catalog source');
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
    assert.ok((await frame.locator('pre').innerText()).includes('fixture count: 5'), 'public lesson must not embed the exhaustive corpus');
  }
  // Source-formed lines and reversed placement retain identities; gaps miss.
  const last = cases.at(-1);
  const lastBoxes = last.pibblBoxes ?? last.boxes;
  const column = last.flexDirection.startsWith('column');
  if (!absoluteMeasuredOnly && !absoluteAspectOnly && !absoluteBoundsOnly && !containingBlockOnly && !absoluteDerivedOnly && !absoluteAlignmentOnly && !absoluteParticipationOnly && !relativePositionOnly && !decoratedRelativePositionOnly && !roundingOnly && !nestedCrossMinOnly && !nestedDecoratedCrossMinOnly && !nestedDecoratedCrossMaxOnly && !nestedDecoratedColumnCrossMaxOnly && !nestedDecoratedColumnCrossMinOnly && !customColumnMeasureOnly && !last.directionMatrixFixture && last.gap > 0) {
  const gap = column ? Math.min(...lastBoxes.map(box => box.y + box.height)) + 6 : Math.min(...lastBoxes.map(box => box.x + box.width)) + 6;
  await click(column ? 396+lastBoxes[0].x : 392+gap, column ? 240+gap : 244+lastBoxes[0].y);
  assert.ok((await frame.locator('pre').innerText()).includes(`selected: ${String.fromCharCode(64+lastBoxes.length)}`));
  }
  if (process.argv.includes('--screenshot')) await frame.locator('canvas').screenshot({ path: '/tmp/pibbl-yoga-comparison.png' });
  const proof = publicConcise ? await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__) : privateProof;
  if (built) {
    assert.equal(proof?.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  } else if (!publicConcise) {
    assert.equal(proof.mode, 'source');
    assert.ok(proof.coreInputs.every(value => value.includes('packages/core/src/')));
  }
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0, 0, 0]);
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, route, publicConcise, commit: reference.commit, cases: cases.map(value => value.name), coreInputs: proof?.coreInputs.length ?? null, builtInputs: built ? proof?.coreInputs.length ?? null : null, catalogUrls, catalogSurface, privateCorpusRequests: privateCorpusRequests.length, customColumnContentMutation: customColumnMeasureOnly, coveredTargets, matched: cases.filter(value => !value.pibblBoxes).length, classified: cases.filter(value => value.pibblBoxes).map(value => value.name), cleanup: [0, 0, 0], errors }));
} finally { await browser.close(); }
