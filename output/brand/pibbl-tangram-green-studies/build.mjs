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
 ['Kelly & coral','#FF785E','#159447','#3748AE'],
 ['Lime voltage','#244EE8','#93D500','#26322B'],
 ['Forest & copper','#D98B58','#D6BA91','#14543D'],
 ['Emerald & lilac','#BCA0F2','#00865A','#E9A4BC'],
 ['Green on green','#87C849','#146C3A','#35A968'],
 ['Olive & plum','#73852F','#673D68','#D5AD36'],
 ['Sage & terracotta','#BA5D45','#6F9878','#5C748A'],
 ['Neon garden','#EC489F','#6B35BF','#71D530'],
 ['Racing green','#EAC93B','#07583C','#36B7CE'],
 ['Fern & sky','#419539','#47A5EA','#E4A331']
];
const svg=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title.replaceAll('&','&amp;')}</title>${body}</svg>`;
const logo=(colors)=>`<g transform="translate(35 35)">${identity.icon.map((s,i)=>`<path d="${s.d}" fill="${colors[i]}"/>`).join('')}</g><g transform="translate(303 73)" fill="#111211">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`;
let board='<rect width="1800" height="1860" fill="#F4F3EF"/><g font-family="Arial,Helvetica,sans-serif" fill="#111211"><text x="48" y="56" font-size="32" font-weight="bold">Pibbl · Daddy likes green</text><text x="48" y="92" font-size="20">Ten green palettes. Same Original Tangram.</text></g>';
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
const sheet=svg(1800,1860,board,'Ten green Pibbl Original Tangram palettes');
await fs.writeFile(path.join(dir,'comparison.svg'),sheet);
await sharp(Buffer.from(sheet)).png().toFile(path.join(dir,'comparison.png'));
await fs.writeFile(path.join(dir,'palettes.json'),JSON.stringify(palettes.map(([name,triangle,rectangle,bowl])=>({name,triangle,rectangle,bowl})),null,2));
console.log('Created 10 SVG + transparent PNG color variants and comparison sheet.');
