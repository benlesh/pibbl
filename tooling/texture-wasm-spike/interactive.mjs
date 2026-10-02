import {crc,createElement,defineRenderLayer} from '../../packages/core/src/index.ts';
import {installSchedulerTraceCollectorForTest} from '../../packages/core/src/lib/scheduler/testing.ts';

const summary = values => {
  const sorted=[...values].sort((a,b)=>a-b), n=sorted.length;
  return {count:n,median:n?sorted[Math.floor(n*.5)]:null,p95:n?sorted[Math.min(n-1,Math.floor(n*.95))]:null,samples:[...values]};
};
const historyKeys=['handler','marshal','brush','inputToFrame','dispatchDelay','handlerToFrame','frames','frameIntervals'];
const metrics = () => ({events:[],ready:[],handler:[],marshal:[],brush:[],inputToFrame:[],dispatchDelay:[],handlerToFrame:[],frames:[],frameIntervals:[],routed:0,stamps:0,dropped:0,applied:0,completed:0,wasmCalls:0,clockErrors:0,errors:0});

// Same mapping, interpolation bounds and capture policy as ReactionDiffusion.
// Both variants write four f64s per stamp; WASM's queue is already in its memory.
function route(r,event,width,height,settings,m) {
  const original=event.originalEvent;
  if(event.type==='pointerup'||event.type==='pointercancel') {
    if(r.pointer?.id===original.pointerId) {r.pointer.release();r.pointer=undefined;}
    return;
  }
  if(width<=0||height<=0)return;
  const x=event.point.x/width*r.simulation.width,y=event.point.y/height*r.simulation.height;
  if(event.type==='pointerdown') {
    if(r.pointer||original.button!==0||original.isPrimary===false)return;
    event.setPointerCapture(original.pointerId);
    r.pointer={id:original.pointerId,x,y,release:()=>event.releasePointerCapture(original.pointerId)};
  } else if(event.type!=='pointermove'||r.pointer?.id!==original.pointerId)return;
  const started=performance.now(), {radius,strength}=settings;
  const previous=r.pointer, distance=Math.hypot(x-previous.x,y-previous.y);
  const count=Math.min(4096,Math.max(1,Math.ceil(distance/Math.max(.5,radius*.3))));
  const before=r.count, writeStart=performance.now();
  for(let i=1;i<=count;i++) {
    const px=previous.x+(x-previous.x)*i/count,py=previous.y+(y-previous.y)*i/count;
    if(px<0||py<0||px>=r.simulation.width||py>=r.simulation.height)continue;
    if(r.count===8192) {m.dropped++;continue;}
    const offset=r.count++*4;
    r.stamps[offset]=px;r.stamps[offset+1]=py;r.stamps[offset+2]=radius;r.stamps[offset+3]=strength;
  }
  m.marshal.push(performance.now()-writeStart);
  previous.x=x;previous.y=y;
  m.routed++;m.stamps+=r.count-before;
  if(r.count>before) {
    const timestamp=original.timeStamp,delay=started-timestamp;
    if(!Number.isFinite(delay)||delay< -1||delay>10000)m.clockErrors++;
    m.dispatchDelay.push(delay);
    m.events.push({timestamp,started});
    r.invalidate();
  }
  m.handler.push(performance.now()-started);
}

