import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const route = '#/examples/layout/wasm-flex-percent-placement';
// Nested layout preparation stores coordinates as float32; compare logical geometry within 0.001px.
function assertBox(actual, expected) {
  for (const field of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(actual[field] - expected[field]) < .001, `${field}: ${actual[field]} != ${expected[field]}`);
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    globalThis.__PERCENT_LESSON_DRAWS__ = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
      globalThis.__PERCENT_LESSON_DRAWS__.push({ text: String(text), font: this.font });
      return original.call(this, text, x, y, ...rest);
    };
  });
  await page.goto(`${base}/${route}`);
  assert.equal(new URL(page.url()).hash, route);
  const iframe = page.locator('iframe[srcdoc]');
  await iframe.waitFor({ state: 'attached' });
  await iframe.scrollIntoViewIfNeeded();
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const state = async () => JSON.parse(await frame.locator('pre').innerText());
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await page.mouse.click(bounds.x + (bounds.width - 760 * scale) / 2 + x * scale, bounds.y + (bounds.height - 460 * scale) / 2 + y * scale);
    await page.waitForTimeout(220);
  };
  await page.waitForTimeout(180);
  const initial = await state();
  assert.equal(initial.width, 500);
  assert.ok(Math.abs(initial.boxes.relative.x - 262.8) < .001);
  assert.equal(initial.boxes.relative.y, 220);
  assertBox(initial.boxes.pin, { x: 350.8, y: 266, width: 24, height: 14 });
  assert.deepEqual(initial.boxes.badge, { x: 353, y: 338, width: 125, height: 34.8 });
  const badgePixel = async box => sandbox.evaluate(({x,y}) => { const canvas=document.querySelector('canvas'),scale=Math.min(canvas.width/760,canvas.height/460); return [...canvas.getContext('2d').getImageData(Math.round((canvas.width-760*scale)/2+(x+4)*scale),Math.round((canvas.height-460*scale)/2+(y+4)*scale),1,1).data]; }, box);
  assert.deepEqual(await badgePixel(initial.boxes.badge), [166, 55, 88, 255]);
  assert.deepEqual(await badgePixel(initial.boxes.pin), [216, 170, 60, 255]);
  await sandbox.evaluate(() => { globalThis.__PERCENT_LESSON_DRAWS__ = []; });
  await click(initial.boxes.relative.x + 4, initial.boxes.relative.y + 4);
  assert.equal((await state()).selected, 'relative');
  const wideLines = await sandbox.evaluate(() => globalThis.__PERCENT_LESSON_DRAWS__.filter(draw => draw.font.includes('13px')).length);
  const pixel = await sandbox.evaluate(({x,y}) => { const canvas=document.querySelector('canvas'),scale=Math.min(canvas.width/760,canvas.height/460); return [...canvas.getContext('2d').getImageData(Math.round((canvas.width-760*scale)/2+(x+4)*scale),Math.round((canvas.height-460*scale)/2+(y+4)*scale),1,1).data]; }, initial.boxes.relative);
  assert.deepEqual(pixel, [225, 219, 202, 255]);
  await click(236, 118);
  assert.equal((await state()).relative, false);
  assert.equal((await state()).boxes.relative.x, 216);
  assert.equal((await state()).boxes.relative.y, 180);
  assertBox((await state()).boxes.pin, { x: 496, y: 374, width: 24, height: 14 });
  await sandbox.evaluate(() => { globalThis.__PERCENT_LESSON_DRAWS__ = []; });
  await click(40, 118);
  const narrow = await state();
  assert.equal(narrow.width, 360);
  assert.deepEqual(narrow.boxes.badge, { x: 252, y: 338, width: 100, height: 34.8 });
  assertBox(narrow.boxes.pin, { x: 356, y: 374, width: 24, height: 14 });
  assert.deepEqual(await badgePixel(narrow.boxes.badge), [166, 55, 88, 255]);
  assert.deepEqual(await badgePixel(narrow.boxes.pin), [216, 170, 60, 255]);
  const narrowLines = await sandbox.evaluate(() => globalThis.__PERCENT_LESSON_DRAWS__.filter(draw => draw.font.includes('13px')).length);
  assert.ok(narrowLines > wideLines, `natural Text must reflow: ${wideLines} to ${narrowLines} draw lines`);
  await click(236, 118);
  const narrowRelative = await state();
  assert.equal(narrowRelative.relative, true);
  assertBox(narrowRelative.boxes.relative, { x: 224.8, y: 220, width: 120, height: 68 });
  assertBox(narrowRelative.boxes.pin, { x: 312.8, y: 266, width: 24, height: 14 });
  await click(narrow.boxes.badge.x + 4, narrow.boxes.badge.y + 4);
  assert.equal((await state()).selected, 'badge');

  // Logical inline-start overrides the corresponding physical right edge and
  // maps through the receiving Flex direction without changing badge size.
  await click(432, 118);
  const startLtr = await state();
  assert.equal(startLtr.badgeAnchor, 'start-ltr');
  assert.equal(startLtr.relative, true);
  assertBox(startLtr.boxes.badge, { x: 100, y: 338, width: 100, height: 34.8 });
  assert.deepEqual(await badgePixel(startLtr.boxes.badge), [166, 55, 88, 255]);
  await click(startLtr.boxes.badge.x + 4, startLtr.boxes.badge.y + 4);
  assert.equal((await state()).selected, 'badge');

  await click(432, 118);
  const startRtl = await state();
  assert.equal(startRtl.badgeAnchor, 'start-rtl');
  assert.equal(startRtl.relative, true);
  assertBox(startRtl.boxes.badge, { x: 216, y: 338, width: 100, height: 34.8 });
  assert.deepEqual(await badgePixel(startRtl.boxes.badge), [166, 55, 88, 255]);
  await click(startRtl.boxes.badge.x + 4, startRtl.boxes.badge.y + 4);
  assert.equal((await state()).selected, 'badge');

  await click(432, 118);
  const physical = await state();
  assert.equal(physical.badgeAnchor, 'physical');
  assert.equal(physical.relative, true);
  assertBox(physical.boxes.badge, { x: 252, y: 338, width: 100, height: 34.8 });
  assert.deepEqual(await badgePixel(physical.boxes.badge), [166, 55, 88, 255]);
  const screenshot = `/tmp/pibbl-percent-placement-${built ? 'built' : 'source'}.png`;
  await frame.locator('canvas').screenshot({ path: screenshot });
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) {
    assert.equal(proof?.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements], [0,0,0]);
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ url: `${base}/${route}`, wideLines, narrowLines, pixel, builtInputs: proof?.coreInputs.length ?? null, screenshot, cleanup: [0,0,0], errors }));
} finally { await browser.close(); }
