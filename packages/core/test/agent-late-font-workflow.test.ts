import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@crc/scenarios';
import type { AgentLateFontState } from '../../scenarios/src/agent-late-font';
it('separates font readiness from repaint and responsive rendering in one application workflow', async () => {
 const canvas=document.createElement('canvas');canvas.style.cssText='width:400px;height:120px';const host=document.createElement('div');document.body.append(canvas,host);
 const entry=getScenarioBySlug('agent-late-font');expect(entry).toBeDefined();
 const controller=await (await loadScenario<AgentLateFontState>(entry!)).mount({canvas,referenceHost:host});
 try {
  const initial=controller.getState();expect(initial.sample?.fontSize).toBe(24);
  await controller.perform('load-font');const loaded=controller.getState();
  expect(loaded.font).toBe('loaded');expect(loaded.diagnosis).toBe('font-ready-without-render');
  expect(loaded.sample?.evaluations).toBe(initial.sample?.evaluations);
  expect(loaded.sample?.requested).toBe(initial.sample?.requested);
  expect(Math.abs(loaded.sample!.measuredWidth-initial.sample!.measuredWidth)).toBeGreaterThan(1);
  await controller.perform('repaint');const painted=controller.getState();
  expect(painted.diagnosis).toBe('application-requested-render');expect(painted.sample?.fontLoadedAtEvaluation).toBe(true);
  await controller.perform('narrow');const narrow=controller.getState();expect(narrow.sample).toMatchObject({width:200,fontSize:16});expect(narrow.diagnosis).toBe('resize-requested-render');
  expect(JSON.parse(host.textContent!).state.sample).toEqual(narrow.sample);
 }finally{await controller.dispose();canvas.remove();host.remove();}
});

it('preserves provenance on load failure and recovers without retaining loaded fonts', async () => {
 const { vi } = await import('vitest');
 const canvas=document.createElement('canvas');canvas.style.cssText='width:400px;height:120px';
 const host=document.createElement('div');document.body.append(canvas,host);
 const definition=await loadScenario<AgentLateFontState>(getScenarioBySlug('agent-late-font')!);
 const controller=await definition.mount({canvas,referenceHost:host});
 const originalFonts=new Set(document.fonts);
 const load=vi.spyOn(FontFace.prototype,'load').mockRejectedValueOnce(new Error('controlled font failure'));
 try {
  await expect(controller.perform('load-font')).rejects.toThrow('controlled font failure');
  expect(controller.getState()).toMatchObject({status:'error',sample:null,diagnosis:'observation-failed'});
  expect(JSON.parse(host.textContent!)).toMatchObject({schema:'crc-late-font-fixture/1',provenance:'source-development-no-build-attestation',state:{status:'error',sample:null}});
  load.mockRestore();
  await controller.perform('load-font');
  const first=controller.getState();expect(first.font).toBe('loaded');
  await controller.perform('load-font');
  expect(controller.getState().sample?.evaluations).toBe(first.sample?.evaluations);
  expect(new Set(document.fonts).size).toBe(originalFonts.size+1);
  await controller.perform('narrow');await controller.reset();
  expect(controller.getState()).toMatchObject({font:'unloaded',sample:{width:400,fontSize:24,fontLoadedAtEvaluation:false}});
  expect(new Set(document.fonts)).toEqual(originalFonts);
 }finally{load.mockRestore();await controller.dispose();canvas.remove();host.remove();}
});

it('cancels a pending font load, refuses competing actions and never installs a late completion', async () => {
 const { vi }=await import('vitest');
 const canvas=document.createElement('canvas');canvas.style.cssText='width:400px;height:120px';
 const host=document.createElement('div');document.body.append(canvas,host);
 const definition=await loadScenario<AgentLateFontState>(getScenarioBySlug('agent-late-font')!);
 const controller=await definition.mount({canvas,referenceHost:host});
 let release!: (face:FontFace)=>void;
 let requestedFace:FontFace|undefined;
 const load=vi.spyOn(FontFace.prototype,'load').mockImplementation(function(this:FontFace){requestedFace=this;return new Promise<FontFace>(resolve=>{release=resolve;});});
 const before=new Set(document.fonts);const historical=controller.getState();
 try {
  const action=controller.perform('load-font');const rejected=expect(action).rejects.toThrow('disposed');
  await Promise.resolve();
  expect(requestedFace).toBeDefined();
  expect(controller.getState()).toMatchObject({status:'pending',sample:null});
  await expect(controller.perform('repaint')).rejects.toThrow('already running');
  await controller.dispose();await controller.dispose();await rejected;
  release(requestedFace!);await Promise.resolve();await Promise.resolve();
  expect(new Set(document.fonts)).toEqual(before);
  expect(controller.getState()).toMatchObject({status:'disposed',sample:null});
  expect(host.childElementCount).toBe(0);expect(historical.sample).not.toBeNull();
  await expect(controller.perform('reset')).rejects.toThrow('disposed');
  await expect(controller.settled()).rejects.toThrow('disposed');
 }finally{load.mockRestore();await controller.dispose();canvas.remove();host.remove();}
});
