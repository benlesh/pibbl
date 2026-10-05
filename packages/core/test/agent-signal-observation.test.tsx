import { signalObserversForTest } from "./support/signal-observer";
import { jsxDEV } from '@crc/core/jsx-dev-runtime';
import type { CRCAdvanceParticipant } from '../src/lib/scheduler/types';
import { queueBeginCommand, registerAdvanceParticipant, queueFrameCompletion } from '../src/lib/scheduler/realm-scheduler';
import { createSchedulerHistory, observeScheduler } from '../../../tooling/agent-verification/scheduler';
import { computed, createElement, crc, Absolute, Group, Layer, Rectangle, signal, useReaction, useConst, useLayoutBox, type BoxStyle } from '@crc/core';
import { expect, it } from 'vitest';
import { createTargetingInspector } from '../../../tooling/agent-verification/targeting';
import { createSignalInspector } from '../../../tooling/agent-verification/signals';
import { ManualSchedulerDriver, installSchedulerDriverForTest, installSchedulerTraceCollectorForTest } from '../src/lib/scheduler/testing';
import { getSignalNode, signalGraphSnapshot } from '../src/lib/signals/graph';

it('observes cached signal state without evaluating formulas or payload getters', () => {
  let evaluations = 0;
  const source = signal(1);
  const lazy = computed(() => { evaluations++; return source.get() * 2; });
  let payloadReads = 0;
  const payload = signal({ get secret() { payloadReads++; throw new Error('must stay opaque'); } });
  const failing = computed(() => { throw new Error('private error'); });
  const inspector = createSignalInspector();
  inspector.register(source); inspector.register(lazy); inspector.register(payload); inspector.register(failing);
  const graph = signalGraphSnapshot();
  const first = inspector.snapshot();
  expect(first.records[1]).toMatchObject({ kind: 'computed', cache: 'never-read', validation: 'unobserved', preview: { kind: 'unavailable' } });
  expect(first.records[2]?.status === 'available' ? first.records[2].preview : null).toEqual({ kind: 'opaque', type: 'object' });
  expect(evaluations).toBe(0); expect(payloadReads).toBe(0);
  expect(signalGraphSnapshot()).toEqual(graph);
  expect(lazy.get()).toBe(2);
  source.set(2);
  expect(() => failing.get()).toThrow('private error');
  const cached = inspector.snapshot();
  expect(cached.records[1]).toMatchObject({ cache: 'value', validation: 'unobserved', preview: { kind: 'scalar', value: 2 } });
  expect(cached.records[3]).toMatchObject({ cache: 'error', preview: { kind: 'unavailable' } });
  expect(evaluations).toBe(1);
  expect(Object.isFrozen(cached.records[1]?.status === 'available' ? cached.records[1].preview : null)).toBe(true);
  inspector.dispose();
  expect(inspector.snapshot()).toMatchObject({ status: 'disposed', records: [] });
});

