import { expect, it, vi } from 'vitest';
import { canvas } from './helpers.js';
it('rejects pre-aborted requests before loading or superseding an eligible waiter', async () => {
  const core = await import('@pibbl/core');
  const { pibblSync } = await import('@pibbl/core/sync');
  const lifetime = new AbortController(); lifetime.abort();
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(core.pibbl(canvas(), null, {signal:lifetime.signal})).rejects.toMatchObject({name:'AbortError'});
  expect(() => pibblSync(canvas(), null, {signal:lifetime.signal})).toThrowError(/cancelled/);
  expect(fetch).not.toHaveBeenCalled();
});
