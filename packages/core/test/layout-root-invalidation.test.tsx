import { expect, it } from 'vitest';
import { Absolute, Flex, Rectangle, createElement, signal, definePrimitive, useCanvasContext, useLayoutBox, type BoxStyle, type FlexItemStyle, type SystemStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { invalidateAllocationInputs } from '../src/lib/layout/allocation-revision.js';
import { snapshotLayoutTopology } from '../src/lib/layout/prepared-root.js';
import { getPibblInstance } from '../src/lib/global-state.js';

it.runIf(nativeLayout)('keeps an unrelated root allocation cached after another root changes layout', () => {
  const width = signal(40), fill = signal('#426b61'), pointerEvents = signal<'auto' | 'none'>('auto');
  let hits = 0;
  const first = createElement(Rectangle, { style: Object.freeze({ width, height: 20, minWidth: 0, flexShrink: 0, fill: '#19375b' }) });
  const second = createElement(Rectangle, { onClick: () => hits++, pointerEvents, style: Object.freeze({ width: 40, height: 20, minWidth: 0, flexShrink: 0, fill }) });
  Object.freeze(first.props); Object.freeze(first); Object.freeze(second.props); Object.freeze(second);
  const left = document.createElement('canvas'), right = document.createElement('canvas');
  left.width = right.width = 100; left.height = right.height = 20; document.body.append(left, right);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const a = pibblSync(left, createElement(Flex, { style: { width: 100, height: 20 }, children: Object.freeze([first]) }));
  const b = pibblSync(right, createElement(Flex, { style: { width: 100, height: 20 }, children: Object.freeze([second]) }));
  try {
    driver.flush(1);
    width.set(60); driver.flush(2);
    const before = snapshotWasmLayoutDiagnostics();
    fill.set('#a63758'); driver.flush(3);
    const after = snapshotWasmLayoutDiagnostics();
    expect(after.allocationPasses).toBe(before.allocationPasses);
    expect(after.allocationItemVisits).toBe(before.allocationItemVisits);
    expect(after.allocationCacheHits).toBe(before.allocationCacheHits + 1);
    expect([...right.getContext('2d')!.getImageData(5, 5, 1, 1).data]).toEqual([166, 55, 88, 255]);
    const click = () => { const box = right.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) right.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: box.left + 5, clientY: box.top + 5 })); };
    click(); expect(hits).toBe(1);
    pointerEvents.set('none'); driver.flush(4); click(); expect(hits).toBe(1);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(after.allocationPasses);
    pointerEvents.set('auto'); driver.flush(5); click(); expect(hits).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(after.allocationPasses);
  } finally { a.dispose(); b.dispose(); restore(); left.remove(); right.remove(); }
});

it.runIf(nativeLayout)('commits root-owned prepared topology only after a successful traversal and releases it on disposal', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const fill = signal('#19375b');
  const controller = pibblSync(canvas, createElement(Absolute, {
    style: { width: 100, height: 40 },
    children: createElement(Flex, { style: { width: 100, height: 40, left: 0, top: 0, minWidth: 0, flexShrink: 0 }, children: [
      createElement(Flex, { key: 'nested', style: { width: 40, height: 20, minWidth: 0, flexShrink: 0 }, children: createElement(Rectangle, { style: { width: 40, height: 20, fill } }) }),
    ] }),
  }));
  try {
    driver.flush(1);
    const root = getPibblInstance(canvas);
    const initial = snapshotLayoutTopology(root);
    expect(initial.records).toBeGreaterThanOrEqual(2);
    expect(initial.revision).toBeGreaterThan(0);
    expect(initial.pending).toBe(0);

    fill.set('#426b61'); driver.flush(2);
    const stable = snapshotLayoutTopology(root);
    expect(stable.revision).toBe(initial.revision);
    expect(stable.records).toBe(initial.records);
  } finally { controller.dispose(); restore(); canvas.remove(); }
  expect(snapshotLayoutTopology()).toEqual({ roots: 0, records: 0, pending: 0 });
});

