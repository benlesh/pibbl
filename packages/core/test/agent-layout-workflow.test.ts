import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@crc/scenarios';
import { clickMouse } from './support/mouse-input';

it('explains a clipped shape and verifies repair through the shared public workflow', async () => {
  const entry = getScenarioBySlug('agent-layout-placement');
  expect(entry).toBeDefined();
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 240;
  canvas.style.cssText = 'width:400px;height:240px';
  const host = document.createElement('div'); document.body.append(canvas, host);
  const controller = await (await loadScenario(entry!)).mount({ canvas, referenceHost: host });
  try {
    const seed = controller.getState();
    expect(seed).toMatchObject({ status: 'ready', mode: 'clipped', assertion: 'fail', diagnosis: 'local-offset-outside-parent-clip', allocation: { x: 0, y: 0, width: 20, height: 20 }, observed: { center: { x: 300, y: 90 }, probe: { status: 'miss' } } });
    await clickMouse(canvas, { x: 300, y: 90 });
    expect(controller.getState().clicks).toBe(0);
    await controller.perform('overflow-visible');
    expect(controller.getState()).toMatchObject({ assertion: 'pass', diagnosis: 'overflow-explicitly-allowed', observed: { center: { x: 300, y: 90 }, probe: { status: 'target' } } });
    await clickMouse(canvas, { x: 300, y: 90 });
    expect(controller.getState().clicks).toBe(1);
    await controller.perform('repaired');
    const repaired = controller.getState();
    expect(repaired).toMatchObject({ assertion: 'pass', diagnosis: 'local-offset-repaired', declared: { parentPlacement: { left: 30, top: 20 }, shapeLocal: { x: 0, y: 0, width: 20, height: 20 } }, observed: { center: { x: 120, y: 90 } } });
    expect(repaired.allocation).toEqual(seed.allocation);
    await clickMouse(canvas, { x: 120, y: 90 });
    expect(controller.getState().clicks).toBe(2);
    expect(JSON.parse(host.textContent!).state.clicks).toBe(2);
    expect(seed.observed.center).toEqual({ x: 300, y: 90 });
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});

it('withdraws current observations during updates and disposal, rejects overlap and isolates remounts', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-layout-placement')!);
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 240;
  canvas.style.cssText = 'width:400px;height:240px';
  const host = document.createElement('div'); document.body.append(canvas, host);
  const controller = await definition.mount({ canvas, referenceHost: host });
  try {
    const historical = controller.getState();
    const pending = controller.perform('repaired');
    const rejected = expect(pending).rejects.toThrow('disposed');
    expect(controller.getState()).toMatchObject({ status: 'pending', assertion: 'unavailable', observed: null, allocation: null });
    await expect(controller.perform('overflow-visible')).rejects.toThrow('already running');
    // Let the action install its frame wait before cancellation.
    await Promise.resolve();
    await controller.dispose(); await rejected;
    await controller.dispose();
    expect(controller.getState()).toMatchObject({ status: 'disposed', observed: null, allocation: null, diagnosis: 'disposed' });
    expect(host.textContent).toBe('');
    await expect(controller.perform('repaired')).rejects.toThrow('disposed');
    await expect(controller.settled()).rejects.toThrow('disposed');
    expect(historical.allocation).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    const next = await definition.mount({ canvas, referenceHost: host });
    try {
      expect(next.getState()).toMatchObject({ mode: 'clipped', clicks: 0, revision: 1 });
      await expect(next.perform('unsupported')).rejects.toThrow('Unknown');
      await next.perform('repaired'); await next.reset();
      expect(next.getState()).toMatchObject({ mode: 'clipped', assertion: 'fail', diagnosis: 'local-offset-outside-parent-clip' });
    } finally { await next.dispose(); }
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});

it('withdraws evidence after a publication failure and permits a subsequent action', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-layout-placement')!);
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 240;
  canvas.style.cssText = 'width:400px;height:240px';
  const host = document.createElement('div'); document.body.append(canvas, host);
  let failNextPublication = false;
  const controller = await definition.mount({ canvas, referenceHost: host, onStateChange() {
    if (failNextPublication) { failNextPublication = false; throw new Error('Controlled publication failure'); }
  } });
  try {
    failNextPublication = true;
    await expect(controller.perform('repaired')).rejects.toThrow('Controlled publication failure');
    expect(controller.getState()).toMatchObject({ status: 'error', assertion: 'unavailable', allocation: null, observed: null });
    expect(JSON.parse(host.textContent!).state).toEqual(controller.getState());
    await controller.perform('repaired');
    expect(controller.getState()).toMatchObject({ status: 'ready', assertion: 'pass', diagnosis: 'local-offset-repaired' });
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});
