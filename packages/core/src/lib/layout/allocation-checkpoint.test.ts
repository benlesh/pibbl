import { canvasMeasurementService } from './canvas-measurement.js';
import { describe, expect, it } from 'vitest';
import { createElement } from '../element/create-element.js';
import { getPrimitiveReceiverToken, getChildPrimitiveReceiverToken } from '../element/metadata.js';
import { signal, signalGraphSnapshot, withSignalDependencyRole } from '../signals/graph.js';
import { withReceiverInputProvision, adoptReceiverInputProvision } from '../signals/input-provision.js';
import { createSignalRenderConsumer, collectSignalReads, disposeSignalRenderConsumer } from '../signals/render-consumer.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { PibblRenderTransaction, SystemStyle, RenderingContext2D } from '../types.js';
import { takePreNormalizedStyle } from '../style/resolve-dispatch.js';
import { Rectangle } from '../components/rect.js';
import { prepareDirectChildStyle, childWithUsedSize } from './absolute.js';
import { preparedStyleValue } from '../style/responsive.js';
import { allocationMeasurement, disposeAllocationCheckpoint, withAllocationCheckpoint } from './allocation-checkpoint.js';
import { allocationCheckpointPhaseOwner, retainAllocationCheckpointPhases } from './allocation-checkpoint-owner.js';
import { adoptAllocationReceiver, invalidateAllocationReceiver, snapshotAllocationDependencies } from './allocation-dependencies.js';