export function installInteractive(makeResources) {
  let active, refresh;
  const api={
    start({mode='wasm-direct',width=256,height=160,steps=8,paused=false,radius=6,strength=.8,quiet=false}={}) {
      api.stop();
      const host=document.querySelector('#previews');host.replaceChildren();
      const canvas=document.createElement('canvas');canvas.id='paint-canvas';canvas.width=832;canvas.height=400;
      canvas.style.touchAction='none';canvas.style.width='832px';canvas.style.maxWidth='100%';
      host.append(canvas);
      let m=metrics(),resource,frameStart=0,lastFrame;
      const settings={paused,radius,strength};
      const restoreTrace=installSchedulerTraceCollectorForTest(record=>{
        if(record.kind!=='scheduler-phase')return;
        if(record.phase==='begin') {
          frameStart=performance.now();
          if(lastFrame!==undefined)m.frameIntervals.push(frameStart-lastFrame);
          lastFrame=frameStart;
        }
        if(record.phase==='idle') {
          const now=performance.now();m.frames.push(now-frameStart);
          m.errors+=record.errorCount??0;
          for(const event of m.ready) {
            m.inputToFrame.push(now-event.timestamp);
            m.handlerToFrame.push(now-event.started);
            m.completed++;
          }
          m.ready.length=0;
          if(!quiet)for(const key of historyKeys)if(m[key].length>600)m[key].splice(0,m[key].length-600);
        }
      });
      const Layer=defineRenderLayer({
        create(context) {
          resource=makeResources(mode,width,height);
          Object.assign(resource,{target:{},count:0,stamps:resource.simulation.stamps??new Float64Array(8192*4),invalidate:context.invalidate});
          return resource;
        },
        render(r,frame,context) {
          r.invalidate=frame.invalidate;
          if(r.count) {
            const start=performance.now();
            if(mode.startsWith('wasm')) {r.simulation.paintBatch(r.count);m.wasmCalls++;}
            else for(let i=0;i<r.count;i++) {
              const p=i*4;r.simulation.paint(r.stamps[p],r.stamps[p+1],r.stamps[p+2],r.stamps[p+3]);
            }
            m.brush.push(performance.now()-start);m.applied+=r.count;r.count=0;
            m.ready.push(...m.events);m.events.length=0;
          }
          if(!settings.paused)r.simulation.advance(steps);
          r.update();
          const out=context.canvas.getContext('2d');
          out.clearRect(0,0,context.size.backingWidth,context.size.backingHeight);
          out.drawImage(r.surface,0,0,context.size.backingWidth,context.size.backingHeight);
          if(!settings.paused)frame.invalidate();
        },
        interaction:{
          settle(r,_props,size) {
            return {targets:[{target:r.target,cursor:'crosshair'}],hitTest:()=>({kind:'target',target:r.target}),onInput:event=>route(r,event,size.width,size.height,settings,m)};
          },
        },
        dispose(r) {r.pointer?.release();r.pointer=undefined;r.count=0;r.dispose();},
      });
      let controller;
      try {controller=crc(canvas,createElement(Layer,{style:{width:832,height:400}}),{pixelRatio:1});}
      catch(error) {restoreTrace();throw error;}
      active={controller,restoreTrace,canvas,settings,get resource(){return resource;},reset(){m=metrics();lastFrame=undefined;},get metrics(){return m;},mode,width,height,steps};
      document.querySelector('#status').textContent=`${mode==='current-js'?'JavaScript':'WASM'} · ${width}×${height} · ${steps} steps/frame. Drag to paint; switch backend to compare. Only one runs at a time.`;
      if(!quiet)refresh=setInterval(()=>{
        const report=api.report(),lat=report.inputToFrame;
        document.querySelector('#interactive-metrics').textContent=`${report.routed} pointer samples · ${report.applied} stamps · ${report.dropped} dropped\nRecent input → CRC frame complete: ${lat.count?`${lat.median.toFixed(2)} ms median / ${lat.p95.toFixed(2)} ms p95`:'drag to measure'}\nBrush queue write: ${report.marshal.median?.toFixed(3)??'—'} ms median · CRC frame: ${report.frames.median?.toFixed(2)??'—'} ms median`;
      },250);
    },
    stop() {
      clearInterval(refresh);
      if(active) {active.controller.dispose();active.restoreTrace();active=undefined;}
    },
    resetMetrics() {active.reset();},
    pause(value) {active.settings.paused=value;active.resource?.invalidate();},
    setRadius(value) {active.settings.radius=value;},
    report() {
      if(!active)return undefined;
      const m=active.metrics;
      return {mode:active.mode,width:active.width,height:active.height,steps:active.steps,routed:m.routed,stamps:m.stamps,dropped:m.dropped,applied:m.applied,completed:m.completed,wasmCalls:m.wasmCalls,pending:active.resource?.count??0,captured:!!active.resource?.pointer,clockErrors:m.clockErrors,errors:m.errors,
        handler:summary(m.handler),marshal:summary(m.marshal),brush:summary(m.brush),dispatchDelay:summary(m.dispatchDelay),inputToFrame:summary(m.inputToFrame),handlerToFrame:summary(m.handlerToFrame),frames:summary(m.frames),frameIntervals:summary(m.frameIntervals)};
    },
    // Test-only snapshots, never used in timing or production exports.
    snapshot() {return {a:[...active.resource.simulation.a],b:[...active.resource.simulation.b],pixels:[...active.canvas.getContext('2d').getImageData(0,0,832,400).data]};},
  };
  window.interactive=api;
  return api;
}
