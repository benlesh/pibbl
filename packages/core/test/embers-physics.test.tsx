import { expect, it } from 'vitest';
import { crc, Rectangle, embers, useVisibilityTransition, type CRCVisibilityTransition } from '@crc/core';
import { installSchedulerDriverForTest, ManualSchedulerDriver, snapshotRealmScheduler } from '../src/lib/scheduler/testing';
it('opts into local forces and collision in Advance, keeps reversal history, and cleans up', async () => {
  const driver=new ManualSchedulerDriver(),restore=installSchedulerDriverForTest(driver);
  const canvas=document.createElement('canvas');canvas.width=240;canvas.height=240;document.body.append(canvas);
  let handle!:CRCVisibilityTransition, queries=0, hits=0;
  const effect=embers({region:{x:30,y:30,width:180,height:80},linger:1000,seed:4,physics:{gravity:[0,700],drag:1,wind:[0,0],restitution:.6,collide(from,to){
    queries++;
    expect(snapshotRealmScheduler().phase).toBe('advance');
    if(from[1]<140 && to[1]>=140){hits++;return {fraction:(140-from[1])/(to[1]-from[1]),normal:[0,-1]};}
    return undefined;
  }}});
  function Scene(){handle=useVisibilityTransition({enter:effect,duration:200});return <Rectangle style={{x:30,y:30,width:180,height:80,fill:'white',transition:handle.binding}} />;}
  const root=crc(canvas,<Scene />);
  try {
    driver.flush(0);expect(queries).toBe(0);
    const exiting=handle.hide();driver.flush(10);
    for(let t=26;t<=138;t+=16)driver.flush(t);
    void handle.show();driver.flush(150);
    expect(await exiting).toMatchObject({status:'cancelled'});
    for(let t=166;t<=1100;t+=16)if(driver.pendingHostFrames)driver.flush(t);
    expect(queries).toBeGreaterThan(0);expect(hits).toBeGreaterThan(0);
    const count=queries; root.dispose();if(driver.pendingHostFrames)driver.flush(1200);
    expect(queries).toBe(count);expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  } finally {root.dispose();if(driver.pendingHostFrames)driver.flush(2000);restore();canvas.remove();}
});

it('settles as disposed and releases animation when a physics callback fails', async () => {
  const driver=new ManualSchedulerDriver(),restore=installSchedulerDriverForTest(driver);
  const canvas=document.createElement('canvas');document.body.append(canvas);let handle!:CRCVisibilityTransition;
  function Scene(){handle=useVisibilityTransition({enter:embers({region:{x:0,y:0,width:100,height:100},linger:500,physics:{collide(){throw Error('collision failed');}}}),duration:300});return <Rectangle style={{width:100,height:100,fill:'red',transition:handle.binding}} />;}
  const root=crc(canvas,<Scene />);
  try {
    driver.flush(0);const pending=handle.hide();driver.flush(10);
    expect(()=>driver.flush(60)).toThrow('collision failed');
    expect(await pending).toMatchObject({status:'disposed'});
    if(driver.pendingHostFrames)driver.flush(80);
    expect(snapshotRealmScheduler().registeredAdvanceParticipants).toBe(0);
  } finally {root.dispose();if(driver.pendingHostFrames)driver.flush(1000);restore();canvas.remove();}
});
