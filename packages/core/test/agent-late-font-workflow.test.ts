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
