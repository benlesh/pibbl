import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
  const read = async ({ wrap = 'wrap', align = 'flex-start', margin = '', all = false }) => {
    await page.setContent(`<style>
      *{box-sizing:border-box} body{margin:0}.flex{display:flex;width:100px;height:120px;flex-flow:row ${wrap};align-items:baseline;align-content:${align};row-gap:8px}
      .item{font-size:0;line-height:0;flex:0 0 auto}.item span{display:inline-block;width:0;vertical-align:baseline}
    </style><div class=flex>${[['A',60,20,12],['B',40,40,30],['C',60,20,8],['D',40,30,20]].map(([id,w,h,b],i)=>`<div id=${id} class=item style="width:${w}px;height:${h}px;${all ? margin : i === 0 ? margin : ''}"><span style="height:${b}px"></span></div>`).join('')}</div>`);
    return page.evaluate(() => Object.fromEntries(['A','B','C','D'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id,{x:r.x,y:r.y,width:r.width,height:r.height}]; })));
  };
  const result = {
    topAutoBottom10: await read({margin:'margin-top:auto;margin-bottom:10px'}),
    bottomAuto: await read({margin:'margin-bottom:auto'}),
    bothAuto: await read({margin:'margin-top:auto;margin-bottom:auto'}),
    allTopAuto: await read({margin:'margin-top:auto',all:true}),
    reverseBottomAuto: await read({wrap:'wrap-reverse',margin:'margin-bottom:auto'}),
    reverseTopAutoBottom10: await read({wrap:'wrap-reverse',margin:'margin-top:auto;margin-bottom:10px'}),
    reverseStretchTopAuto: await read({wrap:'wrap-reverse',align:'stretch',margin:'margin-top:auto;margin-bottom:10px'}),
  };
  const expected = {topAutoBottom10:[10,0,60,48],bottomAuto:[0,0,60,48],bothAuto:[10,0,60,48],allTopAuto:[20,0,58,48],reverseBottomAuto:[80,80,52,40],reverseTopAutoBottom10:[90,80,52,40],reverseStretchTopAuto:[90,80,32,20]};
  for(const [profile,ys] of Object.entries(expected)) {
    for(let i=0;i<4;i++) {
      const box=result[profile][['A','B','C','D'][i]];
      assert.deepEqual(box,{x:i%2===0?0:60,y:ys[i],width:i%2===0?60:40,height:[20,40,20,30][i]},profile);
    }
  }
  process.stdout.write(JSON.stringify({browser: browser.version(),result})+'\n');
} finally { await browser.close(); }
