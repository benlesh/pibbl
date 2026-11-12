import { expect, it } from 'vitest';
import { setPrimitiveReceiverToken } from '../element/metadata.js';
import { createElement } from '../element/create-element.js';
import { definePrimitive } from '../define-primitive.js';
import { signal, signalGraphSnapshot } from '../signals/graph.js';
import { collectSignalReads, createSignalRenderConsumer, disposeSignalRenderConsumer } from '../signals/render-consumer.js';
import { adoptReceiverInputProvision } from '../signals/input-provision.js';
import { GLOBAL_STATE } from '../global-state.js';
import { RootRenderTransaction } from '../render-transaction.js';
import { setPreNormalizedStyle } from '../style/resolve-dispatch.js';
import type { FlexStyle } from './flex.js';
import { measureElement, measureConstrainedLayoutChild, measureBaselineElement } from './measure.js';
import { canvasMeasurementService } from './canvas-measurement.js';
import type { RenderingContext2D, SystemStyle } from '../types.js';

it('reuses only the current transaction constrained leaf demand and validates scalar inputs, signal bindings, style, service and constraints', () => {
  const previousTransaction = GLOBAL_STATE.renderTransaction;
  const first = signal(80), second = signal(80);
  let selected = first, calls = 0, amount = 1, invalidations = 0;
  const baseline = signalGraphSnapshot();
  const consumer = createSignalRenderConsumer({ debugName: 'constrained query receipt', invalidate: () => { invalidations++; } });
  const leafStyle: FlexStyle = { width: 'auto', height: 20, minWidth: 0, maxWidth: '25%', flexGrow: 0, flexShrink: 0 };
  const Leaf = definePrimitive<{ amount: number; source: typeof first }, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}), preserveSignalProps: ['source'],
    measure: ({ props, constraints }) => { calls++; if (Number.isNaN(constraints.maxWidth)) throw new Error('Invalid maximum'); return { status: 'measured', size: { width: props.source.get() * props.amount, height: 20 } }; },
  });
  const receiver = {}, childReceiver = {};
  const constraints = { minWidth: 0, maxWidth: 40, minHeight: 20, maxHeight: 20 };
  const Parent = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: () => {
      const leaf = createElement(Leaf, { amount, source: selected, style: leafStyle });
      setPreNormalizedStyle(leaf, leafStyle, leaf, childReceiver);
      return measureConstrainedLayoutChild(leaf, constraints);
    },
  });
  let service = { measureText: () => { throw new Error('No text'); } };
  let tx = new RootRenderTransaction();
  const query = () => {
    const root = createElement(Parent, { style: { width: 'auto', height: 20 } });
    setPreNormalizedStyle(root, { height: 20 } as FlexStyle, root, receiver);
    const result = measureElement(root, { minWidth: 0, maxWidth: Infinity, minHeight: 20, maxHeight: 20 }, service);
    collectSignalReads(consumer, () => adoptReceiverInputProvision(tx, childReceiver)); consumer.markClean();
    return result;
  };
  try {
    GLOBAL_STATE.renderTransaction = tx;
    expect(query().status).toBe('measured'); query(); expect(calls).toBe(1);
    first.set(20); query(); expect(calls).toBe(2);
    selected = second; query(); expect(calls).toBe(3);
    amount = 2; query(); expect(calls).toBe(4);
    const beforeOld = invalidations;
    first.set(30); expect(invalidations).toBe(beforeOld); query(); expect(calls).toBe(4);
    second.set(30); expect(invalidations).toBe(beforeOld + 1); query(); expect(calls).toBe(5);
    leafStyle.minWidth = 1; query(); expect(calls).toBe(6);
    constraints.maxWidth = 20; query(); expect(calls).toBe(7);
    service = { measureText: () => { throw new Error('Different service'); } }; query(); expect(calls).toBe(8);
    tx.finish(false); tx = new RootRenderTransaction(); GLOBAL_STATE.renderTransaction = tx;
    query(); expect(calls).toBe(9);
    constraints.maxWidth = Infinity; query(); expect(calls).toBe(10);
    constraints.maxWidth = NaN; expect(query).toThrow('Invalid maximum'); expect(calls).toBe(11);
  } finally { tx.finish(false); disposeSignalRenderConsumer(consumer); GLOBAL_STATE.renderTransaction = previousTransaction; }
  expect(signalGraphSnapshot().rendererEdges).toBe(baseline.rendererEdges);
});

