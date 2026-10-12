import { userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { pibbl, HtmlBox, Group, Clip, Layer, Absolute, PathGeometry, signal, createElement, definePrimitive } from '@pibbl/core';
import { blur } from '@pibbl/core/filters';
import { clearSharedState } from '../src/lib/global-state.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import mountLesson from '../../scenarios/src/learning/composition/html-box.example.js';

afterEach(() => { clearSharedState(); document.body.replaceChildren(); });
function surface() {
  const wrapper = document.createElement('div'); wrapper.style.cssText = 'position:relative;width:400px;height:300px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width=400;canvas.height=300;canvas.style.cssText='display:block;width:100%;height:100%';
  const overlay=document.createElement('div');overlay.style.cssText='position:absolute;inset:0;pointer-events:none';wrapper.append(canvas,overlay);document.body.append(wrapper);
  return {canvas,overlay,wrapper};
}
function path(x=0,y=0,w=100,h=100) { const p=new PathGeometry();p.rect(x,y,w,h);return p; }
const emptyMount = (element: HTMLDivElement) => { element.style.background='red';return ()=>{}; };

describe('HtmlBox geometry, composition and ownership', () => {
  it('reprojects nested clean Layers without remounting or updating content', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();
    let mounts=0,updates=0,aborts=0;
    const mount=(element:HTMLDivElement,_data:number,signal:AbortSignal)=>{mounts++;const input=document.createElement('input');element.append(input);signal.addEventListener('abort',()=>aborts++);return ()=>{updates++;};};
    const inside=<Group style={{translateX:11,translateY:13}}><Layer style={{width:200,height:180}}><Group style={{translateX:7,translateY:9}}><HtmlBox mount={mount} data={0} style={{width:80,height:70}} /></Group></Layer></Group>;
    const scene=(x:number)=><Group style={{translateX:x,translateY:20}}><Layer style={{width:250,height:240}}>{inside}</Layer></Group>;
    const controller=pibbl(canvas,scene(30),{htmlOverlay:overlay,pixelRatio:2});
    try{driver.flush(1);const input=overlay.querySelector('input')!;input.value='preserved';
      expect(new DOMMatrix(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!.style.transform).e).toBeCloseTo(48);
      pibbl(canvas,scene(90));driver.flush(2);
      const matrix=new DOMMatrix(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!.style.transform);
      expect(matrix.e).toBeCloseTo(108);expect(matrix.f).toBeCloseTo(42);expect(mounts).toBe(1);expect(updates).toBe(0);expect(overlay.querySelector('input')).toBe(input);expect(input.value).toBe('preserved');
      controller.dispose();expect(aborts).toBe(1);expect(overlay.childNodes.length).toBe(0);
    }finally{controller.dispose();restore();}
  });

  it('intersects transformed clips and refreshes mutable geometry only on rerender', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();
    const a=path(0,0,100,50),b=path(0,0,50,100);
    const scene=()=> <Group style={{translateX:20,translateY:30}}><Clip style={{d:a}}><Group style={{translateX:10}}><Clip style={{d:b}}><HtmlBox mount={emptyMount} data={0} style={{width:100,height:100}} /></Clip></Group></Clip></Group>;
    const controller=pibbl(canvas,scene(),{htmlOverlay:overlay});
    const hit=(x:number,y:number)=>{const rect=canvas.getBoundingClientRect();return document.elementFromPoint(rect.left+x,rect.top+y)?.closest('[data-pibbl-html-box]')!==null;};
    try{driver.flush(1);expect(hit(40,40)).toBe(true);expect(hit(90,40)).toBe(false);expect(hit(40,90)).toBe(false);
      const content=overlay.querySelector('[data-pibbl-html-content]');const old=overlay.querySelector('path')!.getAttribute('d');
      a.rect(0,50,100,50);expect(overlay.querySelector('path')!.getAttribute('d')).toBe(old);
      pibbl(canvas,scene());driver.flush(2);expect(hit(40,90)).toBe(true);expect(overlay.querySelector('[data-pibbl-html-content]')).toBe(content);
    }finally{controller.dispose();restore();}
  });

  it('maps layout allocation, padding, viewport fit and pixel density once', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();
    const controller=pibbl(canvas,<Absolute style={{width:200,height:100}}><HtmlBox mount={emptyMount} data={0} style={{left:20,top:10,width:100,height:60,padding:5}} /></Absolute>,{htmlOverlay:overlay,viewport:{width:200,height:100},fit:'contain',pixelRatio:2});
    try{driver.flush(1);const shell=overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!;const content=overlay.querySelector<HTMLElement>('[data-pibbl-html-content]')!;const matrix=new DOMMatrix(shell.style.transform);
      expect([matrix.a,matrix.d,matrix.e,matrix.f]).toEqual([2,2,40,70]);expect(shell.style.width).toBe('110px');expect(content.style.width).toBe('100px');expect(content.style.left).toBe('5px');
    }finally{controller.dispose();restore();}
  });

  it('supports createElement and preserves a signal supplied as opaque data', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();const data=signal(3);let received:unknown;
    const controller=pibbl(canvas,createElement(HtmlBox,{data,mount:(_element:HTMLDivElement,initial:typeof data)=>{received=initial;return ()=>{};},style:{width:30,height:30}}),{htmlOverlay:overlay});
    try{driver.flush(1);expect(received).toBe(data);}finally{controller.dispose();restore();}
  });

  it('rejects missing overlay, native clips, ancestor filters and custom compositing', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);
    try{
      const missing=surface();const c1=pibbl(missing.canvas,<HtmlBox mount={emptyMount} data={0}/>);expect(()=>driver.flush(1)).toThrow('htmlOverlay');c1.dispose();
      const native=surface();const clip=new Path2D();clip.rect(0,0,30,30);const c2=pibbl(native.canvas,<Clip style={{d:clip}}><HtmlBox mount={emptyMount} data={0}/></Clip>,{htmlOverlay:native.overlay});expect(()=>driver.flush(2)).toThrow('PathGeometry');expect(native.overlay.childNodes.length).toBe(0);c2.dispose();
      const filtered=surface();const c3=pibbl(filtered.canvas,<Group style={{filter:blur({radius:2})}}><HtmlBox mount={emptyMount} data={0}/></Group>,{htmlOverlay:filtered.overlay});expect(()=>driver.flush(3)).toThrow('filters');c3.dispose();
      const composite=surface();const Composite=definePrimitive<{children:ReturnType<typeof createElement>}>((props,_style,ctx)=>{ctx.globalCompositeOperation='multiply';return props.children;});const c4=pibbl(composite.canvas,<Composite><HtmlBox mount={emptyMount} data={0}/></Composite>,{htmlOverlay:composite.overlay});expect(()=>driver.flush(4)).toThrow('compositing');c4.dispose();
    }finally{restore();}
  });

  it('aborts failed mounts and updates while still connected, and can render again', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();const aborts:boolean[]=[];
    const badMount=(element:HTMLDivElement,_data:number,signal:AbortSignal)=>{signal.addEventListener('abort',()=>aborts.push(element.isConnected));throw new Error('mount failed');};
    const controller=pibbl(canvas,<HtmlBox mount={badMount} data={0}/>,{htmlOverlay:overlay});
    try{expect(()=>driver.flush(1)).toThrow('mount failed');expect(aborts).toEqual([true]);expect(overlay.childNodes.length).toBe(0);
      const mount=(element:HTMLDivElement,_data:number,signal:AbortSignal)=>{signal.addEventListener('abort',()=>aborts.push(element.isConnected));return ()=>{throw new Error('update failed');};};
      pibbl(canvas,<HtmlBox mount={mount} data={0}/>);driver.flush(2);pibbl(canvas,<HtmlBox mount={mount} data={1}/>);expect(()=>driver.flush(3)).toThrow('update failed');expect(aborts).toEqual([true,true]);expect(overlay.childNodes.length).toBe(0);
      pibbl(canvas,<HtmlBox mount={emptyMount} data={2}/>);driver.flush(4);expect(overlay.querySelector('[data-pibbl-html-box]')).not.toBeNull();
    }finally{controller.dispose();restore();}
  });

  it('uses mount-only configuration and releases its overlay lease on disposal', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();const other=document.createElement('div');
    const controller=pibbl(canvas,<HtmlBox mount={emptyMount} data={0}/>,{htmlOverlay:overlay});
    try{driver.flush(1);expect(pibbl(canvas,<HtmlBox mount={emptyMount} data={1}/>,{htmlOverlay:other})).toBe(controller);driver.flush(2);expect(other.childNodes.length).toBe(0);controller.dispose();
      const again=pibbl(canvas,<HtmlBox mount={emptyMount} data={0}/>,{htmlOverlay:overlay});driver.flush(3);again.dispose();expect(overlay.childNodes.length).toBe(0);
    }finally{controller.dispose();restore();}
  });

  it('runs the copyable Studio lesson and restores the supplied canvas on disposal', async () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,wrapper,overlay}=surface();overlay.remove();const original=canvas.getAttribute('style');
    const controller=mountLesson(canvas);
    try{driver.flush(1);const input=wrapper.querySelector('input')!;input.value='lesson survives';const button=wrapper.querySelector('button')!;button.click();expect(button.textContent).toBe('Native clicks: 1');
      const rect=canvas.getBoundingClientRect();await userEvent.click(canvas,{position:{x:92/720*rect.width,y:(rect.height-480*rect.width/720)/2+116/720*rect.width}});driver.flush(2);expect(input.value).toBe('lesson survives');
      controller.dispose();expect(canvas.parentElement).toBe(wrapper);expect(canvas.getAttribute('style')).toBe(original);expect(wrapper.querySelector('[data-pibbl-html-box]')).toBeNull();
    }finally{controller.dispose();restore();}
  });
  it('recovers root display suspension and responsive resize with the same nodes', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay,wrapper}=surface();let mounts=0;
    const mount=(element:HTMLDivElement)=>{mounts++;element.textContent='persistent';return ()=>{};};
    const scene=()=> <HtmlBox mount={mount} data={0} style={{width:'50%',height:'50%'}}/>;
    const controller=pibbl(canvas,scene(),{htmlOverlay:overlay,viewport:'responsive'});
    try{driver.flush(1);const node=overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!;expect(node.style.width).toBe('200px');
      wrapper.style.width='0px';wrapper.style.height='0px';pibbl(canvas,scene());driver.flush(2);expect(overlay.querySelector('[data-pibbl-html-box]')).toBe(node);expect(node.inert).toBe(true);
      wrapper.style.width='600px';wrapper.style.height='400px';pibbl(canvas,scene());driver.flush(3);expect(overlay.querySelector('[data-pibbl-html-box]')).toBe(node);expect(node.style.width).toBe('300px');expect(node.inert).toBe(false);expect(mounts).toBe(1);
    }finally{controller.dispose();restore();}
  });

  it('rejects invalid mount results, aborts exactly once and lets another root complete', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const bad=surface(),good=surface();let aborts=0,healthy=0;
    const invalid=(_element:HTMLDivElement,_props:number,abort:AbortSignal)=>{abort.addEventListener('abort',()=>aborts++);return {} as unknown as ()=>void;};
    const c1=pibbl(bad.canvas,<HtmlBox mount={invalid} data={0}/>,{htmlOverlay:bad.overlay});
    const c2=pibbl(good.canvas,<HtmlBox mount={()=>{healthy++;return ()=>{};}} data={0}/>,{htmlOverlay:good.overlay});
    try{expect(()=>driver.flush(1)).toThrow('update function');expect(aborts).toBe(1);expect(healthy).toBe(1);expect(bad.overlay.childNodes.length).toBe(0);expect(good.overlay.querySelector('[data-pibbl-html-box]')).not.toBeNull();}
    finally{c1.dispose();c2.dispose();restore();}expect(aborts).toBe(1);
  });

  it('keeps an enclosing filter unsupported even when its Layer content is cached', () => {
    const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);const {canvas,overlay}=surface();let mounts=0,updates=0,aborts=0;
    const child=<Layer style={{width:100,height:100}}><HtmlBox data={0} mount={(_e,_p,s)=>{mounts++;s.addEventListener('abort',()=>aborts++);return ()=>updates++;}}/></Layer>;
    const scene=(enabled:boolean)=><Group style={{filter:enabled?blur({radius:2}):[]}}>{child}</Group>;
    const controller=pibbl(canvas,scene(false),{htmlOverlay:overlay});
    try{driver.flush(1);pibbl(canvas,scene(true));expect(()=>driver.flush(2)).toThrow('filters');expect(mounts).toBe(1);expect(updates).toBe(0);expect(aborts).toBe(1);expect(overlay.childNodes.length).toBe(0);}
    finally{controller.dispose();restore();}
  });

});
