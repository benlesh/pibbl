import { KeyboardNavigation, FocusManagement, Clip, Group, Layer, Line, Rectangle, computed, crc, defineRenderLayer, signal, type CRCController, type CRCNode } from '@crc/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { signalGraphSnapshot } from '../src/lib/signals/graph';
import { ManualSchedulerDriver, installSchedulerDriverForTest, snapshotRealmScheduler } from '../src/lib/scheduler/testing';
import { clickMouse, cssPointForIntrinsic } from './support/mouse-input';
import { tab, pointerDownLogicalPoint, pointerMoveLogicalPoint, pointerUpLogicalPoint } from './support/user-input';
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
  function Scene() { renders++; return <Rectangle style={{ left: 20, top: 20, width: 80, height: 40, fill: visible }} onClick={() => undefined} />; }
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
    expect(observation.focus).toMatchObject({ status: 'unconfigured', policy: null });
    expect(Object.isFrozen(observation.records[0])).toBe(true);
    expect(inspector.probe(observation.generation!, 30, 30).status).toBe('target');
    expect(inspector.convert(observation.generation!, 'root-logical', 'backing', { x: 30, y: 30 }).status).toBe('mapped');
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
    function Scene() { renders++; return <Rectangle style={{ left: source.get(), top: 0, width: 10, height: 10, fill: '#fff' }} />; }
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
  controller = crc(canvas, Array.from({ length: 65 }, (_, index) => <Rectangle key={index} style={{ left: index, top: 0, width: 10, height: 10, fill: '#fff' }} />));
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const tooLarge = inspector.snapshot();
  expect(tooLarge.records).toHaveLength(64);
  expect(tooLarge.completeness).toBe('truncated');
  expect(inspector.probe(tooLarge.generation!, 5, 5)).toMatchObject({ status: 'truncated', nativeCalls: 0, targetId: null });
  crc(canvas, <Layer style={{ width: 100, height: 100 }}><Rectangle style={{ width: 50, height: 50, fill: '#fff' }} /></Layer>);
  driver.flush(2);
  expect(inspector.probe(inspector.snapshot().generation!, 5, 5)).toMatchObject({ status: 'target' });
  const path = new Path2D(); path.rect(0, 0, 10, 10);
  crc(canvas, <Group style={{ translateX: 30, translateY: 20 }}><Clip style={{ d: path }}><Rectangle style={{ width: 50, height: 50, fill: '#fff' }} /></Clip></Group>);
  driver.flush(3);
  expect(inspector.probe(inspector.snapshot().generation!, 35, 25).status).toBe('target');
  const clipped = inspector.probe(inspector.snapshot().generation!, 50, 40);
  expect(clipped.status).toBe('miss');
  expect(clipped.candidates[0]?.outcome).toBe('clip-excluded');
  expect(clipped.candidates[0]).toMatchObject({ geometry: 'hit' });
  const outsideBoth = inspector.probe(inspector.snapshot().generation!, 90, 90);
  expect(outsideBoth.candidates[0]).toMatchObject({ outcome: 'clip-excluded', geometry: 'miss' });
  const previous = inspector.snapshot();
  controller.dispose();
  controller = crc(canvas, <Rectangle style={{ width: 50, height: 50, fill: '#fff' }} />);
  driver.flush(4);
  expect(inspector.probe(previous.generation!, 5, 5).status).toBe('unavailable');
  expect(inspector.snapshot().status).toBe('stale-root');
});


it('never invokes external renderer hit resolvers, even behind a normal Canvas target', () => {
  const canvas = host();
  let calls = 0;
  const External = defineRenderLayer<{}, {}>({
    create(context) { context.canvas.getContext('2d'); return {}; },
    render() {},
    interaction: { settle: () => ({ targets: [], hitTest() { calls++; throw new Error('Inspector must not call application picking'); } }) },
  });
  controller = crc(canvas, <><External style={{ width: 100, height: 100 }} /><Rectangle style={{ width: 50, height: 50, fill: '#fff' }} /></>);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  expect(inspector.snapshot().records.some(record => record.kind === 'resolver')).toBe(true);
  expect(inspector.probe(inspector.snapshot().generation!, 5, 5)).toMatchObject({ status: 'unsupported', nativeCalls: 0, targetId: null });
  expect(calls).toBe(0);
});


