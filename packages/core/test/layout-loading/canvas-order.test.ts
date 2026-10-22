import { expect, it, vi } from 'vitest';
import { canvas, controllers, binaryResponse } from './helpers.js';

it('mounts only the newest pending root and preserves its identity on awaited updates', async () => {
  const core = await import('@pibbl/core');
  let release!: (response: Response) => void;
  const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(resolve => { release=resolve; }));
  const target = canvas();
  const painted: string[] = [];
  function Scene({label}: {label:string}) { painted.push(label); return null; }
  const previous = core.pibbl(target, core.createElement(Scene, {label:'superseded'}));
  const rejected = expect(previous).rejects.toMatchObject({name:'AbortError'});
  const next = core.pibbl(target, core.createElement(Scene, {label:'newest'}));
  const invalid = expect(core.pibbl(target, null, {pixelRatio:0})).rejects.toThrow(/pixelRatio/);
  release(binaryResponse());
  const controller = await next; controllers.push(controller);
  await rejected;
  await invalid;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(painted).toEqual(['newest']);
  expect(await core.pibbl(target, core.createElement(Scene,{label:'updated'}))).toBe(controller);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(painted).toEqual(['newest','updated']);
  expect(fetch).toHaveBeenCalledTimes(1);
});
