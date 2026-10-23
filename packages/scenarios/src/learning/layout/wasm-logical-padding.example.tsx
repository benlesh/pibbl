import { Flex, Rectangle, Text, signal, useCanvasContext, useConst, useLayoutBox, useReaction, type BoxStyle, type FlexItemStyle } from '@pibbl/core';

function createLogicalPaddingContent(canvas: HTMLCanvasElement) {
  const width=signal(240), direction=signal<'ltr'|'rtl'>('ltr'), padding=signal<number|'15%'>(0), ink=signal('#a63758');
  let hits=0, serial=0, box={x:0,y:0,width:0,height:0,stamp:0}, rootTransform=new DOMMatrix();
  const read=(globalThis as typeof globalThis & {__PIBBL_LAYOUT_DIAGNOSTICS__?:()=>Record<string,number>}).__PIBBL_LAYOUT_DIAGNOSTICS__;
  function Leaf({style:_style}:{style:BoxStyle & FlexItemStyle}){
    const stamp=useConst(()=>++serial),allocation=useLayoutBox(),transform=rootTransform.inverse().multiply(useCanvasContext().getTransform());
    box={x:+transform.e.toFixed(3),y:+transform.f.toFixed(3),width:allocation.width,height:allocation.height,stamp};
    return <Rectangle style={{width:allocation.width,height:allocation.height,fill:ink,cursor:'pointer'}} onClick={()=>{hits++;}}/>;
  }
  function Workspace(){
    rootTransform=useCanvasContext().getTransform();
    return <>
      <Rectangle pointerEvents="none" style={{left:28,top:150,width,height:120,stroke:'#a0aab8',strokeWidth:2}}/>
      <Rectangle pointerEvents="none" style={{left:direction.get()==='rtl'?28+width.get()-160:28,top:150,width:160,height:80,fill:'#d6e3db'}}/>
      <Flex style={{left:28,top:150,width,height:120,layoutDirection:direction}}>
        <Flex style={{width:160,height:80,boxSizing:'border-box',minWidth:0,minHeight:0,flexShrink:0,padding:{left:8,right:20,top:8,bottom:8},paddingStart:read?padding:undefined,alignItems:'flex-start'}}>
          <Leaf style={{width:20,height:20,minWidth:0,minHeight:0,flexShrink:0}}/>
        </Flex>
      </Flex>
    </>;
  }
  function Button({x,width:buttonWidth,label,onClick}:{x:number;width:number;label:string;onClick():void}){
    return <><Rectangle style={{left:x,top:90,width:buttonWidth,height:36,fill:'#19375b',cursor:'pointer'}} onClick={onClick}/><Text pointerEvents="none" style={{left:x+10,top:101,font:'14px sans-serif',fill:'white'}}>{label}</Text></>;
  }
  const node=<>
    <Rectangle style={{width:760,height:360,fill:'#f3f0e8'}}/>
    <Text style={{left:28,top:24,font:'bold 24px sans-serif',fill:'#19375b'}}>Logical padding · one owner width</Text>
    <Text style={{left:28,top:61,font:'14px sans-serif',fill:'#475569'}}>Green box stays 160 × 80. Click the red content box after each change.</Text>
    <Button x={28} width={130} label="LTR ⇄ RTL" onClick={()=>direction.update(value=>value==='ltr'?'rtl':'ltr')}/>
    <Button x={172} width={160} label="Padding 0 ⇄ 15%" onClick={()=>padding.update(value=>value===0?'15%':0)}/>
    <Button x={346} width={140} label="Resize owner" onClick={()=>width.update(value=>value===240?360:240)}/>
    <Button x={500} width={140} label="Paint only" onClick={()=>ink.update(value=>value==='#a63758'?'#19375b':'#a63758')}/>
    <Workspace/>
    <Text pointerEvents="none" style={{left:28,top:298,width:700,font:'14px sans-serif',fill:'#475569'}}>Start overrides physical left/right, including zero. Percentages use the gray owner's width.</Text>
  </>;
  const panel=document.createElement('pre');panel.style.cssText='font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df';canvas.insertAdjacentElement('afterend',panel);
  const refresh=()=>{panel.textContent=JSON.stringify({lane:read?'experimental WASM':'normal JavaScript',direction:direction.get(),ownerWidth:width.get(),paddingStart:padding.get(),box,hits,layout:read?.()??{},limits:'Experimental logical padding; percentages require a finite Flex owner. Layer raster sizing remains independent from padding.'});};
  refresh();const timer=setInterval(refresh,100);
  return {node,dispose(){clearInterval(timer);panel.remove();}};
}

export function WasmLogicalPaddingExample(){
  const canvas=useCanvasContext().canvas as HTMLCanvasElement;
  const resource=useConst(()=>createLogicalPaddingContent(canvas));
  useReaction(()=>resource.dispose,[]);
  return resource.node;
}
