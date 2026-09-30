import { learningExampleCatalog, getScenarioBySlug, loadScenario, type ScenarioController } from '@crc/scenarios';
import { afterEach, expect, it } from 'vitest';
import { tab, pressKey, pointerDownLogicalPoint, pointerMoveLogicalPoint, pointerUpLogicalPoint } from './support/user-input';
import { clickMouse } from './support/mouse-input';

let controller: ScenarioController<any> | undefined;
afterEach(async () => {
  await controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});

it('diagnoses interception and verifies the repair through the same public application', async () => {
  const entry = getScenarioBySlug('agent-targeting-verification');
  expect(entry, 'the manually runnable verification scenario must exist').toBeDefined();
  const definition = await loadScenario(entry!);
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px;display:block';
  document.body.append(canvas);
  controller = await definition.mount({ canvas });

  // Independent application requirement, not obtained from the inspector:
  // center (144, 112) lies within the action; one click must select item A.
  await controller.perform('inspect');
  const seed = controller.getState();
  const pixel = () => Array.from(canvas.getContext('2d')!.getImageData(144, 112, 1, 1).data);
  expect(pixel()).toEqual([37, 99, 235, 255]);
  expect(seed.signalInspection?.records).toHaveLength(6);
  expect(seed.signalInspection.ownership.components.records.some((record: any) => record.surfaceKind === 'layer' && record.layout.status === 'entry-context' && record.layout.allocation.width === 240 && record.layout.allocation.height === 160)).toBe(true);
  expect(seed.signalInspection.ownership.components.records.some((record: { label: { value: string; uniqueness: string } | null }) => record.label?.value === 'targeting-scene' && record.label.uniqueness === 'unique')).toBe(true);
  expect(seed.signalInspection.records[4]).toMatchObject({ kind: 'computed', cache: 'never-read' });
  expect(seed.signalInspection.records[5]).toMatchObject({ dependencies: { count: 2, edges: [{ sourceId: 1 }, { sourceId: 2 }] } });
  await controller.perform('capture-sources');
  const capturedSources = controller.getState();
  expect(capturedSources.signalInspection.ownership.components.records.some((record: { source: { status: string } }) => record.source.status === 'available')).toBe(true);
  expect(capturedSources.renderCount).toBe(seed.renderCount);
  expect(pixel()).toEqual([37, 99, 235, 255]);
  expect(seed.inspection.status).toBe('ready');
  expect(seed.inspection.records.some((record: { kind: string }) => record.kind === 'nested-surface')).toBe(true);
  expect(seed.probe.status).toBe('target');
  expect(seed.probe.candidates.filter((candidate: { outcome: string }) => candidate.outcome === 'hit')).toHaveLength(2);
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: null, selections: 0, deliveredTo: 'decoration' });
  expect(controller.getState().delivery.targetId).toBe(seed.probe.targetId);
  expect(controller.getState().delivery.generation).toEqual(seed.inspection.generation);

  await controller.perform('repair');
  await controller.perform('inspect');
  const repair = controller.getState();
  expect(pixel()).toEqual([37, 99, 235, 255]);
  expect(repair.inspection.generation.render).toBeGreaterThan(seed.inspection.generation.render);
  expect(repair.probe.status).toBe('target');
  expect(repair.probe.targetId).not.toBe(seed.probe.targetId);
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: 'item-a', selections: 1, deliveredTo: 'action' });
  expect(controller.getState().delivery.targetId).toBe(repair.probe.targetId);
  expect(controller.getState().delivery.generation).toEqual(repair.inspection.generation);
  await controller.perform('inspect');
  expect(controller.getState().signalInspection.records[2]).toMatchObject({ preview: { kind: 'scalar', value: 1 } });
  expect(controller.getState().signalInspection.records[4]).toMatchObject({ cache: 'never-read' });

  // Passive application evidence reads do not render or evaluate lazy values.
  const passive = controller.getState();
  for (let index = 0; index < 50; index++) expect(controller.getState()).toEqual(passive);
  expect(passive.dormantMetricEvaluations).toBe(0);

  // A visually identical but intentionally blocking state is not a defect.
  await controller.perform('intentional-block');
  await controller.perform('inspect');
  expect(controller.getState().signalInspection.records[5]).toMatchObject({ dependencies: { count: 1, edges: [{ sourceId: 1 }] } });
  await clickMouse(canvas, { x: 144, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: null, selections: 0, deliveredTo: 'decoration', expectedSelection: false });

  // The same failing and repaired input paths work with inspection disabled.
  await controller.perform('inspection-off');
  for (const mode of ['seed', 'repair']) {
    await controller.perform(mode);
    await clickMouse(canvas, { x: 144, y: 112 });
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      inspectionEnabled: false,
      selectedItem: mode === 'repair' ? 'item-a' : null,
      selections: mode === 'repair' ? 1 : 0,
      deliveredTo: mode === 'repair' ? 'action' : 'decoration',
      delivery: { targetId: null, generation: null },
    });
  }
});

