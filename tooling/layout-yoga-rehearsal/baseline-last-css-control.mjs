import { chromium } from 'playwright';
import { strict as assert } from 'node:assert';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const css = `*{box-sizing:border-box}body{margin:0}.host{width:WIDTHpx;height:HEIGHTpx;display:flex;flex-direction:row;flex-wrap:WRAP;align-items:last baseline;align-content:stretch;column-gap:8px;row-gap:8px;background:#eee}.item{flex:0 0 auto;font-size:0;line-height:0;background:#bbb}.a{width:40px;height:40px;margin-top:5px;margin-bottom:10px}.b{width:40px;height:60px}.c{width:40px;height:30px}.d{width:40px;height:20px}.m{display:inline-block;width:0;vertical-align:baseline;background:#000}.a .m{height:30px}.b .m{height:50px}.c .m{height:20px}.d .m{height:10px}`;
const body = `<div class=host><div class='item a'><i class=m></i></div><div class='item b'><i class=m></i></div><div class='item c'><i class=m></i></div><div class='item d'><i class=m></i></div></div>`;
async function one(name, { wrap, width, height, hideCD = false }) {
  await page.setContent(`<style>${css.replace('WRAP', wrap).replace('WIDTH', width).replace('HEIGHT', height)}${hideCD ? '.c,.d{display:none}' : ''}</style>${body}`);
  const layout = await page.evaluate(() => {
    const rect = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { x: box.x, y: box.y, w: box.width, h: box.height, b: box.bottom }; };
    return {
      host: rect('.host'), a: rect('.a'), b: rect('.b'), c: rect('.c'), d: rect('.d'),
      markers: [...document.querySelectorAll('.m')].map(element => { const box = element.getBoundingClientRect(); return { y: box.y, h: box.height, b: box.bottom }; }),
    };
  });
  return { name, wrap, layout };
}
const records = [];
records.push(await one('nowrap', { wrap: 'nowrap', width: 120, height: 80, hideCD: true }));
records.push(await one('wrap', { wrap: 'wrap', width: 100, height: 120 }));
records.push(await one('wrap-reverse', { wrap: 'wrap-reverse', width: 100, height: 120 }));
await browser.close();
const out = { css, records };
assert.deepEqual(records.map(record => ['a','b','c','d'].map(key => record.layout[key].y)), [[30,10,0,0],[26,6,90,100],[64,44,0,10]]);
for (const record of records) { assert.equal(record.layout.markers[0].b, record.layout.markers[1].b); if (record.wrap !== 'nowrap') assert.equal(record.layout.markers[2].b, record.layout.markers[3].b); }
if (process.env.PIBBL_LAYOUT_CONTROL_OUTPUT) await writeFile(process.env.PIBBL_LAYOUT_CONTROL_OUTPUT, JSON.stringify(out, null, 2) + '\n');
console.warn(JSON.stringify(out, null, 2));
