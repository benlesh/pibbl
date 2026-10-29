import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.PIBBL_SHARP_PATH||'sharp');
const dir=path.dirname(fileURLToPath(import.meta.url));
const identity=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/identity.json'),'utf8'));
const glyphs=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/wordmark-paths.json'),'utf8'));
const p=identity.palette;
const shape=(d,c)=>`<path d="${d}" fill="${p[c]}" fill-rule="evenodd"/>`;
const word=`<g fill="${p.ink}" transform="translate(303 73)">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`;
const current=identity.icon.map(s=>shape(s.d,s.color)).join('');
const loop=shape('M24 134H68V280H24Z','coral')+
  shape('M200 94C200 142.601 160.601 182 112 182C63.399 182 24 142.601 24 94C24 45.399 63.399 6 112 6C160.601 6 200 45.399 200 94ZM156 94C156 118.301 136.301 138 112 138C87.699 138 68 118.301 68 94C68 69.699 87.699 50 112 50C136.301 50 156 69.699 156 94Z','blue')+
  shape('M24 6H112L24 94Z','yellow');
const fold=shape('M0 280H60L140 0H80Z','coral')+
  shape('M100 0H176L228 56V116L168 176H80ZM122 52L106 112H170L186 96V68L170 52Z','blue')+
  shape('M80 0H140L62 64Z','yellow');
const offset=shape('M0 100H80V280H0Z','coral')+
  shape('M80 10H100C144 10 180 50 180 100C180 150 144 190 100 190H80Z','blue')+
  shape('M0 100L100 0V100Z','yellow');
const variants=[
  ['01-current','Current Tangram','The familiar stacked-block silhouette.',current],
  ['02-loop','Loop','A circular counter and slimmer stem change the construction.',loop],
  ['03-fold','Fold','An angled stem and faceted bowl create a different silhouette.',fold],
  ['04-offset','Offset','A reversed triangle and shifted bowl make the pieces asymmetric.',offset]
];
const svg=(w,h,content,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title}</title>${content}</svg>`;
const logo=m=>`<g transform="translate(35 35)">${m}</g>${word}`;
for(const [name,title,,mark] of variants){
 const s=svg(890,364,logo(mark),`Pibbl ${title} study`);
 await fs.writeFile(path.join(dir,name+'.svg'),s);
 await sharp(Buffer.from(s)).resize(1780,728).png().toFile(path.join(dir,name+'.png'));
}
let sheet=`<rect width="1800" height="1200" fill="${p.paper}"/><g font-family="Arial,Helvetica,sans-serif" fill="${p.ink}"><text x="48" y="56" font-size="27" font-weight="bold">Same simple geometry. Different construction.</text><text x="48" y="91" font-size="18">Illustrative directions for comparison — these alternatives have not undergone a similarity search.</text></g>`;
for(let i=0;i<variants.length;i++){
 const [,title,caption,mark]=variants[i],x=48+(i%2)*864,y=126+Math.floor(i/2)*518;
 sheet+=`<rect x="${x}" y="${y}" width="840" height="492" fill="white"/>`;
 sheet+=`<g transform="translate(${x+35} ${y+36}) scale(.865)">${logo(mark)}</g>`;
 sheet+=`<g font-family="Arial,Helvetica,sans-serif" fill="${p.ink}"><text x="${x+30}" y="${y+398}" font-size="25" font-weight="bold">${i+1}. ${title}</text><text x="${x+30}" y="${y+433}" font-size="18">${caption}</text></g>`;
}
await fs.writeFile(path.join(dir,'comparison.svg'),svg(1800,1200,sheet,'Pibbl geometric logo construction studies'));
await sharp(Buffer.from(svg(1800,1200,sheet,'Pibbl geometric logo construction studies'))).png().toFile(path.join(dir,'comparison.png'));
console.log('Created current mark + three vector construction studies and a comparison sheet.');
