import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-baseline`);
  const host = page.locator('iframe[srcdoc]'); await host.waitFor(); await host.scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]'); await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const counters = () => sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  await sandbox.evaluate(() => {
    const canvas = document.querySelector('canvas'), context = canvas.getContext('2d'), original = context.fillText.bind(context);
    globalThis.__PIBBL_TEXT_BASELINE_DRAWS__ = [];
    context.fillText = (text, x, y, maxWidth) => {
      if (text === 'Ag' || text.startsWith('Ag ')) globalThis.__PIBBL_TEXT_BASELINE_DRAWS__.push({ text, x, y, font: context.font, baseline: context.textBaseline, matrix: [...context.getTransform().toFloat64Array()] });
      original(text, x, y, maxWidth);
    };
  });
  const textDraws = async () => sandbox.evaluate(basis => {
    const canvas = document.querySelector('canvas'), context = canvas.getContext('2d'), inverse = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).inverse();
    return globalThis.__PIBBL_TEXT_BASELINE_DRAWS__.map(draw => {
      const matrix = new DOMMatrix(draw.matrix), origin = inverse.transformPoint(matrix.transformPoint({ x: draw.x, y: draw.y }));
      context.save();
      try {
        context.font = draw.font;
        context.textBaseline = 'top';
        const top = context.measureText(draw.text).actualBoundingBoxAscent;
        const left = context.measureText(draw.text).actualBoundingBoxLeft;
        const right = context.measureText(draw.text).actualBoundingBoxRight;
        const descent = context.measureText(draw.text).actualBoundingBoxDescent;
        context.textBaseline = 'alphabetic';
        const alphabetic = context.measureText(draw.text).actualBoundingBoxAscent;
        const alpha = inverse.transformPoint(matrix.transformPoint({ x: draw.x, y: draw.y + alphabetic - top }));
        const hitTopLeft = inverse.transformPoint(matrix.transformPoint({ x: draw.x - left, y: draw.y - top }));
        const hitBottomRight = inverse.transformPoint(matrix.transformPoint({ x: draw.x + right, y: draw.y + descent }));
        return { text: draw.text, font: draw.font, origin, alpha, hitTopLeft, hitBottomRight };
      } finally { context.restore(); }
    });
  }, (await state()).basis);
  const clearTextDraws = () => sandbox.evaluate(() => { globalThis.__PIBBL_TEXT_BASELINE_DRAWS__.length = 0; });
  const click = async (x, y) => {
    const position = await sandbox.evaluate(({ x, y, basis }) => {
      const canvas = document.querySelector('canvas'), bounds = canvas.getBoundingClientRect();
      const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({x,y});
      return { x: point.x * bounds.width / canvas.width, y: point.y * bounds.height / canvas.height };
    }, { x, y, basis: (await state()).basis });
    await frame.locator('canvas').click({ position });
    await page.waitForTimeout(180);
  };
  const geometry = (actual, width, first) => {
    const baseline = Math.max(0,12,first,24), cellWidth = width / 3;
    const expected = { A: [28,210+baseline-12,cellWidth,20], B: [28+cellWidth,210+baseline-first,cellWidth,40], C: [28+cellWidth*2,210+baseline-24,cellWidth,24] };
    for (const id of ['A','B','C']) {
      assert.ok(Math.abs(actual[id].x - expected[id][0]) < 1e-9, `${id} x`);
      assert.ok(Math.abs(actual[id].y - expected[id][1]) < 1e-9, `${id} y`);
      assert.equal(actual[id].width, expected[id][2]); assert.equal(actual[id].height, expected[id][3]);
    }
  };
  const initial = await state(); geometry(initial.boxes,180,30);
  assert.deepEqual(initial.allocations.A, { x:0,y:0,width:60,height:20 });
  assert.deepEqual(initial.allocations.B, { x:0,y:0,width:60,height:40 });
  await sandbox.evaluate(() => { const canvas = document.querySelector('canvas'); canvas.blur(); canvas.focus(); });
  for (let index=0;index<2;index++) await frame.locator('canvas').press('Tab');
  await page.waitForTimeout(180); assert.deepEqual((await state()).focused,['A','B','C']);
  await click(32,229); assert.deepEqual((await state()).hits,['A']);
  const before = await counters(); await click(40,110);
  const shifted = await state(); geometry(shifted.boxes,180,34);
  assert.ok(shifted.calls.B > initial.calls.B);
  assert.deepEqual(shifted.stamps,initial.stamps);
  assert.equal((await counters()).nodeCreates,before.nodeCreates);
  await click(32,229); assert.deepEqual((await state()).hits,['A']);
  await click(32,249); assert.deepEqual((await state()).hits,['A','A']);
  await click(90,215); assert.equal((await state()).hits.at(-1),'B');
  await click(260,110);
  const wider = await state(); geometry(wider.boxes,240,34);
  assert.deepEqual(wider.allocations.A,{x:0,y:0,width:80,height:20});
  assert.deepEqual(wider.allocations.B,{x:0,y:0,width:80,height:40});
  assert.deepEqual(wider.stamps,initial.stamps);
  const hitCount=wider.hits.length;
  await click(90,215); assert.equal((await state()).hits.length,hitCount);
  await click(110,215); assert.equal((await state()).hits.at(-1),'B');
  // Clear and settle the preceding card focus before isolating paint work.
  await click(700,410);
  const beforePaint=await counters(), calls=(await state()).calls;
  await clearTextDraws();
  await click(480,110);
  assert.deepEqual((await state()).calls,calls);
  const painted=await counters(); assert.equal(painted.solves,beforePaint.solves); assert.equal(painted.nodeCreates,beforePaint.nodeCreates); assert.equal(painted.crossPlacements,beforePaint.crossPlacements);
  const pixel=await sandbox.evaluate(basis=>{
    const point=new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({x:480,y:148});
    return [...document.querySelector('canvas').getContext('2d').getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data];
  },(await state()).basis);
  assert.deepEqual(pixel,[110,62,121,255]);
  const initialText = await textDraws();
  assert.equal(initialText.length, 2);
  const initialSmall = initialText.find(value => value.font === '10px monospace'), initialLarge = initialText.find(value => value.font === '20px sans-serif');
  assert.ok(initialSmall && initialLarge);
  assert.ok(Math.abs(initialSmall.alpha.y - initialLarge.alpha.y) < 1e-9, 'initial live Canvas baselines align');
  await click((initialSmall.hitTopLeft.x + initialSmall.hitBottomRight.x) / 2, (initialSmall.hitTopLeft.y + initialSmall.hitBottomRight.y) / 2);
  assert.deepEqual((await state()).textHits, ['text']);
  await clearTextDraws();
  await click(700,110);
  const changedTextState = await state(), changedText = await textDraws();
  assert.equal(changedTextState.textFont, '16px monospace');
  const changedSmall = changedText.find(value => value.font === '16px monospace'), changedLarge = changedText.find(value => value.font === '20px sans-serif');
  assert.ok(changedSmall && changedLarge);
  assert.notEqual(changedSmall.origin.y, initialSmall.origin.y);
  assert.ok(Math.abs(changedSmall.alpha.y - changedLarge.alpha.y) < 1e-9, 'changed live Canvas baselines align');
  await click((changedSmall.hitTopLeft.x + changedSmall.hitBottomRight.x) / 2, (changedSmall.hitTopLeft.y + changedSmall.hitBottomRight.y) / 2);
  assert.deepEqual((await state()).textHits, ['text', 'text']);
  await clearTextDraws();
  await click(80,392);
  const wrappedTextState = await state(), wrappedText = await textDraws();
  assert.equal(wrappedTextState.textWrap, true); assert.equal(wrappedTextState.textReflow, false);
  const twoLineSmall = wrappedText.filter(value => value.font === '10px monospace'), twoLineLarge = wrappedText.find(value => value.font === '20px sans-serif');
  assert.equal(twoLineSmall.length, 2);
  assert.ok(twoLineLarge);
  assert.ok(Math.abs(twoLineSmall[0].alpha.y - twoLineLarge.alpha.y) < 1e-9, 'wrapped first live Canvas baseline aligns');
  await clearTextDraws();
  await click(400,392);
  const reflowedTextState = await state(), reflowedText = await textDraws();
  assert.equal(reflowedTextState.textReflow, true);
  const wrappedSmall = reflowedText.filter(value => value.font === '10px monospace'), wrappedLarge = reflowedText.find(value => value.font === '20px sans-serif');
  assert.equal(wrappedSmall.length, 3);
  assert.ok(wrappedLarge);
  assert.ok(wrappedSmall.at(-1).origin.y > twoLineSmall.at(-1).origin.y, 'wrapped last line moves below the two-line glyph');
  assert.ok(Math.abs(wrappedSmall[0].alpha.y - wrappedLarge.alpha.y) < 1e-9, 'reflowed first live Canvas baseline aligns');
  await click((wrappedSmall.at(-1).hitTopLeft.x + wrappedSmall.at(-1).hitBottomRight.x) / 2, (wrappedSmall.at(-1).hitTopLeft.y + wrappedSmall.at(-1).hitBottomRight.y) / 2);
  assert.deepEqual((await state()).textHits, ['text', 'text', 'text']);
  await click(700,410);
  await page.waitForTimeout(180);
  const beforeTextPaint = await counters();
  await clearTextDraws();
  await click(480,110);
  const textPainted = await counters();
  assert.equal(textPainted.solves, beforeTextPaint.solves);
  assert.equal(textPainted.crossPlacements, beforeTextPaint.crossPlacements);
  assert.equal(textPainted.nodeCreates, beforeTextPaint.nodeCreates);
  assert.equal(textPainted.measuredLeaves, beforeTextPaint.measuredLeaves);
  // The companion row uses the same baseline offsets while a main-axis
  // automatic margin consumes its free space.
  const mainStart=await state();
  assert.equal(mainStart.mainAuto,false);
  assert.ok(Math.abs(mainStart.boxes.MA.x-460)<1e-9&&Math.abs(mainStart.boxes.MA.y-228)<1e-9);
  assert.ok(Math.abs(mainStart.boxes.MB.x-500)<1e-9&&Math.abs(mainStart.boxes.MB.y-210)<1e-9);
  const mainStamps=Object.fromEntries([['MA',mainStart.stamps.MA],['MB',mainStart.stamps.MB]]);
  await click(700,160);
  const mainAuto=await state();
  assert.equal(mainAuto.mainAuto,true);
  assert.ok(Math.abs(mainAuto.boxes.MA.x-540)<1e-9&&Math.abs(mainAuto.boxes.MA.y-228)<1e-9);
  assert.ok(Math.abs(mainAuto.boxes.MB.x-580)<1e-9&&Math.abs(mainAuto.boxes.MB.y-210)<1e-9);
  assert.deepEqual(Object.fromEntries([['MA',mainAuto.stamps.MA],['MB',mainAuto.stamps.MB]]),mainStamps);
  await click(550,238);assert.equal((await state()).hits.at(-1),'MA');
  await click(590,220);assert.equal((await state()).hits.at(-1),'MB');
  for (const [mode, y] of [['top',270],['bottom',210],['both',240]] ) {
    await click(700,204);
    const cross=await state();
    assert.equal(cross.crossMode,mode);
    assert.ok(Math.abs(cross.boxes.MA.x-540)<1e-9&&Math.abs(cross.boxes.MA.y-y)<1e-9,`${mode} cross placement`);
    assert.ok(Math.abs(cross.boxes.MB.x-580)<1e-9&&Math.abs(cross.boxes.MB.y-210)<1e-9,`${mode} baseline peer`);
    assert.deepEqual(Object.fromEntries([['MA',cross.stamps.MA],['MB',cross.stamps.MB]]),mainStamps);
    await click(550,y+4);assert.equal((await state()).hits.at(-1),'MA');
  }
  const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if(built){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
  const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements],[0,0,0]);assert.equal(await frame.locator('pre').count(),0);assert.deepEqual(errors,[]);
  console.warn(JSON.stringify({base,initial:initial.boxes,shifted:shifted.boxes,wider:wider.boxes,text:{initialSmall,initialLarge,changedSmall,changedLarge,twoLineSmall,twoLineLarge,wrappedSmall,wrappedLarge},builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
} finally { await browser.close(); }
