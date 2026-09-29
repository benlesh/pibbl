import { getScenarioBySlug, loadScenario, type ScenarioController } from '@crc/scenarios';
import { afterEach, expect, it } from 'vitest';
import { clickMouse } from './support/mouse-input';

let controller: ScenarioController<any> | undefined;
afterEach(async () => {
  await controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});

it('diagnoses interception and verifies the repair through the same public application', async () => {
  const entry = getScenarioBySlug('agent-targeting-verification');
  expect(entry, 'the manually runnable verification scenario must exist').toBeDefined();
  const definition = await loadScenario(entry!);
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px;display:block';
  document.body.append(canvas);
  controller = await definition.mount({ canvas });

  // Independent application requirement, not obtained from the inspector:
  // center (144, 112) lies within the action; one click must select item A.
  await controller.perform('inspect');
  const seed = controller.getState();
  const pixel = () => Array.from(canvas.getContext('2d')!.getImageData(144, 112, 1, 1).data);
  expect(pixel()).toEqual([37, 99, 235, 255]);
  expect(seed.inspection.status).toBe('ready');
  expect(seed.probe.status).toBe('target');
  expect(seed.probe.candidates.filter((candidate: { outcome: string }) => candidate.outcome === 'hit')).toHaveLength(2);
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: null, selections: 0, deliveredTo: 'decoration' });
  expect(controller.getState().delivery.targetId).toBe(seed.probe.targetId);
  expect(controller.getState().delivery.generation).toEqual(seed.inspection.generation);

  await controller.perform('repair');
  await controller.perform('inspect');
  const repair = controller.getState();
  expect(pixel()).toEqual([37, 99, 235, 255]);
  expect(repair.inspection.generation.render).toBeGreaterThan(seed.inspection.generation.render);
  expect(repair.probe.status).toBe('target');
  expect(repair.probe.targetId).not.toBe(seed.probe.targetId);
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: 'item-a', selections: 1, deliveredTo: 'action' });
  expect(controller.getState().delivery.targetId).toBe(repair.probe.targetId);
  expect(controller.getState().delivery.generation).toEqual(repair.inspection.generation);

  // Passive application evidence reads do not render or evaluate lazy values.
  const passive = controller.getState();
  for (let index = 0; index < 50; index++) expect(controller.getState()).toEqual(passive);
  expect(passive.dormantMetricEvaluations).toBe(0);

  // A visually identical but intentionally blocking state is not a defect.
  await controller.perform('intentional-block');
  await controller.perform('inspect');
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: null, selections: 0, deliveredTo: 'decoration', expectedSelection: false });

  // The same failing and repaired input paths work with inspection disabled.
  await controller.perform('inspection-off');
  for (const mode of ['seed', 'repair']) {
    await controller.perform(mode);
    await clickMouse(canvas, { x: 144, y: 112 });
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      inspectionEnabled: false,
      selectedItem: mode === 'repair' ? 'item-a' : null,
      selections: mode === 'repair' ? 1 : 0,
      deliveredTo: mode === 'repair' ? 'action' : 'decoration',
      delivery: { targetId: null, generation: null },
    });
  }
});
