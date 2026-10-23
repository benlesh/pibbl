import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(() => {
    const policies = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'];
    const result = { reverseMain: {}, wrapReverse: {} };
    const record = (root) => {
      const outer = root.getBoundingClientRect();
      return [...root.children].map((child) => {
        const rect = child.getBoundingClientRect();
        return [rect.x - outer.x, rect.y - outer.y];
      });
    };
    for (const direction of ['row-reverse', 'column-reverse']) {
      result.reverseMain[direction] = {};
      for (const justifyContent of policies) {
        const root = document.createElement('div');
        root.style.cssText = `display:flex;flex-direction:${direction};width:100px;height:100px;gap:12px;justify-content:${justifyContent};align-items:flex-start`;
        for (let index = 0; index < 2; index++) {
          const child = document.createElement('div');
          child.style.cssText = direction === 'row-reverse'
            ? 'width:80px;height:20px;flex:0 0 80px'
            : 'width:20px;height:80px;flex:0 0 80px';
          root.append(child);
        }
        document.body.append(root);
        result.reverseMain[direction][justifyContent] = record(root);
        root.remove();
      }
    }
    for (const direction of ['row', 'column']) {
      result.wrapReverse[direction] = {};
      for (const alignContent of policies) {
        const root = document.createElement('div');
        root.style.cssText = direction === 'row'
          ? `display:flex;flex-flow:row wrap-reverse;width:100px;height:30px;gap:12px;align-content:${alignContent};align-items:flex-start`
          : `display:flex;flex-flow:column wrap-reverse;width:30px;height:100px;gap:12px;align-content:${alignContent};align-items:flex-start`;
        for (let index = 0; index < 2; index++) {
          const child = document.createElement('div');
          child.style.cssText = direction === 'row'
            ? 'width:80px;height:20px;flex:0 0 80px'
            : 'width:20px;height:80px;flex:0 0 80px';
          root.append(child);
        }
        document.body.append(root);
        result.wrapReverse[direction][alignContent] = record(root);
        root.remove();
      }
    }
    return result;
  });
  for (const policy of ['space-around', 'space-evenly']) {
    assert.deepEqual(result.reverseMain['row-reverse'][policy], [[92,0],[0,0]]);
    assert.deepEqual(result.reverseMain['column-reverse'][policy], [[0,92],[0,0]]);
    assert.deepEqual(result.wrapReverse.row[policy], [[0,32],[0,0]]);
    assert.deepEqual(result.wrapReverse.column[policy], [[32,0],[0,0]]);
  }
  assert.deepEqual(result.reverseMain['row-reverse'].center, [[56,0],[-36,0]]);
  assert.deepEqual(result.wrapReverse.row.center, [[0,21],[0,-11]]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await browser.close();
}
