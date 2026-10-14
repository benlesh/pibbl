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
 ['Electric violet','#B8E62E','#7550E8','#16B8BA'],
 ['Lagoon','#F5BC42','#087E8B','#55C9B0'],
 ['Citrus','#FFC23B','#F16B32','#68A842'],
 ['Arcade','#FFAF35','#F0449B','#5259E8'],
 ['Sunset','#F7B84D','#E35470','#8553BB'],
 ['Candy','#FF7CB6','#7363D8','#3EBBBF'],
 ['Cobalt & mint','#64DDB8','#195BD8','#8EABF4'],
 ['Ember','#EBA74B','#DD543E','#334B66'],
 ['Orchid','#D9AFEF','#A649A2','#5044A1'],
 ['Graphite & lime','#C7EB39','#303D4B','#6B8898']
];
const svg=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title.replaceAll('&','&amp;')}</title>${body}</svg>`;
const logo=(colors)=>`<g transform="translate(35 35)">${identity.icon.map((s,i)=>`<path d="${s.d}" fill="${colors[i]}"/>`).join('')}</g><g transform="translate(303 73)" fill="#111211">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`;
let board='<rect width="1800" height="1860" fill="#F4F3EF"/><g font-family="Arial,Helvetica,sans-serif" fill="#111211"><text x="48" y="56" font-size="32" font-weight="bold">Pibbl · Original Tangram</text><text x="48" y="92" font-size="20">Ten color directions. Same geometry and wordmark.</text></g>';
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
const sheet=svg(1800,1860,board,'Ten Pibbl Original Tangram color palettes');
await fs.writeFile(path.join(dir,'comparison.svg'),sheet);
await sharp(Buffer.from(sheet)).png().toFile(path.join(dir,'comparison.png'));
await fs.writeFile(path.join(dir,'palettes.json'),JSON.stringify(palettes.map(([name,triangle,rectangle,bowl])=>({name,triangle,rectangle,bowl})),null,2));
console.log('Created 10 SVG + transparent PNG color variants and comparison sheet.');
