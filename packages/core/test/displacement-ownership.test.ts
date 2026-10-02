import { createElement, crc, defineTexture, Group, Layer, Rectangle, signal, useTexture } from '@crc/core';
import { displacement } from '@crc/core/filters';
import { afterEach, expect, it, vi } from 'vitest';
import { DisplacementGpu } from '../src/filters/displacement-gpu';
import { getCRCInstance } from '../src/lib/global-state';
import { peekDisplacementGpu } from '../src/filters/render-displacement-boundary';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { clickMouse } from './support/mouse-input';

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
  const applies = vi.spyOn(DisplacementGpu.prototype, 'apply');
  const uploads = vi.spyOn(WebGL2RenderingContext.prototype, 'texImage2D');
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
    expect(uploads).toHaveBeenCalledTimes(applies.mock.calls.length + 1);
    enabled.set(false); await frame();
    expect(dispose).toHaveBeenCalledTimes(1);
    enabled.set(true); await frame();
    expect(contexts.mock.calls.filter(([kind]) => kind === 'webgl2')).toHaveLength(2);
  } finally { controller.dispose(); }
  expect(dispose).toHaveBeenCalledTimes(2);
});

it('restores one root GPU update across an active Layer without changing logical targets', async () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  let rootClicks = 0, layerClicks = 0;
  function Scene() {
    const texture = useTexture(neutral({}));
    const filter = displacement({ map: texture, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } });
    return createElement(Group, { children: [
      createElement(Rectangle, { style: { x: 2, y: 2, width: 10, height: 10, fill: 'red', filter }, onClick: () => { rootClicks += 1; } }),
      createElement(Layer, { style: { width: 40, height: 40 }, children: createElement(Rectangle, { style: { x: 24, y: 2, width: 10, height: 10, fill: 'blue', filter }, onClick: () => { layerClicks += 1; } }) }),
    ] });
  }
  const controller = crc(canvas, createElement(Scene, {}));
  try {
    await frame();
    const instance = getCRCInstance(canvas);
    const gpu = peekDisplacementGpu(instance)!;
    const gl = (gpu as unknown as { canvas: OffscreenCanvas }).canvas.getContext('webgl2')!;
    const lose = gl.getExtension('WEBGL_lose_context');
    expect(lose).not.toBeNull();
    const requests = vi.spyOn(window, 'requestAnimationFrame');
    lose!.loseContext();
    await new Promise<void>(resolve => setTimeout(resolve, 50));
    requests.mockClear();
    lose!.restoreContext();
    await new Promise<void>(resolve => setTimeout(resolve, 80));
    expect(requests).toHaveBeenCalledTimes(1);
    const context = canvas.getContext('2d')!;
    expect(context.getImageData(6, 6, 1, 1).data[0]).toBeGreaterThan(200);
    expect(context.getImageData(28, 6, 1, 1).data[2]).toBeGreaterThan(200);
    await clickMouse(canvas, { x: 6, y: 6 });
    await clickMouse(canvas, { x: 28, y: 6 });
    expect(rootClicks).toBe(1); expect(layerClicks).toBe(1);
  } finally { controller.dispose(); }
});

it('evaluates a discarded displacement subtree once without acquiring a GPU', async () => {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  const contexts = vi.spyOn(OffscreenCanvas.prototype, 'getContext');
  let renders = 0;
  function Child() { renders++; return createElement(Rectangle, { style: { width: 10, height: 10, fill: 'red' } }); }
  function Scene() {
    const map = useTexture(neutral({}));
    return createElement(Group, { style: { scaleX: 0, filter: displacement({ map, strength: 4, region: { x: 0, y: 0, width: 40, height: 40 } }) }, children: createElement(Child, {}) });
  }
  const controller = crc(canvas, createElement(Scene, {}));
  try { await frame(); expect(renders).toBe(1); expect(contexts.mock.calls.filter(([kind]) => kind === 'webgl2')).toHaveLength(0); }
  finally { controller.dispose(); }
});

it('releases a first-generation GPU service after its pass fails', () => {
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const apply = vi.spyOn(DisplacementGpu.prototype, 'apply').mockImplementation(() => { throw new Error('injected GPU pass failure'); });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40; document.body.append(canvas);
  const recipe = defineTexture({ create() {}, rasterize() {} });
  function Scene() {
    const texture = useTexture(recipe({}), { resolution: { width: 8, height: 8 } });
    return createElement(Rectangle, { style: { width: 10, height: 10, fill: 'red', filter: displacement({ map: texture, strength: 2, region: { x: 0, y: 0, width: 40, height: 40 } }) } });
  }
  const controller = crc(canvas, createElement(Scene, {}));
  try {
    expect(() => driver.flush(0)).toThrow(/injected GPU pass failure/);
    expect(peekDisplacementGpu(getCRCInstance(canvas))).toBeUndefined();
  } finally { controller.dispose(); apply.mockRestore(); restore(); }
});
