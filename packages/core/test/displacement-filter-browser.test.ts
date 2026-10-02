import { createElement, crc, defineTexture, Group, Rectangle, useTexture } from '@crc/core';
import { brightness, displacement, opacity } from '@crc/core/filters';
import { describe, expect, it } from 'vitest';
import { clickMouse } from './support/mouse-input';

const map = defineTexture({
  create: () => undefined,
  rasterize(_state: undefined, context: { canvas: OffscreenCanvas }) {
    const c = context.canvas.getContext('2d')!;
    c.fillStyle = 'rgb(128 128 0)'; c.fillRect(0, 0, context.canvas.width, context.canvas.height);
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
});
