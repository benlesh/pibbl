import { getScenarioBySlug, loadScenario, type ScenarioController } from '@pibbl/scenarios';
import { afterEach, describe, expect, it } from 'vitest';
let controller: ScenarioController<any> | undefined;
afterEach(async () => {
  await controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});
describe('responsive styles public laboratory', () => {
  it('preserves allocated identity and crosses root and container thresholds in both directions', async () => {
    const entry = getScenarioBySlug('responsive-styles');
    expect(entry, 'responsive styles must have a separate deterministic laboratory').toBeDefined();
    const definition = await loadScenario(entry!);
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    controller = await definition.mount({ canvas });
    const initial = controller.getState();
    expect(initial.root).toMatchObject({ width: 1000, height: 600, x: 124, y: 40 });
    expect(initial.cell).toMatchObject({ width: 320, height: 160, x: 0, y: 296 });
    const identities = [initial.root.identity, initial.cell.identity];
    for (const width of [599, 600, 601, 599, 600]) {
      await controller.perform(`root-width-${width}`);
      await controller.perform(`cell-width-${width}`);
      const state = controller.getState();
      expect(state.root).toMatchObject(width >= 600 ? { x: 124, y: 40 } : { x: 0, y: 96 });
      expect(state.cell).toMatchObject(width >= 600 ? { x: 124, y: 240 } : { x: 0, y: 296 });
      expect([state.root.identity, state.cell.identity]).toEqual(identities);
    }
    await controller.perform('gap-20');
    expect(controller.getState().root.x).toBe(132);
    expect(controller.getState().cell.x).toBe(132);
    for (const [height, x] of [[121, 132], [120, 120], [119, 120], [121, 132]]) {
      await controller.perform(`cell-height-${height}`);
      expect(controller.getState().cell.x).toBe(x);
    }
    await controller.perform('root-width-360');
    expect(controller.getState().root).toMatchObject({ width: 360, x: 0, y: 104 });
  });
});