it('publishes structured, historical evidence and releases the test harness on disposal', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-targeting-verification')!);
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 240;
  const referenceHost = document.createElement('div');
  document.body.append(canvas, referenceHost);
  controller = await definition.mount({ canvas, referenceHost });
  const evidence = referenceHost.querySelector('[data-testid="agent-targeting-evidence"]');
  expect(evidence, 'agents should consume data, not parse UI prose').not.toBeNull();
  const initialRender = controller.getState().renderCount;
  await controller.perform('repair');
  expect(controller.getState().renderCount).toBeGreaterThan(initialRender);
  await controller.perform('inspect');
  const captured = JSON.parse(evidence!.textContent!);
  expect(captured.schema).toBe('crc-targeting-fixture/1');
  expect(captured.state.probe.status).toBe('target');
  expect(captured.state).toEqual(controller.getState());
  const firstSession = captured.state.inspection.generation.session;
  await controller.perform('inspection-off');
  await controller.perform('inspection-on');
  await controller.perform('inspect');
  expect(controller.getState().inspection.generation.session).not.toBe(firstSession);
  expect(captured.state.inspection.generation.session).toBe(firstSession);
  await controller.dispose();
  expect(referenceHost.children).toHaveLength(0);
  await expect(controller.perform('inspect')).rejects.toThrow('disposed');
});


it('keeps the agent fixture out of the public learning catalog', () => {
  expect(getScenarioBySlug('agent-targeting-verification')?.metadata.visibility).toBe('test-laboratory');
  expect(learningExampleCatalog.some(entry => entry.slug === 'agent-targeting-verification')).toBe(false);
});

it('cleans up evidence when the initial CRC mount fails', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-targeting-verification')!);
  const canvas = document.createElement('canvas');
  canvas.width = 0;
  const referenceHost = document.createElement('div');
  document.body.append(canvas, referenceHost);
  await expect(definition.mount({ canvas, referenceHost })).rejects.toThrow();
  expect(referenceHost.children).toHaveLength(0);
});


it('explains a Layer boundary miss through the manually available probe action', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-targeting-verification')!);
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px;display:block';
  document.body.append(canvas);
  controller = await definition.mount({ canvas });
  await controller.perform('inspect-outside-layer');
  const captured = controller.getState();
  expect(captured.probePoint).toEqual({ x: 300, y: 112 });
  expect(captured.probe.status).toBe('miss');
  expect(captured.probe.candidates).toHaveLength(2);
  expect(captured.probe.candidates.every((candidate: any) => candidate.exclusion?.kind === 'surface-bounds')).toBe(true);
  // Removing the Layer clip alone would not make either shape contain this point.
  expect(captured.probe.candidates.every((candidate: any) => candidate.geometry === 'miss')).toBe(true);
  await clickMouse(canvas, { x: 300, y: 112 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ selectedItem: null, selections: 0, deliveredTo: null });
  await controller.perform('inspect');
  expect(controller.getState().probePoint).toEqual({ x: 144, y: 112 });
  expect(controller.getState().probe.status).toBe('target');
});


it('demonstrates captured delivery outside painted geometry in the shared lab', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('agent-targeting-verification')!)).mount({ canvas });
  await controller.perform('capture-drag');
  await pointerDownLogicalPoint(canvas, { x: 144, y: 112 });
  try {
    await pointerMoveLogicalPoint(canvas, { x: 300, y: 112 });
    const state = controller.getState();
    expect(state.probe).toMatchObject({ status: 'miss', routing: 'geometry-only' });
    expect(state.capturedDelivery).toMatchObject({ x: 300, y: 112 });
    expect(state.inspection.pointerCapture.records).toEqual([{
      pointerId: state.capturedDelivery.pointerId, targetId: state.capturedDelivery.targetId, live: true,
    }]);
  } finally { await pointerUpLogicalPoint(canvas, { x: 300, y: 112 }); }
  await controller.perform('inspect');
  expect(controller.getState().inspection.pointerCapture.records).toEqual([]);
});


