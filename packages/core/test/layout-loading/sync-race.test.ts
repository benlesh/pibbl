import { expect, it, vi } from 'vitest';
import { canvas, controllers } from './helpers.js';
it('lets sync win an in-flight load and prevents a stale failure from poisoning readiness', async () => {
  const core = await import('@pibbl/core');
  const sync = await import('@pibbl/core/sync');
  let fail!: (error: unknown) => void;
  const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((_resolve, reject) => { fail=reject; }));
  const target = canvas();
  let painted = '';
  function Old(_props: {}) { painted = 'old async'; return null; }
  function Winner(_props: {}) { painted = 'new sync'; return null; }
  const old = core.pibbl(target, core.createElement(Old, {}));
  const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' });
  const unrelated = core.pibbl(canvas(), null);
  const mounted = sync.pibblSync(target, core.createElement(Winner, {})); controllers.push(mounted);
  await rejected;
  controllers.push(await unrelated);
  fail(new Error('late transport failure'));
  await core.prepareLayoutEngine();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  expect(painted).toBe('new sync');
  expect(await core.pibbl(target, null)).toBe(mounted);
  expect(fetch).toHaveBeenCalledTimes(1);
});