it('reports observed invalidation without validating or changing observer leases', () => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
  canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1); let evaluations = 0;
  const value = computed(() => { evaluations++; return source.get() * 2; });
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Rectangle style={{ width: value, height: 10, fill: '#fff' }} />);
  driver.flush(1);
  const inspector = createSignalInspector(); inspector.register(value);
  try {
    source.set(2);
    const graph = signalGraphSnapshot();
    const before = evaluations;
    for (let index = 0; index < 10; index++) expect(inspector.snapshot().records[0]).toMatchObject({ validation: 'check', cache: 'value' });
    expect(evaluations).toBe(before);
    expect(signalGraphSnapshot()).toEqual(graph);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('bounds registration and string previews without inspecting foreign signal-like objects', () => {
  const inspector = createSignalInspector();
  const text = signal('x'.repeat(200));
  expect(inspector.register(text)).toBe(inspector.register(text));
  expect(inspector.register({ get() { throw new Error('foreign'); } })).toBeNull();
  for (let index = 1; index < 64; index++) inspector.register(signal(index));
  expect(inspector.register(signal(65))).toBeNull();
  expect(inspector.snapshot()).toMatchObject({ status: 'ready', completeness: 'truncated' });
  const record = inspector.snapshot().records[0];
  expect(record?.status === 'available' ? record.preview : null).toEqual({ kind: 'scalar', value: 'x'.repeat(128), truncated: true });
  inspector.dispose();
});

it('reports recorded dynamic dependencies and readonly aliases without evaluating them', () => {
  const branch = signal(true); const left = signal(10); const right = signal(20);
  let evaluations = 0;
  const choice = computed(() => { evaluations++; return branch.get() ? left.get() : right.get(); });
  const inspector = createSignalInspector();
  const branchId = inspector.register(branch);
  expect(inspector.register(branch.asReadonly())).toBe(branchId);
  const leftId = inspector.register(left); const rightId = inspector.register(right);
  inspector.register(choice);
  expect(choice.get()).toBe(10);
  const before = inspector.snapshot();
  expect(before.records[3]).toMatchObject({ dependencies: { completeness: 'complete', count: 2, edges: [
    { sourceId: branchId, observedVersion: 0, sourceVersion: 0, subscribed: false },
    { sourceId: leftId, observedVersion: 0, sourceVersion: 0, subscribed: false },
  ] } });
  branch.set(false);
  expect(inspector.snapshot().records[3]).toMatchObject({ dependencies: { edges: [
    { sourceId: branchId, observedVersion: 0, sourceVersion: 1 }, { sourceId: leftId },
  ] } });
  expect(evaluations).toBe(1);
  expect(choice.get()).toBe(20);
  expect(inspector.snapshot().records[3]).toMatchObject({ dependencies: { edges: [
    { sourceId: branchId }, { sourceId: rightId },
  ] } });
  expect(before.records[3]).toMatchObject({ dependencies: { edges: [{ sourceVersion: 0 }, { sourceId: leftId }] } });
  inspector.dispose();
});

it('bounds dependency traversal and labels unregistered sources without discovering them', () => {
  const sources = Array.from({ length: 129 }, () => signal(1));
  const sum = computed(() => sources.reduce((total, source) => total + source.get(), 0));
  const inspector = createSignalInspector(); inspector.register(sum);
  expect(sum.get()).toBe(129);
  const graph = signalGraphSnapshot();
  const state = inspector.snapshot();
  expect(state.completeness).toBe('truncated');
  expect(state.records).toHaveLength(1);
  expect(state.records[0]).toMatchObject({ dependencies: { count: 129, completeness: 'truncated' } });
  const record = state.records[0];
  if (record?.status !== 'available') throw new Error('Expected registered computed');
  expect(record.dependencies.edges).toHaveLength(128);
  expect(record.dependencies.edges.every(edge => edge.sourceId === null)).toBe(true);
  expect(Object.isFrozen(record.dependencies.edges)).toBe(true);
  expect(signalGraphSnapshot()).toEqual(graph);
  inspector.dispose();
});

it('reports subscribed computed/render consumers and pending direct dirtiness without triggering evaluation', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1); let evaluations = 0;
  const derived = computed(() => { evaluations++; return source.get() * 2; });
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <><Rectangle style={{ left: source, width: 10, height: 10, fill: '#fff' }} /><Rectangle style={{ top: 20, width: derived, height: 10, fill: '#fff' }} /></>);
  driver.flush(1);
  const inspector = createSignalInspector(); inspector.register(source); const derivedId = inspector.register(derived);
  try {
    const initial = inspector.snapshot();
    const first = initial.records[0]; const second = initial.records[1];
    if (first?.status !== 'available' || second?.status !== 'available') throw new Error('Expected records');
    expect(first.observers.completeness).toBe('complete');
    expect(first.observers.records).toHaveLength(2);
    expect(first.observers.records.find(value => value.kind === 'computed')).toMatchObject({ registeredSignalId: derivedId });
    const direct = first.observers.records.find(value => value.kind === 'render')!;
    const indirect = second.observers.records[0];
    expect(direct.dirty).toBe(false); expect(indirect.dirty).toBe(false);
    expect(direct.consumerId).not.toBe(indirect.consumerId);
    source.set(2);
    const graph = signalGraphSnapshot(); const before = evaluations;
    const pending = inspector.snapshot();
    expect(pending.records[0]).toMatchObject({ observers: { records: expect.arrayContaining([expect.objectContaining({ consumerId: direct.consumerId, kind: 'render', dirty: true })]) } });
    expect(pending.records[1]).toMatchObject({ validation: 'check', observers: { records: [expect.objectContaining({ consumerId: indirect.consumerId, dirty: false })] } });
    expect(signalGraphSnapshot()).toEqual(graph); expect(evaluations).toBe(before);
    expect(direct.dirty).toBe(false);
    driver.flush(2);
    controller.dispose();
    for (const record of inspector.snapshot().records) expect(record).toMatchObject({ observerCount: 0, observers: { records: [], completeness: 'complete' } });
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('bounds direct observer traversal and never reads legacy callback flag getters', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, Array.from({ length: 129 }, (_, index) => <Rectangle key={index} style={{ left: source, width: 1, height: 1, fill: '#fff' }} />));
  driver.flush(1);
  const inspector = createSignalInspector(); inspector.register(source);
  try {
    const state = inspector.snapshot();
    expect(state.completeness).toBe('truncated');
    const record = state.records[0];
    if (record?.status !== 'available') throw new Error('Expected source');
    expect(record.observerCount).toBe(129);
    expect(record.observers.completeness).toBe('truncated');
    expect(record.observers.records).toHaveLength(128);
    expect(Object.isFrozen(record.observers.records)).toBe(true);
    controller.dispose();
    let reads = 0;
    const callback = Object.defineProperty(() => {}, 'renderInvalidation', { get() { reads++; throw new Error('Do not read callback flags'); } });
    const node = getSignalNode(source);
    signalObserversForTest(node).add(callback);
    try {
      expect(inspector.snapshot().records[0]).toMatchObject({ observerCount: 1, observers: { completeness: 'complete', records: [expect.objectContaining({ kind: 'other', dirty: null })] } });
      expect(reads).toBe(0);
    } finally { signalObserversForTest(node).delete(callback); }
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('attributes receiver consumers to their root and Layer surfaces and rejects a disposed or replaced mount', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(10);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <><Rectangle style={{ width: source, height: 10, fill: '#fff' }} /><Layer style={{ width: 50, height: 50 }}><Rectangle style={{ width: source, height: 10, fill: '#f00' }} /></Layer></>);
  driver.flush(1);
  const inspector = createSignalInspector(canvas);
  inspector.register(source);
  try {
    const graph = signalGraphSnapshot();
    const before = inspector.snapshot();
    expect(before.ownership.completeness).toBe('complete');
    const record = before.records[0];
    if (record?.status !== 'available') throw new Error('Expected source');
    const owners = record.observers.records.map(observer => observer.owner);
    expect(owners).toHaveLength(2);
    expect(owners.map(owner => owner?.surfaceKind).sort()).toEqual(['layer', 'root']);
    expect(new Set(owners.map(owner => owner?.surfaceId)).size).toBe(2);
    expect(owners.every(owner => owner?.componentId && owner.debugName.includes('Rectangle'))).toBe(true);
    expect(owners.every(owner => Object.isFrozen(owner))).toBe(true);
    expect(inspector.snapshot().records).toEqual(before.records);
    expect(signalGraphSnapshot()).toEqual(graph);
    controller.dispose();
    expect(inspector.snapshot().ownership.completeness).toBe('unavailable');
    const replacement = crc(canvas, <Rectangle style={{ width: source, height: 10 }} />);
    try {
      driver.flush(2);
      expect(inspector.snapshot().ownership.completeness).toBe('unavailable');
      const replacementRecord = inspector.snapshot().records[0];
      if (replacementRecord?.status !== 'available') throw new Error('Expected source');
      expect(replacementRecord.observers.records.every(observer => observer.owner === null)).toBe(true);
    } finally { replacement.dispose(); }
    expect(owners.map(owner => owner?.surfaceKind).sort()).toEqual(['layer', 'root']);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('reports bounded ownership traversal without interpreting an unmatched subscriber as absent', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(10);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, [...Array.from({ length: 260 }, (_, index) => <Rectangle key={index} style={{ width: 1, height: 1 }} />), <Rectangle key="late" style={{ width: source, height: 10 }} />]);
  driver.flush(1);
  const inspector = createSignalInspector(canvas); inspector.register(source);
  try {
    const graph = signalGraphSnapshot();
    const result = inspector.snapshot();
    expect(result.ownership).toMatchObject({ completeness: 'truncated', visited: { components: 256, surfaces: 1 }, limits: { components: 256, surfaces: 64, paintEntries: 256 } });
    expect(result.ownership.components).toMatchObject({ completeness: 'truncated', limit: 64 });
    expect(result.ownership.components.records).toHaveLength(64);
    expect(result.records[0]).toMatchObject({ observerCount: 1, observers: { completeness: 'complete', records: [expect.objectContaining({ kind: 'render', owner: null })] } });
    expect(signalGraphSnapshot()).toEqual(graph);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('separates pending surface revisions from committed rendering and preserves ownership identity', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(10);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Rectangle style={{ width: source, height: 10 }} />);
  driver.flush(1);
  const inspector = createSignalInspector(canvas); inspector.register(source);
  const read = () => {
    const record = inspector.snapshot().records[0];
    if (record?.status !== 'available' || !record.observers.records[0]?.owner) throw new Error('Expected owned observer');
    return record.observers.records[0];
  };
  try {
    const before = read();
    source.set(20);
    const pending = read();
    expect(pending.dirty).toBe(true);
    expect(pending.owner!.componentId).toBe(before.owner!.componentId);
    expect(pending.owner!.renderGeneration).toBe(before.owner!.renderGeneration);
    expect(pending.owner!.requestedRevision).toBeGreaterThan(pending.owner!.completedRevision);
    driver.flush(2);
    const settled = read();
    expect(settled.dirty).toBe(false);
    expect(settled.owner!.componentId).toBe(before.owner!.componentId);
    expect(settled.owner!.renderGeneration).toBeGreaterThan(before.owner!.renderGeneration);
    expect(settled.owner!.requestedRevision).toBe(settled.owner!.completedRevision);
    expect(before.dirty).toBe(false);
    expect(before.owner!.requestedRevision).toBe(before.owner!.completedRevision);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('caps nested surface discovery and leaves excluded owners unknown', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, Array.from({ length: 65 }, (_, index) => <Layer key={index} style={{ width: 2, height: 2 }}><Rectangle style={{ width: source, height: 1 }} /></Layer>));
  driver.flush(1);
  const inspector = createSignalInspector(canvas); inspector.register(source);
  try {
    const graph = signalGraphSnapshot();
    const result = inspector.snapshot();
    expect(result.ownership).toMatchObject({ completeness: 'truncated', visited: { surfaces: 64 } });
    const record = result.records[0];
    if (record?.status !== 'available') throw new Error('Expected source');
    expect(record.observerCount).toBe(65);
    expect(record.observers.completeness).toBe('complete');
    expect(record.observers.records.filter(observer => observer.owner !== null)).toHaveLength(63);
    expect(record.observers.records.filter(observer => observer.owner === null)).toHaveLength(2);
    expect(result.ownership.visited.components).toBeLessThanOrEqual(256);
    expect(result.ownership.visited.paintEntries).toBeLessThanOrEqual(256);
    expect(signalGraphSnapshot()).toEqual(graph);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('does not attribute consumers from another canvas even when ownership traversal is complete', () => {
  const canvases = [document.createElement('canvas'), document.createElement('canvas')];
  canvases.forEach(canvas => { canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas); });
  const source = signal(1);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controllers = canvases.map(canvas => crc(canvas, <Rectangle style={{ width: source, height: 10 }} />));
  driver.flush(1);
  const inspector = createSignalInspector(canvases[0]); inspector.register(source);
  try {
    const result = inspector.snapshot();
    expect(result.ownership.completeness).toBe('complete');
    const record = result.records[0];
    if (record?.status !== 'available') throw new Error('Expected source');
    expect(record.observers.records).toHaveLength(2);
    expect(record.observers.records.filter(observer => observer.owner !== null)).toHaveLength(1);
    expect(record.observers.records.filter(observer => observer.owner === null)).toHaveLength(1);
    expect(Object.isFrozen(result.ownership.visited)).toBe(true);
    expect(Object.isFrozen(result.ownership.limits)).toBe(true);
  } finally { inspector.dispose(); controllers.forEach(controller => controller.dispose()); canvases.forEach(canvas => canvas.remove()); restore(); }
});

it('distinguishes source publication, computed equality validation and actual Canvas repaint', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(11); let computations = 0; let componentEvaluations = 0;
  const color = computed(() => { computations++; return source.get() < 20 ? '#ff0000' : '#0000ff'; });
  function Scene() { componentEvaluations++; return <Rectangle style={{ width: 50, height: 50, fill: color }} />; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Scene />, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  driver.flush(1);
  const inspector = createSignalInspector(canvas); inspector.register(source); inspector.register(color);
  const read = () => {
    const snapshot = inspector.snapshot();
    const sourceRecord = snapshot.records[0]; const computedRecord = snapshot.records[1];
    if (sourceRecord?.status !== 'available' || computedRecord?.status !== 'available') throw new Error('Expected signals');
    const owner = computedRecord.observers.records[0]?.owner;
    if (!owner) throw new Error('Expected surface owner');
    return { snapshot, source: sourceRecord, computed: computedRecord, owner };
  };
  const pixel = () => Array.from(canvas.getContext('2d')!.getImageData(25, 25, 1, 1).data);
  try {
    const initial = read();
    const initialComputations = computations; const initialEvaluations = componentEvaluations;
    expect(pixel()).toEqual([255, 0, 0, 255]);
    source.set(12);
    const pending = read();
    expect(pending.source.version).toBe(initial.source.version + 1);
    expect(pending.computed.validation).toBe('check');
    expect(pending.computed.version).toBe(initial.computed.version);
    expect(pending.computed.observers.records[0].dirty).toBe(false);
    expect(computations).toBe(initialComputations);
    expect(pending.owner.renderGeneration).toBe(initial.owner.renderGeneration);
    driver.flush(2);
    const equal = read();
    expect(equal.computed.validation).toBe('clean');
    expect(computations).toBe(initialComputations + 1);
    expect(equal.computed.version).toBe(initial.computed.version);
    expect(equal.computed.dependencies.edges[0].observedVersion).toBe(equal.source.version);
    expect(equal.owner.renderGeneration).toBe(initial.owner.renderGeneration);
    expect(componentEvaluations).toBe(initialEvaluations);
    expect(pixel()).toEqual([255, 0, 0, 255]);
    source.set(12);
    expect(read().snapshot).toEqual(equal.snapshot);
    source.set(20);
    expect(read().computed.validation).toBe('check');
    driver.flush(3);
    const changed = read();
    expect(changed.computed.version).toBe(equal.computed.version + 1);
    expect(changed.owner.renderGeneration).toBeGreaterThan(equal.owner.renderGeneration);
    expect(componentEvaluations).toBeGreaterThan(initialEvaluations);
    expect(pixel()).toEqual([0, 0, 255, 255]);
    expect(initial.computed.preview).toEqual({ kind: 'scalar', value: '#ff0000', truncated: false });
    expect(initial.owner.renderGeneration).toBe(equal.owner.renderGeneration);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('records dynamic dependency replacement even when computed equality suppresses repaint', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const branch = signal(true); const left = signal(10); const right = signal(10);
  let computations = 0;
  const width = computed(() => { computations++; return branch.get() ? left.get() : right.get(); });
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Rectangle style={{ width, height: 10, fill: '#ff0000' }} />, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  driver.flush(1);
  const inspector = createSignalInspector(canvas);
  const branchId = inspector.register(branch); const leftId = inspector.register(left); const rightId = inspector.register(right); inspector.register(width);
  const read = () => {
    const records = inspector.snapshot().records;
    const value = records[3];
    if (value?.status !== 'available' || !value.observers.records[0]?.owner) throw new Error('Expected owned computed');
    return { records, value, generation: value.observers.records[0].owner.renderGeneration };
  };
  try {
    const before = read(); const beforeComputations = computations;
    expect(before.value.dependencies.edges.map(edge => edge.sourceId)).toEqual([branchId, leftId]);
    branch.set(false);
    expect(read().value.dependencies.edges.map(edge => edge.sourceId)).toEqual([branchId, leftId]);
    driver.flush(2);
    const switched = read();
    expect(switched.value.dependencies.edges.map(edge => edge.sourceId)).toEqual([branchId, rightId]);
    expect(switched.value.version).toBe(before.value.version);
    expect(switched.generation).toBe(before.generation);
    expect(computations).toBe(beforeComputations + 1);
    expect(switched.records[1]).toMatchObject({ observerCount: 0, observers: { records: [] } });
    expect(switched.records[2]).toMatchObject({ observerCount: 1 });
    left.set(30);
    expect(driver.pendingHostFrames).toBe(0);
    expect(read().value).toEqual(switched.value);
    expect(computations).toBe(beforeComputations + 1);
    right.set(20);
    driver.flush(4);
    expect(read().generation).toBeGreaterThan(switched.generation);
    expect(read().value.version).toBe(switched.value.version + 1);
    expect(Array.from(canvas.getContext('2d')!.getImageData(15, 5, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(before.value.dependencies.edges.map(edge => edge.sourceId)).toEqual([branchId, leftId]);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('observes pending, Plan and Render scheduler state without requesting or flushing work', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1);
  const samples: ReturnType<typeof observeScheduler>[] = [];
  const value = computed(() => { samples.push(observeScheduler()); return source.get() * 2; });
  function Scene() { samples.push(observeScheduler()); return <Rectangle style={{ width: value, height: 10 }} />; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const before = observeScheduler();
  const controller = crc(canvas, <Scene />);
  try {
    const pending = observeScheduler();
    expect(pending).toMatchObject({ scope: 'loaded-runtime-realm', phase: 'idle', frame: null, work: { pendingHostFrames: 1 } });
    expect(pending.work.registeredRoots).toBe(before.work.registeredRoots + 1);
    const requests = driver.requestCount;
    for (let index = 0; index < 20; index++) expect(observeScheduler()).toEqual(pending);
    expect(driver.requestCount).toBe(requests);
    driver.flush(100);
    expect(samples.some(sample => sample.phase === 'render')).toBe(true);
    samples.length = 0;
    source.set(2);
    expect(observeScheduler().work.pendingComputedValidations).toBeGreaterThan(0);
    driver.flush(120);
    expect(observeScheduler().work.pendingComputedValidations).toBe(0);
    const plan = samples.find(sample => sample.phase === 'plan');
    const render = samples.find(sample => sample.phase === 'render');
    expect(plan).toBeDefined(); expect(render).toBeDefined();
    expect(plan!.frame).toEqual(render!.frame);
    expect(plan!.frame!.hostTime).toBe(120);
    expect(Object.isFrozen(plan!.frame)).toBe(true);
    expect(Object.isFrozen(plan!.work)).toBe(true);
    expect(observeScheduler()).toMatchObject({ phase: 'idle', frame: null, work: { pendingHostFrames: 0, dirtyRoots: 0 } });
    expect(pending.work.pendingHostFrames).toBe(1);
    controller.dispose();
    expect(observeScheduler().work.registeredRoots).toBe(before.work.registeredRoots);
  } finally { controller.dispose(); canvas.remove(); restore(); }
});


it('records bounded ordered phase history without requesting frames and stops cleanly', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const source = signal(1);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const history = createSchedulerHistory(10);
  expect(driver.pendingHostFrames).toBe(0);
  const controller = crc(canvas, <Rectangle style={{ width: source, height: 10 }} />);
  try {
    driver.flush(100);
    const first = history.snapshot();
    expect(first.records.map(record => record.phase)).toEqual(['begin', 'advance', 'commit', 'plan', 'render', 'complete', 'idle']);
    expect(new Set(first.records.map(record => record.frameId)).size).toBe(1);
    expect(first.records.every(record => record.hostTime === 100 && Object.isFrozen(record))).toBe(true);
    source.set(2); driver.flush(120);
    const second = history.snapshot();
    expect(second.records).toHaveLength(10); expect(second.dropped).toBe(4);
    expect(second.records.map(record => record.sequence)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(first.records).toHaveLength(7); expect(first.dropped).toBe(0);
    expect(first.frames).toHaveLength(1);
    expect(first.frames[0]).toMatchObject({ completeness: 'complete', missingStart: false, missingEnd: false, errorCount: 0 });
    expect(second.frames).toHaveLength(2);
    expect(second.frames[0]).toMatchObject({ completeness: 'partial', missingStart: true, missingEnd: false, phaseErrors: { begin: null, render: 0, complete: 0 } });
    expect(second.frames[1]).toMatchObject({ completeness: 'complete', phaseErrors: { begin: 0, advance: 0, commit: 0, plan: 0, render: 0, complete: 0 } });
    history.stop(); history.stop();
    source.set(3); driver.flush(140);
    expect(history.snapshot()).toMatchObject({ status: 'stopped', records: second.records, dropped: 4 });
    history.dispose(); history.dispose();
    expect(history.snapshot()).toMatchObject({ status: 'disposed', records: [] });
  } finally { history.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('rejects invalid history capacities and collector conflicts without replacing an owner', () => {
  for (const capacity of [0, -1, 1.5, 1025, Infinity, NaN]) expect(() => createSchedulerHistory(capacity)).toThrow(RangeError);
  const external = installSchedulerTraceCollectorForTest(() => {});
  try { expect(() => createSchedulerHistory()).toThrow('already owned'); } finally { external(); }
  const history = createSchedulerHistory(1);
  try {
    expect(() => createSchedulerHistory()).toThrow('already owned');
    expect(() => installSchedulerTraceCollectorForTest(() => {})).toThrow('already owned');
    expect(history.snapshot()).toMatchObject({ status: 'recording', records: [], dropped: 0 });
  } finally { history.dispose(); }
  const replacement = createSchedulerHistory();
  replacement.dispose();
});

it('distinguishes an idle frame with collected errors from success while another root still paints', () => {
  const canvases = [document.createElement('canvas'), document.createElement('canvas')];
  canvases.forEach(canvas => { canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas); });
  const fail = signal(false); const color = signal('#ff0000');
  const failure = new Error('private application failure');
  function Failing() { if (fail.get()) throw failure; return <Rectangle style={{ width: 20, height: 20 }} />; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const history = createSchedulerHistory();
  const bad = crc(canvases[0], <Failing />);
  const good = crc(canvases[1], <Rectangle style={{ width: 50, height: 50, fill: color }} />, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  try {
    driver.flush(100);
    const first = history.snapshot();
    expect(first.records.at(-1)).toMatchObject({ phase: 'idle', outcome: 'no-collected-errors', errorCount: 0 });
    fail.set(true); color.set('#0000ff');
    let thrown: unknown;
    try { driver.flush(120); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    const failed = history.snapshot();
    expect(failed.records.at(-1)).toMatchObject({ phase: 'idle', outcome: 'errors-collected', errorCount: 1 });
    expect(failed.records.slice(-7).map(record => record.collectedErrors)).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(failed.frames.at(-1)).toMatchObject({ completeness: 'complete', phaseErrors: { render: 1, complete: 0 } });
    expect(failed.records.slice(-7).map(record => record.phase)).toEqual(['begin', 'advance', 'commit', 'plan', 'render', 'complete', 'idle']);
    expect(Array.from(canvases[1].getContext('2d')!.getImageData(25, 25, 1, 1).data)).toEqual([0, 0, 255, 255]);
    expect(JSON.stringify(failed)).not.toContain('private application failure');
    expect(first.records.at(-1)).toMatchObject({ outcome: 'no-collected-errors', errorCount: 0 });
    expect(observeScheduler().phase).toBe('idle');
  } finally { history.dispose(); bad.dispose(); good.dispose(); canvases.forEach(canvas => canvas.remove()); restore(); }
});


it('localizes completion failures after Render and still runs unrelated completions', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const history = createSchedulerHistory();
  const failure = new Error('private completion detail');
  let completed = false;
  const cancelFailure = queueFrameCompletion(() => { throw failure; });
  const cancelOther = queueFrameCompletion(() => { completed = true; });
  try {
    let thrown: unknown;
    try { driver.flush(100); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure); expect(completed).toBe(true);
    const result = history.snapshot();
    expect(result.records.map(record => record.collectedErrors)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(result.frames[0]).toMatchObject({ completeness: 'complete', phaseErrors: { render: 0, complete: 1 } });
    expect(result.records.at(-1)).toMatchObject({ phase: 'idle', errorCount: 1, outcome: 'errors-collected' });
    expect(JSON.stringify(result)).not.toContain('private completion detail');
    expect(observeScheduler().work.completionCallbacks).toBe(0);
  } finally { cancelFailure(); cancelOther(); history.dispose(); restore(); }
});


it.each(['start', 'stop'] as const)('labels recording that %ss during Render as a partial frame', mode => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  let history: ReturnType<typeof createSchedulerHistory> | undefined = mode === 'stop' ? createSchedulerHistory() : undefined;
  function Scene() {
    if (mode === 'start') history ??= createSchedulerHistory(); else history!.stop();
    return <Rectangle style={{ width: 10, height: 10 }} />;
  }
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(100);
    const result = history!.snapshot();
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]).toMatchObject({ completeness: 'partial', missingStart: mode === 'start', missingEnd: mode === 'stop' });
    expect(result.frames[0].errorCount).toBe(mode === 'start' ? 0 : null);
    expect(result.frames[0].phaseErrors.render).toBeNull();
    expect(Object.isFrozen(result.frames)).toBe(true);
    expect(Object.isFrozen(result.frames[0].phaseErrors)).toBe(true);
  } finally { history?.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it.each(['begin', 'advance'] as const)('preserves transaction isolation when %s work stages values then fails', phase => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const rejected = signal(10); const accepted = signal(10);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <><Rectangle style={{ width: rejected, height: 10, fill: '#ff0000' }} /><Rectangle style={{ top: 20, width: accepted, height: 10, fill: '#00ff00' }} /></>, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  driver.flush(100);
  const inspector = createSignalInspector(canvas); inspector.register(rejected); inspector.register(accepted);
  const history = createSchedulerHistory();
  const failure = new Error('private staged failure');
  let staged: ReturnType<typeof inspector.snapshot> | undefined;
  let releaseBad = () => {}; let releaseGood = () => {};
  const bad: CRCAdvanceParticipant = (_frame, batch) => {
    releaseBad(); batch.stage(rejected, 30, bad); staged = inspector.snapshot(); throw failure;
  };
  const good: CRCAdvanceParticipant = (_frame, batch) => { releaseGood(); batch.stage(accepted, 30, good); };
  const admit = (work: CRCAdvanceParticipant) => phase === 'begin' ? queueBeginCommand(work).cancel : registerAdvanceParticipant(work);
  try {
    const before = inspector.snapshot();
    releaseBad = admit(bad); releaseGood = admit(good);
    let thrown: unknown;
    try { driver.flush(120); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(staged!.scheduler.phase).toBe(phase);
    expect(staged!.records[0]).toMatchObject({ version: 0, preview: { kind: 'scalar', value: 10 } });
    const after = inspector.snapshot();
    expect(after.records[0]).toMatchObject({ version: 0, preview: { kind: 'scalar', value: 10 } });
    expect(after.records[1]).toMatchObject({ version: 1, preview: { kind: 'scalar', value: 30 } });
    expect(rejected.get()).toBe(10); expect(accepted.get()).toBe(30);
    expect(before.records[1]).toMatchObject({ version: 0, preview: { value: 10 } });
    const frame = history.snapshot().frames[0];
    expect(frame.completeness).toBe('complete'); expect(frame.errorCount).toBe(1);
    expect(frame.phaseErrors[phase]).toBe(1);
    expect(frame.phaseErrors.commit).toBe(0); expect(frame.phaseErrors.render).toBe(0);
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(15, 5, 1, 1).data)).toEqual([0, 0, 0, 0]);
    expect(Array.from(context.getImageData(15, 25, 1, 1).data)).toEqual([0, 255, 0, 255]);
    expect(driver.pendingHostFrames).toBe(0);
  } finally { releaseBad(); releaseGood(); history.dispose(); inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('distinguishes Commit validation failure from participant rollback without publishing a partial batch', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const failure = new Error('private equality failure'); let comparisons = 0;
  const first = signal(10); const second = signal(10, { equals(a, b) { comparisons++; if (b === 30) throw failure; return a === b; } });
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <><Rectangle style={{ width: first, height: 10, fill: '#ff0000' }} /><Rectangle style={{ top: 20, width: second, height: 10, fill: '#00ff00' }} /></>, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  driver.flush(100);
  const inspector = createSignalInspector(canvas); inspector.register(first); inspector.register(second);
  const history = createSchedulerHistory();
  let release = () => {};
  const participant: CRCAdvanceParticipant = (_frame, batch) => { release(); batch.stage(first, 30, participant); batch.stage(second, 30, participant); };
  try {
    const before = inspector.snapshot(); const beforeComparisons = comparisons;
    for (let index = 0; index < 10; index++) inspector.snapshot();
    expect(comparisons).toBe(beforeComparisons);
    release = registerAdvanceParticipant(participant);
    let thrown: unknown;
    try { driver.flush(120); } catch (error) { thrown = error; }
    expect(thrown).toBe(failure); expect(comparisons).toBe(beforeComparisons + 1);
    expect(inspector.snapshot().records).toEqual(before.records);
    expect(first.get()).toBe(10); expect(second.get()).toBe(10);
    expect(history.snapshot().frames[0]).toMatchObject({ completeness: 'complete', errorCount: 1, commitApplied: false, phaseErrors: { advance: 0, commit: 1, plan: 0, render: 0 } });
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(15, 5, 1, 1).data)).toEqual([0, 0, 0, 0]);
    expect(Array.from(context.getImageData(15, 25, 1, 1).data)).toEqual([0, 0, 0, 0]);
    expect(driver.pendingHostFrames).toBe(0);
  } finally { release(); history.dispose(); inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('records applied Commit despite observer failure and preserves unrelated publication and repaint', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const first = signal(10); const second = signal(10);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <><Rectangle style={{ width: first, height: 10, fill: '#ff0000' }} /><Rectangle style={{ top: 20, width: second, height: 10, fill: '#00ff00' }} /></>, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  driver.flush(100);
  const inspector = createSignalInspector(canvas); inspector.register(first); inspector.register(second);
  const history = createSchedulerHistory(); const failure = new Error('private observer failure');
  const observer = () => { throw failure; };
  const node = getSignalNode(first); signalObserversForTest(node).add(observer);
  let release = () => {};
  const participant: CRCAdvanceParticipant = (_frame, batch) => { release(); batch.stage(first, 30, participant); batch.stage(second, 30, participant); };
  try {
    release = registerAdvanceParticipant(participant);
    let thrown: unknown;
    try { driver.flush(120); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual([failure]);
    const record = history.snapshot();
    expect(record.frames[0]).toMatchObject({ completeness: 'complete', errorCount: 1, commitApplied: true, phaseErrors: { commit: 1, render: 0 } });
    expect(record.records.slice(0, 3).every(value => value.commitApplied === null)).toBe(true);
    expect(record.records.slice(3).every(value => value.commitApplied === true)).toBe(true);
    expect(first.get()).toBe(30); expect(second.get()).toBe(30);
    inspector.snapshot().records.forEach(value => expect(value).toMatchObject({ version: 1, preview: { value: 30 } }));
    const context = canvas.getContext('2d')!;
    expect(Array.from(context.getImageData(15, 5, 1, 1).data)).toEqual([255, 0, 0, 255]);
    expect(Array.from(context.getImageData(15, 25, 1, 1).data)).toEqual([0, 255, 0, 255]);
    expect(driver.pendingHostFrames).toBe(0);
  } finally { release(); signalObserversForTest(node).delete(observer); history.dispose(); inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('observes non-subscribing and empty components with lifetime identity across keyed reorder and remount', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const phase = signal(0); let lifetimes = 0;
  function Empty() { return null; }
  function Static() { useConst(() => ++lifetimes); return <Rectangle style={{ width: 10, height: 10 }} />; }
  function Parent() {
    const stage = phase.get();
    return <><Empty />{stage === 0 ? [<Static key="a" />, <Static key="b" />] : stage === 1 ? [<Static key="b" />, <Static key="a" />] : stage === 2 ? [<Static key="b" />] : [<Static key="b" />, <Static key="a" />]}</>;
  }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  const read = () => inspector.snapshot().ownership.components;
  try {
    const first = read();
    expect(first.completeness).toBe('complete');
    expect(first.records.some(record => record.typeId === inspector.identifyType(Empty))).toBe(true);
    const ids = first.records.filter(record => record.typeId === inspector.identifyType(Static)).map(record => record.componentId).sort();
    expect(ids).toHaveLength(2); expect(lifetimes).toBe(2);
    phase.set(1); driver.flush(120);
    expect(read().records.filter(record => record.typeId === inspector.identifyType(Static)).map(record => record.componentId).sort()).toEqual(ids);
    expect(lifetimes).toBe(2);
    phase.set(2); driver.flush(140);
    const retained = read().records.filter(record => record.typeId === inspector.identifyType(Static)).map(record => record.componentId);
    expect(retained).toHaveLength(1);
    phase.set(3); driver.flush(160);
    const remounted = read().records.filter(record => record.typeId === inspector.identifyType(Static)).map(record => record.componentId);
    expect(remounted).toContain(retained[0]);
    expect(remounted.filter(id => !ids.includes(id))).toHaveLength(1);
    expect(lifetimes).toBe(3);
    expect(first.records.filter(record => record.typeId === inspector.identifyType(Static)).map(record => record.componentId).sort()).toEqual(ids);
    expect(Object.isFrozen(first.records)).toBe(true);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('identifies component types without invoking proxy traps during inspection', () => {
  let armed = false; let reads = 0;
  const Component = new Proxy(function Opaque() { return null; }, {
    get(target, key, receiver) { if (armed) { reads++; throw new Error('No function property reads'); } return Reflect.get(target, key, receiver); },
    getOwnPropertyDescriptor(target, key) { if (armed) { reads++; throw new Error('No function descriptors'); } return Reflect.getOwnPropertyDescriptor(target, key); },
  });
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Component />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    armed = true;
    const typeId = inspector.identifyType(Component);
    expect(typeId).not.toBeNull();
    expect(inspector.identifyType(Component)).toBe(typeId);
    expect(inspector.identifyType({})).toBeNull();
    expect(inspector.snapshot().ownership.components.records.some(record => record.typeId === typeId)).toBe(true);
    expect(reads).toBe(0);
    inspector.dispose(); expect(inspector.identifyType(Component)).toBeNull();
  } finally { armed = false; inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('separates component parent links from the Layer surface host', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  function Leaf() { return <Rectangle style={{ width: 10, height: 10 }} />; }
  function Parent() { return <Group><Layer style={{ width: 50, height: 50 }}><Leaf /></Layer></Group>; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    const result = inspector.snapshot().ownership.components;
    const find = (type: unknown) => result.records.find(record => record.typeId === inspector.identifyType(type))!;
    const parent = find(Parent); const group = find(Group); const layer = find(Layer); const leaf = find(Leaf);
    expect(parent.componentParent).toEqual({ status: 'none', componentId: null });
    expect(group.componentParent).toEqual({ status: 'observed', componentId: parent.componentId });
    expect(layer.componentParent).toEqual({ status: 'observed', componentId: group.componentId });
    expect(parent.surfaceHost).toEqual({ status: 'none', componentId: null });
    expect(layer.surfaceHost).toEqual({ status: 'none', componentId: null });
    expect(leaf.surfaceHost).toEqual({ status: 'observed', componentId: layer.componentId });
    expect(leaf.surfaceId).not.toBe(layer.surfaceId);
    expect(leaf.componentParent.componentId).not.toBe(layer.componentId);
    for (const record of result.records) {
      for (const relation of [record.componentParent, record.surfaceHost]) {
        expect(Object.isFrozen(relation)).toBe(true);
        if (relation.status === 'observed') expect(result.records.some(candidate => candidate.componentId === relation.componentId)).toBe(true);
      }
    }
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('captures compiler callsites explicitly while snapshots remain passive and bounded', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  let reads = 0; let armed = false;
  const source = new Proxy({ fileName: '/app/chart.tsx', lineNumber: 12, columnNumber: 7 }, {
    get(target, key, receiver) { reads++; if (armed) throw new Error('source must remain passive'); return Reflect.get(target, key, receiver); },
  });
  function Chart() { return <Rectangle style={{ width: 10, height: 10 }} />; }
  const descriptor = jsxDEV(Chart, {}, undefined, false, source, undefined);
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, descriptor); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  const chart = () => inspector.snapshot().ownership.components.records.find(record => record.typeId === inspector.identifyType(Chart))!;
  try {
    const before = reads;
    expect(chart().source).toEqual({ status: 'not-captured' });
    expect(reads).toBe(before);
    expect(inspector.captureSource(descriptor)).toEqual({ status: 'available', fileName: '/app/chart.tsx', lineNumber: 12, columnNumber: 7, provenance: 'jsx-development-callsite', sourceMap: 'unverified' });
    expect(reads).toBe(before + 3);
    armed = true;
    const snapshot = chart().source;
    expect(snapshot).toMatchObject({ status: 'available', lineNumber: 12 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    for (let index = 0; index < 10; index++) chart();
    expect(reads).toBe(before + 3);
    expect(inspector.snapshot().ownership.components.records.find(record => record.typeId === inspector.identifyType(Rectangle))?.source).toEqual({ status: 'not-captured' });
    expect(inspector.captureSource(createElement(Chart, {}))).toEqual({ status: 'missing' });
    const invalid = jsxDEV(Chart, {}, undefined, false, { fileName: 'x', lineNumber: -1, columnNumber: 0 }, undefined);
    expect(inspector.captureSource(invalid)).toEqual({ status: 'invalid' });
    const long = jsxDEV(Chart, {}, undefined, false, { fileName: 'x'.repeat(1025), lineNumber: 1, columnNumber: 1 }, undefined);
    expect(inspector.captureSource(long)).toEqual({ status: 'invalid' });
    const throwing = jsxDEV(Chart, {}, undefined, false, source, undefined);
    // Captured objects are immutable evidence: repeated capture does not re-read them.
    expect(inspector.captureSource(throwing)).toEqual(snapshot);
    inspector.dispose();
    expect(inspector.captureSource(descriptor)).toEqual({ status: 'disposed' });
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('bounds source acquisition and contains failed or reentrant source reads', () => {
  function Empty() { return null; }
  const inspector = createSignalInspector();
  const source = { get fileName(): string { throw new Error('private path'); }, lineNumber: 1, columnNumber: 1 };
  const descriptor = jsxDEV(Empty, {}, undefined, false, source, undefined);
  expect(inspector.captureSource(descriptor)).toEqual({ status: 'unreadable' });
  expect(inspector.captureSource(descriptor)).toEqual({ status: 'unreadable' });
  for (let index = 1; index < 64; index++) {
    expect(inspector.captureSource(jsxDEV(Empty, {}, undefined, false, { fileName: 'chart.tsx', lineNumber: index, columnNumber: 1 }, undefined))).toMatchObject({ status: 'available' });
  }
  let reads = 0;
  const overflow = jsxDEV(Empty, {}, undefined, false, { get fileName() { reads++; return 'secret'; }, lineNumber: 1, columnNumber: 1 }, undefined);
  expect(inspector.captureSource(overflow)).toEqual({ status: 'limit' });
  expect(reads).toBe(0);
  inspector.dispose();
  const reentrant = createSignalInspector();
  const disposing = jsxDEV(Empty, {}, undefined, false, { get fileName() { reentrant.dispose(); return 'chart.tsx'; }, lineNumber: 1, columnNumber: 1 }, undefined);
  expect(reentrant.captureSource(disposing)).toEqual({ status: 'disposed' });
});

it('acquires source by session and component generation and rejects stale mounts', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const revision = signal(0);
  function Child() { return null; }
  function Parent() { return jsxDEV(Child, {}, undefined, false, { fileName: 'chart.tsx', lineNumber: revision.get() + 1, columnNumber: 1 }, undefined); }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  let controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  const read = () => { const snapshot = inspector.snapshot(); const record = snapshot.ownership.components.records.find(value => value.typeId === inspector.identifyType(Child))!; return { session: snapshot.session, componentId: record.componentId, renderGeneration: record.renderGeneration }; };
  try {
    const first = read();
    expect(inspector.captureComponentSource({ ...first, session: first.session + 1 })).toEqual({ status: 'stale' });
    expect(inspector.captureComponentSource(first)).toMatchObject({ status: 'available', lineNumber: 1 });
    revision.set(1); driver.flush(116);
    expect(inspector.captureComponentSource(first)).toEqual({ status: 'stale' });
    const second = read();
    expect(second.componentId).toBe(first.componentId);
    expect(inspector.captureComponentSource(second)).toMatchObject({ status: 'available', lineNumber: 2 });
    controller.dispose(); controller = crc(canvas, <Parent />); driver.flush(132);
    expect(inspector.captureComponentSource(second)).toEqual({ status: 'stale' });
    inspector.dispose(); expect(inspector.captureComponentSource(second)).toEqual({ status: 'disposed' });
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('records bounded confirmed component removals without calling snapshot omissions removals', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const phase = signal(0);
  function Empty() { return null; }
  function Parent() { const value = phase.get(); return <>{value === 1 ? Array.from({ length: 65 }, (_, index) => <Empty key={index} />) : null}<Layer style={{ width: 50, height: 50 }}>{value < 2 ? <Empty /> : null}</Layer></>; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    const first = inspector.snapshot().ownership.components;
    const leaf = first.records.find(record => record.typeId === inspector.identifyType(Empty))!;
    expect(first.removals).toEqual({ scope: 'previous-snapshot-handles', limit: 64, dropped: 0, records: [] });
    phase.set(1); driver.flush(116);
    const truncated = inspector.snapshot().ownership.components;
    expect(truncated.completeness).toBe('truncated');
    expect(truncated.records.some(record => record.componentId === leaf.componentId)).toBe(false);
    expect(truncated.removals.records).toEqual([]);
    phase.set(2); driver.flush(132);
    const removed = inspector.snapshot().ownership.components.removals;
    expect(removed.records.length).toBeGreaterThan(0);
    expect(removed.records.every(record => record.reason === 'component-disposed')).toBe(true);
    expect(removed.records.some(record => record.componentId === leaf.componentId)).toBe(false);
    expect(Object.isFrozen(removed.records)).toBe(true);
    expect(first.removals.records).toEqual([]);
    for (let index = 0; index < 3; index++) {
      phase.set(1); driver.flush(148 + index * 32); inspector.snapshot();
      phase.set(2); driver.flush(164 + index * 32); inspector.snapshot();
    }
    const bounded = inspector.snapshot().ownership.components.removals;
    expect(bounded.records).toHaveLength(64);
    expect(bounded.dropped).toBeGreaterThan(0);
    expect(bounded.records.every(record => Object.keys(record).sort().join(',') === 'componentId,reason')).toBe(true);
    inspector.dispose();
    expect(inspector.snapshot().ownership.components.removals.records).toEqual([]);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('finds explicit component labels and reports duplicates without changing keyed identity', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const phase = signal(0); let mounts = 0;
  function Item() { useConst(() => ++mounts); return null; }
  function Parent() { return phase.get() === 0 ? [<Item key="a" />, <Item key="b" />] : phase.get() === 1 ? [<Item key="b" />, <Item key="a" />] : [<Item key="b" />]; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  const read = () => inspector.snapshot();
  try {
    const first = read(); const items = first.ownership.components.records.filter(record => record.typeId === inspector.identifyType(Item));
    const handle = (record: typeof items[number]) => ({ session: first.session, componentId: record.componentId, renderGeneration: record.renderGeneration });
    expect(inspector.labelComponent(handle(items[0]), 'series:revenue')).toEqual({ status: 'labeled' });
    expect(inspector.findComponents('series:revenue')).toMatchObject({ completeness: 'complete', matches: [{ componentId: items[0].componentId, label: { value: 'series:revenue', uniqueness: 'unique', matchesInSnapshot: 1 } }] });
    expect(inspector.labelComponent(handle(items[1]), 'series:revenue')).toEqual({ status: 'labeled' });
    const duplicates = inspector.findComponents('series:revenue');
    expect(duplicates.matches).toHaveLength(2);
    expect(duplicates.matches.every(record => record.label?.uniqueness === 'duplicate')).toBe(true);
    phase.set(1); driver.flush(116);
    expect(inspector.findComponents('series:revenue').matches.map(record => record.componentId).sort()).toEqual(items.map(record => record.componentId).sort());
    expect(mounts).toBe(2);
    expect(inspector.labelComponent(handle(items[0]), 'stale')).toEqual({ status: 'stale' });
    phase.set(2); driver.flush(132);
    const retained = inspector.findComponents('series:revenue');
    expect(retained.matches).toHaveLength(1);
    expect(retained.matches[0].label?.uniqueness).toBe('unique');
    expect(inspector.labelComponent(handle(retained.matches[0]), null)).toEqual({ status: 'cleared' });
    expect(inspector.findComponents('series:revenue').matches).toEqual([]);
    expect(duplicates.matches).toHaveLength(2);
    expect(Object.isFrozen(duplicates.matches)).toBe(true);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('bounds label registration and does not claim uniqueness from a truncated scan', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const phase = signal(0);
  function Item() { return null; }
  function Parent() { const value = phase.get(); return Array.from({ length: 65 }, (_, index) => <Item key={`${value}:${index}`} />); }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    const first = inspector.snapshot();
    const handle = (record: typeof first.ownership.components.records[number]) => ({ session: first.session, componentId: record.componentId, renderGeneration: record.renderGeneration });
    const parent = first.ownership.components.records.find(record => record.typeId === inspector.identifyType(Parent))!;
    expect(inspector.labelComponent(handle(parent), '')).toEqual({ status: 'invalid' });
    expect(inspector.labelComponent(handle(parent), 'x'.repeat(129))).toEqual({ status: 'invalid' });
    for (const record of first.ownership.components.records) expect(inspector.labelComponent(handle(record), `label:${record.componentId}`)).toEqual({ status: 'labeled' });
    const result = inspector.findComponents(`label:${parent.componentId}`);
    expect(result.completeness).toBe('truncated');
    expect(result.matches[0].label?.uniqueness).toBe('unknown');
    phase.set(1); driver.flush(116);
    const second = inspector.snapshot();
    const item = second.ownership.components.records.find(record => record.typeId === inspector.identifyType(Item))!;
    expect(inspector.labelComponent(handle(item), 'overflow')).toEqual({ status: 'limit' });
    expect(inspector.findComponents('absent')).toMatchObject({ completeness: 'truncated', matches: [] });
    expect(inspector.findComponents('')).toMatchObject({ status: 'invalid', matches: [] });
    inspector.dispose();
    expect(inspector.findComponents('x')).toMatchObject({ status: 'disposed', completeness: 'unavailable', matches: [] });
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('compares semantic component facts without treating render generations as changes', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const phase = signal(0);
  function Item() { return null; }
  function Parent() { return <Item key={phase.get() < 2 ? 'a' : 'b'} />; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    const first = inspector.snapshot();
    phase.set(1); driver.flush(116);
    const rerender = inspector.snapshot();
    expect(inspector.compareComponents(first, rerender)).toMatchObject({ status: 'ready', completeness: 'complete', changes: [] });
    const item = rerender.ownership.components.records.find(record => record.typeId === inspector.identifyType(Item))!;
    inspector.labelComponent({ session: rerender.session, componentId: item.componentId, renderGeneration: item.renderGeneration }, 'item');
    const labeled = inspector.snapshot();
    expect(inspector.compareComponents(rerender, labeled).changes).toEqual([{ componentId: item.componentId, kind: 'changed', fields: ['label'] }]);
    phase.set(2); driver.flush(132);
    const replacement = inspector.snapshot();
    const changes = inspector.compareComponents(labeled, replacement).changes;
    expect(changes.filter(change => change.kind === 'removed').map(change => change.componentId)).toEqual([item.componentId]);
    expect(changes.filter(change => change.kind === 'added')).toHaveLength(1);
    expect(inspector.compareComponents(replacement, first).status).toBe('invalid-order');
    let traps = 0;
    const foreign = new Proxy({}, { get() { traps++; throw new Error('foreign'); } });
    expect(inspector.compareComponents(foreign, first).status).toBe('invalid-snapshot');
    expect(traps).toBe(0);
    expect(inspector.compareComponents(structuredClone(first), replacement).status).toBe('invalid-snapshot');
    expect(Object.isFrozen(changes)).toBe(true);
    expect(Object.isFrozen(changes[0].fields)).toBe(true);
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('marks truncated comparison omissions as uncertain and rejects unavailable roots', () => {
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const expanded = signal(false);
  function Item() { return null; }
  function Parent() { return <>{expanded.get() ? Array.from({ length: 65 }, (_, index) => <Item key={index} />) : null}<Layer style={{ width: 50, height: 50 }}><Item /></Layer></>; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Parent />); driver.flush(100);
  const inspector = createSignalInspector(canvas);
  try {
    const first = inspector.snapshot();
    const leaf = first.ownership.components.records.find(record => record.typeId === inspector.identifyType(Item))!;
    expanded.set(true); driver.flush(116);
    const truncated = inspector.snapshot();
    const forward = inspector.compareComponents(first, truncated);
    expect(forward.completeness).toBe('partial');
    expect(forward.changes.find(change => change.componentId === leaf.componentId)?.kind).toBe('unobserved');
    expect(forward.changes.some(change => change.kind === 'removed')).toBe(false);
    expanded.set(false); driver.flush(132);
    const complete = inspector.snapshot();
    expect(inspector.compareComponents(truncated, complete).changes.find(change => change.componentId === leaf.componentId)?.kind).toBe('newly-observed');
    expect(inspector.compareComponents(first, complete).changes).toEqual([]);
    controller.dispose();
    expect(inspector.compareComponents(complete, inspector.snapshot())).toMatchObject({ status: 'unavailable', changes: [] });
    inspector.dispose();
    expect(inspector.compareComponents(first, complete).status).toBe('disposed');
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});


it('observes receiver entry allocation separately from its percentage basis without reevaluation', () => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200; canvas.style.cssText = 'width:400px;height:200px'; document.body.append(canvas);
  const width = signal<'50%' | '25%'>('50%');
  const refresh = signal(0);
  let evaluations = 0;
  let actual: unknown;
  function Panel(_props: { style: BoxStyle }) { evaluations++; actual = { ...useLayoutBox() }; return null; }
  function Scene() { refresh.get(); return <Absolute style={{ width: 400, height: 200 }}><Panel style={{ width: width.get(), height: 100 }} /></Absolute>; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Scene />); driver.flush(1);
  const inspector = createSignalInspector(canvas);
  try {
    const first = inspector.snapshot();
    const panel = first.ownership.components.records.find(record => record.typeId === inspector.identifyType(Panel))!;
    expect(panel.layout).toEqual({ status: 'entry-context', allocation: { x: 0, y: 0, width: 200, height: 100 }, percentageBasis: { x: 0, y: 0, width: 400, height: 200 } });
    expect(panel.layout.allocation).toEqual(actual);
    expect(Object.isFrozen(panel.layout.allocation)).toBe(true);
    inspector.snapshot(); expect(evaluations).toBe(1);
    refresh.set(1); driver.flush(2);
    const unchanged = inspector.snapshot();
    const same = unchanged.ownership.components.records.find(record => record.componentId === panel.componentId)!;
    expect(same.layout.allocation).toBe(panel.layout.allocation);
    expect(same.layout.percentageBasis).toBe(panel.layout.percentageBasis);
    expect(inspector.compareComponents(first, unchanged).changes).toEqual([]);
    width.set('25%'); driver.flush(3);
    const next = inspector.snapshot();
    const resized = next.ownership.components.records.find(record => record.componentId === panel.componentId)!;
    expect(resized.layout.allocation).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(resized.layout.percentageBasis).toBe(panel.layout.percentageBasis);
    expect(resized.layout.allocation).not.toBe(panel.layout.allocation);
    expect(panel.layout.allocation).toEqual({ x: 0, y: 0, width: 200, height: 100 });
    expect(inspector.compareComponents(first, next).changes.find(change => change.componentId === panel.componentId)?.fields).toContain('layout');
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('clears failed layout entries, isolates another root and recovers with a new observed lifetime', () => {
  const canvases = [document.createElement('canvas'), document.createElement('canvas')];
  canvases[0].width = 400; canvases[0].height = 200;
  canvases[1].width = 180; canvases[1].height = 120;
  for (const canvas of canvases) document.body.append(canvas);
  const fail = signal(false), width = signal<'50%' | '25%'>('50%'), color = signal('#ff0000');
  const failure = new Error('layout fixture failure');
  function Panel(props: { style: BoxStyle; bad?: boolean }) {
    const box = useLayoutBox();
    if (props.bad && fail.get()) throw failure;
    return <Rectangle style={{ width: box.width, height: box.height, fill: color.get() }} />;
  }
  function BadScene() { return <Absolute><Panel bad style={{ width: width.get(), height: 80 }} /></Absolute>; }
  function GoodScene() { return <Absolute><Panel style={{ width: '50%', height: 60 }} /></Absolute>; }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const bad = crc(canvases[0], <BadScene />, { viewport: { width: 400, height: 200 }, pixelRatio: 1 });
  const good = crc(canvases[1], <GoodScene />, { viewport: { width: 180, height: 120 }, pixelRatio: 1 });
  const badInspector = createSignalInspector(canvases[0]), goodInspector = createSignalInspector(canvases[1]);
  try {
    driver.flush(1);
    const first = badInspector.snapshot();
    const before = first.ownership.components.records.find(record => record.typeId === badInspector.identifyType(Panel))!;
    expect(before.layout.allocation).toEqual({ x: 0, y: 0, width: 200, height: 80 });
    fail.set(true); width.set('25%'); color.set('#0000ff');
    expect(() => driver.flush(2)).toThrow(failure);
    const failed = badInspector.snapshot();
    expect(failed.ownership.components.records).toEqual([]);
    expect(failed.ownership.components.removals.records).toContainEqual({ componentId: before.componentId, reason: 'component-disposed' });
    expect(before.layout.allocation).toEqual({ x: 0, y: 0, width: 200, height: 80 });
    const unaffected = goodInspector.snapshot().ownership.components.records.find(record => record.typeId === goodInspector.identifyType(Panel))!;
    expect(unaffected.layout).toEqual({ status: 'entry-context', allocation: { x: 0, y: 0, width: 90, height: 60 }, percentageBasis: { x: 0, y: 0, width: 180, height: 120 } });
    expect([...canvases[1].getContext('2d')!.getImageData(20, 20, 1, 1).data]).toEqual([0, 0, 255, 255]);
    fail.set(false);
    crc(canvases[0], <BadScene />); driver.flush(3);
    const recovered = badInspector.snapshot().ownership.components.records.find(record => record.typeId === badInspector.identifyType(Panel))!;
    expect(recovered.componentId).not.toBe(before.componentId);
    expect(recovered.layout).toEqual({ status: 'entry-context', allocation: { x: 0, y: 0, width: 100, height: 80 }, percentageBasis: { x: 0, y: 0, width: 400, height: 200 } });
    expect([...canvases[0].getContext('2d')!.getImageData(20, 20, 1, 1).data]).toEqual([0, 0, 255, 255]);
  } finally { badInspector.dispose(); goodInspector.dispose(); bad.dispose(); good.dispose(); canvases.forEach(canvas => canvas.remove()); restore(); }
});

it.each([false, true])('restores sibling allocations after a failed child (nested Layer: %s)', (nestedLayer) => {
  const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 200; document.body.append(canvas);
  const fail = signal(false);
  const visited: { name: string; width: number; height: number }[] = [];
  const failure = new Error('nested layout failure');
  function Panel(props: { name: string; style: BoxStyle & { left?: number } }) {
    const box = useLayoutBox();
    visited.push({ name: props.name, width: box.width, height: box.height });
    if (props.name === 'middle' && fail.get()) throw failure;
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#008000' }} />;
  }
  function Scene() {
    const middle = <Absolute><Panel name="middle" style={{ width: '50%', height: 30 }} /></Absolute>;
    return <Absolute>
      <Panel name="before" style={{ width: 60, height: 40 }} />
      {nestedLayer ? <Layer style={{ width: 200, height: 100 }}>{middle}</Layer> : <Panel name="middle" style={{ width: 100, height: 30 }} />}
      <Panel name="after" style={{ left: 250, width: 70, height: 80 }} />
    </Absolute>;
  }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const controller = crc(canvas, <Scene />);
  try {
    driver.flush(1);
    expect(visited).toEqual([{ name: 'before', width: 60, height: 40 }, { name: 'middle', width: 100, height: 30 }, { name: 'after', width: 70, height: 80 }]);
    visited.length = 0;
    // Explicit root traversal exercises sibling unwinding even when the failing
    // signal's consumer lives on a separately scheduled Layer.
    fail.set(true); crc(canvas, <Scene />);
    let thrown: unknown;
    try { driver.flush(2); } catch (error) { thrown = error; }
    expect(thrown === failure || thrown instanceof AggregateError && thrown.errors.includes(failure)).toBe(true);
    expect(visited.some(record => record.name === 'middle')).toBe(true);
    if (!nestedLayer) expect(visited.map(record => record.name)).toEqual(['before', 'middle']);
    visited.length = 0;
    fail.set(false); crc(canvas, <Scene />); driver.flush(3);
    const before = { name: 'before', width: 60, height: 40 }, middle = { name: 'middle', width: 100, height: 30 }, after = { name: 'after', width: 70, height: 80 };
    // Dirty Layers advance deepest-first; source paint order is a separate fact.
    expect(visited).toEqual(nestedLayer ? [middle, before, after] : [before, middle, after]);
    const inspector = createSignalInspector(canvas);
    try {
      const records = inspector.snapshot().ownership.components.records.filter(record => record.typeId === inspector.identifyType(Panel));
      expect(records).toHaveLength(3);
      expect(records.map(record => record.layout.allocation).sort((a, b) => a!.width - b!.width)).toEqual([
        { x: 0, y: 0, width: 60, height: 40 }, { x: 0, y: 0, width: 70, height: 80 }, { x: 0, y: 0, width: 100, height: 30 },
      ]);
      expect(records.find(record => record.layout.allocation?.width === 100)?.layout.percentageBasis).toEqual({ x: 0, y: 0, width: nestedLayer ? 200 : 400, height: nestedLayer ? 100 : 200 });
    } finally { inspector.dispose(); }
  } finally { controller.dispose(); canvas.remove(); restore(); }
});


it.each(['root', 'layer'] as const)('observes %s reaction subscriptions without running setup or confusing them with render reads', surfaceKind => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const branch = signal(true); const left = signal(1); const right = signal(2);
  let setups = 0; let cleanups = 0; let renders = 0;
  function Scene() {
    renders++;
    useReaction(() => {
      setups++;
      (branch.get() ? left : right).get();
      return () => { cleanups++; };
    });
  }
  const controller = crc(canvas, surfaceKind === 'root' ? <Scene /> : <Layer style={{ width: 100, height: 100 }}><Scene /></Layer>);
  const inspector = createSignalInspector(canvas);
  inspector.register(branch); inspector.register(left); inspector.register(right);
  const subscribers = (index: number) => {
    const record = inspector.snapshot().records[index];
    if (record?.status !== 'available') throw new Error('Expected signal');
    return record.observers.records;
  };
  try {
    driver.flush(1);
    const initial = subscribers(1);
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ kind: 'reaction', dirty: null, registeredSignalId: null });
    const scene = inspector.snapshot().ownership.components.records.find(record => record.typeId === inspector.identifyType(Scene));
    expect(scene).toBeDefined();
    expect(initial[0].owner).toMatchObject({ componentId: scene!.componentId, surfaceKind });
    const unrelatedCanvas = document.createElement('canvas'); document.body.append(unrelatedCanvas);
    const unrelatedController = crc(unrelatedCanvas, <Group>{null}</Group>);
    const unrelated = createSignalInspector(unrelatedCanvas); unrelated.register(left);
    try {
      const record = unrelated.snapshot().records[0];
      if (record?.status !== 'available') throw new Error('Expected shared signal');
      expect(record.observers.records[0]).toMatchObject({ kind: 'reaction', owner: null });
    } finally { unrelated.dispose(); unrelatedController.dispose(); unrelatedCanvas.remove(); }
    const before = signalGraphSnapshot();
    for (let index = 0; index < 10; index++) inspector.snapshot();
    expect(signalGraphSnapshot()).toEqual(before);
    expect([setups, cleanups, renders]).toEqual([1, 0, 1]);
    branch.set(false);
    expect(subscribers(1)[0].consumerId).toBe(initial[0].consumerId);
    expect(subscribers(2)).toHaveLength(0);
    expect([setups, cleanups]).toEqual([1, 0]);
    driver.flush(2);
    expect(subscribers(1)).toHaveLength(0);
    expect(subscribers(2)[0]).toMatchObject({ kind: 'reaction', consumerId: initial[0].consumerId });
    expect([setups, cleanups, renders]).toEqual([2, 1, 1]);
    controller.dispose();
    expect(subscribers(2)).toHaveLength(0);
    expect([setups, cleanups]).toEqual([2, 2]);
    expect(initial[0].kind).toBe('reaction');
  } finally { inspector.dispose(); controller.dispose(); canvas.remove(); restore(); }
});

it('preserves exceptional numeric previews through saved JSON without validating signals', () => {
  const inspector = createSignalInspector();
  [-0, 0, NaN, Infinity, -Infinity].forEach(value => inspector.register(signal(value)));
  try {
    const saved = JSON.parse(JSON.stringify(inspector.snapshot()));
    expect(saved.records.map((record: { preview: unknown }) => record.preview)).toEqual([
      { kind: 'special-number', value: '-0' }, { kind: 'scalar', value: 0 },
      { kind: 'special-number', value: 'NaN' },
      { kind: 'special-number', value: 'Infinity' },
      { kind: 'special-number', value: '-Infinity' },
    ]);
  } finally { inspector.dispose(); }
});


it('keeps partial Canvas pixels visible after render failure without calling the frame committed', () => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
  canvas.style.cssText = 'width:100px;height:100px'; document.body.append(canvas);
  const fail = signal(false); const failure = new Error('after prefix paint');
  function Broken() { throw failure; }
  function Scene() {
    return fail.get() ? <><Rectangle style={{ width: 40, height: 100, fill: '#ff0000' }} /><Broken /></> :
      <Rectangle style={{ width: 100, height: 100, fill: '#0000ff' }} />;
  }
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const history = createSchedulerHistory();
  const controller = crc(canvas, <Scene />, { viewport: { width: 100, height: 100 }, pixelRatio: 1 });
  const inspector = createTargetingInspector(canvas);
  const pixel = (x: number) => Array.from(canvas.getContext('2d')!.getImageData(x, 50, 1, 1).data);
  try {
    driver.flush(1);
    const successful = inspector.snapshot();
    expect(successful.status).toBe('ready');
    expect(pixel(20)).toEqual([0, 0, 255, 255]);
    expect(pixel(80)).toEqual([0, 0, 255, 255]);
    fail.set(true);
    expect(() => driver.flush(2)).toThrow(failure);
    expect(pixel(20)).toEqual([255, 0, 0, 255]);
    expect(pixel(80)).toEqual([0, 0, 0, 0]);
    const failed = inspector.snapshot();
    expect(failed.status).toBe('pending');
    expect(failed.records).toEqual([]);
    expect(failed.surface.status).toBe('unavailable');
    expect(history.snapshot().frames.at(-1)).toMatchObject({ outcome: 'errors-collected', phaseErrors: { render: 1 } });
    expect(successful.status).toBe('ready');
    fail.set(false); crc(canvas, <Scene />); driver.flush(3);
    expect(inspector.snapshot().status).toBe('ready');
    expect(pixel(20)).toEqual([0, 0, 255, 255]);
    expect(pixel(80)).toEqual([0, 0, 255, 255]);
  } finally { inspector.dispose(); history.dispose(); controller.dispose(); canvas.remove(); restore(); }
});