it('probes transformed clipped Layers with bounded snapshots and rejects stale child updates', async () => {
  const canvas = host();
  const x = signal(0);
  const clip = new Path2D(); clip.rect(0, 0, 25, 30);
  let delivered: number | null = null;
  controller = crc(canvas, <Group style={{ translateX: 80, translateY: 40 }}><Group style={{ scaleX: 2, scaleY: 2 }}>
    <Layer style={{ width: 60, height: 60 }}><Clip style={{ d: clip }}>
      <Rectangle style={{ left: x, width: 40, height: 40, fill: '#fff' }} onClick={event => { delivered = inspector.identifyTarget(event.target); }} />
    </Clip></Layer>
  </Group></Group>, { pixelRatio: 2 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const nativePathProbe = vi.spyOn(canvas.getContext('2d')!, 'isPointInPath');
  const nativeStrokeProbe = vi.spyOn(canvas.getContext('2d')!, 'isPointInStroke');
  const snapshot = inspector.snapshot();
  expect(nativePathProbe).not.toHaveBeenCalled();
  expect(nativeStrokeProbe).not.toHaveBeenCalled();
  nativePathProbe.mockRestore();
  nativeStrokeProbe.mockRestore();
  expect(snapshot.records.some(record => record.kind === 'path')).toBe(true);
  const pathRecord = snapshot.records.find(record => record.kind === 'path')!;
  expect(pathRecord.clips).toEqual([
    { kind: 'surface-bounds', entryOrder: 0, stackIndex: null, fillRule: 'nonzero',
      surfacePath: [], coordinateSpace: 'clip-local-to-root-logical', geometry: 'opaque-path',
      localToSurface: [2, 0, 0, 2, 80, 40], transform: [2, 0, 0, 2, 80, 40] },
    { kind: 'clip', entryOrder: 1, stackIndex: 0, fillRule: 'nonzero',
      surfacePath: [0], coordinateSpace: 'clip-local-to-root-logical', geometry: 'opaque-path',
      localToSurface: [1, 0, 0, 1, 0, 0], transform: [2, 0, 0, 2, 80, 40] },
  ]);
  expect(Object.isFrozen(pathRecord.clips)).toBe(true);
  expect(Object.isFrozen(pathRecord.clips[1].surfacePath)).toBe(true);
  expect(Object.isFrozen(pathRecord.clips[1].localToSurface)).toBe(true);
  expect(inspector.convert(snapshot.generation!, 'entry-local', 'root-logical', { x: 10, y: 10 }, 'point', pathRecord.order)).toMatchObject({ status: 'mapped', value: { x: 100, y: 60 } });
  expect(inspector.convert(snapshot.generation!, 'backing', 'entry-local', { x: 200, y: 120 }, 'point', pathRecord.order)).toMatchObject({ status: 'mapped', value: { x: 10, y: 10 } });
  expect(inspector.convert(snapshot.generation!, 'entry-local', 'root-logical', { x: 10, y: 10 }, 'vector', pathRecord.order)).toMatchObject({ status: 'mapped', value: { x: 20, y: 20 } });
  const prediction = inspector.probe(snapshot.generation!, 100, 60);
  expect(prediction.status).toBe('target');
  await clickMouse(canvas, cssPointForIntrinsic(canvas, { x: 100, y: 60 }));
  expect(delivered).toBe(prediction.targetId);
  delivered = null;
  await clickMouse(canvas, cssPointForIntrinsic(canvas, { x: 150, y: 60 }));
  expect(delivered).toBeNull();
  const clipped = inspector.probe(snapshot.generation!, 150, 60);
  expect(clipped.status).toBe('miss');
  expect(clipped.candidates[0]).toMatchObject({
    outcome: 'clip-excluded',
    exclusion: { kind: 'clip', entryOrder: 1, stackIndex: 0, transform: [2, 0, 0, 2, 80, 40], fillRule: 'nonzero' },
  });
  expect(Object.isFrozen(clipped.candidates[0]?.exclusion)).toBe(true);
  const outsideLayer = inspector.probe(snapshot.generation!, 210, 60);
  expect(outsideLayer.candidates[0]).toMatchObject({
    outcome: 'clip-excluded',
    exclusion: { kind: 'surface-bounds', entryOrder: 0, stackIndex: null, transform: [2, 0, 0, 2, 80, 40] },
  });
  expect(prediction.candidates[0]?.exclusion).toBeNull();
  expect(inspector.probe(snapshot.generation!, 210, 60).status).toBe('miss');
  x.set(30); driver.flush(2);
  expect(inspector.probe(snapshot.generation!, 100, 60).status).toBe('stale');
  expect(inspector.probe(inspector.snapshot().generation!, 100, 60).status).toBe('miss');
  inspector.dispose();
});


it('applies the record budget across nested Layers before probing geometry', () => {
  const canvas = host();
  controller = crc(canvas, <Layer style={{ width: 100, height: 100 }}>
    {Array.from({ length: 64 }, (_, index) => <Rectangle key={index} style={{ width: 10, height: 10, fill: '#fff' }} />)}
  </Layer>);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const observation = inspector.snapshot();
  expect(observation.records).toHaveLength(64);
  expect(observation.totalRecords).toBeNull();
  expect(observation.completeness).toBe('truncated');
  expect(observation.records[1]?.surfacePath).toEqual([0]);
  expect(Object.isFrozen(observation.records[1]?.surfacePath)).toBe(true);
  expect(inspector.probe(observation.generation!, 5, 5)).toMatchObject({ status: 'truncated', nativeCalls: 0, targetId: null });
  inspector.dispose();
});


it('matches native sibling ordering and outer Layer bounds after a resize', async () => {
  const canvas = host();
  const width = signal(40);
  const showCover = signal(true);
  const deliveries: string[] = [];
  function Scene() {
    return <>
      <Layer style={{ width, height: 100 }}>
        <Layer style={{ width: 100, height: 100 }}>
          <Rectangle style={{ width: 90, height: 90, fill: '#00f' }} onClick={() => deliveries.push('nested')} />
        </Layer>
      </Layer>
      {showCover.get() ? <Rectangle style={{ width: 30, height: 30, fill: '#f00' }} onClick={() => deliveries.push('cover')} /> : null}
    </>;
  }
  controller = crc(canvas, <Scene />);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const first = inspector.snapshot();
  const overlapping = inspector.probe(first.generation!, 10, 10);
  expect(overlapping.candidates.filter(candidate => candidate.outcome === 'hit')).toHaveLength(2);
  expect(overlapping.targetId).toBe(first.records.at(-1)?.targetId);
  expect(first.records[2]?.surfacePath).toEqual([0, 1]);
  await clickMouse(canvas, { x: 10, y: 10 });
  expect(deliveries).toEqual(['cover']);
  const excluded = inspector.probe(first.generation!, 70, 10);
  expect(excluded.status).toBe('miss');
  expect(excluded.candidates.find(candidate => candidate.outcome === 'clip-excluded')?.exclusion).toMatchObject({ kind: 'surface-bounds', entryOrder: 0 });
  await clickMouse(canvas, { x: 70, y: 10 });
  expect(deliveries).toEqual(['cover']);

  width.set(100); showCover.set(false); driver.flush(2);
  expect(inspector.probe(first.generation!, 70, 10).status).toBe('stale');
  const resized = inspector.snapshot();
  expect(resized.records.filter(record => record.kind === 'path')).toHaveLength(1);
  expect(inspector.probe(resized.generation!, 70, 10)).toMatchObject({ status: 'target', targetId: resized.records[2]?.targetId });
  await clickMouse(canvas, { x: 70, y: 10 });
  expect(deliveries).toEqual(['cover', 'nested']);
  inspector.dispose();
});

it('refuses excessive Layer depth without native work and releases all Layer resources', () => {
  const canvas = host();
  const diagnostics = activeDiagnostics = new RuntimeDiagnostics(canvas);
  let scene: CRCNode = <Rectangle style={{ width: 10, height: 10, fill: '#fff' }} />;
  for (let depth = 0; depth < 17; depth++) scene = <Layer style={{ width: 20, height: 20 }}>{scene}</Layer>;
  controller = crc(canvas, scene);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const before = diagnostics.snapshot();
  const state = inspector.snapshot();
  expect(state.completeness).toBe('truncated');
  expect(state.records.length).toBeLessThan(64);
  expect(inspector.probe(state.generation!, 5, 5)).toMatchObject({ status: 'truncated', nativeCalls: 0, targetId: null });
  expect(diagnostics.snapshot()).toEqual(before);
  inspector.dispose(); controller.dispose();
  expect(diagnostics.snapshot()).toMatchObject({ instances: 0, nativeListeners: 0, scheduledFrames: 0 });
});


it('bounds clip metadata traversal before allocating an oversized snapshot', () => {
  const canvas = host();
  const clip = new Path2D(); clip.rect(0, 0, 20, 20);
  let scene: CRCNode = <Rectangle style={{ width: 10, height: 10, fill: '#fff' }} />;
  for (let depth = 0; depth < 129; depth++) scene = <Clip style={{ d: clip }}>{scene}</Clip>;
  controller = crc(canvas, scene);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const state = inspector.snapshot();
  expect(state.completeness).toBe('truncated');
  expect(state.records).toHaveLength(0);
  expect(inspector.probe(state.generation!, 5, 5)).toMatchObject({ status: 'truncated', nativeCalls: 0, targetId: null });
  inspector.dispose();
});


it('reports logical capture separately from geometry without changing native drag delivery', async () => {
  const canvas = host(); let pointerId = -1; let delivered: number | null = null;
  controller = crc(canvas, <>
    <Rectangle style={{ width: 40, height: 40, fill: '#00f' }}
      onPointerDown={event => { pointerId = event.pointerId; event.currentTarget.setPointerCapture(pointerId); }}
      onPointerMove={event => { delivered = inspector.identifyTarget(event.target); }} />
    <Rectangle style={{ left: 100, width: 40, height: 40, fill: '#f00' }} />
  </>);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const before = inspector.snapshot();
  const ownerId = inspector.probe(before.generation!, 10, 10).targetId;
  const geometricId = inspector.probe(before.generation!, 110, 10).targetId;
  await pointerDownLogicalPoint(canvas, { x: 10, y: 10 });
  try {
    await pointerMoveLogicalPoint(canvas, { x: 110, y: 10 });
    expect(delivered).toBe(ownerId);
    const captured = inspector.snapshot();
    expect(captured.pointerCapture).toMatchObject({ completeness: 'complete', records: [{ pointerId, targetId: ownerId, live: true }] });
    expect(inspector.probe(before.generation!, 110, 10)).toMatchObject({ targetId: geometricId, routing: 'geometry-only' });
    expect(Object.isFrozen(captured.pointerCapture.records[0])).toBe(true);
  } finally { await pointerUpLogicalPoint(canvas, { x: 110, y: 10 }); }
  expect(inspector.snapshot().pointerCapture.records).toEqual([]);
  inspector.dispose();
});


it('observes native Canvas focus and logical keyboard order independently', async () => {
  const canvas = host();
  const before = document.createElement('button'), after = document.createElement('button');
  before.textContent = 'before'; after.textContent = 'after'; canvas.before(before); canvas.after(after);
  controller = crc(canvas, <FocusManagement><Group>
    <KeyboardNavigation mode="directional"><Rectangle style={{ width: 40, height: 40, fill: '#00f' }} onClick={() => undefined} /></KeyboardNavigation>
    <Rectangle style={{ left: 60, width: 40, height: 40, fill: '#f00' }} onClick={() => undefined} />
  </Group></FocusManagement>);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  before.focus();
  const initial = inspector.snapshot();
  expect(initial.focus).toMatchObject({ status: 'ready', nativeFocus: 'other', completeness: 'complete' });
  expect(initial.focus.records.map(record => record.targetId)).toEqual(initial.records.map(record => record.targetId));
  expect(initial.focus.policy).toEqual({ kind: 'crc-focus-management', tab: 'source-order-exit', keyboardActivation: 'enter-space' });
  const boundaryId = initial.focus.records[0].directionalBoundaryId;
  expect(boundaryId).toBeGreaterThan(0);
  expect(initial.focus.records[1].directionalBoundaryId).toBeNull();
  expect(inspector.snapshot().focus.records[0].directionalBoundaryId).toBe(boundaryId);
  expect(Object.isFrozen(initial.focus.policy)).toBe(true);
  await tab(); driver.flush(2);
  const first = inspector.snapshot();
  expect(document.activeElement).toBe(canvas);
  expect(first.focus).toMatchObject({ nativeFocus: 'canvas', targetId: first.focus.records[0]?.targetId, visible: true });
  await tab(); driver.flush(3);
  const second = inspector.snapshot();
  expect(second.focus.targetId).toBe(second.focus.records[1]?.targetId);
  await tab(); driver.flush(4);
  expect(document.activeElement).toBe(after);
  expect(inspector.snapshot().focus.nativeFocus).toBe('other');
  expect(first.focus.targetId).toBe(first.focus.records[0]?.targetId);
  inspector.dispose();
});

it('reports committed fitted surface geometry without measuring DOM and agrees with native input and pixels', async () => {
  const canvas = host();
  canvas.style.cssText = 'width:600px;height:400px';
  let delivered: { x: number; y: number } | null = null;
  controller = crc(canvas, <Rectangle style={{ left: 40, top: 20, width: 20, height: 20, fill: '#ff0000' }} onClick={event => { delivered = { x: event.x, y: event.y }; }} />, {
    viewport: { width: 300, height: 100 }, fit: 'contain', pixelRatio: 2,
  });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const previousMeasure = canvas.getBoundingClientRect;
  let snapshot;
  // Passive inspection must consume CRC's committed geometry, not flush layout.
  canvas.getBoundingClientRect = () => { throw new Error('Unexpected DOM measurement'); };
  try { snapshot = inspector.snapshot(); }
  finally { canvas.getBoundingClientRect = previousMeasure; }
  expect(snapshot.surface).toMatchObject({ status: 'available', scope: 'committed-root-surface', hostGeometry: 'unavailable',
    geometry: { mode: 'fixed', fit: 'contain', logical: { width: 300, height: 100 },
      cssContent: { width: 600, height: 400 }, backing: { width: 1200, height: 800 },
      backingPerCss: { x: 2, y: 2 }, backingPerLogical: { x: 4, y: 4 },
      logicalToBacking: [4, 0, 0, 4, 0, 200] } });
  const geometry = snapshot.surface.geometry!;
  expect(Object.isFrozen(geometry)).toBe(true);
  expect(Object.isFrozen(geometry.logicalToBacking)).toBe(true);
  const inverse = geometry.backingToLogical;
  expect(inverse[0] * 200 + inverse[2] * 320 + inverse[4]).toBe(50);
  expect(inverse[1] * 200 + inverse[3] * 320 + inverse[5]).toBe(30);
  // Independent expected positions: logical (50,30), backing (200,320), CSS (100,160).
  expect([...canvas.getContext('2d')!.getImageData(200, 320, 1, 1).data]).toEqual([255, 0, 0, 255]);
  expect(inspector.probe(snapshot.generation!, 50, 30).status).toBe('target');
  await clickMouse(canvas, { x: 100, y: 160 });
  expect(delivered).toEqual({ x: 50, y: 30 });
  controller.dispose();
  expect(inspector.snapshot().surface).toMatchObject({ status: 'unavailable', geometry: null });
  expect(geometry.logical).toEqual({ width: 300, height: 100 });
  inspector.dispose();
});

it('converts points and vectors only with matching committed geometry and explicit supported spaces', () => {
  const canvas = host(); canvas.style.cssText = 'width:600px;height:400px';
  const x = signal(40);
  controller = crc(canvas, <Rectangle style={{ left: x, top: 20, width: 20, height: 20, fill: '#ff0000' }} />, {
    viewport: { width: 300, height: 100 }, fit: 'contain', pixelRatio: 2,
  });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const snapshot = inspector.snapshot();
  const generation = snapshot.generation!;
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: 50, y: 30 })).toMatchObject({ status: 'mapped', value: { x: 200, y: 320 } });
  expect(inspector.convert(generation, 'backing', 'css-content', { x: 200, y: 320 })).toMatchObject({ status: 'mapped', value: { x: 100, y: 160 } });
  expect(inspector.convert(generation, 'css-content', 'root-logical', { x: 100, y: 160 })).toMatchObject({ status: 'mapped', value: { x: 50, y: 30 } });
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: 50, y: 30 }, 'vector')).toMatchObject({ status: 'mapped', value: { x: 200, y: 120 } });
  expect(inspector.convert(generation, 'css-content', 'root-logical', { x: 100, y: 160 }, 'vector')).toMatchObject({ status: 'mapped', value: { x: 50, y: 80 } });
  expect(inspector.convert(generation, 'client', 'root-logical', { x: 100, y: 160 }).status).toBe('unsupported');
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: NaN, y: 0 }).status).toBe('invalid');
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: Number.MAX_VALUE, y: 0 }).status).toBe('invalid');
  const historical = inspector.convert(generation, 'root-logical', 'backing', { x: 50, y: 30 });
  expect(Object.isFrozen(historical.value)).toBe(true);
  x.set(50); driver.flush(2);
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: 50, y: 30 })).toMatchObject({ status: 'stale', value: null });
  expect(historical.value).toEqual({ x: 200, y: 320 });
  inspector.dispose();
  expect(inspector.convert(generation, 'root-logical', 'backing', { x: 50, y: 30 })).toMatchObject({ status: 'unavailable', value: null });
});