it('does not reuse a receiver-tagged leaf without a fresh normalized style proof', () => {
  const previous = GLOBAL_STATE.renderTransaction, tx = new RootRenderTransaction();
  let calls = 0;
  const style: FlexStyle = { width: 20, height: 10 };
  const receiver = {};
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: ({ style }) => { calls++; return { status: 'measured', size: { width: style.width as number, height: 10 } }; },
  });
  const leaf = createElement(Leaf, { style }); setPrimitiveReceiverToken(leaf, receiver);
  const Parent = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: () => measureConstrainedLayoutChild(leaf, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }),
  });
  const root = createElement(Parent, {});
  const service = { measureText: () => { throw new Error('No text'); } };
  const query = () => measureElement(root, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service);
  try {
    GLOBAL_STATE.renderTransaction = tx;
    expect(query()).toEqual({ status: 'measured', size: { width: 20, height: 10 } });
    style.width = 30; expect(query()).toEqual({ status: 'measured', size: { width: 30, height: 10 } }); expect(calls).toBe(2);
    setPreNormalizedStyle(leaf, { ...style }, leaf, receiver); query(); expect(calls).toBe(3);
    setPreNormalizedStyle(leaf, { ...style }, leaf, receiver); query(); expect(calls).toBe(3);
    style.width = 40; expect(query()).toEqual({ status: 'measured', size: { width: 40, height: 10 } }); expect(calls).toBe(4);
  } finally { tx.finish(false); GLOBAL_STATE.renderTransaction = previous; }
});

it('reuses framework Canvas wrappers for one target, while isolating different targets and custom services', () => {
  const previousTransaction = GLOBAL_STATE.renderTransaction;
  const receiver = {}, leafReceiver = {};
  let calls = 0;
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: () => { calls++; expect(GLOBAL_STATE.renderContext).toBeUndefined(); return { status: 'measured', size: { width: 20, height: 20 } }; },
  });
  const Parent = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: () => {
      const leaf = createElement(Leaf, { style: { width: 'auto', height: 20 } });
      setPreNormalizedStyle(leaf, { width: 'auto', height: 20 } as FlexStyle, leaf, leafReceiver);
      return measureConstrainedLayoutChild(leaf, { minWidth: 0, maxWidth: 40, minHeight: 20, maxHeight: 20 });
    },
  });
  const tx = new RootRenderTransaction();
  const first = {} as RenderingContext2D, second = {} as RenderingContext2D;
  const query = (service: Parameters<typeof measureElement>[2]) => {
    const root = createElement(Parent, { style: { height: 20 } });
    setPreNormalizedStyle(root, { height: 20 } as FlexStyle, root, receiver);
    return measureElement(root, { minWidth: 0, maxWidth: 160, minHeight: 20, maxHeight: 20 }, service);
  };
  try {
    GLOBAL_STATE.renderTransaction = tx;
    query(canvasMeasurementService(first)); query(canvasMeasurementService(first)); expect(calls).toBe(1);
    query(canvasMeasurementService(second)); expect(calls).toBe(2);
    const custom = { measureText: () => { throw new Error('No text'); } };
    query(custom); query(custom); expect(calls).toBe(3);
    query({ ...custom }); expect(calls).toBe(4);
  } finally { tx.finish(false); GLOBAL_STATE.renderTransaction = previousTransaction; }
});

