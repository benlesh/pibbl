import { crc, signal } from '@crc/core';
import { expect, it } from 'vitest';
import { AgentLateFontScene } from '../../scenarios/src/agent-late-font.example';
import fontUrl from '../../scenarios/src/assets/agent-space-grotesk.woff2?url';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
const twoFrames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
it('records absent font-arrival redraw, explicit application invalidation and responsive resize', async () => {
 const driver=new ManualSchedulerDriver();const restore=installSchedulerDriverForTest(driver);
 const canvas=document.createElement('canvas');canvas.style.cssText='width:400px;height:120px';document.body.append(canvas);
 const revision=signal(0);const family='CRCLateFontVerification';const font=new FontFace(family,`url("${fontUrl}")`);
 const observations:{width:number;fontSize:number}[]=[];
 const mount=crc(canvas,<AgentLateFontScene revision={revision} family={family} onEvaluation={value=>observations.push(value)}/>,{viewport:'responsive',pixelRatio:1});
 const pixels=()=>Array.from(canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data);
 const measure=()=>{const ctx=document.createElement('canvas').getContext('2d')!;ctx.font=`24px "${family}", monospace`;return ctx.measureText('MMMM').width;};
 try{
  await twoFrames();driver.flush(1);
  expect(observations.at(-1)).toEqual({width:400,fontSize:24});
  const before=pixels();expect(before.some((value,index)=>index%4===3&&value>0)).toBe(true);const requests=driver.requestCount;const evaluations=observations.length;const fallbackWidth=measure();
  await font.load();document.fonts.add(font);await twoFrames();
  expect(font.status).toBe('loaded');expect(Math.abs(measure()-fallbackWidth)).toBeGreaterThan(1);
  expect(driver.requestCount).toBe(requests);expect(observations).toHaveLength(evaluations);expect(pixels()).toEqual(before);
  revision.set(1);expect(driver.requestCount).toBeGreaterThan(requests);driver.flush(2);
  expect(observations).toHaveLength(evaluations+1);expect(pixels()).not.toEqual(before);
  const updatedRequests=driver.requestCount;
  canvas.style.width='200px';await twoFrames();expect(driver.requestCount).toBeGreaterThan(updatedRequests);driver.flush(3);
  expect(observations.at(-1)).toEqual({width:200,fontSize:16});
 }finally{mount.dispose();document.fonts.delete(font);canvas.remove();restore();}
});
