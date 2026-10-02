import { getScenarioBySlug, loadScenario, type ScenarioController } from '@crc/scenarios';
import { afterEach, expect, it } from 'vitest';
import { moveMouse } from './support/mouse-input';
let controller: ScenarioController<any> | undefined;
afterEach(async () => { await controller?.dispose(); controller = undefined; document.body.replaceChildren(); });

it('verifies interpolated values and coordinates across a native hover and data revision', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px';
  const evidenceHost = document.createElement('div'); document.body.append(canvas, evidenceHost);
  const definition = await loadScenario(getScenarioBySlug('viz-hover-lab')!);
  controller = await definition.mount({ canvas, referenceHost: evidenceHost });
  await controller.perform('interpolated-x');
  // Independent fixture arithmetic: plot origin (55,175), width 917, height 375.
  // x=5 maps to 55+917/2; y=20 maps to 175+375/2 for reversed [0,40].
  await moveMouse(canvas, { x: 513.5, y: 362.5 });
  await controller.settled();
  const first = controller.getState();
  expect(first.plot).toEqual({ x: 55, y: 175, width: 917, height: 375 });
  expect(first.inspection).toBeCloseTo(5, 8);
  expect(first.results).toHaveLength(2);
  for (const result of first.results) {
    expect(result.kind).toBe('interpolated');
    expect(result.x).toBeCloseTo(5, 8); expect(result.y).toBeCloseTo(20, 8);
    expect(result.anchor.x).toBeCloseTo(458.5, 8); expect(result.anchor.y).toBeCloseTo(187.5, 8);
  }
  expect(first.generation).toBe(0);
  await controller.perform('update-data');
  const changed = controller.getState();
  expect(changed.generation).toBe(1);
  expect(changed.inspection).toBeCloseTo(5, 8);
  expect(changed.results.find((value: any) => value.series === 'monthly')).toMatchObject({ kind: 'interpolated', y: 30, anchor: { x: 458.5, y: 93.75 } });
  expect(changed.results.find((value: any) => value.series === 'adjusted')?.y).toBe(20);
  expect(first.results[0].y).toBe(20);
  const evidence = evidenceHost.querySelector('[data-testid="agent-viz-evidence"]');
  expect(JSON.parse(evidence!.textContent!)).toMatchObject({ schema: 'crc-viz-fixture/1', state: changed });
  await controller.perform('missing-data');
  const missing = controller.getState();
  expect(missing.generation).toBe(2);
  expect(missing.results).toHaveLength(1);
  expect(missing.results[0]).toMatchObject({ series: 'adjusted', kind: 'interpolated', x: 5, y: 20 });
  // Either side of the explicit null is also a broken segment, not a bridge.
  for (const x of [2.5, 7.5]) {
    await moveMouse(canvas, { x: 55 + 917 * x / 10, y: 362.5 });
    await controller.settled();
    const result = controller.getState();
    expect(result.results).toHaveLength(1);
    expect(result.results[0].series).toBe('adjusted');
    expect(result.results[0].y).toBeCloseTo(30 - (x - 2) * 20 / 6, 8);
  }
  expect(changed.results).toHaveLength(2);
  await controller.dispose(); controller = undefined;
  expect(evidenceHost.children).toHaveLength(0);
});

it('waits for resized chart geometry before accepting native hover evidence', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas });
  await controller.perform('interpolated-x');
  canvas.style.width = '600px';
  await controller.settled();
  const resized = controller.getState();
  expect(resized.viewport).toEqual({ width: 600, height: 620 });
  expect(resized.plot).toEqual({ x: 55, y: 235, width: 517, height: 315 });
  await moveMouse(canvas, { x: 313.5, y: 392.5 });
  await controller.settled();
  const hovered = controller.getState();
  expect(hovered.inspection).toBeCloseTo(5, 8);
  expect(hovered.results).toHaveLength(2);
  for (const result of hovered.results) {
    expect(result.y).toBeCloseTo(20, 8);
    expect(result.anchor.x).toBeCloseTo(258.5, 8);
    expect(result.anchor.y).toBeCloseTo(157.5, 8);
  }
});