it('distinguishes DOM interception from a valid Canvas target in the shared lab', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('agent-targeting-verification')!)).mount({ canvas });
  await controller.perform('dom-overlay'); await controller.perform('inspect');
  expect(controller.getState()).toMatchObject({ probe: { status: 'target' }, browserProbe: { status: 'blocked' } });
  await clickMouse(canvas, { x: 144, y: 112 });
  expect(controller.getState()).toMatchObject({ domOverlayClicks: 1, selectedItem: null });
  await controller.perform('remove-dom-overlay'); await controller.perform('inspect');
  expect(controller.getState().browserProbe.status).toBe('canvas');
  await clickMouse(canvas, { x: 144, y: 112 }); await controller.settled();
  expect(controller.getState().selectedItem).toBe('item-a');
});


it('reports logical focus and native keyboard activation in the shared lab', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('agent-targeting-verification')!)).mount({ canvas });
  await controller.perform('keyboard-focus');
  await clickMouse(canvas, { x: 144, y: 112 }); await controller.settled();
  const focusPixel = () => Array.from(canvas.getContext('2d')!.getImageData(76, 80, 1, 1).data);
  expect(focusPixel()).toEqual([248, 250, 252, 255]);
  const before = document.createElement('button'); before.textContent = 'Before'; canvas.before(before);
  await clickMouse(before, { x: 5, y: 5 }); await tab(); await controller.settled();
  await pressKey('Enter'); await controller.settled();
  expect(focusPixel()).toEqual([255, 0, 255, 255]);
  await controller.perform('inspect');
  const state = controller.getState();
  expect(state.inspection.focus).toMatchObject({ status: 'ready', nativeFocus: 'canvas' });
  expect(state.inspection.focus.targetId).toBe(state.delivery.targetId);
  expect(state.selections).toBe(2);
  const outside = document.createElement('button'); outside.textContent = 'Outside'; canvas.after(outside);
  await clickMouse(outside, { x: 5, y: 5 }); await controller.settled();
  expect(focusPixel()).toEqual([248, 250, 252, 255]);
});

it('records phase history only after an explicit lab action and retains stopped evidence', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-targeting-verification')!);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px'; document.body.append(canvas);
  controller = await definition.mount({ canvas });
  expect(controller.getState().schedulerHistory).toBeNull();
  await controller.perform('trace-start');
  await controller.perform('repair');
  await controller.perform('inspect');
  const recorded = controller.getState().schedulerHistory;
  expect(recorded.status).toBe('recording');
  expect(recorded.records.slice(-7).map((record: { phase: string }) => record.phase)).toEqual(['begin', 'advance', 'commit', 'plan', 'render', 'complete', 'idle']);
  await controller.perform('trace-stop');
  const stopped = controller.getState().schedulerHistory;
  await controller.perform('reset');
  await controller.perform('inspect');
  expect(controller.getState().schedulerHistory).toEqual(stopped);
});

it('publishes bounded before-after component evidence through the shared inspect action', async () => {
  const definition = await loadScenario(getScenarioBySlug('agent-targeting-verification')!);
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px'; document.body.append(canvas);
  controller = await definition.mount({ canvas });
  await controller.perform('inspect');
  expect(controller.getState().componentChanges).toBeNull();
  await controller.perform('inspect');
  expect(controller.getState().componentChanges).toMatchObject({ status: 'ready', completeness: 'complete', changes: [] });
  await controller.perform('keyboard-focus');
  await controller.perform('inspect');
  expect(controller.getState().componentChanges.changes.some((change: { kind: string }) => change.kind === 'added')).toBe(true);
  expect(controller.getState().componentChanges.changes.some((change: { kind: string }) => change.kind === 'removed')).toBe(true);
  await controller.perform('inspection-off');
  await controller.perform('inspection-on');
  await controller.perform('inspect');
  expect(controller.getState().componentChanges).toBeNull();
});
