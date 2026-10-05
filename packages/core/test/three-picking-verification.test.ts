import { expect, it, vi } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@pibbl/scenarios';
import { clickMouse } from './support/mouse-input';

it('lets a native-input lab inspect live mutation separately from bitmap commit', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
  canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
  const definition = await loadScenario(getScenarioBySlug('three-picking-generation')!);
  const controller = await definition.mount({ canvas });
  try {
    const pixel = () => Array.from(canvas.getContext('2d')!.getImageData(200, 150, 1, 1).data);
    expect(pixel()).toEqual([255, 255, 255, 255]);
    await controller.perform('mutate-without-frame');
    expect(controller.getState()).toMatchObject({ liveVisible: false, displayedVisible: true, frames: 1 });
    await clickMouse(canvas, { x: 200, y: 150 }); await controller.settled();
    expect(controller.getState()).toMatchObject({ threeClicks: 1, canvasClicks: 0, frames: 1 });
    expect(pixel()).toEqual([255, 255, 255, 255]);
    await controller.perform('commit-frame');
    expect(controller.getState()).toMatchObject({ displayedVisible: false, frames: 2 });
    expect(pixel()).toEqual([37, 99, 235, 255]);
    await clickMouse(canvas, { x: 200, y: 150 }); await controller.settled();
    expect(controller.getState()).toMatchObject({ threeClicks: 1, canvasClicks: 1, frames: 2 });
    await controller.reset();
    expect(controller.getState()).toMatchObject({ liveVisible: true, displayedVisible: true, frames: 3 });
  } finally { await controller.dispose(); canvas.remove(); }
});

it('cancels pending lab waits on disposal and cannot republish stale evidence', async () => {
  const canvas = document.createElement('canvas'), host = document.createElement('div');
  canvas.width = 400; canvas.height = 300; canvas.style.cssText = 'width:400px;height:300px';
  document.body.append(canvas, host);
  const publications: unknown[] = [];
  const controller = await (await loadScenario(getScenarioBySlug('three-picking-generation')!)).mount({ canvas, referenceHost: host, onStateChange: state => publications.push(state) });
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextId = 9000;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.set(++nextId, callback); return nextId; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
  try {
    const results: string[] = [];
    const waits = [controller.settled(), controller.settled()].map(wait => wait.then(() => results.push('resolved'), error => results.push(String(error))));
    const staleCallbacks = [...callbacks.values()];
    const before = publications.length;
    await controller.dispose();
    await Promise.resolve();
    expect(results).toHaveLength(2);
    expect(results.every(result => result.includes('disposed'))).toBe(true);
    await Promise.all(waits);
    expect(callbacks.size).toBe(0);
    expect(host.children).toHaveLength(0);
    for (const callback of staleCallbacks) callback(100);
    expect(callbacks.size).toBe(0);
    expect(publications).toHaveLength(before);
    await expect(controller.perform('commit-frame')).rejects.toThrow(/disposed/);
  } finally { vi.restoreAllMocks(); await controller.dispose(); canvas.remove(); host.remove(); }
});

it('bounds a stalled lab frame wait and cleans its scheduled callback', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
  canvas.style.cssText = 'width:400px;height:300px'; document.body.append(canvas);
  const controller = await (await loadScenario(getScenarioBySlug('three-picking-generation')!)).mount({ canvas });
  let expire!: () => void;
  const originalTimeout = window.setTimeout.bind(window);
  vi.spyOn(window, 'setTimeout').mockImplementationOnce((handler, delay) => {
    expect(delay).toBe(5000);
    expire = () => { if (typeof handler === 'function') handler(); };
    return originalTimeout(handler, delay) as unknown as ReturnType<typeof setTimeout>;
  });
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(9000);
  const cancelled = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  try {
    const result = controller.settled().then(() => 'unexpected success', error => String(error));
    expire();
    expect(await result).toContain('exceeded 5 seconds');
    expect(cancelled).toHaveBeenCalledWith(9000);
  } finally { vi.restoreAllMocks(); await controller.dispose(); canvas.remove(); }
});
