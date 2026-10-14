import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.PIBBL_SHARP_PATH||'sharp');
const dir=path.dirname(fileURLToPath(import.meta.url));
const identity=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/identity.json'),'utf8'));
const glyphs=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/wordmark-paths.json'),'utf8'));
// Palette order: triangle, rectangle, curved bowl. Geometry remains exact.
const palettes=[
 ['Current warm coral','#FF896B','#159447','#8B5CCB'],
 ['Peach coral','#F6A080','#159447','#8B5CCB'],
 ['Apricot coral','#FA9562','#159447','#8B5CCB'],
 ['Pink coral','#F78391','#159447','#8B5CCB'],
 ['Vivid coral','#FF735E','#159447','#8B5CCB'],
 ['Muted coral','#DD8B7A','#159447','#8B5CCB']
];
const svg=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title.replaceAll('&','&amp;')}</title>${body}</svg>`;
const logo=(colors)=>`<g transform="translate(35 35)">${identity.icon.map((s,i)=>`<path d="${s.d}" fill="${colors[i]}"/>`).join('')}</g><g transform="translate(303 73)" fill="#111211">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`;
let board='<rect width="1800" height="1180" fill="#F4F3EF"/><g font-family="Arial,Helvetica,sans-serif" fill="#111211"><text x="48" y="56" font-size="32" font-weight="bold">Pibbl · Coral variations</text><text x="48" y="92" font-size="20">Kelly green and soft violet stay fixed. Only the coral changes.</text></g>';
for(let i=0;i<palettes.length;i++){
 const [name,...colors]=palettes[i];
 const filename=`${String(i+1).padStart(2,'0')}-${name.toLowerCase().replace(/[^a-z]+/g,'-')}`;
 const s=svg(890,364,logo(colors),`Pibbl Tangram — ${name}`);
 await fs.writeFile(path.join(dir,filename+'.svg'),s);
 await sharp(Buffer.from(s)).resize(1780,728).png().toFile(path.join(dir,filename+'.png'));
 const x=48+(i%2)*864,y=126+Math.floor(i/2)*340;
 board+=`<rect x="${x}" y="${y}" width="840" height="318" rx="12" fill="#FFFFFF"/><g transform="translate(${x+105} ${y+5}) scale(.72)">${logo(colors)}</g><g font-family="Arial,Helvetica,sans-serif" fill="#111211"><text x="${x+28}" y="${y+285}" font-size="22" font-weight="bold">${i+1}. ${name.replace('&','&amp;')}</text></g>`;
 for(let j=0;j<3;j++)board+=`<rect x="${x+718+j*30}" y="${y+267}" width="20" height="20" rx="4" fill="${colors[j]}"/>`;
}
const sheet=svg(1800,1180,board,'Six coral Pibbl palettes with Kelly green and soft violet');
await fs.writeFile(path.join(dir,'comparison.svg'),sheet);
await sharp(Buffer.from(sheet)).png().toFile(path.join(dir,'comparison.png'));
await fs.writeFile(path.join(dir,'palettes.json'),JSON.stringify(palettes.map(([name,triangle,rectangle,bowl])=>({name,triangle,rectangle,bowl})),null,2));
console.log('Created 6 SVG + transparent PNG color variants and comparison sheet.');
