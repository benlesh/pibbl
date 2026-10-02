import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:900,height:850}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4381/crc');
 await page.waitForTimeout(5000);
 console.log(JSON.stringify({errors,proof:await page.evaluate(()=>window.productionProof?.())}));
 await page.screenshot({path:'/private/tmp/crc-wasm-production.png'});
 await page.getByLabel('Pause ink evolution',{exact:true}).check();
 await page.getByRole('button',{name:'Reset scene'}).click();
 if (await page.getByLabel('Pause ink evolution',{exact:true}).isChecked()) throw new Error('Reset left pause enabled');
 if (errors.length) throw new Error(errors.join('\n'));
 await page.setViewportSize({width:390,height:850});
 await page.screenshot({path:'/private/tmp/crc-wasm-production-mobile.png'});
} finally {await browser.close();}
