import { expect, it } from 'vitest';
import { getScenarioBySlug, loadScenario } from '@pibbl/scenarios';

it('shares redacted text assertions across seed, repair and independent evidence snapshots', async () => {
  const entry = getScenarioBySlug('agent-text-verification');
  expect(entry).toBeDefined();
  const canvas = document.createElement('canvas');
  const host = document.createElement('div'); document.body.append(canvas, host);
  const controller = await (await loadScenario(entry!)).mount({ canvas, referenceHost: host });
  try {
    const seed = controller.getState();
    expect(seed.assertion).toBe('fail');
    expect(seed.observation.records.filter((r: any) => r.content.status === 'redacted')).toHaveLength(1);
    await controller.perform('repair');
    const repaired = controller.getState();
    expect(repaired.assertion).toBe('pass');
    expect(repaired.observation.records.find((r: any) => r.content.status === 'fixture').content.value).toBe('Revenue: 42');
    expect(seed.assertion).toBe('fail');
    expect(host.textContent).not.toContain('PRIVATE_CUSTOMER');
    expect(JSON.parse(host.textContent!).state).toEqual(repaired);
    await controller.reset();
    expect(controller.getState().assertion).toBe('fail');
  } finally { await controller.dispose(); canvas.remove(); host.remove(); }
});

it('refuses overlapping actions and waits for the admitted action before reporting settled', async () => {
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const controller = await (await loadScenario(getScenarioBySlug('agent-text-verification')!)).mount({ canvas });
  try {
    const repair = controller.perform('repair');
    expect(controller.getState()).toMatchObject({ status: 'pending', observation: null, assertion: 'unavailable' });
    const overlap = controller.perform('seed');
    await expect(overlap).rejects.toThrow('already running');
    await controller.settled();
    await repair;
    expect(controller.getState()).toMatchObject({ mode: 'repair', assertion: 'pass', status: 'ready' });
  } finally { await controller.dispose(); canvas.remove(); }
});

it('cancels a pending capture on disposal and remounts without leaked recorder ownership', async () => {
  const canvas = document.createElement('canvas');
  const host = document.createElement('div'); document.body.append(canvas, host);
  const definition = await loadScenario(getScenarioBySlug('agent-text-verification')!);
  const controller = await definition.mount({ canvas, referenceHost: host });
  const original = canvas.getContext('2d')!.fillText;
  const repair = controller.perform('repair');
  const rejected = expect(repair).rejects.toThrow('disposed');
  await Promise.resolve(); // Enter the capture wait before cancelling it.
  expect(controller.getState().status).toBe('pending');
  await controller.dispose();
  await rejected;
  expect(controller.getState()).toMatchObject({ status: 'disposed', assertion: 'unavailable', observation: null });
  expect(host.children).toHaveLength(0);
  expect(canvas.getContext('2d')!.fillText).toBe(original);
  const next = await definition.mount({ canvas, referenceHost: host });
  try { await next.perform('repair'); expect(next.getState().assertion).toBe('pass'); }
  finally { await next.dispose(); canvas.remove(); host.remove(); }
});
