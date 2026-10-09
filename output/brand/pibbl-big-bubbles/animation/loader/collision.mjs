const vertices=[[[0,0],[128,0],[0,140]],[[0,0],[124,0],[124,140],[0,140]],[[0,0],[20,0],[0,140]]];
const curves=[[[20,0],[64,0],[100,31],[100,70]],[[100,70],[100,109],[64,140],[20,140]]];
const dot=(p,n)=>p[0]*n[0]+p[1]*n[1];
const cubic=(q,t)=>{const u=1-t;return [0,1].map(k=>u*u*u*q[0][k]+3*u*u*t*q[1][k]+3*u*t*t*q[2][k]+t*t*t*q[3][k]);};
const localPoint=(p,q)=>{const a=p.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return [p.x+(q[0]*c-q[1]*s)*(p.sx??1),p.y+(q[0]*s+q[1]*c)*(p.sy??1)];};
export function projection(i,p,n){
 const a=p.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),nx=n[0]*(p.sx??1),ny=n[1]*(p.sy??1),axis=[nx*c+ny*s,-nx*s+ny*c];
 const values=vertices[i].map(q=>dot(q,axis));
 if(i===2)for(const q of curves){const v=q.map(pt=>dot(pt,axis));const A=-v[0]+3*v[1]-3*v[2]+v[3],B=2*(v[0]-2*v[1]+v[2]),C=v[1]-v[0];let roots=[];
  if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots=[-C/B];}else{const d=B*B-4*A*C;if(d>=0)roots=[(-B+Math.sqrt(d))/(2*A),(-B-Math.sqrt(d))/(2*A)];}
  values.push(v[3]);for(const t of roots)if(t>0&&t<1)values.push(dot(cubic(q,t),axis));
 }
 const offset=p.x*n[0]+p.y*n[1];return [Math.min(...values)+offset,Math.max(...values)+offset];
}
const edges=[[[0,0],[128,0],[0,140]],[[0,0],[124,0],[124,140],[0,140]],[[0,0],[20,0],...curves.flatMap(q=>Array.from({length:33},(_,j)=>cubic(q,j/32))),[0,140]]];
function axes(i,p){const points=edges[i].map(q=>localPoint(p,q)),out=[];for(let j=0;j<points.length;j++){const a=points[j],b=points[(j+1)%points.length],x=b[0]-a[0],y=b[1]-a[1],len=Math.hypot(x,y);if(len>1e-8)out.push([-y/len,x/len]);}return out;}
export function overlaps(i,a,j,b){
 for(const n of [...axes(i,a),...axes(j,b)]){const A=projection(i,a,n),B=projection(j,b,n);if(Math.min(A[1],B[1])-Math.max(A[0],B[0])<=1e-7)return false;}
 return true;
}