it.runIf(nativeLayout)('reuses a same-root sibling allocation only when its frozen metric inputs are unchanged', () => {
  const aWidth = signal(40), bWidth = signal(40), bFill = signal('#426b61');
  const bPointerEvents = signal<'auto' | 'none'>('auto');
  let hits = 0;
  const aLeaf = createElement(Rectangle, { style: Object.freeze({ width: aWidth, height: 20, minWidth: 0, flexShrink: 0, fill: '#19375b' }) });
  const bLeaf = createElement(Rectangle, { onClick: () => hits++, pointerEvents: bPointerEvents, style: Object.freeze({ width: bWidth, height: 20, minWidth: 0, flexShrink: 0, fill: bFill }) });
  Object.freeze(aLeaf.props); Object.freeze(aLeaf); Object.freeze(bLeaf.props); Object.freeze(bLeaf);
  const a = createElement(Flex, { style: { width: 100, height: 20 }, children: Object.freeze([aLeaf]) });
  const b = createElement(Flex, { style: { width: 100, height: 20 }, children: Object.freeze([bLeaf]) });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const root = createElement(Flex, {
    style: { width: 100, height: 40, flexDirection: 'column' }, children: [a, b],
  });
  const controller = pibblSync(canvas, root);
  const clickB = () => {
    const box = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true, button: 0, clientX: box.left + 5, clientY: box.top + 25,
    }));
  };
  try {
    driver.flush(1);
    const initial = snapshotWasmLayoutDiagnostics();

    aWidth.set(60); driver.flush(2);
    const afterA = snapshotWasmLayoutDiagnostics();
    // The enclosing Flex always solves; A misses and B reuses its frozen input.
    expect(afterA.allocationPasses).toBe(initial.allocationPasses + 2);
    expect(afterA.allocationCacheHits).toBe(initial.allocationCacheHits + 1);

    bFill.set('#a63758'); driver.flush(3);
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.allocationPasses).toBe(afterA.allocationPasses + 1);
    expect(afterPaint.allocationCacheHits).toBe(afterA.allocationCacheHits + 2);
    expect([...canvas.getContext('2d')!.getImageData(5, 25, 1, 1).data]).toEqual([166, 55, 88, 255]);
    clickB(); expect(hits).toBe(1);
    bPointerEvents.set('none'); driver.flush(4); clickB(); expect(hits).toBe(1);
    const afterInteraction = snapshotWasmLayoutDiagnostics();
    expect(afterInteraction.allocationPasses).toBe(afterPaint.allocationPasses + 1);
    expect(afterInteraction.allocationCacheHits).toBe(afterPaint.allocationCacheHits + 2);

    bWidth.set(60); driver.flush(5);
    const afterB = snapshotWasmLayoutDiagnostics();
    expect(afterB.allocationPasses).toBe(afterInteraction.allocationPasses + 2);
    expect(afterB.allocationCacheHits).toBe(afterInteraction.allocationCacheHits + 1);

    invalidateAllocationInputs(); pibblSync(canvas, root); driver.flush(6);
    const afterStructural = snapshotWasmLayoutDiagnostics();
    expect(afterStructural.allocationPasses).toBe(afterB.allocationPasses + 3);
    expect(afterStructural.allocationCacheHits).toBe(afterB.allocationCacheHits);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('remeasures only providers whose measurement dependencies changed within one root', () => {
  const metrics = [signal(20), signal(20)];
  const measurements = [0, 0];
  const positions = [0, 0];
  let selected = -1;
  function leaf(index: number) {
    return definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle & { width: number; height: number }>((_props, _style) => {
      const context = useCanvasContext(); positions[index] = context.getTransform().e;
      return createElement(Rectangle, { onClick: () => { selected = index; }, style: { width: useLayoutBox().width, height: 10, fill: '#19375b' } });
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => {
        measurements[index]!++;
        const width = metrics[index]!.get();
        return { status: 'measured', minContent: { width, height: 10 }, maxContent: { width, height: 10 } };
      },
      measure: ({ constraints }) => ({ status: 'measured', size: { width: constraints.maxWidth, height: 10 } }),
    });
  }
  const A = leaf(0), B = leaf(1);
  const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 120, height: 20, alignItems: 'flex-start' }, children: [
    createElement(A, { style: { width: 'min-content', height: 10, minWidth: 0, flexShrink: 0 } }),
    createElement(B, { style: { width: 'min-content', height: 10, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(positions).toEqual([0, 20]);
    const before = measurements[1];
    metrics[0]!.set(30); driver.flush(2);
    expect(positions).toEqual([0, 30]); expect(measurements[1]).toBe(before);
    const rect = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: rect.left + 35, clientY: rect.top + 5 }));
    expect(selected).toBe(1);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
