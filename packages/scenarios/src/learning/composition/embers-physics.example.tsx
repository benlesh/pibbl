import { crc, Group, Rectangle, Circle, Text, embers, useVisibilityTransition, useSignal, useConst, type CRCController, type CRCVisibilityTransition } from '@crc/core';
import { PhysicsWorld2D, crcPhysicsWorld2D, staticBody2D, raycast2D } from '@crc/core/physics/2d';

function Chamber({ enabled, register }: {enabled:boolean;register:(handle:CRCVisibilityTransition)=>void}) {
  const world=crcPhysicsWorld2D();
  const effect=useConst(()=>embers({region:{x:180,y:35,width:440,height:110},seed:9,linger:1800,wind:65,physics:enabled?{
    gravity:[0,650],wind:[55,0],drag:2.5,restitution:.72,
    collide(from,to){
      // Cheap broad-phase rejection before querying the local world's colliders.
      if(Math.max(from[1],to[1])<210 && Math.min(from[0],to[0])>40 && Math.max(from[0],to[0])<760)return undefined;
      const dx=to[0]-from[0],dy=to[1]-from[1],distance=Math.hypot(dx,dy);
      if(distance<1e-8)return undefined;
      const hit=raycast2D(world,{origin:from,direction:[dx/distance,dy/distance],maxDistance:distance},{sensors:'exclude'});
      return hit?{fraction:Math.min(1,hit.distance/distance),normal:hit.normal}:undefined;
    },
  }:undefined}));
  const transition=useVisibilityTransition({enter:effect,duration:900});register(transition);
  return <Group>
    <Rectangle style={{x:25,y:5,width:750,height:370,cornerRadius:16,fill:'#101f2d'}} />
    <Group style={{transition:transition.binding}}>
      <Rectangle style={{x:180,y:35,width:440,height:110,cornerRadius:14,fill:'#32677b'}} />
      <Text style={{x:400,y:85,textAlign:'center',textBaseline:'middle',font:'600 30px sans-serif',fill:'#fff2d6'}}>FROM FIRE TO ASH</Text>
      <Text style={{x:400,y:116,textAlign:'center',font:'14px sans-serif',fill:'#badbdc'}}>Ordinary Canvas content. Physical fragments.</Text>
    </Group>
    <Circle physics={staticBody2D()} style={{cx:440,cy:260,radius:46,fill:'#305068',stroke:'#81acbc',strokeWidth:2}} />
    <Rectangle physics={staticBody2D()} style={{x:140,y:235,width:160,height:18,cornerRadius:3,fill:'#305068',stroke:'#81acbc',strokeWidth:2}} />
    <Rectangle physics={staticBody2D()} style={{x:40,y:350,width:720,height:15,fill:'#466273'}} />
    <Rectangle physics={staticBody2D()} style={{x:25,y:10,width:15,height:355,fill:'#263f51'}} />
    <Rectangle physics={staticBody2D()} style={{x:760,y:10,width:15,height:355,fill:'#263f51'}} />
    <Text style={{x:70,y:333,font:'12px monospace',fill:'#86a7b4'}}>LOCAL COLLIDERS · GRAVITY · WIND · BOUNCE</Text>
  </Group>;
}
function Demo(){
  const enabled=useSignal(true),status=useSignal('Burn it away, then watch the fragments bounce.');
  let handle:CRCVisibilityTransition|undefined;
  const run=async()=>{if(!handle)return;const current=handle;status.set(current.visible.get()?'Burning away…':'Materializing…');const result=await(current.visible.get()?current.hide():current.show());if(result.status==='finished')status.set('Settled. Toggle again, or compare with physics off.');};
  return <Group>
    <Rectangle style={{width:800,height:600,fill:'#091722'}} />
    <Text style={{x:36,y:42,font:'12px monospace',fill:'#77cabc'}}>EMBERS / LOCAL PHYSICS</Text>
    <Text style={{x:36,y:84,font:'600 30px sans-serif',fill:'#f4f3e9'}}>A little fire. A little gravity.</Text>
    <Text style={{x:36,y:113,font:'14px sans-serif',fill:'#96b4c1'}}>Fragments collide with the shelf, sphere, and floor. Click mid-flight to reverse.</Text>
    <Group style={{translateY:130}}><PhysicsWorld2D key={String(enabled.get())} space="local" gravity={[0,650]}>
      <Chamber enabled={enabled.get()} register={value=>{handle=value;}} />
    </PhysicsWorld2D></Group>
    <Rectangle style={{x:36,y:520,width:220,height:42,cornerRadius:7,fill:'#d48439',cursor:'pointer'}} onClick={()=>{void run();}} />
    <Text pointerEvents="none" style={{x:146,y:541,textAlign:'center',textBaseline:'middle',font:'600 14px sans-serif',fill:'#101e29'}}>BURN / MATERIALIZE</Text>
    <Rectangle style={{x:275,y:520,width:210,height:42,cornerRadius:7,fill:'#294454',cursor:'pointer'}} onClick={()=>{enabled.update(value=>!value);status.set('Fresh subject. Toggle to compare the motion.');}} />
    <Text pointerEvents="none" style={{x:380,y:541,textAlign:'center',textBaseline:'middle',font:'600 14px sans-serif',fill:'#e8f6f0'}}>PHYSICS: {enabled.get()?'ON':'OFF'}</Text>
    <Text style={{x:36,y:588,font:'13px monospace',fill:'#8be3c7'}}>{status.get()}</Text>
  </Group>;
}
export default function mount(canvas:HTMLCanvasElement):CRCController{return crc(canvas,<Demo />);}
