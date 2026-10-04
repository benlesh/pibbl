import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@crc/scenarios';
import { analyzeBoxRelations } from '../../../tooling/agent-verification/layout-box-relations.mjs';

it('relates live allocation and declared drawing without labeling allowed overflow an error', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 240;
  canvas.style.cssText = 'width:400px;height:240px'; document.body.append(canvas);
  const controller = await (await loadScenario(getScenarioBySlug('agent-layout-placement')!)).mount({ canvas });
  try {
    for (const mode of ['clipped', 'overflow-visible', 'repaired']) {
      await controller.perform(mode);
      const state = controller.getState();
      expect(state.status).toBe('ready');
      const input = { coordinateSpace: 'placed-child-local', allocation: state.allocation, drawing: state.declared.shapeLocal };
      const facts = analyzeBoxRelations(input);
      expect(facts).toMatchObject({ status: 'available', contained: mode === 'repaired', overflow: { left: 0, top: 0, right: mode === 'repaired' ? 0 : 90, bottom: 0 }, assertions: { containment: 'not-requested' } });
      // A policy belongs to the application. The geometry alone does not decide
      // whether this allocation-relative overdraw was intended.
      const checked = analyzeBoxRelations({ ...input, expectations: mode === 'overflow-visible' ? {} : { containment: 'required' } });
      if (checked.status !== 'available') throw new Error('Expected available box facts.');
      expect(checked.assertions.containment).toBe(mode === 'clipped' ? 'fail' : mode === 'repaired' ? 'pass' : 'not-requested');
      expect(state.observed.probe.status).toBe(mode === 'clipped' ? 'miss' : 'target');
    }
  } finally { await controller.dispose(); canvas.remove(); }
});
