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
const holes=[[216,32,12],[228,65,10],[211,105,9],[187,52,8],[183,91,6]];
const particles=[[241,18,9,violet],[267,67,10,violet],[228,121,7,violet],[241,62,6,coral],[254,107,8,green],[272,27,6,coral],[253,-2,4,green],[286,96,5,violet],[282,47,5,green]];
const mark=bloom('big-bubbles-edge',holes,particles);
const parts=path.join(dir,'parts');
await fs.mkdir(parts,{recursive:true});
const manifest={name:'Pibbl Big Bubbles',palette:{coral,green,violet,ink},coordinateSystem:{viewBox:[0,0,350,350],shapeOrigin:[35,35],horizontalWordmarkOrigin:[330,73],units:'SVG units; bubble positions are relative to shapeOrigin'},shapes:identity.icon.map((s,i)=>({id:s.id,path:s.d,fill:colors[i],pivot:i===0?[42.667,46.667]:i===1?[62,210]:[172,70]})),bubbles:particles.map(([x,y,r,fill],i)=>({id:`bubble-${i+1}`,destination:{x,y,r},fill,...(i<5?{source:{x:holes[i][0],y:holes[i][1],r:holes[i][2]},release:'cutout grows as bubble exits',sourceFill:violet,colorTransition:fill===violet?'none':'violet to destination color during release'}:{release:'accent dot fades in during bloom'})})),cutouts:holes.map(([x,y,r],i)=>({bubbleId:`bubble-${i+1}`,x,y,r})),intendedSequence:['Tumble the three solid primary shapes in a repeating loading loop.','When ready, finish the current loop and settle shapes into the P.','Release bubbles from their source positions; reveal corresponding cutouts and transition accent colors.','Reveal coral and green accent dots, then hold the completed logo.'],status:'Prepared geometry and parts; animation timing and motion are not implemented.'};
await fs.writeFile(path.join(dir,'animation-parts.json'),JSON.stringify(manifest,null,2));
for(const [name,w,h,body] of [['horizontal',920,364,logo(mark)],['icon',350,350,`<g transform="translate(35 35)">${mark}</g>`]]){
 const s=svg(w,h,body,'Pibbl Big Bubbles — deeper release');
 await fs.writeFile(path.join(dir,name+'.svg'),s);
 await sharp(Buffer.from(s)).resize(w*2,h*2).png().toFile(path.join(dir,name+'.png'));
}
await sharp(path.join(dir,'horizontal.png')).flatten({background:'white'}).toFile(path.join(dir,'preview.png'));
for(let i=0;i<identity.icon.length;i++){
 const s=identity.icon[i];
 await fs.writeFile(path.join(parts,s.id+'.svg'),svg(350,350,`<g transform="translate(35 35)"><path d="${s.d}" fill="${colors[i]}"/></g>`,'Pibbl solid '+s.id+' animation part'));
}
await fs.writeFile(path.join(parts,'bowl-with-cutouts.svg'),svg(350,350,`<g transform="translate(35 35)">${mark.replace(`<path d="${identity.icon[0].d}" fill="${coral}"/>`,'').replace(`<path d="${identity.icon[1].d}" fill="${green}"/>`,'').replace(dots(particles),'')}</g>`,'Pibbl bowl with bubble cutouts'));
for(let i=0;i<particles.length;i++)await fs.writeFile(path.join(parts,`bubble-${i+1}.svg`),svg(350,350,`<g transform="translate(35 35)">${dots([particles[i]])}</g>`,'Pibbl bubble '+(i+1)));
await fs.writeFile(path.join(parts,'wordmark.svg'),svg(621,325,`<g transform="translate(35 35)" fill="${ink}">${glyphs.map(g=>`<path d="${g.d}" fill-rule="${g.rule||'nonzero'}"/>`).join('')}</g>`,'Pibbl wordmark'));
await fs.writeFile(path.join(dir,'README.txt'),'Selected: Big Bubbles, with two additional bubbles released from deeper inside the violet bowl.\n\nparts/ contains the three solid loading shapes, the final cutout bowl, nine individual bubbles, and the wordmark. Shape parts share a 350 × 350 viewBox and a (35,35) origin. animation-parts.json records exact paths, colors, source and destination positions, and transform pivots.\n\nThe intended animation is tumble loop → settle into P → release bubbles → hold. These are prepared assets; the animation is not implemented yet.\n');
const selected=path.join(dir,'../pibbl-tangram-selected');
for(const filename of ['horizontal.svg','horizontal.png','icon.svg','icon.png','preview.png'])await fs.copyFile(path.join(dir,filename),path.join(selected,filename));
await fs.writeFile(path.join(selected,'selection.json'),JSON.stringify({name:manifest.name,selectedOn:'2026-10-08',palette:manifest.palette,treatment:'Big Bubbles with two deeper interior cutouts and an organic cloud of violet, coral, and green dots.',source:'../pibbl-tangram-big-bubbles',animationParts:'../pibbl-tangram-big-bubbles/animation-parts.json'},null,2));
console.log('Saved refined Big Bubbles logo and separate animation parts, with exact bubble source/destination geometry.');
