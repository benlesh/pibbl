import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@pibbl/scenarios';
import { clickMouse } from './support/mouse-input';
it('keeps identical overlap geometry benign or erroneous according to explicit app policy', async () => {
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;canvas.style.cssText='width:400px;height:240px';document.body.append(canvas);
 const controller=await(await loadScenario(getScenarioBySlug('agent-layout-placement')!)).mount({canvas});
 try {
  for(const mode of ['overlap-allowed','overlap-prohibited']) {
   await controller.perform(mode);
   const state=controller.getState();
   expect(state.relations).toMatchObject({status:'available',overlap:{relation:'overlap',area:200},assertions:{separation:mode==='overlap-allowed'?'not-requested':'fail'}});
   expect(state.assertion).toBe(mode==='overlap-allowed'?'pass':'fail');
   expect(state.diagnosis).toBe(mode==='overlap-allowed'?'overlap-explicitly-allowed':'overlap-violates-separation');
   const ctx=canvas.getContext('2d')!;
   expect([...ctx.getImageData(110,90,1,1).data]).toEqual([37,99,235,255]);
   expect([...ctx.getImageData(130,90,1,1).data]).toEqual([249,115,22,255]);
   await clickMouse(canvas,{x:130,y:90});expect(controller.getState().lastActivated).toBe('peer');
   await clickMouse(canvas,{x:110,y:90});expect(controller.getState().lastActivated).toBe('primary');
  }
 }finally{await controller.dispose();canvas.remove();}
});

it('withdraws overlap facts on policy changes, publication failure and disposal', async () => {
 const canvas=document.createElement('canvas');canvas.width=400;canvas.height=240;canvas.style.cssText='width:400px;height:240px';
 const host=document.createElement('div');document.body.append(canvas,host);
 let failPublication=false;
 const controller=await(await loadScenario(getScenarioBySlug('agent-layout-placement')!)).mount({canvas,referenceHost:host,onStateChange(){if(failPublication){failPublication=false;throw new Error('Controlled overlap publication failure');}}});
 try {
  await controller.perform('overlap-prohibited');
  const previous=controller.getState();
  const switching=controller.perform('overlap-allowed');
  expect(controller.getState()).toMatchObject({status:'pending',relations:null,observed:null,assertion:'unavailable'});
  await switching;
  expect(controller.getState().relations.assertions.separation).toBe('not-requested');
  expect(previous.relations.assertions.separation).toBe('fail');
  failPublication=true;
  await expect(controller.perform('overlap-prohibited')).rejects.toThrow('Controlled overlap publication failure');
  expect(controller.getState()).toMatchObject({status:'error',relations:null,observed:null,assertion:'unavailable'});
  expect(JSON.parse(host.textContent!).state.relations).toBeNull();
  await controller.perform('overlap-prohibited');
  expect(controller.getState().relations.assertions.separation).toBe('fail');
  await controller.perform('repaired');
  expect(controller.getState().relations).toMatchObject({overlap:null,assertions:{separation:'not-requested',containment:'pass'}});
  await controller.dispose();
  expect(controller.getState()).toMatchObject({status:'disposed',relations:null,observed:null,assertion:'unavailable'});
  expect(host.textContent).toBe('');
  expect(previous.relations.overlap.area).toBe(200);
 }finally{await controller.dispose();canvas.remove();host.remove();}
});
