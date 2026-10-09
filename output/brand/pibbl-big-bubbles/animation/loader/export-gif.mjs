import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Playback} from './playback.mjs';
import {svg} from './svg.mjs';
const require=createRequire(import.meta.url),sharp=require(process.env.PIBBL_SHARP_PATH||'sharp');
const destination=process.argv[2];if(!destination)throw new Error('Supply a temporary frame directory.');
for(const theme of ['white','dark'])for(const sequence of ['loop','finish']){
 const dir=path.join(destination,theme+'-'+sequence);await fs.mkdir(dir,{recursive:true});
 const p=new Playback(),count=sequence==='loop'?275:375;
 for(let i=0;i<count;i++){
 if(sequence==='finish'&&i===248)p.complete();
 await sharp(Buffer.from(svg(p.frame(),{background:theme==='white'?'#FFFFFF':'#141820'}))).resize(1024,720).png().toFile(path.join(dir,String(i).padStart(4,'0')+'.png'));
 p.advance(40);
 }
 console.warn(theme,sequence,count);
}
