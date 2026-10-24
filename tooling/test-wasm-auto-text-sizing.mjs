import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/examples/layout/wasm-flex-text`);
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  await page.locator('iframe[srcdoc]').scrollIntoViewIfNeeded();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = () => frame.locator('pre').innerText();
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 460 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(180);
  };
  const pixel = (x, y) => sandbox.evaluate(({ x, y }) => {
    const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
    const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).transformPoint({ x, y });
    return [...document.querySelector('canvas').getContext('2d').getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data];
  }, { x, y });
  await click(500, 76);
  await sandbox.evaluate(() => {
    const context = document.querySelector('canvas').getContext('2d');
    const original = context.fillText;
    globalThis.__PIBBL_TEXT_SIZE_DRAWS__ = [];
    context.fillText = function(text,x,y,maxWidth) {
      if (text.startsWith('aaaa') || text.startsWith('jobs') || text.startsWith('alp')) {
        const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
        const point = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]).inverse().transformPoint(this.getTransform().transformPoint({x,y}));
        globalThis.__PIBBL_TEXT_SIZE_DRAWS__.push({text,x:point.x,y:point.y,maximum:maxWidth,font:this.font});
      }
      return original.call(this,text,x,y,maxWidth);
    };
  });
  const clearDraws = () => sandbox.evaluate(() => { globalThis.__PIBBL_TEXT_SIZE_DRAWS__.length = 0; });
  const draws = prefix => sandbox.evaluate(prefix => globalThis.__PIBBL_TEXT_SIZE_DRAWS__.filter(draw => draw.text.startsWith(prefix)),prefix);
  await click(270,160);
  assert.match(await state(),/text grow: true/);
  assert.ok((await draws('aaaa')).every(draw => Math.abs(draw.y-350)<1e-6),JSON.stringify(await draws('aaaa')));
  assert.deepEqual(await pixel(134,264),[66,107,97,255]);
  await clearDraws(); await click(90,110);
  const narrow = await draws('aaaa');
  assert.ok(narrow.length >= 2 && Math.abs(narrow[0].y-340)<1e-6);
  const inkMiddle = await sandbox.evaluate(text => { const context=document.querySelector('canvas').getContext('2d');context.save();context.font='10px monospace';context.textBaseline='top';const metric=context.measureText(text);context.restore();return (metric.actualBoundingBoxDescent-metric.actualBoundingBoxAscent)/2; },narrow[0].text);
  await click(35,narrow[0].y+inkMiddle); assert.match(await state(),/selected: auto cross text/);
  await click(94,264); assert.match(await state(),/selected: auto cross sibling/);
  for (let sizing=1;sizing<=4;sizing++) {
    await click(100,160);
    assert.match(await state(),new RegExp(`column sizing: ${sizing%4}`));
    if (sizing===1 || sizing===2) {
      assert.deepEqual(await pixel(425,324),[66,107,97,255]);
      await click(425,324); assert.match(await state(),/selected: column auto sibling/);
    }
    if (sizing===3) {
      const first = await sandbox.evaluate(() => {
        const basis = JSON.parse(document.querySelector('pre').textContent.split('auto cross transform: ')[1]);
        const matrix = new DOMMatrix([basis.a,basis.b,basis.c,basis.d,basis.e,basis.f]);
        const context = document.querySelector('canvas').getContext('2d');
        for (let y=280;y<300;y++) {
          const point=matrix.transformPoint({x:425,y});
          const data=context.getImageData(Math.floor(point.x),Math.floor(point.y),1,1).data;
          if (data[0]===66 && data[1]===107 && data[2]===97) return y;
        }
        return undefined;
      });
      assert.ok(first>=280 && first<300);
      await click(425,first+3); assert.match(await state(),/selected: column auto sibling/);
    }
  }
  // Return to column sizing 0 after the Text cycle, then drive the paired
  // provider and known row root through exactly the same four final-main
  // states. Each retains its natural cross width while its footer follows the
  // resolved main target.
  const exerciseColumnContent = async (content, selection, contentX) => {
    assert.match(await state(), new RegExp(`column provider: ${content}`));
    for (let sizing=1;sizing<=4;sizing++) {
      await click(100,160);
      assert.match(await state(),new RegExp(`column sizing: ${sizing%4}`));
      if (sizing===1 || sizing===2) {
        assert.deepEqual(await pixel(425,324),[66,107,97,255]);
        await click(425,324); assert.match(await state(),new RegExp(`selected: ${selection} sibling`));
      }
      if (sizing===3) {
        assert.deepEqual(await pixel(425,304),[66,107,97,255]);
        await click(425,304); assert.match(await state(),new RegExp(`selected: ${selection} sibling`));
      }
    }
    await click(contentX,284); assert.match(await state(),new RegExp(`selected: ${selection} A`));
  };
  await click(500,434); // Text -> paired provider 40px.
  await exerciseColumnContent(40, 'column provider', 564);
  await click(500,434); // Provider 40 -> provider 80.
  await click(500,434); // Provider 80 -> known 60px row.
  await exerciseColumnContent('known60', 'column known', 544);
  // Restore text so the pre-existing wrapped-Text cycle remains unchanged.
  for (let index=0;index<3;index++) await click(500,434);
  assert.match(await state(),/column provider: text/);

  await click(270,160);
  for (let index=0;index<5;index++) await click(500,434);
  await click(700,394); await click(700,430);
  await clearDraws(); await click(500,394);
  const wrappedLong=await draws('jobs');
  assert.ok(wrappedLong.length>=2 && wrappedLong.every(draw=>Math.abs(draw.x-420)<1e-6));
  const columnInkMiddle = await sandbox.evaluate(text => { const context=document.querySelector('canvas').getContext('2d');context.save();context.font='10px monospace';context.textBaseline='top';const metric=context.measureText(text);context.restore();return (metric.actualBoundingBoxDescent-metric.actualBoundingBoxAscent)/2; },wrappedLong[0].text);
  await click(430,wrappedLong[0].y+columnInkMiddle); assert.match(await state(),/selected: column wrapped text/);
  await clearDraws(); await click(500,394);
  const wrappedShort=await draws('jobs');
  assert.ok(wrappedShort.length && wrappedShort.at(-1).x>420 && Math.abs(wrappedShort.at(-1).y-320)<1e-6);
  await click(564,304); assert.match(await state(),/selected: column wrapped sibling/);
  await click(430,wrappedShort.at(-1).y+columnInkMiddle); assert.match(await state(),/selected: column wrapped sibling/);
  await click(wrappedShort.at(-1).x+8,wrappedShort.at(-1).y+columnInkMiddle); assert.match(await state(),/selected: column wrapped text/);
  await clearDraws(); await click(450,160);
  assert.match(await state(),/row content: unwrappedText/);
  const oneLine=await draws('aaaa');assert.ok(oneLine.length && oneLine.every(draw=>draw.y>350&&draw.y<360));
  const rowInkMiddle=await sandbox.evaluate(text=>{const context=document.querySelector('canvas').getContext('2d');context.save();context.font='10px monospace';context.textBaseline='top';const metric=context.measureText(text);context.restore();return(metric.actualBoundingBoxDescent-metric.actualBoundingBoxAscent)/2;},oneLine.at(-1).text);
  await click(72,264);assert.match(await state(),/selected: auto cross sibling/);
  await click(32,264);assert.match(await state(),/selected: auto cross sibling/);
  await click(32,oneLine.at(-1).y+rowInkMiddle);assert.match(await state(),/selected: auto cross text/);
  await click(450,160);assert.match(await state(),/row content: provider/);
  await click(90,110); // Wide80 provider:20 high beside40 peer.
  assert.deepEqual(await pixel(32,284),[138,50,72,255]);
  await click(32,284);assert.match(await state(),/selected: auto cross provider/);
  await click(90,110); // Narrow40 provider:40 high, same line top.
  assert.deepEqual(await pixel(32,264),[138,50,72,255]);
  await click(82,264);assert.match(await state(),/selected: auto cross sibling/);
  await click(32,264);assert.match(await state(),/selected: auto cross provider/);
  await click(450,160);assert.match(await state(),/row content: known/);
  assert.deepEqual(await pixel(32,284),[138,50,72,255]);
  await click(82,264);assert.match(await state(),/selected: auto cross sibling/);
  await click(32,284);assert.match(await state(),/selected: auto cross known/);
  for(const policy of ['font','ellipsis','fitClip','squish','overflowClip']) {
    await clearDraws();await click(450,160);assert.match(await state(),new RegExp(`row content: ${policy}`));
    const policyDraw=(await draws('alp')).at(-1);assert.ok(policyDraw&&policyDraw.y>348&&policyDraw.y<360);
    if(policy==='ellipsis')assert.ok(policyDraw.text.endsWith('...'));
    if(policy==='squish')assert.equal(policyDraw.maximum,40);
    const ink=await sandbox.evaluate(({text,font})=>{const context=document.querySelector('canvas').getContext('2d');context.save();context.font=font;context.textBaseline='top';const metric=context.measureText(text);context.restore();return(metric.actualBoundingBoxDescent-metric.actualBoundingBoxAscent)/2;},policyDraw);
    await click(72,264);assert.match(await state(),/selected: auto cross sibling/);
    if(policy==='fitClip'){await click(75,policyDraw.y+ink);assert.match(await state(),/selected: auto cross sibling/);}
    await click(32,policyDraw.y+ink);assert.match(await state(),/selected: auto cross text/);
  }
  for(const family of ['flow','grid']){
    await click(450,160);assert.match(await state(),new RegExp(`row content: ${family}`));
    assert.deepEqual(await pixel(32,284),[138,50,72,255]);
    await click(82,264);assert.match(await state(),/selected: auto cross sibling/);
    await click(32,284);assert.match(await state(),new RegExp(`selected: auto cross ${family==='flow'?'Flow':'Grid'}`));
  }
  // Grid -> measure-only provider. It follows the paired provider's existing
  // 80px/20px then 40px/40px final-width behavior without intrinsic metadata.
  await click(450,160);assert.match(await state(),/row content: ordinary/);
  await click(90,110); // Enter at wide80, matching the paired-provider replay.
  assert.deepEqual(await pixel(32,284),[138,50,72,255]);
  await click(32,284);assert.match(await state(),/selected: auto cross ordinary provider/);
  await click(90,110);
  assert.deepEqual(await pixel(32,264),[138,50,72,255]);
  await click(82,264);assert.match(await state(),/selected: auto cross sibling/);
  await click(32,264);assert.match(await state(),/selected: auto cross ordinary provider/);
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) {
    assert.equal(proof.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  if (process.env.PIBBL_LAYOUT_SCREENSHOT) await frame.locator('canvas').screenshot({ path: process.env.PIBBL_LAYOUT_SCREENSHOT });
  const disposed = await sandbox.evaluate(() => {
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__();
  });
  assert.deepEqual([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances],[0,0,0,0]);
  assert.deepEqual(errors, []);
  console.warn(`${built ? 'Built' : 'Source'} shared Text auto sizing: growing row and width reflow, column basis/auto-height allocations, wrapped reverse/RTL short/long targets, unwrapped row Text, wrapped provider/Flex targets and Canvas font/fitting policies and measured Flow/Grid/ordinary-provider rows; cleanup0000; ${proof?.coreInputs.length ?? 'source'} inputs.`);
} finally { await browser.close(); }