it('tracks fractional responsive resize and hidden-host recovery without reusing old geometry', async () => {
  const canvas = host(); canvas.style.cssText = 'display:block;width:600px;height:400px';
  const delivered: { x: number; y: number }[] = [];
  controller = crc(canvas, <Rectangle style={{ left: 20, top: 20, width: 20, height: 20, fill: '#ff0000' }} onClick={event => { delivered.push({ x: event.x, y: event.y }); }} />, { viewport: 'responsive', pixelRatio: 1.5 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const original = inspector.snapshot();
  expect(original.surface.geometry).toMatchObject({ configuredPixelRatio: 1.5, mode: 'responsive', fit: 'fill', logical: { width: 600, height: 400 }, backing: { width: 900, height: 600 } });
  let time = 1;
  canvas.style.width = '300.25px'; canvas.style.height = '100.5px';
  // Poll actual committed predicates while the native ResizeObserver schedules work.
  await expect.poll(() => { driver.flush(++time); return inspector.snapshot().surface.geometry?.logical; }).toEqual({ width: 300.25, height: 100.5 });
  const resized = inspector.snapshot();
  expect(resized.surface.geometry).toMatchObject({ cssContent: { width: 300.25, height: 100.5 }, backing: { width: 450, height: 151 }, backingPerCss: { x: 450 / 300.25, y: 151 / 100.5 } });
  expect(resized.generation!.render).toBeGreaterThan(original.generation!.render);
  expect(inspector.convert(original.generation!, 'root-logical', 'backing', { x: 30, y: 30 }).status).toBe('stale');
  const converted = inspector.convert(resized.generation!, 'root-logical', 'backing', { x: 30, y: 30 });
  expect(converted.status).toBe('mapped');
  // Browser DOMMatrix storage rounds fractional scale components; tolerate 0.0001 backing pixel.
  expect(Math.abs(converted.value!.x - 30 * 450 / 300.25)).toBeLessThan(0.0001);
  expect(Math.abs(converted.value!.y - 30 * 151 / 100.5)).toBeLessThan(0.0001);
  expect([...canvas.getContext('2d')!.getImageData(45, 45, 1, 1).data]).toEqual([255, 0, 0, 255]);
  await clickMouse(canvas, { x: 30, y: 30 });
  expect(delivered).toHaveLength(1);
  expect(Math.abs(delivered[0].x - 30)).toBeLessThan(0.0001); expect(Math.abs(delivered[0].y - 30)).toBeLessThan(0.0001);
  canvas.style.display = 'none';
  await expect.poll(() => { driver.flush(++time); return inspector.snapshot().surface.status; }).toBe('unavailable');
  expect(inspector.snapshot().surface.geometry).toBeNull();
  expect(inspector.convert(resized.generation!, 'root-logical', 'backing', { x: 30, y: 30 })).toMatchObject({ status: 'unavailable', value: null });
  expect(inspector.probe(resized.generation!, 30, 30).status).toBe('unavailable');
  canvas.style.display = 'block';
  await expect.poll(() => { driver.flush(++time); return inspector.snapshot().surface.status; }).toBe('available');
  const restored = inspector.snapshot();
  expect(restored.generation!.render).toBeGreaterThan(resized.generation!.render);
  expect(inspector.convert(resized.generation!, 'root-logical', 'backing', { x: 30, y: 30 }).status).toBe('stale');
  expect(inspector.probe(restored.generation!, 30, 30).status).toBe('target');
  expect(original.surface.geometry!.logical).toEqual({ width: 600, height: 400 });
  inspector.dispose();
});

it('rejects missing and singular entry mappings while preserving forward points and vectors', () => {
  const canvas = host();
  const scale = signal(-2);
  controller = crc(canvas, <Group style={{ translateX: 80, translateY: 40 }}><Group style={{ scaleX: scale, scaleY: 3 }}>
    <Rectangle style={{ width: 20, height: 20, fill: '#fff' }} />
  </Group></Group>);
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const first = inspector.snapshot();
  const order = first.records.find(record => record.kind === 'path')!.order;
  expect(inspector.convert(first.generation!, 'entry-local', 'root-logical', { x: 5, y: 4 }, 'point', order)).toMatchObject({ status: 'mapped', value: { x: 70, y: 52 } });
  const inverse = inspector.convert(first.generation!, 'root-logical', 'entry-local', { x: 70, y: 52 }, 'point', order);
  expect(inverse.status).toBe('mapped');
  expect(inverse.value!.x).toBeCloseTo(5, 12);
  expect(inverse.value!.y).toBeCloseTo(4, 12);
  expect(inspector.convert(first.generation!, 'root-logical', 'entry-local', { x: -10, y: 12 }, 'vector', order)).toMatchObject({ status: 'mapped', value: { x: 5, y: 4 } });
  for (const missing of [undefined, -1, 0.5, 100]) {
    expect(inspector.convert(first.generation!, 'entry-local', 'root-logical', { x: 0, y: 0 }, 'point', missing)).toMatchObject({ status: 'invalid', value: null });
  }
  scale.set(0); driver.flush(2);
  expect(inspector.convert(first.generation!, 'entry-local', 'root-logical', { x: 0, y: 0 }, 'point', order)).toMatchObject({ status: 'stale', value: null });
  const singular = inspector.snapshot();
  expect(inspector.convert(singular.generation!, 'entry-local', 'root-logical', { x: 5, y: 4 }, 'point', order)).toMatchObject({ status: 'mapped', value: { x: 80, y: 52 } });
  expect(inspector.convert(singular.generation!, 'root-logical', 'entry-local', { x: 80, y: 52 }, 'point', order)).toMatchObject({ status: 'unsupported', value: null, reason: expect.stringContaining('singular') });
  inspector.dispose();
});

it('distinguishes a line interaction band from its painted stroke and endpoint misses', async () => {
  const canvas = host();
  let clicks = 0;
  controller = crc(canvas, <Line style={{ coords: [[40, 60], [140, 60]], stroke: '#ff0000', strokeWidth: 2, lineInteractionWidth: 20 }} onClick={() => { clicks++; }} />, { pixelRatio: 1 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const snapshot = inspector.snapshot();
  const record = snapshot.records.find(record => record.kind === 'path')!;
  expect(record).toMatchObject({ fill: false, strokeInteractionWidth: 20 });
  expect('strokeWidth' in record).toBe(false);
  const context = canvas.getContext('2d')!;
  expect([...context.getImageData(80, 60, 1, 1).data]).toEqual([255, 0, 0, 255]);
  expect(context.getImageData(80, 68, 1, 1).data[3]).toBe(0);
  expect(inspector.probe(snapshot.generation!, 80, 68)).toMatchObject({ status: 'target', targetId: record.targetId });
  await clickMouse(canvas, { x: 80, y: 68 });
  expect(clicks).toBe(1);
  for (const point of [{ x: 80, y: 72 }, { x: 145, y: 60 }]) {
    expect(inspector.probe(snapshot.generation!, point.x, point.y)).toMatchObject({ status: 'miss', candidates: [{ geometry: 'miss', outcome: 'geometry-miss' }] });
    await clickMouse(canvas, point);
    expect(clicks).toBe(1);
  }
  inspector.dispose();
});

it('labels focus rectangles as navigation envelopes rather than exact rotated hit geometry', async () => {
  const canvas = host();
  let clicks = 0;
  controller = crc(canvas, <FocusManagement><Group style={{ translateX: 100, translateY: 100 }}><Group style={{ rotationDegrees: 45 }}>
    <Rectangle style={{ width: 40, height: 20, fill: '#ff0000' }} onClick={() => { clicks++; }} />
  </Group></Group></FocusManagement>, { pixelRatio: 1 });
  driver.flush(1);
  const inspector = createTargetingInspector(canvas);
  const snapshot = inspector.snapshot();
  expect(snapshot.focus.boundsSemantics).toEqual({ coordinateSpace: 'root-logical', representation: 'axis-aligned-envelope', source: 'navigation-metadata', paintedGeometryRelation: 'unknown', hitGeometryRelation: 'unknown' });
  const bounds = snapshot.focus.records[0].bounds!;
  expect(bounds.x).toBeCloseTo(100 - 20 / Math.sqrt(2), 10);
  expect(bounds.y).toBeCloseTo(100, 10);
  expect(bounds.width).toBeCloseTo(60 / Math.sqrt(2), 10);
  expect(bounds.height).toBeCloseTo(60 / Math.sqrt(2), 10);
  // This point is inside the reported envelope but outside the rotated shape.
  expect(87).toBeGreaterThan(bounds.x);
  expect(101).toBeGreaterThan(bounds.y);
  expect(inspector.probe(snapshot.generation!, 87, 101).status).toBe('miss');
  expect(canvas.getContext('2d')!.getImageData(87, 101, 1, 1).data[3]).toBe(0);
  await clickMouse(canvas, { x: 87, y: 101 });
  expect(clicks).toBe(0);
  expect(inspector.probe(snapshot.generation!, 110, 120).status).toBe('target');
  await clickMouse(canvas, { x: 110, y: 120 });
  expect(clicks).toBe(1);
  inspector.dispose();
});
