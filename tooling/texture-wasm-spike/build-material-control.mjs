import {readFile,writeFile} from 'node:fs/promises';
import {transform} from 'esbuild';
let source=await readFile(new URL('./materials.asc',import.meta.url),'utf8');
source=source.split('export function colorize')[0].replaceAll('@inline','').replace('return a*b;','return Math.imul(a,b);').replaceAll('store<f32>','storeF32').replaceAll('export function','function');
const {code}=await transform(source,{loader:'ts',format:'esm'});
await writeFile(new URL('./materials-control.mjs',import.meta.url),`// Generated from materials.asc. Do not edit.\nexport function createControl(field) {\nconst i32=x=>x|0,u32=x=>x>>>0,usize=x=>x>>>0,f64=Number,f32=Math.fround;\nconst storeF32=(address,value)=>{field[address>>>2]=value;};\n${code}\nreturn {generate};\n}\n`);
