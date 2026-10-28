import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, definePrimitive, signal, useCanvasContext, useConst, useLayoutBox, type SystemStyle, type BoxStyle, type LayoutItemStyle, type FlexStyle } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { measureElement } from '../src/lib/layout/measure';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';
const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
type LeafStyle = BoxStyle & LayoutItemStyle;
const cases = [
  ['column','ltr','nowrap',0,0,0,20], ['column','rtl','nowrap',60,0,40,20],
  ['column-reverse','ltr','nowrap',0,80,0,40], ['column-reverse','rtl','nowrap',60,80,40,40],
  ['column','ltr','wrap',0,0,40,0], ['column','ltr','wrap-reverse',60,0,0,0],
  ['column','rtl','wrap',60,0,0,0], ['column','rtl','wrap-reverse',0,0,40,0],
  ['column-reverse','ltr','wrap',0,40,40,40], ['column-reverse','ltr','wrap-reverse',60,40,0,40],
  ['column-reverse','rtl','wrap',60,40,0,40], ['column-reverse','rtl','wrap-reverse',0,40,40,40],
] as const;
it.runIf(experimentalLayout).each(cases)('column baseline falls back to logical start: %s %s %s', async (flexDirection,layoutDirection,flexWrap,ax,ay,bx,by) => {
  const before = snapshotWasmLayoutDiagnostics(), width = signal(40), boxes = new Map<string, {x:number;y:number;width:number;height:number;stamp:number}>(), hits:string[]=[];
  let serial=0, calls=0;
  const Leaf = definePrimitive<{name:string},LeafStyle,LeafStyle,SystemStyle & {width:number;height:number}>((props) => {
    const box=useLayoutBox(), matrix=useCanvasContext().getTransform(), stamp=useConst(()=>++serial);
    boxes.set(props.name,{x:matrix.e,y:matrix.f,width:box.width,height:box.height,stamp});
    return <Rectangle onClick={()=>hits.push(props.name)} style={{width:box.width,height:box.height,fill:'#b45'}} />;
  }, {resolveStyle:(_style,context)=>({width:context.allocation.width,height:context.allocation.height}),measureBaselines:()=>{calls++;throw new Error('Column baseline callbacks must remain inert');}});
  const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;document.body.append(canvas);
  const style:FlexStyle={width:100,height:100,flexDirection,layoutDirection,flexWrap,alignItems:'first-baseline',alignContent:'flex-start'};
  const controller=pibbl(canvas,<Flex style={style}>
    <Leaf name="A" style={{width,height:flexWrap==='nowrap'?20:60,minWidth:0,minHeight:0,flexShrink:0}} />
    <Leaf name="B" style={{width:60,height:flexWrap==='nowrap'?40:60,minWidth:0,minHeight:0,flexShrink:0}} />
  </Flex>);controllers.push(controller);await frame();
  expect(boxes.get('A')).toEqual({x:ax,y:ay,width:40,height:flexWrap==='nowrap'?20:60,stamp:1});
  expect(boxes.get('B')).toEqual({x:bx,y:by,width:60,height:flexWrap==='nowrap'?40:60,stamp:2});
  expect(calls).toBe(0);
  width.set(30);await frame();expect(boxes.get('A')!.width).toBe(30);expect(boxes.get('A')!.stamp).toBe(1);expect(calls).toBe(0);
  const a=boxes.get('A')!, rect=canvas.getBoundingClientRect();
  for(const type of ['mousedown','mouseup','click'])canvas.dispatchEvent(new MouseEvent(type,{bubbles:true,button:0,clientX:rect.left+a.x+2,clientY:rect.top+a.y+2}));
  expect(hits).toEqual(['A']);controller.dispose();const disposed=snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances]).toEqual([before.activeNodes,before.activeArenas,before.cachedMeasurements,before.activeWasmInstances]);
  width.set(40);await frame();expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
});

it.runIf(experimentalLayout)('pure column first-baseline resolves as flex-start without a mounted baseline group', () => {
  let calls = 0;
  const Leaf = definePrimitive<{name:string},LeafStyle,LeafStyle,SystemStyle & {width:number;height:number}>((_props) => null, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureBaselines: () => { calls++; throw new Error('pure column baseline provider must remain inert'); },
  });
  const result = measureElement(<Flex style={{ width: 100, flexDirection: 'column', alignItems: 'first-baseline' }}>
    <Leaf name="A" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
    <Leaf name="B" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
  </Flex>, { minWidth: 100, maxWidth: 100, minHeight: 0, maxHeight: 100 }, {
    measureText: () => { throw new Error('fixed leaves must not shape text'); },
  });
  expect(result).toEqual({ status: 'measured', size: { width: 100, height: 60 } });
  expect(calls).toBe(0);
});
