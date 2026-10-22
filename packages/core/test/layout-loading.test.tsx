import { afterEach, expect, it, vi } from 'vitest';
import { bytes } from '../src/lib/layout/wasm/bytes.js';

const controllers: { dispose(): void }[] = [];
afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.length = 0;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('waits for the shared external module before mounting through the public async entry', async () => {
  const { pibbl, createElement, Rectangle } = await import('@pibbl/core');
  let release!: (response: Response) => void;
  const fetched = new Promise<Response>(resolve => { release = resolve; });
  const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(fetched);
  let renders = 0;
  function Scene(_props: {}) { renders++; return createElement(Rectangle, { style: { width: 20, height: 20, fill: 'red' } }); }
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const pending = pibbl(canvas, createElement(Scene, {}));
  expect(pending).toBeInstanceOf(Promise);
  expect(renders).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  release(new Response(Uint8Array.from(atob(bytes), value => value.charCodeAt(0)), { headers: { 'Content-Type': 'application/wasm' } }));
  const controller = await pending;
  controllers.push(controller);
  expect(typeof controller.dispose).toBe('function');
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(renders).toBeGreaterThan(0);
});