it('verifies explicit duplicate policies and original record identity after equal-x reordering', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas });
  await controller.perform('interpolated-x');
  const snapshots = [];
  for (const [action, y, id, index] of [
    ['duplicate-first', 10, 'low', 1],
    ['duplicate-last', 30, 'high', 2],
    ['duplicate-reordered', 30, 'high', 1],
  ] as const) {
    await controller.perform(action);
    await moveMouse(canvas, { x: 513.5, y: 362.5 });
    await controller.settled();
    const state = controller.getState(); snapshots.push(state);
    expect(state.results).toHaveLength(2);
    expect(state.results[0]).toMatchObject({ series: 'monthly', kind: 'exact', x: 5, y, provenance: { kind: 'recorded', index, id } });
    expect(state.results[0].anchor).toEqual({ x: 458.5, y: 375 * (1 - y / 40) });
    expect(state.results[1]).toMatchObject({ series: 'adjusted', kind: 'interpolated', x: 5, y: 20 });
    await moveMouse(canvas, { x: 55 + 917 / 4, y: 362.5 });
    await controller.settled();
    const between = controller.getState().results[0];
    expect(between).toMatchObject({ series: 'monthly', kind: 'interpolated', x: 2.5, y: (10 + y) / 2,
      provenance: { kind: 'interpolated', beforeIndex: 0, afterIndex: index, beforeId: 'start', afterId: id, fraction: 0.5 } });
  }
  expect(snapshots.map(value => value.generation)).toEqual([1, 2, 3]);
  expect(snapshots[0].results[0].provenance.id).toBe('low');
});

it('verifies nearest-x ties in unsorted source order, pointer-y independence and empty clearing', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas });
  await controller.perform('nearest-unsorted');
  let previous;
  for (const [x, selectedX, y, id, index] of [
    [5, 5, 30, 'high', 1], [2.5, 5, 30, 'high', 1], [7.5, 10, 30, 'end', 0],
  ] as const) {
    for (const pointerY of [200, 500]) {
      await moveMouse(canvas, { x: 55 + 917 * x / 10, y: pointerY });
      await controller.settled();
      const state = controller.getState();
      expect(state.mode).toBe('nearest-per-line');
      expect(state.inspection).toBeCloseTo(x, 8);
      expect(state.results).toHaveLength(2);
      expect(state.results[0]).toMatchObject({ series: 'monthly', kind: 'recorded', x: selectedX, y, provenance: { kind: 'recorded', index, id } });
      expect(state.results[0].anchor).toEqual({ x: 917 * selectedX / 10, y: 93.75 });
      previous = state;
    }
  }
  await controller.perform('empty-data');
  await moveMouse(canvas, { x: 513.5, y: 362.5 });
  await controller.settled();
  const empty = controller.getState();
  expect(empty.generation).toBe(2);
  expect(empty.results).toHaveLength(1);
  expect(empty.results[0]).toMatchObject({ series: 'adjusted', kind: 'recorded', x: 2, y: 30, provenance: { kind: 'recorded', index: 0, id: null } });
  expect(previous?.results).toHaveLength(2);
  await moveMouse(canvas, { x: 10, y: 10 });
  await controller.settled();
  expect(controller.getState()).toMatchObject({ inspection: null, results: [] });
});