function transaction() {
  const callbacks: ((success: boolean) => void)[] = [];
  return { onFinish: (callback: (success: boolean) => void) => callbacks.push(callback), finish: (success: boolean) => callbacks.forEach(callback => callback(success)) } as unknown as PibblRenderTransaction & { finish(success: boolean): void };
}
const box = { x: 0, y: 0, width: 100, height: 20 };
describe('allocation checkpoints', () => {
  it('remeasures application-owned fonts while equal numeric output stops allocation', () => {
    const owner = {}, token = {};
    let width = 20, measurements = 0, computations = 0, font = '12px "ApplicationFont", monospace';
    const service = canvasMeasurementService({ save() {}, restore() {}, font: '', measureText() { measurements++; return { width }; } } as unknown as RenderingContext2D);
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    const query = () => service.measureText('text', font).width;
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const measured = allocationMeasurement(element, query);
        return [{ box: { ...box, width: measured }, element }];
      } });
      tx.finish(true); return result;
    }
    try {
      render(); expect(measurements).toBe(1); expect(computations).toBe(1);
      render(); expect(measurements).toBe(2); expect(computations).toBe(1);
      width = 30; expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
      font = '12px monospace'; render(); const settled = measurements;
      render(); expect(measurements).toBe(settled); expect(computations).toBe(2);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('replaces measurement dependencies after equal output without keeping the old signal lease', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const select = signal(true), first = signal(20), second = signal(20);
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    const baseline = signalGraphSnapshot();
    const consumer = createSignalRenderConsumer({ debugName: 'measurement checkpoint', allocationReceiver: receiverOwner, invalidate: () => {} });
    let measurements = 0, computations = 0;
    const query = (element: ReturnType<typeof createElement>) => withReceiverInputProvision(GLOBAL_STATE.renderTransaction, getPrimitiveReceiverToken(element), () => withSignalDependencyRole('measurement', () => {
      measurements++; return { width: select.get() ? first.get() : second.get(), height: 10 };
    }));
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const measured = allocationMeasurement(element, query);
        return [{ box: { ...box, width: measured.width }, element }];
      } });
      collectSignalReads(consumer, () => adoptReceiverInputProvision(tx, receiver)); consumer.markClean();
      adoptAllocationReceiver(tx, receiver, receiverOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(true);
      return result;
    }
    try {
      render(); expect(measurements).toBe(1);
      select.set(false); render(); expect(measurements).toBe(2); expect(computations).toBe(1);
      first.set(40); render(); expect(measurements).toBe(2);
      second.set(30); expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
    } finally { disposeAllocationCheckpoint(owner); disposeSignalRenderConsumer(consumer); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
  });
  it('rebinds an equal replacement style signal before reusing numeric allocation', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const first = signal(20), second = signal(20);
    const style = { width: first, height: 10 };
    const children = [createElement(Rectangle, { style })];
    let computations = 0, invalidations = 0;
    const consumer = createSignalRenderConsumer({ debugName: 'equal binding replacement', allocationReceiver: receiverOwner, invalidate: () => { invalidations++; } });
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const resolved = preparedStyleValue(prepared) as SystemStyle & { width: number };
        return [{ box: { ...box, width: resolved.width }, element: childWithUsedSize(children[0], resolved, resolved.width, 10, receiver) }];
      } });
      collectSignalReads(consumer, () => adoptReceiverInputProvision(tx, receiver)); consumer.markClean();
      adoptAllocationReceiver(tx, receiver, receiverOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(true); return result;
    }
    try {
      render(); style.width = second; render(); expect(computations).toBe(1);
      first.set(40); expect(invalidations).toBe(0);
      second.set(30); expect(invalidations).toBe(1);
      expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
    } finally { disposeAllocationCheckpoint(owner); disposeSignalRenderConsumer(consumer); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('routes a structural query receipt back to its descendant receiver without a parent signal lease', () => {
    const owner = {}, parentOwner = {}, leafOwner = {}, token = {};
    const content = signal('first');
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    const baseline = signalGraphSnapshot();
    const leafConsumer = createSignalRenderConsumer({ debugName: 'nested measured receiver', allocationReceiver: leafOwner, invalidate: () => {} });
    let computations = 0, measurements = 0;
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const leafReceiver = getChildPrimitiveReceiverToken(tx, receiver, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const measured = allocationMeasurement(element, current => {
          const nested = getChildPrimitiveReceiverToken(GLOBAL_STATE.renderTransaction, getPrimitiveReceiverToken(current), 0);
          return withReceiverInputProvision(GLOBAL_STATE.renderTransaction, nested, () => withSignalDependencyRole('measurement', () => {
            content.get(); measurements++; return { width: 20, height: 10 };
          }));
        });
        return [{ box: { ...box, width: measured.width }, element }];
      } });
      collectSignalReads(leafConsumer, () => adoptReceiverInputProvision(tx, leafReceiver)); leafConsumer.markClean();
      adoptAllocationReceiver(tx, receiver, parentOwner); adoptAllocationReceiver(tx, leafReceiver, leafOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(true); return result;
    }
    try {
      render(); expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges + 1);
      content.set('other'); render(); expect(measurements).toBe(2); expect(computations).toBe(1);
      expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges + 1);
    } finally { disposeAllocationCheckpoint(owner); disposeSignalRenderConsumer(leafConsumer); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
    expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
  });
  it('bypasses item computation but detects in-place mutable style changes', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const style = { width: 20, height: 10, fill: 'red' };
    const children = [createElement(Rectangle, { style })];
    let computations = 0;
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const resolved = preparedStyleValue(prepared) as SystemStyle & typeof style;
        return [{ box: { ...box, width: resolved.width }, element: childWithUsedSize(children[0], resolved, resolved.width, 10, receiver) }];
      } });
      adoptAllocationReceiver(tx, getChildPrimitiveReceiverToken(tx, token, 0), receiverOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(true);
      return result;
    }
    try {
      render(); render(); expect(computations).toBe(1);
      style.fill = 'blue'; render(); expect(computations).toBe(1);
      style.width = 30; expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('remeasures a dirty demanded contribution before deciding whether allocation is needed', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    let computations = 0, measurements = 0, width = 20;
    function render(success = true) {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const measured = allocationMeasurement(element, () => { measurements++; return { width, height: 10 }; });
        return [{ box: { ...box, width: measured.width }, element }];
      } });
      adoptAllocationReceiver(tx, getChildPrimitiveReceiverToken(tx, token, 0), receiverOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(success);
      return result;
    }
    try {
      render(); invalidateAllocationReceiver(receiverOwner, 4); render();
      expect(measurements).toBe(2); expect(computations).toBe(1);
      width = 30; invalidateAllocationReceiver(receiverOwner, 4);
      expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
      width = 40; invalidateAllocationReceiver(receiverOwner, 4); render(false);
      expect(render()[0].box.width).toBe(40); expect(computations).toBe(4);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('compares prerequisite numeric continuations and rejects missing proof after measurement invalidation', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    let computations = 0;
    function render(continuation: { target: number } | undefined, success = true) {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, continuation, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const width = continuation?.target ?? 20;
        return [{ box: { ...box, width }, element: childWithUsedSize(children[0], preparedStyleValue(prepared), width, 10, receiver) }];
      } });
      adoptAllocationReceiver(tx, receiver, receiverOwner);
      for (const placement of result) takePreNormalizedStyle(placement.element);
      tx.finish(success); return result;
    }
    try {
      render({ target: 30 }); render({ target: 30 }); render(undefined);
      expect(computations).toBe(1);
      expect(render({ target: 40 })[0].box.width).toBe(40); expect(computations).toBe(2);
      render({ target: 50 }, false); expect(render(undefined)[0].box.width).toBe(40);
      expect(computations).toBe(3);
      invalidateAllocationReceiver(receiverOwner, 4);
      expect(render(undefined)[0].box.width).toBe(20); expect(computations).toBe(4);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('replays pending phase descriptors without reading unresolved geometry and disposes phase dependencies', () => {
    const owner = {}, receiverOwner = {}, token = {};
    const phase = allocationCheckpointPhaseOwner(owner, 0);
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } })];
    let computations = 0, replays = 0;
    function render(target: object, pendingPhase: boolean, retain?: readonly number[], success = true) {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      let pending: { style: Readonly<SystemStyle>; data: unknown } | undefined;
      const sentinel = { get box(): typeof box { throw new Error('Unresolved box'); }, get element(): ReturnType<typeof createElement> { throw new Error('Unresolved element'); } };
      withAllocationCheckpoint(target, { children, content: box, settings: {}, pending: pendingPhase ? {
        read: () => pending,
        replay: (_index, style, currentReceiver, _query, data) => { expect(currentReceiver).toBe(receiver); expect(data).toEqual({ measured: false }); replays++; pending = { style, data }; return sentinel; },
      } : undefined, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const style = preparedStyleValue(prepared);
        if (pendingPhase) { pending = { style, data: { measured: false } }; return [sentinel]; }
        return [{ box, element: childWithUsedSize(children[0], style, 20, 10, receiver) }];
      } });
      adoptAllocationReceiver(tx, receiver, receiverOwner);
      if (retain) retainAllocationCheckpointPhases(owner, retain);
      tx.finish(success);
    }
    try {
      render(owner, true); render(phase, false); render(owner, true); render(phase, false);
      expect(computations).toBe(2); expect(replays).toBe(1);
      const beforePrune = snapshotAllocationDependencies();
      render(owner, true, [], false); render(phase, false); expect(computations).toBe(2);
      expect(snapshotAllocationDependencies()).toEqual(beforePrune);
      render(owner, true, []);
      expect(snapshotAllocationDependencies().dependencies).toBe(beforePrune.dependencies - 1);
      expect(snapshotAllocationDependencies().bindings).toBe(beforePrune.bindings - 1);
      render(phase, false); expect(computations).toBe(3);
    } finally { disposeAllocationCheckpoint(owner); disposeAllocationCheckpoint(phase); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('releases nested query bindings on rejected and retired volatile continuations', () => {
    const baseline = snapshotAllocationDependencies(), owner = {}, token = {};
    const content = signal(10);
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 } }),
      createElement(Rectangle, { style: { width: 20, height: 10 }, arbitrary: {} } as any)];
    try {
      for (let pass = 0; pass < 3; pass++) {
        const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
        const receivers = children.map((_child, index) => getChildPrimitiveReceiverToken(tx, token, index));
        const nested = getChildPrimitiveReceiverToken(tx, receivers[0], 0);
        withAllocationCheckpoint(owner, { children, content: box, settings: {}, continuation: { target: 20 }, calculate: () => children.map((child, index) => {
          const prepared = prepareDirectChildStyle(child, receivers[index], box);
          const element = childWithUsedSize(child, preparedStyleValue(prepared), 20, 10, receivers[index]);
          if (index === 0) allocationMeasurement(element, () => withReceiverInputProvision(tx, nested,
            () => withSignalDependencyRole('measurement', () => content.get())));
          return { box, element };
        }) });
        for (const receiver of [...receivers, nested]) adoptAllocationReceiver(tx, receiver, receiver);
        tx.finish(pass !== 0);
        disposeAllocationCheckpoint(owner);
        expect(snapshotAllocationDependencies()).toEqual(baseline);
      }
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
    expect(snapshotAllocationDependencies()).toEqual(baseline);
  });
  it('remeasures opaque model props and stops allocation when the demanded output is equal', () => {
    class Model { width = 20; }
    const data = new Model(), owner = {}, token = {};
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 }, data } as any)];
    let computations = 0, measurements = 0;
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const width = allocationMeasurement(element, current => { measurements++; return current.props.data.width as number; });
        return [{ box: { ...box, width }, element }];
      } });
      tx.finish(true); return result;
    }
    try {
      render(); render(); expect(computations).toBe(1); expect(measurements).toBe(2);
      data.width = 30; expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });  it('compares a current numeric continuation even when model props cannot be snapshotted', () => {
    class Model { width = 20; }
    const data = new Model(), owner = {}, token = {};
    const children = [createElement(Rectangle, { style: { width: 20, height: 10 }, data } as any)];
    let computations = 0, measurements = 0;
    function render(includeContinuation = true) {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, continuation: includeContinuation ? { target: data.width } : undefined, calculate: () => {
        computations++;
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const element = childWithUsedSize(children[0], preparedStyleValue(prepared), 20, 10, receiver);
        const width = allocationMeasurement(element, current => { measurements++; return current.props.data.width as number; });
        return [{ box: { ...box, width }, element }];
      } });
      tx.finish(true); return result;
    }
    try {
      render(); render(); expect(computations).toBe(1); expect(measurements).toBe(2);
      data.width = 30; expect(render()[0].box.width).toBe(30); expect(computations).toBe(2);
      data.width = 40; expect(render(false)[0].box.width).toBe(40); expect(computations).toBe(3);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
  it('reselects a responsive rule list mutated from empty without reading inactive patch signals', () => {
    const rules: { query: { minWidth: number }; style: { width: number } }[] = [];
    const children = [createElement(Rectangle, { style: { width: 20, height: 10, when: rules } })];
    const owner = {}, token = {};
    function render() {
      const tx = transaction(); GLOBAL_STATE.renderTransaction = tx; GLOBAL_STATE.primitiveReceiverToken = token;
      const receiver = getChildPrimitiveReceiverToken(tx, token, 0);
      const result = withAllocationCheckpoint(owner, { children, content: box, settings: {}, calculate: () => {
        const prepared = prepareDirectChildStyle(children[0], receiver, box);
        const style = preparedStyleValue(prepared) as SystemStyle & { width: number };
        return [{ box: { ...box, width: style.width }, element: childWithUsedSize(children[0], style, style.width, 10, receiver) }];
      } });
      tx.finish(true); return result;
    }
    try {
      expect(render()[0].box.width).toBe(20);
      rules.push({ query: { minWidth: 50 }, style: { width: 40 } });
      expect(render()[0].box.width).toBe(40);
      rules[0].style.width = 60; expect(render()[0].box.width).toBe(60);
    } finally { disposeAllocationCheckpoint(owner); GLOBAL_STATE.renderTransaction = undefined; GLOBAL_STATE.primitiveReceiverToken = undefined; }
  });
});
