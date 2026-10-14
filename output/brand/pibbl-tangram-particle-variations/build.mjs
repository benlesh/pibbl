import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.PIBBL_SHARP_PATH||'sharp');
const dir=path.dirname(fileURLToPath(import.meta.url));
const identity=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/identity.json'),'utf8'));
const glyphs=JSON.parse(await fs.readFile(path.join(dir,'../pibbl-tangram/source/wordmark-paths.json'),'utf8'));
const colors=['#FF735E','#159447','#8B5CCB'];
const ink='#111211';
const esc=s=>s.replaceAll('&','&amp;');
const svg=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${esc(title)}</title>${body}</svg>`;
const base=identity.icon.map((s,i)=>`<path d="${s.d}" fill="${colors[i]}"/>`).join('');
const word=`<g transform="translate(330 73)" fill="${ink}">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`;
const logo=mark=>`<g transform="translate(35 35)">${mark}</g>${word}`;
const dot=(x,y,r,color)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const line=(d,color,width=3,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const clip=(id,d,body)=>`<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g clip-path="url(#${id})">${body}</g>`;
const violet=colors[2],green=colors[1],coral=colors[0];
const originalHoles=[[211,20,8],[221,42,7],[226,66,6],[213,93,5],[195,119,4]];
const originalDots=[[239,27,5,violet],[250,49,3,coral],[241,72,6,violet],[253,99,3,green],[231,117,4,violet],[244,11,2,green]];
const dots=p=>p.map(([x,y,r,c=violet])=>dot(x,y,r,c)).join('');
const bowl=identity.icon[2];
const solidBowl=`<path d="${bowl.d}" fill="${violet}"/>`;
const bloom=(id,holes,particles,squares=false)=>{
 const pieces=(p,color)=>p.map(([x,y,r,c=color])=>squares?`<rect x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" fill="${c}"/>`:dot(x,y,r,c)).join('');
 const mask=`<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="128" y="0" width="130" height="145"><rect x="128" y="0" width="130" height="145" fill="white"/>${pieces(holes,'black')}</mask></defs>`;
 return base.replace(solidBowl,mask+solidBowl.replace('/>',' mask="url(#'+id+')"/>'))+pieces(particles,violet);
};
const variants=[
 ['Current bloom','Your selected particle treatment, for comparison.',bloom('original',originalHoles,originalDots)],
 ['Quiet bloom','Fewer dots, with more breathing room.',bloom('quiet',[[220,39,6],[224,71,6],[211,101,4]],[[238,42,5],[251,69,3,coral],[236,101,4,green]])],
 ['Sideways drift','A tapered stream gives the particles a direction.',bloom('drift',[[226,51,7],[228,72,8],[222,92,6]],[[236,58,6],[240,84,5],[254,68,4,coral],[265,85,3,green],[276,70,2.5],[259,49,2]])],
 ['Upward lift','The dots float upward from the top of the curve.',bloom('lift',[[191,12,7],[212,27,7],[223,45,5]],[[220,16,6],[235,1,4,green],[246,24,5],[261,8,3,coral],[254,44,3],[268,29,2]])],
 ['Big bubbles','Larger circles make the breakup bolder and more playful.',bloom('bubbles',[[216,32,12],[228,65,10],[211,105,9]],[[245,34,9],[258,77,11],[238,119,7],[268,13,4,coral],[278,105,4,green]])],
 ['Violet only','One color keeps the particle effect visually focused.',bloom('mono',originalHoles,originalDots.map(([x,y,r])=>[x,y,r,violet]))],
 ['Pixel sparks','Small square fragments add a digital texture.',bloom('pixels',[[213,24,6],[224,49,6],[226,73,5],[214,101,4]],[[236,25,5],[250,48,3,coral],[242,77,5],[257,100,3,green],[235,120,3],[264,69,2]],true)],
 ['Fine mist','More tiny dots make a softer, finer breakup.',bloom('mist',[[215,25,4],[222,42,4],[227,60,4],[225,80,4],[217,97,3],[205,113,3]],[[232,23,3],[243,36,2],[235,50,3],[248,61,2.5],[238,79,3],[246,94,2],[226,114,2.5],[255,25,1.5,green],[261,49,1.5],[266,77,2,coral],[258,113,1.5],[249,127,1.5,green]])]
];
let board=`<rect width="1800" height="1820" fill="#F4F3EF"/><g font-family="Arial,Helvetica,sans-serif" fill="${ink}"><text x="48" y="55" font-size="32" font-weight="bold">Pibbl · Particle bloom variations</text><text x="48" y="92" font-size="20">Same Tangram and selected palette · Eight different particle treatments</text></g>`;
for(let i=0;i<variants.length;i++){
 const [name,caption,mark]=variants[i];
 const filename=`${String(i+1).padStart(2,'0')}-${name.toLowerCase().replace(/[^a-z]+/g,'-')}`;
 const s=svg(920,364,logo(mark),'Pibbl — '+name);
 await fs.writeFile(path.join(dir,filename+'.svg'),s);
 await sharp(Buffer.from(s)).resize(1840,728).png().toFile(path.join(dir,filename+'.png'));
 const icon=svg(350,350,`<g transform="translate(35 35)">${mark}</g>`,'Pibbl '+name+' icon');
 await fs.writeFile(path.join(dir,filename+'-icon.svg'),icon);
 await sharp(Buffer.from(icon)).resize(700,700).png().toFile(path.join(dir,filename+'-icon.png'));
 const x=48+i%2*864,y=126+Math.floor(i/2)*420;
 board+=`<rect x="${x}" y="${y}" width="840" height="395" rx="12" fill="white"/><g transform="translate(${x+60} ${y+27}) scale(.78)">${logo(mark)}</g><g font-family="Arial,Helvetica,sans-serif" fill="${ink}"><text x="${x+28}" y="${y+320}" font-size="24" font-weight="bold">${i+1}. ${name}</text><text x="${x+28}" y="${y+356}" font-size="18">${caption}</text></g>`;
}
const sheet=svg(1800,1820,board,'Eight Pibbl Particle bloom variations');
await fs.writeFile(path.join(dir,'comparison.svg'),sheet);
await sharp(Buffer.from(sheet)).png().toFile(path.join(dir,'comparison.png'));
console.log('Exported eight particle variations as transparent SVG/PNG lockups and icons. Selected design preserved.');
