import { createElement, crc, defineTexture, Group, Rectangle, useTexture } from '@crc/core';
import { blur, brightness, displacement, opacity } from '@crc/core/filters';
import { describe, expect, it } from 'vitest';
import { clickMouse } from './support/mouse-input';

const map = defineTexture({
  create: () => undefined,
  rasterize(_state: undefined, context: { canvas: OffscreenCanvas }) {
    const c = context.canvas.getContext('2d')!;
    c.fillStyle = 'rgb(128 128 0)'; c.fillRect(0, 0, context.canvas.width, context.canvas.height);
  },
});
const rightMap = defineTexture({
  create: () => undefined,
  rasterize(_state: undefined, context: { canvas: OffscreenCanvas }) {
    const c = context.canvas.getContext('2d')!;
    c.fillStyle = 'rgb(255 128 128)'; c.fillRect(0, 0, context.canvas.width, context.canvas.height);
  },
});

describe('public displacement filters', () => {
  it('keeps neutral chained displacement pixels and logical hit geometry', async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
    let clicks = 0;
    function Scene() {
      const texture = useTexture(map({}));
      return createElement(Group, { style: { filter: [brightness({ amount: 1 }), displacement({ map: texture, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } }), opacity({ amount: 1 }), displacement({ map: texture, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } })] }, children: createElement(Rectangle, { style: { x: 10, y: 10, width: 10, height: 10, fill: 'red' }, onClick: () => { clicks += 1; } }) });
    }
    const controller = crc(canvas, createElement(Scene, {}));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    expect(canvas.getContext('2d')!.getImageData(12, 12, 1, 1).data[0]).toBeGreaterThan(200);
    await clickMouse(canvas, { x: 12, y: 12 });
    expect(clicks).toBe(1);
    controller.dispose();
  });

  it('orders native passes around a non-neutral displacement without moving hit geometry', async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
    let clicks = 0;
    function Scene() {
      const texture = useTexture(rightMap({}));
      return createElement(Group, { style: { filter: [brightness({ amount: 0.5 }), displacement({ map: texture, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } }), opacity({ amount: 0.5 })] }, children: createElement(Rectangle, { style: { x: 10, y: 10, width: 10, height: 10, fill: 'red' }, onClick: () => { clicks += 1; } }) });
    }
    const controller = crc(canvas, createElement(Scene, {}));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const context = canvas.getContext('2d')!;
    const displaced = context.getImageData(8, 12, 1, 1).data;
    expect(displaced[0]).toBeGreaterThan(80);
    expect(displaced[3]).toBeGreaterThan(100);
    expect(displaced[3]).toBeLessThan(160);
    await clickMouse(canvas, { x: 8, y: 12 });
    expect(clicks).toBe(0);
    await clickMouse(canvas, { x: 12, y: 12 });
    expect(clicks).toBe(1);
    controller.dispose();
  });
});

it('preserves noncommuting blur and displacement order', async () => {
  const splitMap = defineTexture({
    create() {},
    rasterize(_state, { canvas }) {
      const c = canvas.getContext('2d')!;
      c.fillStyle = 'rgb(255 128 128)'; c.fillRect(0, 0, canvas.width / 2, canvas.height);
      c.fillStyle = 'rgb(0 128 128)'; c.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
    },
  });
  async function sample(blurFirst: boolean) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 30; document.body.append(canvas);
    function Scene() {
      const texture = useTexture(splitMap({}), { resolution: { width: 30, height: 30 } });
      const distortion = displacement({ map: texture.paint({ mode: 'stretch' }), strength: 4, region: { x: 0, y: 0, width: 30, height: 30 } });
      const soften = blur({ radius: 2 });
      return createElement(Group, { style: { filter: blurFirst ? [soften, distortion] : [distortion, soften] }, children: createElement(Rectangle, { style: { x: 10, y: 0, width: 10, height: 30, fill: 'red' } }) });
    }
    const controller = crc(canvas, createElement(Scene, {}));
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      return canvas.getContext('2d')!.getImageData(14, 15, 1, 1).data[3];
    } finally { controller.dispose(); canvas.remove(); }
  }
  const blurThenDisplace = await sample(true);
  const displaceThenBlur = await sample(false);
  expect(displaceThenBlur - blurThenDisplace).toBeGreaterThan(25);
});
