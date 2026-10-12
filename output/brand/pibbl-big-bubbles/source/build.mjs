import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require(process.env.PIBBL_SHARP_PATH || 'sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const identity = JSON.parse(await fs.readFile(path.join(root, 'source/identity.json'), 'utf8'));
const P = identity.palette;
const catalog = [];

function oval(cx, cy, rx, ry) {
  const k = 0.5522847498307936;
  return `M${cx+rx} ${cy}C${cx+rx} ${cy+k*ry} ${cx+k*rx} ${cy+ry} ${cx} ${cy+ry}C${cx-k*rx} ${cy+ry} ${cx-rx} ${cy+k*ry} ${cx-rx} ${cy}C${cx-rx} ${cy-k*ry} ${cx-k*rx} ${cy-ry} ${cx} ${cy-ry}C${cx+k*rx} ${cy-ry} ${cx+rx} ${cy-k*ry} ${cx+rx} ${cy}Z`;
}
function rect(x,y,w,h) { return `M${x} ${y}H${x+w}V${y+h}H${x}Z`; }
const glyphs = [
  {id:'p-stem',d:rect(0,66,40,189)},
  {id:'p-bowl',d:oval(70,132,70,66)+oval(70,132,30,29),rule:'evenodd'},
  {id:'i-stem',d:rect(154,70,37,126)},
  {id:'i-dot',d:oval(172,23,23,23)},
  ...[208,360].flatMap((x,i)=>[
    {id:`b${i+1}-stem`,d:rect(x,0,37,196)},
    {id:`b${i+1}-bowl`,d:oval(x+70,132,69,66)+oval(x+70,132,30,29),rule:'evenodd'}
  ]),
  {id:'l',d:rect(511,0,37,196)}
];
await fs.writeFile(path.join(root,'source/wordmark-paths.json'), JSON.stringify(glyphs,null,2)+'\n');

function wordmark(fill=P.ink) { return `<g id="wordmark" fill="${fill}">${glyphs.map(g=>`<path id="${g.id}" d="${g.d}"${g.rule?' fill-rule="evenodd"':''}/>`).join('')}</g>`; }
function solidIcon(style='color') {
  const fill=style==='black'?P.ink:style==='white'?P.white:null;
  return `<g id="tangram-mark">${identity.icon.map(s=>`<path id="${s.id}" fill="${fill||P[s.color]}" d="${s.d}"/>`).join('')}</g>`;
}
function icon(style='color',customFill) {
  const fill=customFill||(style==='black'?P.ink:style==='white'?P.white:null);
  const bowl=identity.icon[2];
  const holePaths=identity.cutouts.map(h=>oval(h.x,h.y,h.r,h.r)).join('');
  const clipped=`<defs><clipPath id="bowl-clip"><path id="bowl" d="${bowl.d}"/></clipPath></defs><g clip-path="url(#bowl-clip)"><path id="bowl-cutouts" fill="${fill||P.violet}" fill-rule="evenodd" d="${bowl.d+holePaths}"/></g>`;
  return `<g id="tangram-mark">${identity.icon.slice(0,2).map(s=>`<path id="${s.id}" fill="${fill||P[s.color]}" d="${s.d}"/>`).join('')}${clipped}${identity.bubbles.map(b=>`<path id="${b.id}" fill="${fill||b.fill}" d="${oval(b.destination.x,b.destination.y,b.destination.r,b.destination.r)}"/>`).join('')}</g>`;
}

function svg(width,height,body,title='Pibbl',extra='') {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"${extra}><title id="title">${title}</title>${body}</svg>\n`;
}
function placed(content, [x,y,s]) {return `<g transform="translate(${x} ${y}) scale(${s})">${content}</g>`;}
function logoBody(form='horizontal',style='color') {
  const f=identity.forms[form];
  return (f.icon?placed(icon(style),f.icon):'')+(f.wordmark?placed(wordmark(style==='white'||style==='color-on-dark'?P.white:P.ink),f.wordmark):'');
}
async function save(rel,data,meta={}) {
  const dest=path.join(root,rel); await fs.mkdir(path.dirname(dest),{recursive:true}); await fs.writeFile(dest,data);
  catalog.push({file:rel,...meta});
}
async function raster(rel,input,width,height,format='png') {
  let pipe=sharp(Buffer.from(input),{density:144}).resize(width,height,{fit:'fill'}).withMetadata({density:300});
  if(format==='png') pipe=pipe.png();
  if(format==='webp') pipe=pipe.webp({lossless:true});
  if(format==='jpg') pipe=pipe.jpeg({quality:95,chromaSubsampling:'4:4:4'});
  await save(rel,await pipe.toBuffer(),{format,width,height});
}

for(const [form,f] of Object.entries(identity.forms)) {
  for(const style of ['color','color-on-dark','black','white']) {
    const master=svg(f.width,f.height,logoBody(form,style),`Pibbl ${form} logo, ${style}`);
    await save(`svg/pibbl-${form}-${style}.svg`,master,{format:'svg',variant:form,colorway:style,width:f.width,height:f.height,background:'transparent'});
    const sizes=form==='icon'?[128,256,512,1024,2048]:form==='horizontal'?[512,1024,2048,4096]:[512,1024,2048];
    for(const width of sizes) await raster(`png/${form}/pibbl-${form}-${style}-${width}.png`,master,width,Math.round(width*f.height/f.width));
    if(form==='horizontal'&&['color','color-on-dark'].includes(style)) await raster(`web/pibbl-${form}-${style}.webp`,master,1024,Math.round(1024*f.height/f.width),'webp');
  }
}

function avatar(bg,style='color',size=1024) {
  const s=size*0.60/286;
  return svg(size,size,`<path fill="${bg}" d="${rect(0,0,size,size)}"/>${placed(icon(style),[(size-291*s)/2,(size-280*s)/2+3*s,s])}`,'Pibbl profile icon');
}
for(const [name,bg,style] of [['light',P.white,'color'],['dark',P.dark,'color'],['violet',P.violet,'white'],['green',P.green,'white']]) {
  const a=avatar(bg,style);
  await save(`marketing/profile/pibbl-avatar-${name}.svg`,a,{format:'svg',width:1024,height:1024});
  await raster(`marketing/profile/pibbl-avatar-${name}-1024.png`,a,1024,1024);
}
for(const size of [180,192,512]) await raster(`web/pibbl-app-icon-${size}.png`,avatar(P.white),size,size);
await raster('web/pibbl-app-icon-maskable-512.png',avatar(P.white),512,512);
await raster('web/apple-touch-icon.png',avatar(P.white),180,180);

const favicon=svg(32,32,placed(solidIcon(),[4.6,2,0.1]),'Pibbl favicon');
await save('web/favicon.svg',favicon,{format:'svg',width:32,height:32});
const faviconFrames=[];
for(const size of [16,32,48]) {
  const buf=await sharp(Buffer.from(favicon)).resize(size,size).png().toBuffer();
  await save(`web/favicon-${size}.png`,buf,{format:'png',width:size,height:size});
  faviconFrames.push({size,buf});
}
const icoHeader=Buffer.alloc(6+16*faviconFrames.length);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(faviconFrames.length,4);
let offset=icoHeader.length;
faviconFrames.forEach(({size,buf},i)=>{const p=6+i*16;icoHeader[p]=size;icoHeader[p+1]=size;icoHeader.writeUInt16LE(1,p+4);icoHeader.writeUInt16LE(32,p+6);icoHeader.writeUInt32LE(buf.length,p+8);icoHeader.writeUInt32LE(offset,p+12);offset+=buf.length;});
await save('web/favicon.ico',Buffer.concat([icoHeader,...faviconFrames.map(f=>f.buf)]),{format:'ico',sizes:[16,32,48]});
await save('web/site.webmanifest',JSON.stringify({name:'Pibbl',short_name:'Pibbl',icons:[{src:'pibbl-app-icon-192.png',sizes:'192x192',type:'image/png'},{src:'pibbl-app-icon-512.png',sizes:'512x512',type:'image/png'},{src:'pibbl-app-icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],theme_color:P.white,background_color:P.white},null,2)+'\n',{format:'json'});

function campaign(width,height,dark=false) {
  const bg=dark?P.dark:P.paper;
  const f=identity.forms.horizontal;
  const scale=Math.min(width*.82/f.width,height*.64/f.height);
  const x=(width-f.width*scale)/2,y=(height-f.height*scale)/2;
  const motif=`<g opacity="${dark?'.12':'.07'}"><path fill="${P.violet}" d="M${width-100} -180C${width+130} -180 ${width+130} 160 ${width-100} 160Z"/><path fill="${P.green}" d="M-130 ${height-180}H150V${height+100}H-130Z"/><path fill="${P.coral}" d="M${width-250} ${height+50}H${width+50}V${height-250}Z"/></g>`;
  const body=`<path fill="${bg}" d="${rect(0,0,width,height)}"/>${motif}<g transform="translate(${x} ${y}) scale(${scale})">${logoBody('horizontal',dark?'color-on-dark':'color')}</g>`;
  return svg(width,height,body,'Pibbl Tangram brand artwork');
}
for(const [name,w,h] of [['share-card',1200,630],['wide-banner',1500,500],['presentation-cover',1920,1080],['square-post',1080,1080],['wallpaper',2560,1440]]) {
  for(const mode of ['light','dark']) {
    const s=campaign(w,h,mode==='dark');
    await save(`marketing/${name}/pibbl-${name}-${mode}.svg`,s,{format:'svg',width:w,height:h});
    await raster(`marketing/${name}/pibbl-${name}-${mode}.png`,s,w,h);
    if(name==='share-card'||name==='wide-banner') await raster(`marketing/${name}/pibbl-${name}-${mode}.jpg`,s,w,h,'jpg');
  }
}

const tile=svg(240,240,`<path fill="${P.paper}" d="${rect(0,0,240,240)}"/><path fill="${P.green}" d="M24 24H84L24 84Z"/><path fill="${P.coral}" d="${rect(142,142,62,62)}"/><path fill="${P.violet}" d="M150 24C196 24 196 92 150 92Z"/><path fill="${P.ink}" d="M24 160H66L24 204Z"/>`,'Pibbl geometric pattern tile');
await save('marketing/pattern/pibbl-pattern-tile.svg',tile,{format:'svg',width:240,height:240});
await raster('marketing/pattern/pibbl-pattern-tile-960.png',tile,960,960);
const pattern=svg(1920,1080,`<defs><pattern id="tiles" width="240" height="240" patternUnits="userSpaceOnUse">${tile.substring(tile.indexOf('</title>')+8,tile.lastIndexOf('</svg>'))}</pattern></defs><path fill="url(#tiles)" d="${rect(0,0,1920,1080)}"/>`,'Pibbl repeated geometric pattern');
await save('marketing/pattern/pibbl-pattern-background.svg',pattern,{format:'svg',width:1920,height:1080});
await raster('marketing/pattern/pibbl-pattern-background.png',pattern,1920,1080);

const bowlPath=identity.icon.find(piece=>piece.id==='bowl').d;
const stickerSilhouette=`M0 0${bowlPath.slice('M128 0'.length,-1)}H124V280H0Z`;
const sticker=svg(512,512,placed(`<path fill="${P.white}" stroke="${P.white}" stroke-width="28" stroke-linejoin="round" d="${stickerSilhouette}"/>${identity.bubbles.map(b=>`<path fill="${P.white}" stroke="${P.white}" stroke-width="12" d="${oval(b.destination.x,b.destination.y,b.destination.r,b.destination.r)}"/>`).join('')}${icon()}`,[90,82,1]),'Pibbl sticker artwork');
await save('marketing/sticker/pibbl-sticker.svg',sticker,{format:'svg',width:512,height:512,background:'transparent'});
await raster('marketing/sticker/pibbl-sticker-2048.png',sticker,2048,2048);

const email=svg(470,185,`<path fill="${P.white}" d="${rect(0,0,470,185)}"/><g transform="scale(0.5)">${logoBody()}</g>`,'Pibbl email signature logo');
await raster('marketing/email/pibbl-email-logo-2x.png',email,940,370);
await save('marketing/email/signature.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pibbl signature</title></head><body><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td><img src="pibbl-email-logo-2x.png" width="235" height="92" alt="Pibbl" style="display:block;border:0"></td></tr></table></body></html>\n',{format:'html'});

const label=(x,y,t,color=P.ink)=>`<text x="${x}" y="${y}" fill="${color}" font-family="Arial,Helvetica,sans-serif" font-size="20">${t}</text>`;
function overviewTile(x,y,w,h,form,style,bg,caption) {
  const f=identity.forms[form],scale=Math.min((w-60)/f.width,(h-55)/f.height);
  return `<path fill="${bg}" d="${rect(x,y,w,h)}"/>${placed(logoBody(form,style),[x+(w-f.width*scale)/2,y+10,scale])}${label(x+24,y+h-17,caption,bg===P.dark?P.white:P.ink)}`;
}
let overview=`<path fill="${P.paper}" d="${rect(0,0,1600,1120)}"/>${label(48,49,'PIBBL / BIG BUBBLES / LOGO SUITE')}`;
overview+=overviewTile(48,80,1504,310,'horizontal','color',P.white,'Primary logo');
overview+=overviewTile(48,414,740,210,'horizontal','color-on-dark',P.dark,'Full color / dark');
overview+=overviewTile(812,414,740,210,'horizontal','black',P.white,'One color');
overview+=overviewTile(48,648,485,310,'stacked','color',P.white,'Stacked');
overview+=overviewTile(557,648,485,310,'icon','color',P.white,'Icon only');
overview+=overviewTile(1066,648,486,310,'wordmark','white',P.dark,'Wordmark only');
['coral','green','violet','ink','white','dark'].forEach((key,i)=>{
  overview+=`<path fill="${P[key]}" d="${rect(48+i*254,990,234,61)}"/>${label(48+i*254,1080,P[key])}`;
});
await raster('Pibbl-Big-Bubbles-Kit-Overview.png',svg(1600,1120,overview,'Pibbl Tangram logo suite overview'),1600,1120);
await save('source/export-catalog.json',JSON.stringify(catalog,null,2)+'\n',{format:'json'});
console.warn(`Exported ${catalog.length} files. SVG masters use paths only; PNGs rendered directly from those masters.`);
