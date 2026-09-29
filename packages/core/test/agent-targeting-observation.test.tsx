import { Clip, Group, Layer, Rectangle, computed, crc, signal, type CRCController } from '@crc/core';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { signalGraphSnapshot } from '../src/lib/signals/graph';
import { ManualSchedulerDriver, installSchedulerDriverForTest, snapshotRealmScheduler } from '../src/lib/scheduler/testing';
import { RuntimeDiagnostics } from './support/runtime-diagnostics';

let driver: ManualSchedulerDriver;
let restore: () => void;
let controller: CRCController | undefined;
let activeDiagnostics: RuntimeDiagnostics | undefined;
beforeEach(() => {
  driver = new ManualSchedulerDriver();
  restore = installSchedulerDriverForTest(driver);
});
afterEach(() => { controller?.dispose(); controller = undefined; activeDiagnostics?.restore(); activeDiagnostics = undefined; restore(); document.body.replaceChildren(); });
function host() {
  const canvas = document.createElement('canvas');
  canvas.width = 480; canvas.height = 240;
  canvas.style.cssText = 'width:480px;height:240px';
  document.body.append(canvas);
  return canvas;
}

it('inspection preserves lazy evaluation, graph edges, scheduler work, Canvas state and ownership', () => {
  const canvas = host();
  const diagnostics = activeDiagnostics = new RuntimeDiagnostics(canvas);
  const baseline = signalGraphSnapshot();
  const source = signal(0);
  let evaluations = 0;
  let dormantEvaluations = 0;
  let renders = 0;
  const visible = computed(() => { evaluations++; return source.get() ? '#008000' : '#0000ff'; });
  const dormant = computed(() => { dormantEvaluations++; return source.get(); });
  function Scene() { renders++; return <Rectangle style={{ x: 20, y: 20, width: 80, height: 40, fill: visible }} onClick={() => undefined} />; }
  controller = crc(canvas, <Scene />, { pixelRatio: 1 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const graph = signalGraphSnapshot();
  const scheduler = snapshotRealmScheduler();
  const resources = diagnostics.snapshot();
  const ledger = diagnostics.ledgerSnapshot();
  const context = canvas.getContext('2d')!;
  context.setTransform(2, 0, 0, 3, 7, 11);
  context.lineWidth = 13;
  const transform = context.getTransform().toString();
  const rendered = renders;
  for (let index = 0; index < 50; index++) {
    const observation = inspector.snapshot();
    expect(observation.status).toBe('ready');
    expect(Object.isFrozen(observation.records[0])).toBe(true);
    expect(inspector.probe(observation.generation!, 30, 30).status).toBe('target');
  }
  expect(signalGraphSnapshot()).toEqual(graph);
  expect(snapshotRealmScheduler()).toEqual(scheduler);
  expect(diagnostics.snapshot()).toEqual(resources);
  expect(diagnostics.ledgerSnapshot()).toEqual(ledger);
  expect(context.getTransform().toString()).toBe(transform);
  expect(context.lineWidth).toBe(13);
  expect(evaluations).toBe(1);
  expect(dormantEvaluations).toBe(0);
  expect(renders).toBe(rendered);
  const original = inspector.snapshot();
  source.set(1);
  const pendingGraph = signalGraphSnapshot();
  const pendingScheduler = snapshotRealmScheduler();
  // Inspection must not validate either an observed pending or an unread computed.
  expect(inspector.snapshot()).toMatchObject({ status: 'ready', pendingRealmWork: true });
  expect(inspector.probe(original.generation!, 30, 30)).toMatchObject({ status: 'target', pendingRealmWork: true });
  expect(signalGraphSnapshot()).toEqual(pendingGraph);
  expect(snapshotRealmScheduler()).toEqual(pendingScheduler);
  expect(evaluations).toBe(1);
  driver.flush(2);
  expect(inspector.probe(original.generation!, 30, 30).status).toBe('stale');
  expect(evaluations).toBe(2);
  expect(dormantEvaluations).toBe(0);
  expect(dormant).toBeDefined();
  controller.dispose();
  expect(inspector.snapshot().status).toBe('stale-root');
  const after = signalGraphSnapshot();
  expect(after.rendererConsumers).toBe(baseline.rendererConsumers);
  expect(after.rendererEdges).toBe(baseline.rendererEdges);
  expect(after.computedSourceEdges).toBe(baseline.computedSourceEdges);
  expect(diagnostics.snapshot()).toMatchObject({ instances: 0, nativeListeners: 0, scheduledFrames: 0 });
  inspector.dispose();
  expect(inspector.snapshot().status).toBe('disposed');
  diagnostics.restore();
});

it('enabled inspection and disabled inspection have identical render and scheduling work', () => {
  const run = (enabled: boolean) => {
    const canvas = host();
    const source = signal(0);
    let renders = 0;
    function Scene() { renders++; return <Rectangle style={{ x: source.get(), y: 0, width: 10, height: 10, fill: '#fff' }} />; }
    const initialRequests = driver.requestCount;
    const graphBefore = signalGraphSnapshot();
    const mount = crc(canvas, <Scene />, { pixelRatio: 1 });
    driver.flush(1);
    const inspector = enabled ? createTargetingInspector(canvas) : undefined;
    if (inspector) { const state = inspector.snapshot(); inspector.probe(state.generation!, 5, 5); }
    source.set(1); driver.flush(2);
    if (inspector) { const state = inspector.snapshot(); inspector.probe(state.generation!, 5, 5); }
    mount.dispose(); inspector?.dispose(); canvas.remove();
    const graphAfter = signalGraphSnapshot();
    return {
      renders, requests: driver.requestCount - initialRequests,
      consumersCreated: graphAfter.createdRendererConsumers - graphBefore.createdRendererConsumers,
      consumersReleased: graphAfter.releasedRendererConsumers - graphBefore.releasedRendererConsumers,
      edgesCreated: graphAfter.createdRendererEdges - graphBefore.createdRendererEdges,
      edgesReleased: graphAfter.releasedRendererEdges - graphBefore.releasedRendererEdges,
      pending: driver.pendingHostFrames,
    };
  };
  expect(run(true)).toEqual(run(false));
});

it('reports bounded, unsupported, clipped and stale evidence instead of false matches', () => {
  const canvas = host();
  controller = crc(canvas, Array.from({ length: 65 }, (_, index) => <Rectangle key={index} style={{ x: index, y: 0, width: 10, height: 10, fill: '#fff' }} />));
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const tooLarge = inspector.snapshot();
  expect(tooLarge.records).toHaveLength(64);
  expect(tooLarge.completeness).toBe('truncated');
  expect(inspector.probe(tooLarge.generation!, 5, 5)).toMatchObject({ status: 'truncated', nativeCalls: 0, targetId: null });
  crc(canvas, <Layer style={{ width: 100, height: 100 }}><Rectangle style={{ width: 50, height: 50, fill: '#fff' }} /></Layer>);
  driver.flush(2);
  expect(inspector.probe(inspector.snapshot().generation!, 5, 5)).toMatchObject({ status: 'unsupported', nativeCalls: 0 });
  const path = new Path2D(); path.rect(0, 0, 10, 10);
  crc(canvas, <Group style={{ translateX: 30, translateY: 20 }}><Clip style={{ d: path }}><Rectangle style={{ width: 50, height: 50, fill: '#fff' }} /></Clip></Group>);
  driver.flush(3);
  expect(inspector.probe(inspector.snapshot().generation!, 35, 25).status).toBe('target');
  const clipped = inspector.probe(inspector.snapshot().generation!, 50, 40);
  expect(clipped.status).toBe('miss');
  expect(clipped.candidates[0]?.outcome).toBe('clip-excluded');
  const previous = inspector.snapshot();
  controller.dispose();
  controller = crc(canvas, <Rectangle style={{ width: 50, height: 50, fill: '#fff' }} />);
  driver.flush(4);
  expect(inspector.probe(previous.generation!, 5, 5).status).toBe('unavailable');
  expect(inspector.snapshot().status).toBe('stale-root');
});
