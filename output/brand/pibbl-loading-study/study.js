import { choreography, beatName, finishChoreography, finalPoses, checkpoints, bounds } from './motion.mjs?v=8';
const response=await fetch('../pibbl-big-bubbles/source/identity.json');
if(!response.ok)throw new Error('The saved logo geometry could not be loaded.');
const identity=await response.json();
const ns='http://www.w3.org/2000/svg';
const stage=document.querySelector('#stage');
const $=id=>document.querySelector('#'+id);
const node=(name,attrs,parent=stage)=>{const n=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);parent.append(n);return n;};
const ease=t=>1-Math.pow(1-t,3);
const smooth=t=>t*t*(3-2*t);
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=t=>Math.max(0,Math.min(1,t));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const tint=(a,b,t)=>'rgb('+rgb(a).map((v,i)=>Math.round(mix(v,rgb(b)[i],t))).join(',')+')';
const floor=node('line',{x1:20,x2:620,y1:390,y2:390,stroke:'#b8c2b4','stroke-dasharray':'3 7',opacity:0});
const defs=node('defs',{});
const mask=node('mask',{id:'release-cutouts',maskUnits:'userSpaceOnUse',x:128,y:0,width:130,height:145},defs);
node('rect',{x:128,y:0,width:130,height:145,fill:'white'},mask);
const cutouts=identity.cutouts.map(c=>node('circle',{cx:c.x,cy:c.y,r:0,fill:'black'},mask));
const shapes=identity.icon.map(s=>{const outer=node('g',{'data-piece':s.id});node('path',{d:s.d,transform:s.id==='square'?'translate(0 -140)':s.id==='bowl'?'translate(-128 0)':'translate(0 0)',fill:identity.palette[s.color],...(s.id==='bowl'?{mask:'url(#release-cutouts)'}:{})},outer);return outer;});
const bubbleGroup=node('g',{transform:'translate(200 110)'});
const bubbles=identity.bubbles.map(b=>node('circle',{'data-bubble':b.id,cx:b.destination.x,cy:b.destination.y,r:0,fill:b.fill,opacity:0},bubbleGroup));
let state='loading',progress=0,elapsed=0,last=null,paused=false,requested=false,auto=false,turns=0,from=[],timing={};
const settings=()=>Object.fromEntries(['loop','settle','burst','stagger'].map(id=>[id,Number($(id).value)]));
const reduced=()=>$('still').checked;
const labels={loading:'Loading',forming:'Forming the P',bloom:'Releasing bubbles',complete:'Ready'};
function phase(next){state=next;stage.dataset.phase=state;$('phase').textContent=labels[state];document.querySelectorAll('[data-phase]').forEach(n=>n.classList.toggle('active',n.dataset.phase===state));$('ready').disabled=state!=='loading'||requested||reduced();}
function pose(i,p){return choreography(p)[i];}
function place(i,p){shapes[i].setAttribute('transform',`translate(${p.x} ${p.y}) scale(${p.sx??1} ${p.sy??1}) rotate(${p.rotation})`);}
const target=i=>finalPoses()[i];
function clearBloom(){cutouts.forEach(n=>n.setAttribute('r',0));bubbles.forEach(n=>{n.setAttribute('opacity',0);n.setAttribute('r',0);});}
function renderBloom(t){
  identity.bubbles.forEach((b,i)=>{
    const p=clamp((t-i*timing.stagger)/timing.burst),e=ease(p),d=b.destination;
    const source=b.source||{x:d.x-14,y:d.y+8,r:0};
    const x=p===1?d.x:mix(source.x,d.x,e),y=p===1?d.y:mix(source.y,d.y,e)-Math.sin(p*Math.PI)*(b.source?10:5);
    bubbles[i].setAttribute('cx',x);bubbles[i].setAttribute('cy',y);
    bubbles[i].setAttribute('r',b.source?mix(source.r,d.r,e):d.r*ease(p));
    bubbles[i].setAttribute('opacity',b.source?(p>0?1:0):smooth(clamp(p*2)));
    bubbles[i].setAttribute('fill',b.source?tint(identity.palette.violet,b.fill,smooth(p)):b.fill);
    if(i<cutouts.length)cutouts[i].setAttribute('r',identity.cutouts[i].r*e);
  });
}
function finish(){timing=settings();renderBloom(timing.burst+timing.stagger*8);shapes.forEach((_,i)=>place(i,target(i)));phase('complete');}
function restart(sequence=false){last=null;elapsed=0;progress=0;turns=0;requested=false;auto=sequence;paused=false;$('pause').textContent='Pause';$('pause').setAttribute('aria-pressed','false');clearBloom();phase('loading');if(reduced())finish();else shapes.forEach((_,i)=>place(i,pose(i,0)));}
function ready(){if(state!=='loading'||requested)return;requested=true;$('ready').disabled=true;$('phase').textContent='Finishing this encounter…';}
function frame(now){
  const dt=last===null?0:Math.min(now-last,50);last=now;
  if(!paused&&!reduced()){
    if(state==='loading'){
      const before=progress;progress+=dt/settings().loop;
      if(auto&&progress>=.9)ready();
      const boundary=requested?checkpoints.find(p=>p>before+1e-8):undefined;
      if(requested&&boundary!==undefined&&progress>=boundary){progress=boundary;from=choreography(progress);timing=settings();elapsed=0;phase('forming');}
      else if(progress>=1){turns++;progress%=1;}
      shapes.forEach((_,i)=>place(i,pose(i,progress)));
      $('beat').textContent=beatName(progress);
      $('scrub').value=Math.round(progress*1000);
    }else if(state==='forming'){
      elapsed+=dt;const t=clamp(elapsed/timing.settle);
      finishChoreography(from,t).forEach((p,i)=>place(i,p));
      if(t===1){elapsed=0;phase('bloom');}
    }else if(state==='bloom'){
      elapsed+=dt;renderBloom(elapsed);
      if(elapsed>=timing.burst+timing.stagger*8){renderBloom(timing.burst+timing.stagger*8);phase('complete');}
    }
  }
  requestAnimationFrame(frame);
}
for(const id of ['loop','settle','burst','stagger'])$(id).addEventListener('input',()=>{$(id+'-value').textContent=id==='stagger'?$(id).value+' ms':Number($(id).value)/1000+' s';});
$('scrub').addEventListener('input',()=>{if(state!=='loading')restart();paused=true;$('pause').textContent='Resume';$('pause').setAttribute('aria-pressed','true');progress=Number($('scrub').value)/1000;shapes.forEach((_,i)=>place(i,pose(i,progress)));$('beat').textContent=beatName(progress);});
$('floor').addEventListener('change',()=>floor.setAttribute('opacity',$('floor').checked?.55:0));
$('ready').addEventListener('click',()=>{ready();if(paused){paused=false;$('pause').textContent='Pause';$('pause').setAttribute('aria-pressed','false');}});
$('restart').addEventListener('click',()=>restart());
$('sequence').addEventListener('click',()=>restart(true));
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));});
$('still').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
$('still').addEventListener('change',()=>restart());
$('theme').addEventListener('click',()=>{const dark=$('preview').classList.toggle('dark');$('theme').textContent=dark?'Light background':'Dark background';$('theme').setAttribute('aria-pressed',String(dark));});
$('copy').addEventListener('click',async()=>{const text=JSON.stringify(settings(),null,2);try{await navigator.clipboard.writeText(text);$('copy-status').textContent='Copied — all timings are in milliseconds.';}catch{$('copy-status').textContent='Timing settings: '+JSON.stringify(settings());}});
restart();requestAnimationFrame(frame);
