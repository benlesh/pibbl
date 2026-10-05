import { pibbl, createElement, defineTexture, Rectangle, useTexture } from '@pibbl/core';
import { blur, displacement } from '@pibbl/core/filters';
import { expect, it, vi } from 'vitest';
import { DisplacementGpu } from '../src/filters/displacement-gpu';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { resolveFilterList } from '../src/lib/style/filter';

it('prepares native and texture filters for the same boundary executor', async () => {
  const definition = defineTexture({ create() {}, rasterize(_state, { canvas }) {
    const context = canvas.getContext('2d')!; context.fillStyle = 'rgb(128 128 128)'; context.fillRect(0, 0, 1, 1);
  } });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20; document.body.append(canvas);
  let executors: object[] = [];
  function Scene() {
    const map = useTexture(definition({}), { resolution: { width: 8, height: 8 } });
    const filters = resolveFilterList([blur({ radius: 1 }), displacement({ map, strength: 1, region: { x: 0, y: 0, width: 20, height: 20 } })], {
      component: 'Scene', algorithm: 'render-dispatch', allocation: { x: 0, y: 0, width: 20, height: 20 },
      percentageBasis: { x: 0, y: 0, width: 20, height: 20 }, constraints: { minWidth: 0, maxWidth: 20, minHeight: 0, maxHeight: 20 },
    })!;
    executors = filters.values.map(value => value.executor);
    return createElement(Rectangle, { style: { width: 20, height: 20, fill: 'red' } });
  }
  const controller = pibbl(canvas, createElement(Scene, {}));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(executors).toHaveLength(2);
    expect(executors[0]).toBe(executors[1]);
  } finally { controller.dispose(); canvas.remove(); }
});

it('reports an invalid displacement map with the receiving component and field', () => {
  const filter = displacement({ map: {} as never, strength: 0, region: { x: 0, y: 0, width: 20, height: 20 } });
  expect(() => resolveFilterList(filter, {
    component: 'WaterPanel', algorithm: 'render-dispatch', allocation: { x: 0, y: 0, width: 20, height: 20 },
    percentageBasis: { x: 0, y: 0, width: 20, height: 20 }, constraints: { minWidth: 0, maxWidth: 20, minHeight: 0, maxHeight: 20 },
  })).toThrow(/WaterPanel: property filter\.map/);
});

it('reports processing failure with the receiving filter context', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const apply = vi.spyOn(DisplacementGpu.prototype, 'apply').mockImplementation(() => { throw new Error('GPU upload failed'); });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20; document.body.append(canvas);
  const recipe = defineTexture({ create() {}, rasterize() {} });
  function Scene() {
    const map = useTexture(recipe({}), { resolution: { width: 8, height: 8 } });
    return createElement(Rectangle, { style: { width: 20, height: 20, fill: 'red', filter: displacement({ map, strength: 2, region: { x: 0, y: 0, width: 20, height: 20 } }) } });
  }
  const controller = pibbl(canvas, createElement(Scene, {}));
  try { expect(() => driver.flush(0)).toThrow(/Rectangle: property filter.*GPU upload failed/); }
  finally { controller.dispose(); apply.mockRestore(); restore(); canvas.remove(); }
});
