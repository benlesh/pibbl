import { crc, createElement, defineTexture, Rectangle, useTexture } from '@crc/core';
import { blur, displacement } from '@crc/core/filters';
import { expect, it } from 'vitest';
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
  const controller = crc(canvas, createElement(Scene, {}));
  try {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(executors).toHaveLength(2);
    expect(executors[0]).toBe(executors[1]);
  } finally { controller.dispose(); canvas.remove(); }
});
