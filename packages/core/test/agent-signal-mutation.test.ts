import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@pibbl/scenarios';
it.each([180, 240])('verifies mutation and replacement pixels in a 480 by %i display', async displayHeight => {
  const entry = getScenarioBySlug('agent-signal-mutation');
  expect(entry).toBeDefined();
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 180;
  canvas.style.cssText = `width:480px;height:${displayHeight}px`;
  const host = document.createElement('div'); document.body.append(canvas, host);
  const controller = await (await loadScenario(entry!)).mount({ canvas, referenceHost: host });
  try {
    const pixel = () => {
      // Independent fixed-viewport contain transform, including letterbox offsets.
      const scale = Math.min(canvas.clientWidth / 480, canvas.clientHeight / 180);
      const x = ((canvas.clientWidth - 480 * scale) / 2 + 200 * scale) * canvas.width / canvas.clientWidth;
      const y = ((canvas.clientHeight - 180 * scale) / 2 + 80 * scale) * canvas.height / canvas.clientHeight;
      return [...canvas.getContext('2d')!.getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
    };
    const initial = controller.getState();
    expect(pixel()[3]).toBe(0);
    expect(initial).toMatchObject({ sourceAmount: 10, evaluatedAmount: 10, assertion: 'pass' });
    await controller.perform('equal-noop');
    const noop = controller.getState();
    expect(noop).toMatchObject({ assertion: 'pass', equality: { sameReference: true }, diagnosis: 'intentional-equal-write' });
    expect(noop.componentEvaluations).toBe(initial.componentEvaluations);
    await controller.perform('in-place');
    const broken = controller.getState();
    expect(broken).toMatchObject({ sourceAmount: 42, expectedAmount: 42, evaluatedAmount: 10, assertion: 'fail', diagnosis: 'same-reference-mutation-suppressed' });
    expect(broken.signalVersion).toBe(initial.signalVersion);
    expect(broken.componentEvaluations).toBe(initial.componentEvaluations);
    expect(pixel()[3]).toBe(0);
    await controller.perform('replace');
    const repaired = controller.getState();
    expect(repaired).toMatchObject({ sourceAmount: 42, expectedAmount: 42, evaluatedAmount: 42, assertion: 'pass', diagnosis: 'replacement-published' });
    expect(repaired.signalVersion).toBe(initial.signalVersion + 1);
    expect(repaired.componentEvaluations).toBe(initial.componentEvaluations + 1);
    expect(pixel()).toEqual([37, 99, 235, 255]);
    expect(broken.evaluatedAmount).toBe(10);
    expect(JSON.parse(host.textContent!).state).toEqual(repaired);
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});

it('keeps repeated equal writes distinct from a new mutation and resets the independent expectation', async () => {
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const controller = await (await loadScenario(getScenarioBySlug('agent-signal-mutation')!)).mount({ canvas });
  try {
    await controller.perform('in-place');
    const first = controller.getState();
    for (const action of ['in-place', 'equal-noop']) {
      await controller.perform(action);
      const repeated = controller.getState();
      expect(repeated).toMatchObject({ assertion: 'fail', diagnosis: 'equal-write-keeps-stale-display', signalVersion: first.signalVersion, componentEvaluations: first.componentEvaluations, equality: { amountBefore: 42, amountAfter: 42 } });
    }
    await controller.reset();
    expect(controller.getState()).toMatchObject({ sourceAmount: 10, expectedAmount: 10, evaluatedAmount: 10, assertion: 'pass' });
    await controller.perform('equal-noop');
    expect(controller.getState().diagnosis).toBe('intentional-equal-write');
  } finally { await controller.dispose(); canvas.remove(); }
});

it('refuses competing actions and cancels an active observation without leaking ownership into a remount', async () => {
  const canvas = document.createElement('canvas'); const host = document.createElement('div'); document.body.append(canvas, host);
  const definition = await loadScenario(getScenarioBySlug('agent-signal-mutation')!);
  const controller = await definition.mount({ canvas, referenceHost: host });
  try {
    const before = controller.getState();
    await expect(controller.perform('unknown')).rejects.toThrow('Unknown');
    expect(controller.getState()).toEqual(before);
    const mutation = controller.perform('in-place');
    const cancelled = expect(mutation).rejects.toThrow('disposed');
    await expect(controller.perform('replace')).rejects.toThrow('already running');
    expect(controller.getState().status).toBe('pending');
    await controller.dispose();
    await cancelled;
    expect(controller.getState()).toMatchObject({ status: 'disposed', assertion: 'unavailable' });
    expect(host.children).toHaveLength(0);
    await expect(controller.settled()).rejects.toThrow('disposed');
    const next = await definition.mount({ canvas, referenceHost: host });
    try { expect(next.getState()).toMatchObject({ sourceAmount: 10, evaluatedAmount: 10, assertion: 'pass' }); }
    finally { await next.dispose(); }
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});

it('cleans its evidence host when the Canvas cannot establish a 2D mount', async () => {
  const canvas = document.createElement('canvas');
  const host = document.createElement('div'); document.body.append(canvas, host);
  const ownContext = canvas.getContext;
  // Explicit test-scoped unsupported-context injection, restored below.
  Object.defineProperty(canvas, 'getContext', { configurable: true, value: () => null });
  try {
    const definition = await loadScenario(getScenarioBySlug('agent-signal-mutation')!);
    await expect(definition.mount({ canvas, referenceHost: host })).rejects.toThrow();
    expect(host.children).toHaveLength(0);
  } finally { Reflect.deleteProperty(canvas, 'getContext'); expect(canvas.getContext).toBe(ownContext); canvas.remove(); host.remove(); }
});