it('verifies native closest-point distance, its inclusive cutoff and absence beyond it', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas });
  await controller.perform('closest-point');
  for (const distance of [30, 40, 40.25]) {
    // Recorded (0,10) maps to local (0,281.25). Every input here is native.
    await moveMouse(canvas, { x: 55 + distance, y: 456.25 });
    await controller.settled();
    const state = controller.getState();
    expect(state.pointer).toEqual({ x: distance, y: 281.25 });
    expect(state.results).toHaveLength(distance <= 40 ? 1 : 0);
    if (distance <= 40) expect(state.results[0]).toMatchObject({
      series: 'monthly', kind: 'recorded', x: 0, y: 10,
      anchor: { x: 0, y: 281.25 },
      distance: { space: 'plot-pixels', value: distance },
      provenance: { kind: 'recorded', index: 0, id: null },
    });
  }
  // Same x, very different y: nearest-x still selects records; screen distance does not.
  await moveMouse(canvas, { x: 85, y: 185 });
  await controller.settled();
  expect(controller.getState().results).toEqual([]);
  await controller.perform('nearest-per-line');
  const nearest = controller.getState();
  expect(nearest.results).toHaveLength(2);
  expect(nearest.results[0]).toMatchObject({ series: 'monthly', x: 0, y: 10, distance: { space: 'domain-x' } });
  expect(nearest.results[0].distance.value).toBeCloseTo(30 * 10 / 917, 8);
  await controller.perform('closest-point');
  await moveMouse(canvas, { x: 238.4, y: 268.75 });
  await controller.settled();
  const second = controller.getState();
  expect(second.results).toHaveLength(1);
  expect(second.results[0]).toMatchObject({ series: 'adjusted', x: 2, y: 30, provenance: { index: 0 } });
  // Native input quantizes non-binary fractions; allow less than 0.0001 logical pixel.
  expect(second.results[0].distance.value).toBeLessThan(0.0001);
});

it('exposes weighted aggregation evidence independently of correct chart geometry', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px';
  const host = document.createElement('div'); document.body.append(canvas, host);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas, referenceHost: host });
  await controller.perform('weighted-data');
  await moveMouse(canvas, { x: 55 + 917 / 4, y: 362.5 });
  await controller.settled();
  const state = controller.getState();
  // Hand-computed oracle: (0*3+40*1)/4=10; (0*1+40*3)/4=30.
  // At x=2.5 the weighted line is 15, whereas unweighted means produce 20.
  expect(state.pipeline).toEqual({
    generation: 1, operation: 'weighted-mean', units: 'score', rounding: 'none',
    inputCount: 5, includedCount: 4, excludedCount: 1, outputCount: 2,
    groups: [
      { x: 0, count: 2, weightedSum: 40, weightSum: 4, value: 10 },
      { x: 10, count: 2, weightedSum: 120, weightSum: 4, value: 30 },
    ],
  });
  expect(state.results[0]).toMatchObject({ series: 'monthly', x: 2.5, y: 15, anchor: { x: 229.25, y: 234.375 } });
  expect(JSON.parse(host.querySelector('script')!.textContent!).state.pipeline).toEqual(state.pipeline);
  await controller.perform('update-data');
  expect(controller.getState().pipeline).toBeNull();
  expect(state.pipeline.generation).toBe(1);
});

it('diagnoses an injected unweighted mean and verifies repair without changing geometry', async () => {
  const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 620;
  canvas.style.cssText = 'width:1000px;height:620px'; document.body.append(canvas);
  controller = await (await loadScenario(getScenarioBySlug('viz-hover-lab')!)).mount({ canvas });
  await controller.perform('weighted-data-bug');
  await moveMouse(canvas, { x: 284.25, y: 362.5 });
  await controller.settled();
  const broken = controller.getState();
  expect(broken.pipeline.groups.map((g: any) => g.value)).toEqual([20, 20]);
  expect(broken.pipeline.groups.map((g: any) => g.weightedSum / g.weightSum)).toEqual([10, 30]);
  expect(broken.results[0]).toMatchObject({ x: 2.5, y: 20, anchor: { x: 229.25, y: 187.5 } });
  await controller.perform('weighted-data');
  const repaired = controller.getState();
  expect(repaired.generation).toBe(broken.generation + 1);
  expect(repaired.plot).toEqual(broken.plot);
  expect(repaired.pipeline.groups.map((g: any) => g.value)).toEqual([10, 30]);
  expect(repaired.results[0]).toMatchObject({ x: 2.5, y: 15, anchor: { x: 229.25, y: 234.375 } });
  expect(broken.pipeline.groups.map((g: any) => g.value)).toEqual([20, 20]);
});
