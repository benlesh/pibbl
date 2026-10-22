import { expect, it, vi } from 'vitest';
import { canvas, controllers, binaryResponse } from './helpers.js';
it('retries failed fetch, integrity and compile attempts without leaving a mount', async () => {
  const core = await import('@pibbl/core');
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', {status:503}));
  const target = canvas();
  await expect(core.pibbl(target, null)).rejects.toThrow('fetch failed');
  fetch.mockResolvedValueOnce(new Response(new Uint8Array([1,2,3])));
  await expect(core.prepareLayoutEngine()).rejects.toThrow('integrity failed');
  fetch.mockImplementation(async () => binaryResponse());
  vi.spyOn(WebAssembly, 'compile').mockRejectedValueOnce(new WebAssembly.CompileError('test rejection'));
  await expect(core.prepareLayoutEngine()).rejects.toThrow('compile failed');
  controllers.push(await core.pibbl(target, null));
  expect(fetch).toHaveBeenCalledTimes(4);
});
