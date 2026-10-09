import {choreography,finishChoreography,finalPoses,checkpoints} from './motion.mjs';
import {identity} from './identity.mjs';
export const timings=Object.freeze({loop:11000,settle:1600,burst:450,stagger:30});
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>1-(1-t)**3, smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function bloom(time){return identity.bubbles.map((b,i)=>{const p=clamp((time-i*timings.stagger)/timings.burst),e=ease(p),d=b.destination,s=b.source||{x:d.x-14,y:d.y+8,r:0};return {x:p===1?d.x:mix(s.x,d.x,e),y:p===1?d.y:mix(s.y,d.y,e)-Math.sin(p*Math.PI)*(b.source?10:5),r:b.source?mix(s.r,d.r,e):d.r*e,opacity:b.source?(p>0?1:0):smooth(clamp(p*2)),fill:b.source?'rgb('+rgb(identity.palette.violet).map((v,j)=>Math.round(mix(v,rgb(b.fill)[j],smooth(p)))).join(',')+')':b.fill,cutout:i<5?identity.cutouts[i].r*e:0};});}
export class Playback {
 constructor(){this.restart();}
 restart(){this.phase='loading';this.time=0;this.elapsed=0;this.requested=false;this.paused=false;this.from=[];}
 showStill(){this.phase='complete';this.elapsed=690;}
 pause(){this.paused=true;}
 resume(){this.paused=false;}
 complete(immediate=false){this.requested=true;if(immediate){this.phase='complete';this.elapsed=690;return;}if(this.phase==='loading'){this.requested=true;this.resume();}}
 advance(dt){if(this.paused||this.phase==='complete')return;if(!Number.isFinite(dt)||dt<0)throw new RangeError('Elapsed milliseconds must be finite and nonnegative.');
 // Split at boundaries so deterministic exports and browser playback agree.
 while(dt>0&&this.phase!=='complete'){
 if(this.phase==='loading'){const p=this.time/timings.loop,b=this.requested?checkpoints.find(v=>v>p+1e-8):1,end=(b??1)*timings.loop,step=Math.min(dt,end-this.time);this.time+=step;dt-=step;
 if(this.time>=end-1e-7){if(this.requested){this.from=choreography(end/timings.loop);this.phase='forming';this.elapsed=0;}else this.time=0;}
 }else {const end=this.phase==='forming'?timings.settle:690,step=Math.min(dt,end-this.elapsed);this.elapsed+=step;dt-=step;if(this.elapsed>=end){if(this.phase==='forming'){this.phase='bloom';this.elapsed=0;}else this.phase='complete';}}
 }}
 frame(){return {phase:this.phase,poses:this.phase==='loading'?choreography(this.time/timings.loop):this.phase==='forming'?finishChoreography(this.from,clamp(this.elapsed/timings.settle)):finalPoses(),bubbles:bloom(this.phase==='bloom'?this.elapsed:this.phase==='complete'?690:0)};}
}
