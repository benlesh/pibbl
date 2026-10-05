import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const { data, info } = await sharp(new URL('./character-v2.png',import.meta.url).pathname).raw().toBuffer({resolveWithObject:true});
const names=['run-0','run-1','run-2','run-3','run-4','run-5','jump','fall','standing','idle-1','skid-0','skid-1'];
const frames={};
for(let i=0;i<12;i++){
 const col=i%4,row=Math.floor(i/4);let l=info.width,t=info.height,r=0,b=0;
 for(let y=Math.floor(row*info.height/3);y<Math.floor((row+1)*info.height/3);y++)for(let x=Math.floor(col*info.width/4);x<Math.floor((col+1)*info.width/4);x++)if(data[(y*info.width+x)*4+3]>20){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 const w=r-l+1,h=b-t+1;
 frames[names[i]]={frame:{x:l,y:t,w,h},sourceSize:{w:260,h:310},spriteSourceSize:{x:Math.floor((260-w)/2),y:310-h},duration:i<6?80:300};
}
await writeFile(new URL('./character-v2.json',import.meta.url),JSON.stringify({frames,meta:{image:'character-v2.png',frameTags:[{name:'walk',from:0,to:5,direction:'forward'},{name:'idle',from:8,to:9,direction:'forward'}]}},null,2)+'\n');
console.warn(info.width,info.height,frames);
