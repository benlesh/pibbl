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
      if (text === 'Ag' || text.startsWith('Ag')) globalThis.__PIBBL_TEXT_BASELINE_DRAWS__.push({ text, x, y, font: context.font, baseline: context.textBaseline, matrix: [...context.getTransform().toFloat64Array()] });
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
        context.textBaseline = draw.baseline;
        const current = context.measureText(draw.text);
        const currentAscent = current.actualBoundingBoxAscent;
        const left = current.actualBoundingBoxLeft;
        const right = current.actualBoundingBoxRight;
        const descent = current.actualBoundingBoxDescent;
        context.textBaseline = 'alphabetic';
        const alphabetic = context.measureText(draw.text).actualBoundingBoxAscent;
        const alpha = inverse.transformPoint(matrix.transformPoint({ x: draw.x, y: draw.y + alphabetic - currentAscent }));
        const hitTopLeft = inverse.transformPoint(matrix.transformPoint({ x: draw.x - left, y: draw.y - currentAscent }));
        const hitBottomRight = inverse.transformPoint(matrix.transformPoint({ x: draw.x + right, y: draw.y + descent }));
        return { text: draw.text, font: draw.font, baseline: draw.baseline, origin, alpha, hitTopLeft, hitBottomRight };
      } finally { context.restore(); }
    });
  }, (await state()).basis);
  const clearTextDraws = () => sandbox.evaluate(() => { globalThis.__PIBBL_TEXT_BASELINE_DRAWS__.length = 0; });
  const click = async (x, y) => {
    const position = await sandbox.evaluate(({ x, y, basis }) => {
      const canvas = document.querySelector('canvas'), bounds = canvas.getBoundingClientRect(), style = getComputedStyle(canvas);
      const px=value=>Number.parseFloat(value)||0;
      const left=px(style.borderLeftWidth)+px(style.paddingLeft),right=px(style.borderRightWidth)+px(style.paddingRight);
      const top=px(style.borderTopWidth)+px(style.paddingTop),bottom=px(style.borderBottomWidth)+px(style.paddingBottom);
      const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({x,y});
      // MouseEvent client coordinates are integral. Aim at the nearest CSS pixel
      // instead of allowing fractional iframe offsets to truncate an edge target.
      return { x: Math.round(bounds.left+left+point.x*(bounds.width-left-right)/canvas.width)+0.25-bounds.left,
        y: Math.round(bounds.top+top+point.y*(bounds.height-top-bottom)/canvas.height)+0.25-bounds.top };
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
  await click(700,600);
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
  await click(700,600);
  await page.waitForTimeout(180);
  const beforeTextPaint = await counters();
  await clearTextDraws();
  await click(480,110);
  const textPainted = await counters();
  assert.equal(textPainted.solves, beforeTextPaint.solves);
  assert.equal(textPainted.crossPlacements, beforeTextPaint.crossPlacements);
  assert.equal(textPainted.nodeCreates, beforeTextPaint.nodeCreates);
  assert.equal(textPainted.measuredLeaves, beforeTextPaint.measuredLeaves);
  // This opt-in panel uses the normal Canvas font fallback chain and asks the
  // renderer for a middle baseline. It proves the live alphabetic baseline,
  // rather than synthesizing a font metric in the lesson.
  const textHitCount = (await state()).textHits.length;
  await clearTextDraws();
  await click(272,428);
  const customTextState = await state(), customText = await textDraws();
  assert.equal(customTextState.textFitPolicy, true);
  const customSmall = customText.find(value => value.font.includes('Pibbl App Font'));
  const customLarge = customText.find(value => value.font === '20px sans-serif');
  assert.ok(customSmall && customLarge, 'custom-family fitted Text and its peer render');
  assert.equal(customSmall.baseline, 'middle');
  assert.equal(customLarge.baseline, 'middle');
  assert.ok(customSmall.text.startsWith('Ag') && customSmall.text.length < 'Ag baseline fitting string'.length, 'ellipsis fits the long custom-family label');
  assert.ok(Math.abs(customSmall.alpha.y - customLarge.alpha.y) < 1e-9, 'middle-baseline Canvas draws share an alphabetic baseline');
  await click((customSmall.hitTopLeft.x + customSmall.hitBottomRight.x) / 2, (customSmall.hitTopLeft.y + customSmall.hitBottomRight.y) / 2);
  assert.equal((await state()).textHits.length, textHitCount + 1, 'the fitted custom-family glyph remains the real target');
  await click(272,428);
  assert.equal((await state()).textFitPolicy, false);
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
  // RTL reverses only the finite row slots; baseline and physical auto-margin
  // placement stay local to the companion row.
  await click(700,240);
  const rtl=await state();
  assert.equal(rtl.layoutDirection,'rtl');
  assert.ok(Math.abs(rtl.boxes.MA.x-580)<1e-9&&Math.abs(rtl.boxes.MA.y-240)<1e-9,'RTL automatic-margin card');
  assert.ok(Math.abs(rtl.boxes.MB.x-460)<1e-9&&Math.abs(rtl.boxes.MB.y-210)<1e-9,'RTL baseline peer');
  assert.deepEqual(Object.fromEntries([['MA',rtl.stamps.MA],['MB',rtl.stamps.MB]]),mainStamps);
  await click(590,244);assert.equal((await state()).hits.at(-1),'MA');
  await click(470,214);assert.equal((await state()).hits.at(-1),'MB');
  await click(700,204);
  const rtlBaseline=await state();assert.equal(rtlBaseline.crossMode,'off');
  assert.ok(Math.abs(rtlBaseline.boxes.MA.x-580)<1e-9&&Math.abs(rtlBaseline.boxes.MA.y-228)<1e-9,'RTL first-baseline card');
  assert.ok(Math.abs(rtlBaseline.boxes.MB.x-460)<1e-9&&Math.abs(rtlBaseline.boxes.MB.y-210)<1e-9,'RTL shared baseline peer');
  await click(590,232);assert.equal((await state()).hits.at(-1),'MA');
  await click(700,276);
  const reverseRtl=await state();assert.equal(reverseRtl.reverse,true);
  assert.ok(Math.abs(reverseRtl.boxes.MA.x-540)<1e-9&&Math.abs(reverseRtl.boxes.MA.y-228)<1e-9,'row-reverse RTL baseline');
  assert.ok(Math.abs(reverseRtl.boxes.MB.x-580)<1e-9&&Math.abs(reverseRtl.boxes.MB.y-210)<1e-9,'row-reverse RTL peer');
  await click(700,240);
  const reverseLtr=await state();assert.equal(reverseLtr.layoutDirection,'ltr');
  assert.ok(Math.abs(reverseLtr.boxes.MA.x-580)<1e-9&&Math.abs(reverseLtr.boxes.MA.y-228)<1e-9,'row-reverse LTR baseline');
  assert.ok(Math.abs(reverseLtr.boxes.MB.x-460)<1e-9&&Math.abs(reverseLtr.boxes.MB.y-210)<1e-9,'row-reverse LTR peer');
  assert.deepEqual(Object.fromEntries([['MA',reverseLtr.stamps.MA],['MB',reverseLtr.stamps.MB]]),mainStamps);
  await click(590,232);let reverseHit=await state();assert.equal(reverseHit.hits.length,reverseLtr.hits.length+1);assert.equal(reverseHit.hits.at(-1),'MA');
  const reverseHits=reverseHit.hits.length;await click(470,214);reverseHit=await state();assert.equal(reverseHit.hits.length,reverseHits+1);assert.equal(reverseHit.hits.at(-1),'MB');
  // The lower companion makes the two source-ordered wrap lines concrete.
  await click(700,276);
  const wrappedStart=await state();assert.equal(wrappedStart.reverse,false);
  assert.equal(wrappedStart.wrappedD,20);
  const wrapExpected={WA:[460,478,60,20],WB:[520,460,40,40],WC:[460,512,60,20],WD:[520,500,40,30]};
  for(const id of ['WA','WB','WC','WD']){const b=wrappedStart.boxes[id],e=wrapExpected[id];assert.ok(Math.abs(b.x-e[0])<1e-9&&Math.abs(b.y-e[1])<1e-9,id);assert.equal(b.width,e[2]);assert.equal(b.height,e[3]);}
  const wrappedStamps=Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,wrappedStart.stamps[id]]));
  await click(464,514);assert.equal((await state()).hits.at(-1),'WC');
  await click(700,318);
  const wrappedMoved=await state();assert.equal(wrappedMoved.wrappedD,26);
  assert.ok(Math.abs(wrappedMoved.boxes.WC.x-460)<1e-9&&Math.abs(wrappedMoved.boxes.WC.y-518)<1e-9);
  assert.ok(Math.abs(wrappedMoved.boxes.WD.x-520)<1e-9&&Math.abs(wrappedMoved.boxes.WD.y-500)<1e-9);
  assert.deepEqual(wrappedMoved.boxes.WA,wrappedStart.boxes.WA);assert.deepEqual(wrappedMoved.boxes.WB,wrappedStart.boxes.WB);
  assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,wrappedMoved.stamps[id]])),wrappedStamps);
  const wrappedHits=wrappedMoved.hits.length;await click(464,514);assert.equal((await state()).hits.length,wrappedHits);
  await click(464,520);const wrapHit=await state();assert.equal(wrapHit.hits.length,wrappedHits+1);assert.equal(wrapHit.hits.at(-1),'WC');
  for(const toggle of [[700,240],[700,276],[700,240]]){
    await click(...toggle);const directed=await state();const reversed=directed.reverse!==(directed.layoutDirection==='rtl');
    for(const id of ['WA','WB','WC','WD']){const wide=id==='WA'||id==='WC',x=wide?(reversed?500:460):(reversed?460:520);const y=id==='WA'?478:id==='WB'?460:id==='WC'?518:500;assert.ok(Math.abs(directed.boxes[id].x-x)<1e-9&&Math.abs(directed.boxes[id].y-y)<1e-9,id+' wrap direction');assert.equal(directed.stamps[id],wrappedStamps[id]);}
    const before=directed.hits.length;await click(reversed?504:464,520);const hit=await state();assert.equal(hit.hits.length,before+1);assert.equal(hit.hits.at(-1),'WC');
  }
  // The policy profile retains the ordinary zero-gap lower panel until enabled.
  // It then exposes native line distribution, resolved cross gaps, and main-gap
  // membership without changing the established direction checks above.
  await click(700,318);
  await click(700,276);
  await click(700,446);
  const policyStart=await state();
  const policyStamps=Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,policyStart.stamps[id]]));
  const policyExpected=[
    ['flex-start',460,508],['flex-end',500,548],['center',480,528],
    ['space-between',460,548],['space-around',470,538],
    ['space-evenly',473.3333333333333,534.6666666666666],['stretch',460,528],
  ];
  for(let index=0;index<policyExpected.length;index++){
    if(index)await click(700,362);
    const [align,bY,dY]=policyExpected[index],policy=await state();
    assert.equal(policy.reverse,false);assert.equal(policy.layoutDirection,'ltr');
    assert.equal(policy.wrappedProfile,true);assert.equal(policy.wrappedGap,8);assert.equal(policy.wrappedAlign,align);
    for(const [id,x,y,width,height] of [['WA',460,bY+18,60,20],['WB',530,bY,40,40],['WC',460,dY+12,60,20],['WD',530,dY,40,30]]){
      const box=policy.boxes[id];assert.ok(Math.abs(box.x-x)<1e-9&&Math.abs(box.y-y)<1e-4,`policy ${align} ${id}`);assert.equal(box.width,width);assert.equal(box.height,height);
    }
    assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,policy.stamps[id]])),policyStamps);
  }
  await click(700,362);
  const policyReset=await state();assert.equal(policyReset.wrappedAlign,'flex-start');
  const policyHits=(await state()).hits.length;await click(464,522);const policyHit=await state();assert.equal(policyHit.hits.length,policyHits+1);assert.equal(policyHit.hits.at(-1),'WC');
  await click(700,318);
  const raised=await state();assert.equal(raised.wrappedD,26);
  assert.ok(Math.abs(raised.boxes.WA.y-478)<1e-9&&Math.abs(raised.boxes.WB.y-460)<1e-9);
  assert.ok(Math.abs(raised.boxes.WC.y-526)<1e-9&&Math.abs(raised.boxes.WD.y-508)<1e-9);
  const staleWrappedHits=raised.hits.length;await click(464,522);assert.equal((await state()).hits.length,staleWrappedHits);
  await click(464,528);const raisedHit=await state();assert.equal(raisedHit.hits.length,staleWrappedHits+1);assert.equal(raisedHit.hits.at(-1),'WC');
  await click(700,404);
  const gapTwelve=await state();assert.equal(gapTwelve.wrappedGap,12);
  assert.ok(Math.abs(gapTwelve.boxes.WC.y-530)<1e-9&&Math.abs(gapTwelve.boxes.WD.y-512)<1e-9,'numeric row gap');
  await click(700,404);
  const gapPercent=await state();assert.equal(gapPercent.wrappedGap,'10%');
  assert.ok(Math.abs(gapPercent.boxes.WC.y-530)<1e-9&&Math.abs(gapPercent.boxes.WD.y-512)<1e-9,'resolved percentage row gap');
  await click(700,446);
  const zeroMainGap=await state();assert.equal(zeroMainGap.wrappedProfile,false);assert.equal(zeroMainGap.wrappedGap,'10%');
  assert.ok(Math.abs(zeroMainGap.boxes.WB.x-520)<1e-9&&Math.abs(zeroMainGap.boxes.WD.x-520)<1e-9,'main gap removal');
  assert.ok(Math.abs(zeroMainGap.boxes.WC.y-530)<1e-9&&Math.abs(zeroMainGap.boxes.WD.y-512)<1e-9,'main gap preserves cross membership');
  assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,zeroMainGap.stamps[id]])),policyStamps);
  const policyBeforePaint=await counters();await click(480,110);const policyPainted=await counters();
  assert.equal(policyPainted.solves,policyBeforePaint.solves);assert.equal(policyPainted.crossPlacements,policyBeforePaint.crossPlacements);assert.equal(policyPainted.nodeCreates,policyBeforePaint.nodeCreates);
  // Start the reverse profile from its explicit normal-wrap baseline state.
  await click(700,318);
  await click(700,446);
  await click(700,404);
  await click(700,404);
  await click(700,484);
  const reverseStartState=await state();
  const reverseStamps=Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,reverseStartState.stamps[id]]));
  assert.deepEqual(reverseStamps,policyStamps);
  const reverseExpected=[
    ['flex-start',540,500],['flex-end',500,460],['center',520,480],
    ['space-between',540,460],['space-around',530,470],
    ['space-evenly',526.6666666666666,473.3333333333333],['stretch',540,480],
  ];
  for(let index=0;index<reverseExpected.length;index++){
    if(index)await click(700,362);
    const [align,bY,dY]=reverseExpected[index],reversed=await state();
    assert.equal(reversed.wrappedReverse,true);assert.equal(reversed.wrappedProfile,true);assert.equal(reversed.wrappedGap,8);assert.equal(reversed.wrappedAlign,align);
    for(const [id,x,y,width,height] of [['WA',460,bY+18,60,20],['WB',530,bY,40,40],['WC',460,dY+12,60,20],['WD',530,dY,40,30]]){
      const box=reversed.boxes[id];assert.ok(Math.abs(box.x-x)<1e-9&&Math.abs(box.y-y)<1e-4,`reverse ${align} ${id}`);assert.equal(box.width,width);assert.equal(box.height,height);
    }
    assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,reversed.stamps[id]])),reverseStamps);
  }
  await click(700,362);
  const reverseStart=await state();assert.equal(reverseStart.wrappedAlign,'flex-start');
  const oldDHits=reverseStart.hits.length;await click(536,528);let dHit=await state();assert.equal(dHit.hits.length,oldDHits+1);assert.equal(dHit.hits.at(-1),'WD');
  await click(700,318);const reverseRaised=await state();assert.equal(reverseRaised.wrappedD,26);
  assert.ok(Math.abs(reverseRaised.boxes.WC.y-512)<1e-9&&Math.abs(reverseRaised.boxes.WD.y-494)<1e-9,'reverse baseline input moves D');
  const raisedReverseHits=reverseRaised.hits.length;await click(536,528);assert.equal((await state()).hits.length,raisedReverseHits);
  await click(536,496);dHit=await state();assert.equal(dHit.hits.length,raisedReverseHits+1);assert.equal(dHit.hits.at(-1),'WD');
  await click(700,318);const reverseRestoredD=await state();assert.equal(reverseRestoredD.wrappedD,20);
  assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,reverseRestoredD.stamps[id]])),reverseStamps);
  const wrapReverseHits=reverseRestoredD.hits.length;await click(536,536);assert.equal((await state()).hits.length,wrapReverseHits);
  await click(700,484);
  const restoredWrap=await state();assert.equal(restoredWrap.wrappedReverse,false);assert.equal(restoredWrap.wrappedAlign,'flex-start');
  assert.ok(Math.abs(restoredWrap.boxes.WA.y-478)<1e-9&&Math.abs(restoredWrap.boxes.WB.y-460)<1e-9);
  assert.ok(Math.abs(restoredWrap.boxes.WC.y-520)<1e-9&&Math.abs(restoredWrap.boxes.WD.y-508)<1e-9);
  assert.deepEqual(Object.fromEntries(['WA','WB','WC','WD'].map(id=>[id,restoredWrap.stamps[id]])),reverseStamps);
  await click(536,536);const restoredHit=await state();assert.equal(restoredHit.hits.length,wrapReverseHits+1);assert.equal(restoredHit.hits.at(-1),'WD');
  const numericBefore=await state();
  assert.ok(Math.abs(numericBefore.boxes.NA.x-38)<1e-9&&Math.abs(numericBefore.boxes.NA.y-548)<1e-9);
  assert.ok(Math.abs(numericBefore.boxes.NB.x-78)<1e-9&&Math.abs(numericBefore.boxes.NB.y-530)<1e-9);
  await click(42,552);const numericHit=await state();assert.equal(numericHit.hits.at(-1),'NA');
  await click(240,556);const numericAfter=await state();
  assert.ok(Math.abs(numericAfter.boxes.NA.x-48)<1e-9&&Math.abs(numericAfter.boxes.NB.x-88)<1e-9);
  assert.equal(numericAfter.stamps.NA,numericBefore.stamps.NA);assert.equal(numericAfter.stamps.NB,numericBefore.stamps.NB);
  const numericHits=numericAfter.hits.length;await click(42,552);assert.equal((await state()).hits.length,numericHits);
  await click(52,552);assert.equal((await state()).hits.at(-1),'NA');
  const crossNumericBefore=await state();assert.ok(Math.abs(crossNumericBefore.boxes.NC.y-570)<1e-9);
  await click(400,556);const crossNumericTop=await state();
  assert.ok(Math.abs(crossNumericTop.boxes.NA.y-560)<1e-9&&Math.abs(crossNumericTop.boxes.NB.y-542)<1e-9&&Math.abs(crossNumericTop.boxes.NC.y-582)<1e-9);
  const crossNumericHits=crossNumericTop.hits.length;await click(92,534);assert.equal((await state()).hits.length,crossNumericHits);
  await click(92,546);assert.equal((await state()).hits.at(-1),'NB');
  await click(400,556);const crossNumericBottom=await state();
  assert.ok(Math.abs(crossNumericBottom.boxes.NA.y-548)<1e-9&&Math.abs(crossNumericBottom.boxes.NB.y-530)<1e-9&&Math.abs(crossNumericBottom.boxes.NC.y-578)<1e-9);
  const crossBottomHits=crossNumericBottom.hits.length;await click(32,572);assert.equal((await state()).hits.length,crossBottomHits);
  await click(32,582);assert.equal((await state()).hits.at(-1),'NC');
  await click(400,556);const crossNumericRestored=await state();
  for(const id of ['NA','NB','NC'])assert.equal(crossNumericRestored.stamps[id],crossNumericBefore.stamps[id]);
  assert.ok(Math.abs(crossNumericRestored.boxes.NC.y-570)<1e-9);
  const autoCrossStamps=(await state()).stamps;
  for(const [aY,cY] of [[570,590],[530,590],[550,590],[548,570]]) {
    await click(240,600);const lineAuto=await state();
    assert.ok(Math.abs(lineAuto.boxes.NA.y-aY)<1e-9&&Math.abs(lineAuto.boxes.NC.y-cY)<1e-9);
    for(const id of ['NA','NB','NC'])assert.equal(lineAuto.stamps[id],autoCrossStamps[id]);
  }
  await click(700,484);
  for(const [aY,cY] of [[610,550],[570,550],[590,550],[568,530]]) {
    await click(240,600);const lineAutoReverse=await state();
    assert.ok(Math.abs(lineAutoReverse.boxes.NA.y-aY)<1e-9&&Math.abs(lineAutoReverse.boxes.NC.y-cY)<1e-9);
    for(const id of ['NA','NB','NC'])assert.equal(lineAutoReverse.stamps[id],autoCrossStamps[id]);
  }
  await click(700,484);assert.ok(Math.abs((await state()).boxes.NC.y-570)<1e-9);
  const relativeBefore=await state();
  await click(400,600);const relativeMoved=await state();
  assert.ok(Math.abs(relativeMoved.boxes.NA.x-relativeBefore.boxes.NA.x-6)<1e-9&&Math.abs(relativeMoved.boxes.NA.y-relativeBefore.boxes.NA.y-10)<1e-9);
  assert.deepEqual(relativeMoved.boxes.NB,relativeBefore.boxes.NB);assert.deepEqual(relativeMoved.boxes.NC,relativeBefore.boxes.NC);
  assert.equal(relativeMoved.stamps.NA,relativeBefore.stamps.NA);
  const relativeHits=relativeMoved.hits.length;await click(52,552);assert.equal((await state()).hits.length,relativeHits);
  await click(58,562);assert.equal((await state()).hits.at(-1),'NA');
  await click(400,600);assert.deepEqual((await state()).boxes.NA,relativeBefore.boxes.NA);
  await clearTextDraws();await click(390,428);
  const insetDraws=await textDraws();
  const insetSmall=insetDraws.find(draw=>draw.font==='10px monospace'&&draw.text==='Ag'&&draw.origin.x<100&&draw.origin.y>400&&draw.origin.y<460);
  const insetLarge=insetDraws.find(draw=>draw.font==='20px sans-serif'&&draw.text==='Ag'&&draw.origin.x<200&&draw.origin.y>400&&draw.origin.y<460);
  assert.ok(insetSmall&&insetLarge,'decorated Text renders both baseline participants');
  assert.ok(Math.abs(insetSmall.origin.x-wrappedSmall[0].origin.x-8)<1e-4&&Math.abs(insetLarge.origin.x-wrappedLarge.origin.x-17)<1e-4);
  assert.ok(Math.abs(insetSmall.alpha.y-insetLarge.alpha.y)<1e-4,'decorated Text first baselines agree with paint');
  const insetHitBefore=(await state()).textHits.length;
  await click((insetSmall.hitTopLeft.x+insetSmall.hitBottomRight.x)/2,(insetSmall.hitTopLeft.y+insetSmall.hitBottomRight.y)/2);
  assert.equal((await state()).textHits.length,insetHitBefore+1);
  await click(390,428);
  const finalBoxBefore=await state();
  assert.ok(Math.abs(finalBoxBefore.boxes.FA.y-288)<1e-9&&finalBoxBefore.boxes.FA.height===20);
  assert.deepEqual(finalBoxBefore.allocations.FA,{x:0,y:0,width:40,height:20});
  const finalBoxHits=finalBoxBefore.hits.length;await click(32,284);assert.equal((await state()).hits.length,finalBoxHits);
  await click(240,292);const finalBoxMeasured=await state();
  assert.ok(Math.abs(finalBoxMeasured.boxes.FA.y-278)<1e-9&&finalBoxMeasured.boxes.FA.height===30);
  assert.deepEqual(finalBoxMeasured.allocations.FA,{x:0,y:0,width:40,height:30});
  assert.deepEqual(finalBoxMeasured.boxes.FB,finalBoxBefore.boxes.FB);assert.equal(finalBoxMeasured.stamps.FA,finalBoxBefore.stamps.FA);
  await click(32,284);assert.equal((await state()).hits.at(-1),'FA');
  const measuredCalls=finalBoxMeasured.finalBoxMeasureCalls;
  await click(400,292);const finalBoxAspect=await state();
  assert.ok(Math.abs(finalBoxAspect.boxes.FA.y-288)<1e-9&&finalBoxAspect.boxes.FA.height===20);
  assert.equal(finalBoxAspect.finalBoxMeasureCalls,measuredCalls);
  assert.deepEqual(finalBoxAspect.allocations.FA,{x:0,y:0,width:40,height:20});
  await click(400,292);await click(240,292);
  assert.deepEqual((await state()).boxes.FA,finalBoxBefore.boxes.FA);
  // The trusted query is deliberately inactive below its parent-content-width
  // threshold, then changes only the settled provider allocation at 160px.
  await click(540,314);const queryNarrow=await state();
  assert.equal(queryNarrow.queryMode,'narrow');assert.equal(queryNarrow.queryWidth,120);
  assert.deepEqual(queryNarrow.allocations.FA,{x:0,y:0,width:40,height:20});
  assert.ok(Math.abs(queryNarrow.boxes.FA.y-288)<1e-9&&queryNarrow.boxes.FA.height===20);
  await click(540,314);const queryWide=await state();
  assert.equal(queryWide.queryMode,'wide');assert.equal(queryWide.queryWidth,160);
  assert.deepEqual(queryWide.allocations.FA,{x:0,y:0,width:40,height:30});
  assert.ok(Math.abs(queryWide.boxes.FA.y-278)<1e-9&&queryWide.boxes.FA.height===30);
  const queryHits=queryWide.hits.length;await click(32,274);assert.equal((await state()).hits.length,queryHits);
  await click(240,292);const queryUpdated=await state();
  assert.deepEqual(queryUpdated.allocations.FA,{x:0,y:0,width:40,height:40});
  assert.ok(Math.abs(queryUpdated.boxes.FA.y-270)<1e-9&&Math.abs(queryUpdated.boxes.FB.y-272)<1e-9);
  await click(32,274);assert.equal((await state()).hits.at(-1),'FA');
  const queryStamp=queryUpdated.stamps.FA;
  await click(240,292);await click(540,314);const queryRestored=await state();
  assert.equal(queryRestored.queryMode,'off');assert.equal(queryRestored.queryWidth,120);
  assert.deepEqual(queryRestored.boxes.FA,finalBoxBefore.boxes.FA);assert.equal(queryRestored.stamps.FA,queryStamp);
  const assertSelfBox=(actual,expected)=>{for(const key of ['x','y','width','height'])assert.ok(Math.abs(actual[key]-expected[key])<1e-4,`self ${key}: ${actual[key]} versus ${expected[key]}`);};
  const selfBaselineCalls=queryRestored.finalBoxBaselineCalls,selfStamp=queryRestored.stamps.FA,selfHits=queryRestored.hits.length;
  await click(255,319);const selfEnd=await state();
  assert.equal(selfEnd.selfMode,'flex-end');assertSelfBox(selfEnd.boxes.FA,{...queryRestored.boxes.FA,y:290});assert.deepEqual(selfEnd.boxes.FB,queryRestored.boxes.FB);assert.equal(selfEnd.stamps.FA,selfStamp);assert.equal(selfEnd.finalBoxBaselineCalls,selfBaselineCalls);
  await click(32,274);assert.equal((await state()).hits.length,selfHits);
  await click(255,319);const selfCenter=await state();
  assert.equal(selfCenter.selfMode,'center');assertSelfBox(selfCenter.boxes.FA,{...queryRestored.boxes.FA,y:280});assert.equal(selfCenter.stamps.FA,selfStamp);assert.equal(selfCenter.finalBoxBaselineCalls,selfBaselineCalls);
  await click(255,319);const selfStart=await state();
  assert.equal(selfStart.selfMode,'flex-start');assertSelfBox(selfStart.boxes.FA,{...queryRestored.boxes.FA,y:270});assert.deepEqual(selfStart.boxes.FB,queryRestored.boxes.FB);assert.equal(selfStart.stamps.FA,selfStamp);assert.equal(selfStart.finalBoxBaselineCalls,selfBaselineCalls);
  await click(32,274);assert.equal((await state()).hits.at(-1),'FA');
  await click(255,319);const selfStretch=await state();
  assert.equal(selfStretch.selfMode,'stretch');assertSelfBox(selfStretch.boxes.FA,{...queryRestored.boxes.FA,y:270,height:40});assert.deepEqual(selfStretch.boxes.FB,queryRestored.boxes.FB);assert.equal(selfStretch.stamps.FA,selfStamp);assert.equal(selfStretch.finalBoxBaselineCalls,selfBaselineCalls);
  await click(32,274);assert.equal((await state()).hits.at(-1),'FA');
  await click(255,319);const selfAuto=await state();
  assert.equal(selfAuto.selfMode,'auto');assert.deepEqual(selfAuto.boxes.FA,queryRestored.boxes.FA);assert.equal(selfAuto.stamps.FA,selfStamp);assert.ok(selfAuto.finalBoxBaselineCalls>selfBaselineCalls);

  if(process.env.PIBBL_LAYOUT_SCREENSHOT)await frame.locator('canvas').screenshot({path:process.env.PIBBL_LAYOUT_SCREENSHOT});
  const proof=await sandbox.evaluate(()=>globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if(built){assert.equal(proof?.mode,'layout-wasm-built');assert.ok(proof.coreInputs.length&&proof.coreInputs.every(value=>value.includes('packages/core/.layout-wasm-package/dist/')));}
  const disposed=await sandbox.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();});
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances],[0,0,0,0]);assert.equal(await frame.locator('pre').count(),0);assert.deepEqual(errors,[]);
  console.warn(JSON.stringify({base,initial:initial.boxes,shifted:shifted.boxes,wider:wider.boxes,text:{initialSmall,initialLarge,changedSmall,changedLarge,twoLineSmall,twoLineLarge,wrappedSmall,wrappedLarge},builtInputs:proof?.coreInputs.length??null,cleanup:[0,0,0],errors}));
} finally { await browser.close(); }
