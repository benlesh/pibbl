import { expect, it } from 'vitest';
import { canvas, controllers } from './helpers.js';
it('keeps live controller ownership and cancels pending updates on abort or disposal', async () => {
  const { pibbl } = await import('@pibbl/core');
  const { pibblSync } = await import('@pibbl/core/sync');
  const target = canvas();
  const controller = pibblSync(target, null); controllers.push(controller);
  const lifetime = new AbortController();
  const update = pibbl(target, null, {signal:lifetime.signal});
  const rejected = expect(update).rejects.toMatchObject({name:'AbortError'});
  lifetime.abort(); await rejected;
  expect(await pibbl(target, null)).toBe(controller);
  const pending = pibbl(target, null);
  const disposed = expect(pending).rejects.toMatchObject({name:'AbortError'});
  controller.dispose(); await disposed;
  const replacement = await pibbl(target, null); controllers.push(replacement);
  expect(replacement).not.toBe(controller);
  // A stale disposed controller must not cancel work owned by the replacement.
  const next = pibbl(target, null); controller.dispose();
  expect(await next).toBe(replacement);
});
