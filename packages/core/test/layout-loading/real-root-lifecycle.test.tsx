import { expect, it, vi } from 'vitest';
import { binaryResponse, canvas, controllers } from './helpers.js';

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

it('keeps pending real layout roots inert through supersession, caller cancellation and preparation failures, then retries and disposes one live root', async () => {
  const core = await import('@pibbl/core');
  const { snapshotWasmLayoutDiagnostics, experimentalLayout } = await import('../../src/lib/layout/wasm/region.js');
  const baseline = snapshotWasmLayoutDiagnostics();
  let releaseDownload!: (response: Response) => void;
  const heldDownload = new Promise<Response>((resolve) => {
    releaseDownload = resolve;
  });
  const fetch = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(heldDownload);
  const target = canvas();
  target.width = 120;
  target.height = 60;
  const getContext = vi.spyOn(target, 'getContext');
  const firstCaller = new AbortController();
  const cancelledCaller = new AbortController();
  const firstDetach = vi.spyOn(firstCaller.signal, 'removeEventListener');
  const cancelledDetach = vi.spyOn(cancelledCaller.signal, 'removeEventListener');
  let callbacks = 0;
  let mounts = 0;
  let cleanups = 0;
  let hits = 0;

  function Leaf({ label, style: _style }: { label: string; style: { width: number; height: number; minWidth: number } }) {
    callbacks++;
    core.useConst(() => {
      mounts++;
    });
    core.useReaction(() => () => {
      cleanups++;
    }, []);
    const box = core.useLayoutBox();
    return <core.Rectangle style={{ width: box.width, height: box.height, fill: label === 'live' ? '#19375b' : '#a63758', cursor: 'pointer' }} onClick={() => hits++} />;
  }
  const realRoot = (label: string) => (
    <core.Flex style={{ width: 120, height: 60, alignItems: 'flex-start' }}>
      <core.Layer style={{ width: 100, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0 }}>
        <core.Flex style={{ width: 100, height: 40, alignItems: 'flex-start' }}>
          <Leaf label={label} style={{ width: 80, height: 20, minWidth: 0 }} />
        </core.Flex>
      </core.Layer>
    </core.Flex>
  );
  const assertUnadmitted = () => {
    expect([callbacks, mounts, cleanups, hits]).toEqual([0, 0, 0, 0]);
    expect(getContext).not.toHaveBeenCalled();
    expect(snapshotWasmLayoutDiagnostics()).toMatchObject({
      activeNodes: baseline.activeNodes,
      activeArenas: baseline.activeArenas,
      activeWasmInstances: baseline.activeWasmInstances,
      cachedMeasurements: baseline.cachedMeasurements,
    });
  };

  const first = core.pibbl(target, realRoot('first'), { signal: firstCaller.signal });
  const firstCancelled = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = core.pibbl(target, realRoot('second'));
  const secondCancelled = expect(second).rejects.toMatchObject({ name: 'AbortError' });
  const cancelled = core.pibbl(target, realRoot('cancelled'), { signal: cancelledCaller.signal });
  const callerCancelled = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  const prewarm = core.prepareLayoutEngine();
  expect(fetch).toHaveBeenCalledTimes(1);
  cancelledCaller.abort();
  await Promise.all([firstCancelled, secondCancelled, callerCancelled]);
  expect(firstDetach).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(cancelledDetach).toHaveBeenCalledWith('abort', expect.any(Function));
  expect((fetch.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(false);
  assertUnadmitted();

  releaseDownload(new Response('', { status: 503 }));
  await expect(prewarm).rejects.toThrow('fetch failed');
  assertUnadmitted();

  fetch.mockResolvedValueOnce(new Response(Uint8Array.from([1, 2, 3])));
  await expect(core.pibbl(target, realRoot('integrity'))).rejects.toThrow('integrity failed');
  assertUnadmitted();

  fetch.mockResolvedValueOnce(binaryResponse());
  vi.spyOn(WebAssembly, 'compile').mockRejectedValueOnce(new WebAssembly.CompileError('controlled compile failure'));
  await expect(core.pibbl(target, realRoot('compile'))).rejects.toThrow('compile failed');
  assertUnadmitted();

  fetch.mockResolvedValueOnce(binaryResponse());
  const controller = await core.pibbl(target, realRoot('live'));
  controllers.push(controller);
  await nextFrame();
  expect([callbacks, mounts, cleanups]).toEqual([1, 1, 0]);
  const mounted = snapshotWasmLayoutDiagnostics();
  if (experimentalLayout) {
    expect(mounted.activeNodes).toBeGreaterThan(baseline.activeNodes);
    expect(mounted.activeArenas).toBeGreaterThan(baseline.activeArenas);
    expect(mounted.activeWasmInstances).toBe(baseline.activeWasmInstances + 1);
  }
  const bounds = target.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + 10, clientY: bounds.top + 10, bubbles: true, button: 0 }));
  }
  expect(hits).toBe(1);

  controller.dispose();
  expect(cleanups).toBe(1);
  for (const type of ['mousedown', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + 10, clientY: bounds.top + 10, bubbles: true, button: 0 }));
  }
  expect(hits).toBe(1);
  expect(snapshotWasmLayoutDiagnostics()).toMatchObject({
    activeNodes: baseline.activeNodes,
    activeArenas: baseline.activeArenas,
    activeWasmInstances: baseline.activeWasmInstances,
    cachedMeasurements: baseline.cachedMeasurements,
  });
});
