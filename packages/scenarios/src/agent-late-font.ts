import { crc, createElement, signal } from '@crc/core';
import { AgentLateFontScene } from './agent-late-font.example';
const fontUrl = new URL('./assets/agent-space-grotesk.woff2', import.meta.url).href;
import type { ScenarioDefinition } from './types';
type Sample = { evaluations: number; fontLoadedAtEvaluation: boolean | null; width: number | null; fontSize: number | null; requested: number | null; completed: number | null; render: number | null; measuredWidth: number };
export interface AgentLateFontState {
 status: 'pending' | 'ready' | 'error' | 'disposed';
 action: string;
 revision: number;
 font: FontFaceLoadStatus;
 sample: Sample | null;
 before: Sample | null;
 diagnosis: string;
 observationWindow: 'two-host-frames-not-future-guarantee' | 'responsive-allocation-and-render-with-timeout';
}
let nextFamily = 0;
export const agentLateFontScenario: ScenarioDefinition<AgentLateFontState> = {
 id:'agent-late-font', sourceId:'agent-late-font-example', actionIds:['load-font','repaint','narrow','wide','reset'],
 async mount({canvas,referenceHost,onStateChange}) {
  if(!canvas.getContext('2d'))throw new Error('Font fixture requires Canvas 2D.');
  const source=import.meta.env.DEV&&import.meta.env.MODE!=='built'?await import('../../../tooling/agent-verification/targeting'):null;
  const family=`CRCLateFont${++nextFamily}`;const revision=signal(0);
  let face=new FontFace(family,`url("${fontUrl}")`);
  let disposed=false,inFlight:Promise<void>|null=null,cancelWait:(()=>void)|null=null;
  let evaluations=0, evaluated:{width:number;fontSize:number}|null=null,fontLoadedAtEvaluation:boolean|null=null;
  let controller:ReturnType<typeof crc>|undefined,inspector:ReturnType<NonNullable<typeof source>['createTargetingInspector']>|undefined;
  const originalWidth=canvas.style.width;
  const measureContext=document.createElement('canvas').getContext('2d')!;
  const evidence=document.createElement('pre');evidence.dataset.testid='agent-late-font-evidence';evidence.style.cssText='max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere';referenceHost?.append(evidence);
  let state:AgentLateFontState={status:'pending',action:'mount',revision:0,font:'unloaded',sample:null,before:null,diagnosis:'pending',observationWindow:'two-host-frames-not-future-guarantee'};
  const publish=()=>{evidence.textContent=JSON.stringify({schema:'crc-late-font-fixture/1',provenance:'source-development-no-build-attestation',state});onStateChange?.(structuredClone(state));};
  const sample=():Sample=>{
   const generation=inspector?.snapshot().generation;
   measureContext.font=`${evaluated?.fontSize??24}px "${family}", monospace`;
   return {evaluations,fontLoadedAtEvaluation,width:evaluated?.width??null,fontSize:evaluated?.fontSize??null,requested:generation?.requested??null,completed:generation?.completed??null,render:generation?.render??null,measuredWidth:measureContext.measureText('MMMM').width};
  };
  const bounded=<T,>(promise:Promise<T>,cleanup=()=>undefined)=>new Promise<T>((resolve,reject)=>{
   let done=false;
   const finish=(error:Error|null,value?:T)=>{if(done)return;done=true;clearTimeout(timer);cleanup();cancelWait=null;if(error)reject(error);else resolve(value!);};
   const timer=setTimeout(()=>finish(new Error('Font observation timed out.')),5000);
   cancelWait=()=>finish(new Error('Font fixture disposed.'));
   promise.then(value=>finish(null,value),error=>finish(error instanceof Error?error:new Error('Font load failed.')));
  });
  const frames=()=>{let frame=0;const promise=new Promise<void>(resolve=>{frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>resolve());});});return bounded(promise,()=>{cancelAnimationFrame(frame);});};
  function perform(action:string):Promise<void>{
   if(disposed)return Promise.reject(new Error('Font fixture disposed.'));
   if(inFlight)return Promise.reject(new Error('Font action already running.'));
   if(!['load-font','repaint','narrow','wide','reset'].includes(action))return Promise.reject(new Error('Unknown font action.'));
   const before=sample();state={...state,status:'pending',action,revision:state.revision+1,before,sample:null,diagnosis:'pending',observationWindow:action==='narrow'||action==='wide'?'responsive-allocation-and-render-with-timeout':'two-host-frames-not-future-guarantee',font:action==='load-font'?'loading':face.status};
   const operation=Promise.resolve().then(async()=>{
    if(disposed)throw new Error('Font fixture disposed.');publish();if(disposed)throw new Error('Font fixture disposed.');
    if(action==='load-font'){const loaded=await bounded(face.load());if(disposed)throw new Error('Font fixture disposed.');document.fonts.add(loaded);}
    else if(action==='repaint')revision.update(value=>value+1);
    else if(action==='narrow'||action==='wide')canvas.style.width=action==='narrow'?'200px':'400px';
    else{document.fonts.delete(face);face=new FontFace(family,`url("${fontUrl}")`);canvas.style.width=originalWidth;revision.update(value=>value+1);}
    await frames();if(disposed)throw new Error('Font fixture disposed.');
    if(action==='narrow'||action==='wide'){
     const expectedWidth=action==='narrow'?200:400;
     let frame=0;
     const ready=new Promise<void>(resolve=>{
      const check=()=>{const observed=sample();if(observed.width===expectedWidth&&(observed.requested===null||observed.completed===observed.requested)){resolve();return;}frame=requestAnimationFrame(check);};
      check();
     });
     await bounded(ready,()=>{cancelAnimationFrame(frame);});
    }
    const after=sample();const rendered=after.evaluations>before.evaluations;
    const requested=before.requested!==null&&after.requested!==null&&after.requested>before.requested;
    const diagnosis=after.requested===null?'scheduler-observation-unavailable':action==='load-font'&&!rendered&&!requested?'font-ready-without-render':action==='repaint'&&rendered&&requested?'application-requested-render':(action==='narrow'||action==='wide')&&rendered&&requested?'resize-requested-render':'observed-state';
    state={...state,status:'ready',font:face.status,sample:after,diagnosis};publish();
   }).catch(error=>{if(!disposed){state={...state,status:'error',font:face.status,sample:null,diagnosis:'observation-failed'};evidence.textContent=JSON.stringify({schema:'crc-late-font-fixture/1',provenance:'source-development-no-build-attestation',state});}throw error;}).finally(()=>{inFlight=null;});
   inFlight=operation;return operation;
  }
  async function dispose(){if(disposed)return;disposed=true;cancelWait?.();controller?.dispose();inspector?.dispose();document.fonts.delete(face);canvas.style.width=originalWidth;evidence.remove();state={...state,status:'disposed',sample:null,diagnosis:'disposed'};}
  try{controller=crc(canvas,createElement(AgentLateFontScene,{revision,family,onEvaluation(value:{width:number;fontSize:number}){evaluated=value;evaluations++;fontLoadedAtEvaluation=document.fonts.has(face)&&face.status==='loaded';}}),{viewport:'responsive',pixelRatio:1});inspector=source?.createTargetingInspector(canvas);await perform('reset');}
  catch(error){await dispose();throw error;}
  return {getState:()=>structuredClone(state),perform,reset:()=>perform('reset'),settled:async()=>{if(disposed)throw new Error('Font fixture disposed.');await inFlight;},dispose};
 },
 formatState:state=>[{label:'Font readiness',value:state.font},{label:'Update diagnosis',value:state.diagnosis},{label:'Evaluations',value:String(state.sample?.evaluations??'unavailable')},{label:'Render requested / completed',value:`${state.sample?.requested??'unavailable'} / ${state.sample?.completed??'unavailable'}`}],
};
