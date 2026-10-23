import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const variants = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'];
    const negative = {};
    const wrappedCross = {};
    for (const justifyContent of variants) {
      const root = document.createElement('div');
      root.style.cssText = `display:flex;width:100px;height:100px;gap:12px;justify-content:${justifyContent};align-items:flex-start`;
      for (let index = 0; index < 2; index++) {
        const child = document.createElement('div');
        child.style.cssText = 'width:80px;height:20px;flex:0 0 80px';
        root.append(child);
      }
      document.body.append(root);
      const box = root.getBoundingClientRect();
      negative[justifyContent] = [...root.children].map((child) => {
        const rect = child.getBoundingClientRect();
        return [rect.x - box.x, rect.y - box.y];
      });
      root.remove();
    }
    for (const alignContent of variants) {
      const root = document.createElement('div');
      root.style.cssText = `display:flex;flex-wrap:wrap;width:100px;height:30px;gap:12px;align-content:${alignContent};align-items:flex-start`;
      for (let index = 0; index < 2; index++) {
        const child = document.createElement('div');
        child.style.cssText = 'width:80px;height:20px;flex:0 0 80px';
        root.append(child);
      }
      document.body.append(root);
      const box = root.getBoundingClientRect();
      wrappedCross[alignContent] = [...root.children].map((child) => {
        const rect = child.getBoundingClientRect();
        return [rect.x - box.x, rect.y - box.y];
      });
      root.remove();
    }
    return { negative, wrappedCross };
  });
  for (const policy of ['space-between', 'space-around', 'space-evenly']) {
    assert.deepEqual(result.negative[policy], [[0, 0], [92, 0]]);
    assert.deepEqual(result.wrappedCross[policy], [[0, 0], [0, 32]]);
  }
  assert.deepEqual(result.negative.center, [[-36, 0], [56, 0]]);
  assert.deepEqual(result.wrappedCross.center, [[0, -11], [0, 21]]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await browser.close();
}
