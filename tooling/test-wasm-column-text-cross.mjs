import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';

const base = process.argv.slice(2).find(value => !value.startsWith('--')) ?? 'http://127.0.0.1:5192';
const built = process.argv.includes('--built');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${base}/#/examples/layout/wasm-flex-column-text`);
  await page.locator('iframe[srcdoc]').waitFor({ state: 'attached' });
  const frame = page.frameLocator('iframe[srcdoc]');
  await frame.locator('pre').waitFor();
  await frame.locator('canvas').scrollIntoViewIfNeeded();
  const sandbox = page.frames().find(value => value.url() === 'about:srcdoc');
  const read = () => sandbox.evaluate(() => globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__());
  const panel = () => frame.locator('pre').innerText();
  const click = async (x, y) => {
    const bounds = await frame.locator('canvas').boundingBox();
    const scale = Math.min(bounds.width / 760, bounds.height / 460);
    await frame.locator('canvas').click({ position: {
      x: (bounds.width - 760 * scale) / 2 + x * scale,
      y: (bounds.height - 460 * scale) / 2 + y * scale,
    } });
    await page.waitForTimeout(230);
  };
  const footerBounds = () => sandbox.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const bounds = (red, green, blue, minimumY = 0) => {
      let left = width, right = -1, top = height, bottom = -1;
      for (let y = minimumY; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i] === red && data[i + 1] === green && data[i + 2] === blue && data[i + 3] === 255) {
          left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
      return { left, top, width: right - left + 1, height: bottom - top + 1 };
    };
    const root = bounds(243, 240, 232);
    const scale = root.width / 760;
    const footer = bounds(66, 107, 97, Math.ceil(root.top + 150 * scale));
    return {
      left: (footer.left - root.left) / scale,
      top: (footer.top - root.top) / scale,
      width: footer.width / scale,
      height: footer.height / scale,
      root,
      footer,
    };
  });
  const initial = await read();
  const before = await footerBounds();
  for (const [value, expected] of [[before.left, 28], [before.width, 420], [before.height, 36]]) assert.ok(Math.abs(value - expected) <= 1, JSON.stringify(before));
  await click(450, 110); // stretch -> center
  const centered = await read();
  const after = await footerBounds();
  for (const [value, expected] of [[after.left, 158], [after.width, 420], [after.height, 36]]) assert.ok(Math.abs(value - expected) <= 1, JSON.stringify(after));
  assert.ok(Math.abs(after.top - before.top) <= 1, JSON.stringify({ before, after }));
  for (const key of ['solves', 'measuredLeaves', 'nodeCreates']) assert.equal(centered[key], initial[key], key);
  assert.ok(centered.crossPlacements > initial.crossPlacements);
  await click(50, after.top + 10);
  assert.match(await panel(), /footer hits: 0/);
  await click(200, after.top + 10);
  await frame.locator('pre').filter({ hasText: 'footer hits: 1' }).waitFor();
  const proof = await sandbox.evaluate(() => globalThis.__PIBBL_BUILT_LAYOUT_PROOF__);
  if (built) {
    assert.equal(proof?.mode, 'layout-wasm-built');
    assert.ok(proof.coreInputs.length && proof.coreInputs.every(value => value.includes('packages/core/.layout-wasm-package/dist/')));
  }
  const disposed = await sandbox.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide')); return globalThis.__PIBBL_LAYOUT_DIAGNOSTICS__(); });
  assert.deepEqual([disposed.activeNodes, disposed.activeArenas, disposed.activeWasmInstances], [0, 0, 0]);
  assert.deepEqual(errors, []);
  console.warn(JSON.stringify({ base, before, after, initial, centered, built: proof?.mode ?? null, cleanup: disposed, errors }));
} finally { await browser.close(); }
