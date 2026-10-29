import {projection} from './collision.mjs';
export const FLOOR=390;
export const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const pose=(x,y,rotation=0,sx=1,sy=1)=>({x,y,rotation:rotation||0,sx,sy});
export function worldPoint(p,q){const r=p.rotation*Math.PI/180;return [p.x+(q[0]*Math.cos(r)-q[1]*Math.sin(r))*p.sx,p.y+(q[0]*Math.sin(r)+q[1]*Math.cos(r))*p.sy];}
export function bounds(i,r){const p=pose(0,0,r),x=projection(i,p,[1,0]),y=projection(i,p,[0,1]);return {left:x[0],right:x[1],top:y[0],bottom:y[1]};}
const ground=(i,x,r,lift=0)=>pose(x,FLOOR-bounds(i,r).bottom-lift,r);
const lerp=(a,b,t,hop=0)=>pose(mix(a.x,b.x,t),mix(a.y,b.y,t)-Math.sin(t*Math.PI)*hop,mix(a.rotation,b.rotation,t),mix(a.sx,b.sx,t),mix(a.sy,b.sy,t));
function stretch(i,p,sy,right=false){const sx=1/Math.sqrt(sy),b=bounds(i,p.rotation),cx=right==='left'?b.left:right?b.right:(b.left+b.right)/2;return pose(p.x+cx*(1-sx),p.y+b.bottom*(1-sy),p.rotation,sx,sy);}
const centers=[[128/3,140/3],[62,70],[42,70]];
export const massCenter=(i,p)=>worldPoint(p,centers[i]);
export function flight(i,a,b,u,height,extension=.12){
 u=clamp(u);const A=massCenter(i,a),B=massCenter(i,b),r=mix(a.rotation,b.rotation,u);
 const sy=u<.16?mix(a.sy,1+extension,smooth(u/.16)):mix(1+extension,b.sy,smooth((u-.16)/.24)),sx=1/Math.sqrt(sy);
 const q=pose(0,0,r,sx,sy),offset=massCenter(i,q);
 return pose(mix(A[0],B[0],u)-offset[0],mix(A[1],B[1],u)-4*height*u*(1-u)-offset[1],r,sx,sy);
}
function turnAtCenter(i,p,angle){const center=massCenter(i,p),q=pose(0,0,angle,p.sx,p.sy),offset=massCenter(i,q);return pose(center[0]-offset[0],center[1]-offset[1],angle,p.sx,p.sy);}
function jump(i,a,b,t,height=120){
 const compression=i===0?.06+Math.min(height,170)/170*.10:.10,extension=i===0?.04+Math.min(height,170)/170*.12:.12;
 const launch=stretch(i,a,1-compression,i===0?'left':true);
 if(t<.16)return stretch(i,a,1-compression*Math.sin(t/.16*Math.PI/2),i===0?'left':true);
 return flight(i,launch,b,(t-.16)/.84,height,extension);
}
const atPivot=(q,local,r)=>{const p=pose(0,0,r),[x,y]=worldPoint(p,local);return pose(q[0]-x,q[1]-y,r);};
const dock=v=>{const [x,y]=worldPoint(v,[-124,0]);return pose(x,y,v.rotation,v.sx,v.sy);};
const offsets=[0];for(let n=1;n<=100;n++)offsets.push(offsets[n-1]+bounds(2,90-(n-.5)*.25).bottom*(-.25*Math.PI/180));
const homeRoll=[0];for(let n=1;n<=360;n++)homeRoll.push(homeRoll[n-1]+bounds(2,(n-.5)*.25).bottom*.25*Math.PI/180);
const rollHome=r=>{const q=clamp(r/90)*360,k=Math.floor(q);return ground(2,329+mix(homeRoll[k],homeRoll[Math.min(360,k+1)],q-k),r);};
const homeVioletX=329+homeRoll[360];
const ride=t=>{const r=mix(90,65,smooth(t)),q=(90-r)*4,k=Math.floor(q);return ground(2,homeVioletX+mix(offsets[k],offsets[Math.min(100,k+1)],q-k),r);};
const angle=Math.atan2(-140,128)*180/Math.PI;
const backAngle=angle+180;
const ramp=atPivot([207.6,362],[124,0],backAngle);
const flat=pose(182,266,90);
const initial=()=>[ground(0,173,-180),ground(1,235,0),ground(2,homeVioletX,90)];
const bridge=()=>[ground(0,198,-180),pose(165,250,-90),ground(2,290,0)];
const pyramid=()=>[pose(343,250,-180),ground(1,205,0),ground(2,329,0)];
function pushOff(v,sy){let g=stretch(1,dock(v),sy,true);const a=v.rotation*Math.PI/180,n=[Math.cos(a),Math.sin(a)],d=projection(1,g,n)[1]-v.x*n[0]-v.y*n[1];g.x-=d*n[0];g.y-=d*n[1];return g;}
const violetRest=()=>ground(2,ride(1).x-35,65);
const watchingViolet=()=>ground(2,violetRest().x+18,65);
const hoist=t=>{const v=ride(1),p=.32+.07*t;if(p<.348)return stretch(2,v,1-.09*Math.sin((p-.32)/.028*Math.PI/2));return flight(2,stretch(2,v,.91),violetRest(),(p-.348)/.102,80,.08);};
export const checkpoints=[.08,.18,.25,.32,.39,.45,.51,.56,.68,.72,.80,.91,.95].map(t=>t/1.1).concat(1);
export function choreography(progress){
 const cycle=((progress%1)+1)%1,p=cycle*1.1;let [c,g,v]=initial();
 if(p<.08){const t=p/.08;v=ground(2,homeVioletX,90+Math.sin(t*Math.PI*2)*3*Math.sin(t*Math.PI));g=ground(1,235,-Math.sin(t*Math.PI)*3);}
 else if(p<.18){const t=(p-.08)/.1;g=jump(1,g,dock(v),t,180);}
 else if(p<.25){const t=(p-.18)/.07;g=dock(v);c=jump(0,c,ground(0,310,-180),t,200);}
 else if(p<.32){const t=(p-.25)/.07;v=ride(t);g=dock(v);c=ground(0,310,-180);}
 else if(p<.39){v=hoist((p-.32)/.07);g=p<.37?dock(v):pushOff(v,1-.10*smooth((p-.37)/.02));c=ground(0,310,-180);}
 else if(p<.45){
  const t=(p-.39)/.06;v=hoist((p-.32)/.07);c=ground(0,310,-180);
  g=flight(1,pushOff(hoist(1),.90),ramp,t,100,.12);
 }
 else if(p<.51){const t=smooth((p-.45)/.06);c=ground(0,310,-180);v=violetRest();g=atPivot([mix(207.6,182,t),mix(362,390,t)],[124,0],backAngle);}
 else if(p<.56){const t=smooth((p-.51)/.05);c=ground(0,310,-180);v=violetRest();g=atPivot([182,390],[124,0],mix(backAngle,90,t));}
 else if(p<.68){
  c=ground(0,310+12*smooth((p-.56)/.015),-180);g=flat;v=ground(2,violetRest().x+18*smooth((p-.56)/.025),65);
  const giggle=(t)=>t<=0||t>=1?0:Math.sin(t*Math.PI*3)**2*(1-.35*t);
  v=stretch(2,v,1-.065*giggle((p-.56)/.055),'left');
  g=stretch(1,g,1-.045*giggle((p-.59)/.055),true);
  c=stretch(0,c,1-.035*giggle((p-.625)/.055),'left');
 }
 else if(p<.72){c=ground(0,322,-180);g=flat;v=watchingViolet();}
 else if(p<.80){
  const t=(p-.72)/.08;c=ground(0,322,-180);g=flat;v=watchingViolet();
  const cuts=[0,.2142,.5414,1],step=t<cuts[1]?0:t<cuts[2]?1:2,local=(t-cuts[step])/(cuts[step+1]-cuts[step]);c=jump(0,c,c,local,[12,28,55][step]);
 }
 else if(p<.91){
  const t=(p-.80)/.11,goal=pyramid();c=jump(0,ground(0,322,-180),goal[0],t,170);
  // A small airborne flip, returning point-up before the catch.
  if(t>.16)c=turnAtCenter(0,c,c.rotation+Math.sin((t-.16)/.84*Math.PI)*26);
  const u=smooth((t-.38)/.4),r=mix(90,0,u),right=mix(182,329,u);
  g=ground(1,right-bounds(1,r).right,r);const vr=mix(65,0,u),left=mix(watchingViolet().x+bounds(2,65).left,329,u);v=ground(2,left-bounds(2,vr).left,vr);
  const effort=Math.sin(u*Math.PI*2)**2*.05;g=stretch(1,g,1-effort,true);v=stretch(2,v,1-effort,'left');
 }
 else if(p<.95){[c,g,v]=pyramid();const t=(p-.91)/.04,squash=.025*Math.sin(t*Math.PI*2)**2*(1-t);g=stretch(1,g,1-squash,true);v=stretch(2,v,1-squash,'left');c.y+=140*squash;}
 else{
  const t=(cycle-.95/1.1)/(1-.95/1.1),a=initial(),b=pyramid();
  c=jump(0,b[0],a[0],clamp(t/.80),115);
  if(t>.80)c=stretch(0,c,1-.035*Math.sin(clamp((t-.80)/.12)*Math.PI)**2,'left');
  const r=90*smooth((t-.18)/.66);v=rollHome(r);
  const desire=mix(329,359,smooth((t-.25)/.45)),right=Math.min(desire,projection(2,v,[1,0])[0]);
  g=ground(1,right-124,0);
  // An easy weight shift, followed by a short shared rest before the next invitation.
  const effort=.025*Math.sin(clamp((t-.25)/.45)*Math.PI)**2;g=stretch(1,g,1-effort,true);
 }
 return [c,g,v];
}
export const finalPoses=()=>[pose(200,110),pose(200,250),pose(328,110)];
function finishClear(from,t){
 t=clamp(t);const final=finalPoses();if(t===1)return final;
 const [c0,g0,v0]=from,clear=pose(g0.x,160-bounds(1,g0.rotation).bottom,g0.rotation),park=pose(200,20),left=ground(0,35,-90),right=ground(2,470,0);
 if(t<.15)return [c0,lerp(g0,clear,smooth(t/.15)),v0];
 if(t<.30){const u=smooth((t-.15)/.15);return [ground(0,mix(c0.x,left.x,u),mix(c0.rotation,left.rotation,u)),lerp(clear,park,u),ground(2,mix(v0.x,right.x,u),mix(v0.rotation,right.rotation,u))];}
 if(t<.43)return [left,lerp(park,final[1],smooth((t-.30)/.13)),right];
 if(t<.57)return [jump(0,left,pose(35,145,-90),(t-.43)/.14,0),final[1],right];
 if(t<.69)return [lerp(pose(35,145,-90),pose(200,40),smooth((t-.57)/.12),60),final[1],right];
 if(t<.77)return [lerp(pose(200,40),final[0],smooth((t-.69)/.08)),final[1],right];
 if(t<.88)return [final[0],final[1],jump(2,right,pose(470,110),(t-.77)/.11,0)];
 return [final[0],final[1],lerp(pose(470,110),final[2],smooth((t-.88)/.12))];
}
export function finishChoreography(from,t){
 const c=from[0],g=from[1],v=from[2];
 const onTop=projection(0,c,[0,1])[1]<=projection(1,g,[0,1])[0]+1e-7;
 if(!onTop)return finishClear(from,t);
 const high=pose(c.x,160-bounds(0,c.rotation).bottom,c.rotation),leftHigh=pose(35,160,-90),left=ground(0,35,-90);
 if(t<.1)return [lerp(c,high,smooth(t/.1)),g,v];
 if(t<.22)return [lerp(high,leftHigh,smooth((t-.1)/.12)),g,v];
 if(t<.32)return [lerp(leftHigh,left,smooth((t-.22)/.1)),g,v];
 return finishClear([left,g,v],(t-.32)/.68);
}
export function beatName(p){p*=1.1;return p<.08?'An invitation':p<.18?'Crouch → leap → land':p<.25?'Coral gets the ramp ready':p<.32?'A connected ride':p<.39?'Violet hoists green':p<.45?'Release above the ramp':p<.51?'Slide to the edge':p<.56?'Bonk. Fall flat.':p<.59?'Violet gets the giggles':p<.625?'Green joins in':p<.68?'Now coral is laughing too':p<.72?'Let the laughter settle':p<.80?'Hop… hop… HOP!':p<.91?'Scoot underneath — catch coral!':p<.95?'Our little pyramid':'A gentle dismount and a breath';}
