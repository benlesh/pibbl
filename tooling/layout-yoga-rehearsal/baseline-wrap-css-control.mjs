import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Empty inline blocks give a numeric first-line baseline without font metrics.
// This narrow DOM control classifies the Canvas contract's wrap-reverse difference.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const results = {};
  const policies = ['flex-start','flex-end','center','space-between','space-around','space-evenly','stretch'];
  const forward = [[0,48],[40,88],[20,68],[0,88],[10,78],[40/3,224/3],[0,68]];
  const reversed = [[80,40],[40,0],[60,20],[80,0],[70,10],[200/3,40/3],[80,20]];
  for (const wrap of ['wrap','wrap-reverse']) {
    results[wrap] = {};
    for (let index=0;index<policies.length;index++) {
      const align=policies[index];
      await page.setContent(`<style>
        *{box-sizing:border-box}body{margin:0}.flex{display:flex;width:110px;height:120px;flex-flow:row ${wrap};column-gap:10px;row-gap:8px;align-items:baseline;align-content:${align}}
        .item{font-size:0;line-height:0;flex:0 0 auto}.item span{display:inline-block;width:0;vertical-align:baseline}
      </style><div class="flex">${[['A',60,20,12],['B',40,40,30],['C',60,20,8],['D',40,30,20]].map(([id,width,height,baseline])=>`<div class="item" id="${id}" style="width:${width}px;height:${height}px"><span style="height:${baseline}px"></span></div>`).join('')}</div>`);
      const boxes=await page.evaluate(()=>Object.fromEntries(['A','B','C','D'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,width:r.width,height:r.height}]})));
      const [bY,dY]=(wrap==='wrap'?forward:reversed)[index];
      for(const [id,x,y,width,height] of [['A',0,bY+18,60,20],['B',70,bY,40,40],['C',0,dY+12,60,20],['D',70,dY,40,30]]){
        assert.equal(boxes[id].x,x);assert.equal(boxes[id].width,width);assert.equal(boxes[id].height,height);
        // CSS uses fixed layout units; the Canvas kernel retains its f64 geometry.
        assert.ok(Math.abs(boxes[id].y-y)<=1/32,`${wrap} ${align} ${id}: ${boxes[id].y} != ${y}`);
      }
      results[wrap][align]=boxes;
    }
  }
  process.stdout.write(JSON.stringify({browser:browser.version(),results}) + '\n');
} finally { await browser.close(); }
