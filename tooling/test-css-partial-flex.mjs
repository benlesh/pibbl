// Independent browser evidence for https://www.w3.org/TR/2025/CRD-css-flexbox-1-20251014/#resolve-flexible-lengths
import { strict as assert } from 'node:assert';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {const page=await browser.newPage();const boxes=await page.evaluate(()=>{
  const result={};
  for(const shrink of [false,true]){
    const parent=document.createElement('div');parent.style.cssText='display:flex;width:112px;gap:12px;align-items:flex-start';document.body.append(parent);
    for(let i=0;i<2;i++){const child=document.createElement('div');child.style.cssText=`width:${shrink?80:20}px;height:10px;flex-basis:${shrink?80:20}px;flex-grow:${shrink?0:.25};flex-shrink:${shrink?.25:0};min-width:${shrink&&i===0?90:0}px;max-width:${!shrink&&i===0?10:1000000}px`;parent.append(child);}
    result[shrink?'shrink':'grow']=[...parent.children].map(child=>({x:child.getBoundingClientRect().x-parent.getBoundingClientRect().x,width:child.getBoundingClientRect().width}));
  }return result;});assert.deepEqual(boxes,{grow:[{x:0,width:10},{x:22,width:37.5}],shrink:[{x:0,width:90},{x:102,width:62.5}]});process.stdout.write(JSON.stringify(boxes)+'\n');}finally{await browser.close();}
