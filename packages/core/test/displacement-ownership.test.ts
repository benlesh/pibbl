import { createElement, crc, defineTexture, Group, Layer, Rectangle, signal, useTexture } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { afterEach, expect, it, vi } from 'vitest';
import { DisplacementGpu } from '../src/filters/displacement-gpu';

const neutral = defineTexture({
  create: () => undefined,
  rasterize(_state, { canvas }) {
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(128 128 128)';
    context.fillRect(0, 0, canvas.width, canvas.height);
  },
});
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

it('shares one GPU across root and Layers and releases it after the last consumer disappears', async () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  const enabled = signal(true);
  const strength = signal(2);
  const contexts = vi.spyOn(OffscreenCanvas.prototype, 'getContext');
  let allocations = 0;
  const NativeCanvas = OffscreenCanvas;
  vi.stubGlobal('OffscreenCanvas', class extends NativeCanvas {
    constructor(width: number, height: number) { super(width, height); allocations++; }
  });
  const dispose = vi.spyOn(DisplacementGpu.prototype, 'dispose');
  function Scene() {
    const texture = useTexture(neutral({}));
    const filter = enabled.get() ? displacement({ map: texture, strength, region: { x: 0, y: 0, width: 40, height: 40 } }) : [];
    return createElement(Group, { children: [
      createElement(Rectangle, { style: { width: 10, height: 10, fill: 'red', filter } }),
      createElement(Layer, { style: { width: 40, height: 40 }, children: createElement(Rectangle, { style: { x: 20, width: 10, height: 10, fill: 'blue', filter } }) }),
    ] });
  }
  const controller = crc(canvas, createElement(Scene, {}));
  try {
    await frame();
    expect(contexts.mock.calls.filter(([kind]) => kind === 'webgl2')).toHaveLength(1);
    const initialAllocations = allocations;
    for (let index = 0; index < 100; index++) { strength.set(index % 2 + 1); await frame(); }
    expect(allocations).toBe(initialAllocations);
    enabled.set(false); await frame();
    expect(dispose).toHaveBeenCalledTimes(1);
    enabled.set(true); await frame();
    expect(contexts.mock.calls.filter(([kind]) => kind === 'webgl2')).toHaveLength(2);
  } finally { controller.dispose(); }
  expect(dispose).toHaveBeenCalledTimes(2);
});
