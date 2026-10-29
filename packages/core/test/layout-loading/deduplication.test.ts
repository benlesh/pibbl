import { expect, it, vi } from 'vitest';
import { canvas, controllers, binaryResponse } from './helpers.js';
it('deduplicates concurrent prewarming and mounts, then reuses the ready module from sync', async () => {
  const core = await import('@pibbl/core');
  const sync = await import('@pibbl/core/sync');
  const compile = vi.spyOn(WebAssembly, 'compile');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(binaryResponse());
  const warming = core.prepareLayoutEngine();
  expect(core.prepareLayoutEngine()).toBe(warming);
  const first = core.pibbl(canvas(), null), second = core.pibbl(canvas(), null);
  const [a,b] = await Promise.all([first,second]); controllers.push(a,b);
  await warming;
  const decode = vi.spyOn(globalThis, 'atob');
  controllers.push(sync.pibblSync(canvas(), null));
  expect(decode).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(compile).toHaveBeenCalledTimes(1);
});