it('does not memoize a direct constrained provider with an untraced nested public query', () => {
  const previous = GLOBAL_STATE.renderTransaction, tx = new RootRenderTransaction();
  const receiver = {}, childReceiver = {}, height = signal(20);
  const Nested = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: ({ style }) => ({ status: 'measured', size: { width: 1, height: style.height as number } }),
  });
  const nested = createElement(Nested, { style: { height } });
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: ({ measureElement }) => measureElement(nested, { minWidth: 0, maxWidth: 1, minHeight: 0, maxHeight: 100 }),
  });
  const Parent = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measure: () => {
      const leaf = createElement(Leaf, {});
      setPreNormalizedStyle(leaf, {} as SystemStyle, leaf, childReceiver);
      return measureConstrainedLayoutChild(leaf, { minWidth: 0, maxWidth: 40, minHeight: 0, maxHeight: 100 });
    },
  });
  const service = { measureText: () => { throw new Error('No text'); } };
  const query = () => {
    const root = createElement(Parent, {}); setPreNormalizedStyle(root, {}, root, receiver);
    return measureElement(root, { minWidth: 0, maxWidth: 40, minHeight: 0, maxHeight: 100 }, service);
  };
  try {
    GLOBAL_STATE.renderTransaction = tx;
    expect(query()).toEqual({ status: 'measured', size: { width: 1, height: 20 } });
    height.set(40);
    expect(query()).toEqual({ status: 'measured', size: { width: 1, height: 40 } });
  } finally { tx.finish(false); GLOBAL_STATE.renderTransaction = previous; }
});


it('reuses exact baseline demands without confusing size queries or changed allocations and input bindings', () => {
  const previous = GLOBAL_STATE.renderTransaction, tx = new RootRenderTransaction(), receiver = {};
  const first = signal(12), replacement = signal(12);
  let selected = first, calls = 0, invalidations = 0;
  const before = signalGraphSnapshot();
  const consumer = createSignalRenderConsumer({ debugName: 'baseline demand receipt', invalidate: () => { invalidations++; } });
  const Leaf = definePrimitive<{ first: typeof first }, FlexStyle, FlexStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}), preserveSignalProps: ['first'],
    measure: () => ({ status: 'measured', size: { width: 100, height: 55 } }),
    measureBaselines: ({ props, allocation }) => { calls++; const value = props.first.get(); return { status: 'measured', first: value, last: allocation.height }; },
  });
  const service = { measureText: () => { throw new Error('No text'); } };
  const element = () => {
    const leaf = createElement(Leaf, { first: selected, style: { width: 100, height: 55 } });
    setPreNormalizedStyle(leaf, { width: 100, height: 55 } as FlexStyle, leaf, receiver); return leaf;
  };
  const box = { x: 0, y: 0, width: 100, height: 55 };
  const query = () => {
    const result = measureBaselineElement(element(), box, service);
    collectSignalReads(consumer, () => adoptReceiverInputProvision(tx, receiver)); consumer.markClean(); return result;
  };
  try {
    GLOBAL_STATE.renderTransaction = tx;
    expect(query()).toEqual({ status: 'measured', first: 12, last: 55 });
    query(); expect(calls).toBe(1);
    first.set(22); expect(invalidations).toBe(1); expect(query()).toEqual({ status: 'measured', first: 22, last: 55 });
    query(); expect(calls).toBe(2);
    selected = replacement; expect(query()).toEqual({ status: 'measured', first: 12, last: 55 }); expect(calls).toBe(3);
    const beforeOld = invalidations; first.set(30); expect(invalidations).toBe(beforeOld); query(); expect(calls).toBe(3);
    replacement.set(15); expect(invalidations).toBe(beforeOld + 1);
    expect(query()).toEqual({ status: 'measured', first: 15, last: 55 }); expect(calls).toBe(4);
    expect(measureElement(element(), { minWidth: 100, maxWidth: 100, minHeight: 55, maxHeight: 55 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 55 } });
    box.height = 60; expect(query()).toEqual({ status: 'measured', first: 15, last: 60 }); expect(calls).toBe(5);
  } finally { tx.finish(false); disposeSignalRenderConsumer(consumer); GLOBAL_STATE.renderTransaction = previous; }
  expect(signalGraphSnapshot().rendererEdges).toBe(before.rendererEdges);
});
