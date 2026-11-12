import { expect, it } from 'vitest';
import { Absolute, Overlay, Grid, Flow, Flex, Group, Text, Rectangle, createElement, signal, definePrimitive, defineLayoutComponent, useCanvasContext, useLayoutBox, type BoxStyle, type FlexItemStyle, type SystemStyle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region.js';
import { invalidateAllocationInputs } from '../src/lib/layout/allocation-revision.js';
import { snapshotLayoutTopology } from '../src/lib/layout/prepared-root.js';
import { snapshotAllocationDependencies } from '../src/lib/layout/allocation-dependencies.js';
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
    // Both parent contributions stay 100×20; only A’s numeric region changes.
    expect(afterA.allocationPasses).toBe(initial.allocationPasses + 1);
    expect(afterA.allocationCacheHits).toBe(initial.allocationCacheHits + 2);

    expect([...canvas.getContext('2d')!.getImageData(55, 5, 1, 1).data]).toEqual([25, 55, 91, 255]);
    expect(canvas.getContext('2d')!.getImageData(65, 5, 1, 1).data[3]).toBe(0);
    expect(canvas.getContext('2d')!.getImageData(45, 25, 1, 1).data[3]).toBe(0);

    bFill.set('#a63758'); driver.flush(3);
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.allocationPasses).toBe(afterA.allocationPasses);
    expect(afterPaint.allocationCacheHits).toBe(afterA.allocationCacheHits + 3);
    expect([...canvas.getContext('2d')!.getImageData(5, 25, 1, 1).data]).toEqual([166, 55, 88, 255]);
    clickB(); expect(hits).toBe(1);
    bPointerEvents.set('none'); driver.flush(4); clickB(); expect(hits).toBe(1);
    const afterInteraction = snapshotWasmLayoutDiagnostics();
    expect(afterInteraction.allocationPasses).toBe(afterPaint.allocationPasses);
    expect(afterInteraction.allocationCacheHits).toBe(afterPaint.allocationCacheHits + 3);

    bWidth.set(60); driver.flush(5);
    const afterB = snapshotWasmLayoutDiagnostics();
    expect(afterB.allocationPasses).toBe(afterInteraction.allocationPasses + 1);
    expect(afterB.allocationCacheHits).toBe(afterInteraction.allocationCacheHits + 2);

    expect([...canvas.getContext('2d')!.getImageData(55, 25, 1, 1).data]).toEqual([166, 55, 88, 255]);

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

it.runIf(nativeLayout)('reuses unfrozen independent fixed sibling regions and stops at equal parent allocations', () => {
  const width = signal(20);
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 40;
  document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let paints = 0;
  function Paint() { paints++; return null; }
  const controller = pibblSync(canvas, createElement(Flex, {
    style: { width: 200, height: 40, alignItems: 'flex-start' }, children: [
      createElement(Flex, { key: 'changing', style: { width: 100, height: 40, minWidth: 0, flexShrink: 0 }, children: [
        createElement(Rectangle, { style: { width, height: 20, minWidth: 0, flexShrink: 0, fill: '#19375b' } }),
      ] }),
      createElement(Flex, { key: 'independent', style: { width: 100, height: 40, minWidth: 0, flexShrink: 0 }, children: [
        createElement(Rectangle, { style: { width: 40, height: 20, minWidth: 0, flexShrink: 0, fill: '#426b61' } }),
      ] }),
      createElement(Paint, { style: { width: 0, height: 0, minWidth: 0 } }),
    ],
  }));
  try {
    driver.flush(1);
    const before = snapshotWasmLayoutDiagnostics(), beforePaints = paints;
    width.set(30); driver.flush(2);
    const after = snapshotWasmLayoutDiagnostics();
    // Only the changed leaf's owning region needs allocation. Both fixed
    // parent contributions and the independent region remain numerically equal.
    expect(after.allocationPasses - before.allocationPasses).toBe(1);
    expect(after.allocationItemVisits - before.allocationItemVisits).toBe(1);
    expect(paints).toBe(beforePaints + 1);
    expect([...canvas.getContext('2d')!.getImageData(25, 5, 1, 1).data]).toEqual([25, 55, 91, 255]);
    expect([...canvas.getContext('2d')!.getImageData(105, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('remeasures changed content but stops allocation propagation when its numeric contribution is equal', () => {
  const content = signal('first');
  let measurements = 0;
  const painted: string[] = [];
  const Measured = definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle & { width: number; height: number }>(() => {
    painted.push(content.get());
    return createElement(Rectangle, { style: { width: useLayoutBox().width, height: 10, fill: '#426b61' } });
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => {
      content.get(); measurements++;
      return { status: 'measured', minContent: { width: 20, height: 10 }, maxContent: { width: 20, height: 10 } };
    },
    measure: () => ({ status: 'measured', size: { width: 20, height: 10 } }),
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20;
  document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, {
    style: { width: 100, height: 20, alignItems: 'flex-start' }, children: [
      createElement(Measured, { style: { width: 'min-content', height: 10, minWidth: 0, flexShrink: 0 } }),
      createElement(Rectangle, { style: { width: 20, height: 10, minWidth: 0, flexShrink: 0 } }),
    ],
  }));
  try {
    driver.flush(1);
    const before = snapshotWasmLayoutDiagnostics(), priorMeasurements = measurements;
    content.set('other'); driver.flush(2);
    expect(measurements).toBeGreaterThan(priorMeasurements);
    expect(painted).toEqual(['first', 'other']);
    const after = snapshotWasmLayoutDiagnostics();
    expect(after.allocationPasses).toBe(before.allocationPasses);
    expect(after.allocationItemVisits).toBe(before.allocationItemVisits);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});


for (const family of [Flex, Grid, Flow, Absolute, Overlay]) {
  it.runIf(nativeLayout)(`retains ${family.name} allocation on paint and notices mutable geometry`, () => {
    const ownership = snapshotAllocationDependencies();
    const fill = signal('#19375b'), strokeWidth = signal(1);
    const childStyle = { width: 20, height: 10, fill, stroke: '#19375b', strokeWidth };
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
    const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
    const settings = family === Grid ? { width: 100, height: 20, gridTemplateColumns: [100], gridTemplateRows: [20], alignItems: 'start', justifyItems: 'start' } :
      family === Overlay ? { width: 100, height: 20, alignItems: 'start', justifyItems: 'start' } :
      { width: 100, height: 20 };
    const controller = pibblSync(canvas, createElement(family as typeof Flex, { style: settings as any, children: [createElement(Rectangle, { style: childStyle })] }));
    try {
      driver.flush(1);
      const before = snapshotWasmLayoutDiagnostics();
      fill.set('#426b61'); strokeWidth.set(2); driver.flush(2);
      const painted = snapshotWasmLayoutDiagnostics();
      expect(painted.allocationPasses).toBe(before.allocationPasses);
      expect(painted.allocationItemVisits).toBe(before.allocationItemVisits);
      expect(painted.allocationCacheHits).toBeGreaterThan(before.allocationCacheHits);
      expect([...canvas.getContext('2d')!.getImageData(5, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
      childStyle.width = 30; fill.set('#19375b'); driver.flush(3);
      expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(painted.allocationPasses);
      expect([...canvas.getContext('2d')!.getImageData(25, 5, 1, 1).data]).toEqual([25, 55, 91, 255]);
    } finally { controller.dispose(); restore(); canvas.remove(); }
    expect(snapshotLayoutTopology()).toEqual({ roots: 0, records: 0, pending: 0 });
    expect(snapshotAllocationDependencies()).toEqual(ownership);
  });
}


it.runIf(nativeLayout)('keeps Text intrinsic allocation when changed monospace content has equal contributions', () => {
  const content = signal('ii');
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 30; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 30, alignItems: 'flex-start' }, children: [
    createElement(Text, { children: content, style: { width: 'min-content', height: 20, font: '10px monospace', minWidth: 0, flexShrink: 0 } }),
    createElement(Rectangle, { style: { width: 10, height: 10, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); const before = snapshotWasmLayoutDiagnostics();
    content.set('ll'); driver.flush(2);
    const after = snapshotWasmLayoutDiagnostics();
    expect(after.allocationPasses).toBe(before.allocationPasses);
    expect(after.allocationItemVisits).toBe(before.allocationItemVisits);
    expect(after.measuredLeaves).toBeGreaterThan(before.measuredLeaves);
    content.set('llll'); driver.flush(3);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(after.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});


it.runIf(nativeLayout)('replays cached Text measurement with current font and line height at the selected width', () => {
  const font = signal('10px monospace'), lineHeight = signal(10);
  let followingY = 0;
  function Following() { followingY = useCanvasContext().getTransform().f; return null; }
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 200; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 200, flexDirection: 'column', alignItems: 'flex-start' }, children: [
    createElement(Text, { children: 'a a a a', style: { width: 20, wrap: true, font, lineHeight, minHeight: 0, flexShrink: 0 } }),
    createElement(Following, { style: { width: 10, height: 10, minHeight: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(followingY).toBe(20);
    lineHeight.set(20); driver.flush(2); expect(followingY).toBe(40);
    font.set('20px monospace'); driver.flush(3); expect(followingY).toBe(80);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});


for (const family of [Flow, Grid, Absolute, Overlay]) {
  it.runIf(nativeLayout)(`stops ${family.name} allocation after equal demanded intrinsic measurements`, () => {
    const content = signal('first');
    let measurements = 0, paints = 0;
    const Leaf = definePrimitive<{}, BoxStyle, BoxStyle, SystemStyle>(() => { content.get(); paints++; return null; }, {
      resolveStyle: () => ({}),
      measureIntrinsic: () => { content.get(); measurements++; return { status: 'measured', minContent: { width: 20, height: 10 }, maxContent: { width: 20, height: 10 } }; },
      measure: () => { content.get(); measurements++; return { status: 'measured', size: { width: 20, height: 10 } }; },
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
    const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
    const settings = family === Grid ? { width: 100, height: 20, gridTemplateColumns: ['max-content'], gridTemplateRows: [20], alignItems: 'start', justifyItems: 'start' } :
      family === Overlay ? { width: 100, height: 20, alignItems: 'start', justifyItems: 'start' } : { width: 100, height: 20 };
    const controller = pibblSync(canvas, createElement(family as typeof Flow, { style: settings as any, children: [createElement(Leaf, { style: { width: 'min-content', height: 10 } })] }));
    try {
      driver.flush(1); const before = snapshotWasmLayoutDiagnostics(), priorMeasurements = measurements, priorPaints = paints;
      content.set('other'); driver.flush(2);
      expect(measurements).toBeGreaterThan(priorMeasurements); expect(paints).toBe(priorPaints + 1);
      const after = snapshotWasmLayoutDiagnostics();
      expect(after.allocationPasses).toBe(before.allocationPasses);
      expect(after.allocationItemVisits).toBe(before.allocationItemVisits);
    } finally { controller.dispose(); restore(); canvas.remove(); }
  });
}

it.runIf(nativeLayout)('compares demanded baseline outputs before reallocating a direct primitive group', () => {
  const label = signal('first'), baseline = signal(10);
  const positions = [0, 0];
  let queries = 0;
  function primitive(index: number) {
    return definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
      if (index === 0) label.get();
      positions[index] = useCanvasContext().getTransform().f;
      return null;
    }, {
      resolveStyle: () => ({}),
      measureBaselines: () => {
        queries++;
        if (index === 0) label.get();
        const offset = index === 0 ? baseline.get() : 12;
        return { status: 'measured', first: offset, last: offset };
      },
    });
  }
  const A = primitive(0), B = primitive(1);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40, alignItems: 'first-baseline' }, children: [
    createElement(A, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }),
    createElement(B, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(positions).toEqual([2, 0]);
    const before = snapshotWasmLayoutDiagnostics(), priorQueries = queries;
    label.set('other'); driver.flush(2);
    expect(queries).toBeGreaterThan(priorQueries);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    baseline.set(15); driver.flush(3); expect(positions).toEqual([0, 3]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

for (const described of [false, true]) it.runIf(nativeLayout)(`stops parent allocation when a ${described ? 'described' : 'known'} Flow descendant remeasures to an equal contribution`, () => {
  const content = signal('first');
  let measurements = 0;
  const Leaf = definePrimitive<{}, BoxStyle, BoxStyle, SystemStyle>(() => { content.get(); return null; }, {
    resolveStyle: () => ({}),
    measure: () => { content.get(); measurements++; return { status: 'measured', size: { width: 20, height: 10 } }; },
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const region = createElement(Flow, { style: { width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }, children: [
      createElement(Leaf, { style: { width: 20, height: 'auto' } }),
    ] });
  let descriptions = 0;
  const Description = defineLayoutComponent(() => { descriptions++; return region; });
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40, alignItems: 'flex-start' }, children: [described ? createElement(Description, {}) : region] }));
  try {
    driver.flush(1); const before = snapshotWasmLayoutDiagnostics(), priorMeasurements = measurements, priorDescriptions = descriptions;
    content.set('other'); driver.flush(2);
    expect(measurements).toBeGreaterThan(priorMeasurements);
    if (described) expect(descriptions).toBe(priorDescriptions + 1);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('stops equal responsive allocation while replacing the selected branch signal lease', () => {
  const first = signal(40), second = signal(40);
  const style = signal({ width: 20, height: 10, minWidth: 0, flexShrink: 0,
    fill: '#19375b', when: [{ query: { minWidth: 50 }, style: { width: first } }] });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 20 }, children: [createElement(Rectangle, { style })] }));
  try {
    driver.flush(1); const before = snapshotWasmLayoutDiagnostics();
    style.set({ width: 20, height: 10, minWidth: 0, flexShrink: 0,
      fill: '#19375b', when: [{ query: { minWidth: 50 }, style: { width: second } }] });
    driver.flush(2);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    first.set(60); expect(driver.pendingHostFrames).toBe(0);
    second.set(60); driver.flush(3);
    expect([...canvas.getContext('2d')!.getImageData(55, 5, 1, 1).data]).toEqual([25, 55, 91, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('reuses settled static containing allocations and updates absolute percentages when their owner changes', () => {
  const width = signal(200), fill = signal('#19375b');
  let boxWidth = 0;
  function Forward(props: { style: any }) { const box = useLayoutBox(); boxWidth = box.width; return createElement(Rectangle, { style: { width: box.width, height: box.height, fill: props.style.fill } }); }
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width, height: 40, alignItems: 'flex-start' }, children: [
    createElement(Flex, { style: { position: 'static', width: 80, height: 20, marginLeft: 30, minWidth: 0, flexShrink: 0 }, children: [
      createElement(Forward, { style: { position: 'absolute', left: '10%', right: '10%', height: 10, fill } }),
    ] }),
  ] }));
  try {
    driver.flush(1); expect(boxWidth).toBe(160); const before = snapshotWasmLayoutDiagnostics();
    fill.set('#426b61'); driver.flush(2);
    expect(boxWidth).toBe(160);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    expect([...canvas.getContext('2d')!.getImageData(25, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    width.set(220); driver.flush(3); expect(boxWidth).toBe(176);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
    expect(canvas.getContext('2d')!.getImageData(20, 5, 1, 1).data[3]).toBe(0);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('stops ancestor allocation after equal nested structural baseline output', () => {
  const label = signal('first'), baseline = signal(10);
  const positions = [0, 0];
  let queries = 0;
  function primitive(index: number) {
    return definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
      if (index === 0) label.get();
      positions[index] = useCanvasContext().getTransform().f;
      return null;
    }, {
      resolveStyle: () => ({}),
      measureBaselines: () => {
        queries++;
        if (index === 0) label.get();
        const offset = index === 0 ? baseline.get() : 12;
        return { status: 'measured', first: offset, last: offset };
      },
    });
  }
  const A = primitive(0), B = primitive(1);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40, alignItems: 'first-baseline' }, children: [
    createElement(Flex, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 }, children: [createElement(A, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } })] }),
    createElement(B, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(positions).toEqual([2, 0]);
    const before = snapshotWasmLayoutDiagnostics(), priorQueries = queries;
    label.set('other'); driver.flush(2);
    expect(queries).toBeGreaterThan(priorQueries);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    baseline.set(15); driver.flush(3); expect(positions).toEqual([0, 3]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('reuses equal staged intrinsic-main allocations and preserves native automatic-margin residuals', () => {
  const fill = signal('#19375b'), firstWidth = signal(40);
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 30; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 200, height: 20, alignItems: 'flex-start' }, children: [
    createElement(Flex, { style: { width: 'auto', height: 20, minWidth: 200, flexGrow: 0, flexShrink: 0, alignItems: 'flex-start' }, children: [
      createElement(Rectangle, { style: { width: firstWidth, flexBasis: firstWidth, height: 20, minWidth: '10%', flexGrow: 0, flexShrink: 0, marginLeft: 'auto', fill } }),
      createElement(Rectangle, { style: { width: 80, flexBasis: 80, height: 20, minWidth: 0, flexGrow: 0, flexShrink: 0, fill: '#426b61' } }),
    ] }),
  ] }));
  const pixel = (x: number) => [...canvas.getContext('2d')!.getImageData(x, 5, 1, 1).data];
  try {
    driver.flush(1); expect(pixel(79)[3]).toBe(0); expect(pixel(80)).toEqual([25, 55, 91, 255]);
    const before = snapshotWasmLayoutDiagnostics();
    fill.set('#a63758'); driver.flush(2);
    expect(pixel(80)).toEqual([166, 55, 88, 255]); expect(pixel(120)).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    firstWidth.set(60); driver.flush(3);
    expect(pixel(59)[3]).toBe(0); expect(pixel(60)).toEqual([166, 55, 88, 255]);
    expect(pixel(120)).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('compares responsive finite baseline demand before reallocating equal outputs', () => {
  const label = signal('first'), baseline = signal(10);
  const positions = [0, 0];
  let queries = 0;
  function primitive(index: number) {
    return definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
      if (index === 0) label.get();
      positions[index] = useCanvasContext().getTransform().f;
      return null;
    }, {
      resolveStyle: () => ({}),
      measureBaselines: () => {
        queries++;
        if (index === 0) label.get();
        const offset = index === 0 ? baseline.get() : 12;
        return { status: 'measured', first: offset, last: offset };
      },
    });
  }
  const A = primitive(0), B = primitive(1);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40, alignItems: 'first-baseline' }, children: [
    createElement(A, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0, when: [{ query: { minWidth: 50 }, style: { height: 20 } }] } }),
    createElement(B, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0, when: [{ query: { minWidth: 50 }, style: { height: 20 } }] } }),
  ] }));
  try {
    driver.flush(1); expect(positions).toEqual([2, 0]);
    const before = snapshotWasmLayoutDiagnostics(), priorQueries = queries;
    label.set('other'); driver.flush(2);
    expect(queries).toBeGreaterThan(priorQueries);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    baseline.set(15); driver.flush(3); expect(positions).toEqual([0, 3]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('stops static baseline preparation after equal output while preserving deferred absolute geometry', () => {
  const label = signal('first'), baseline = signal(10);
  const positions = [0, 0];
  let queries = 0;
  function primitive(index: number) {
    return definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
      if (index === 0) label.get();
      positions[index] = useCanvasContext().getTransform().f;
      return null;
    }, {
      resolveStyle: () => ({}),
      measureBaselines: () => {
        queries++;
        if (index === 0) label.get();
        const offset = index === 0 ? baseline.get() : 12;
        return { status: 'measured', first: offset, last: offset };
      },
    });
  }
  const A = primitive(0), B = primitive(1);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 40, alignItems: 'first-baseline' }, children: [
    createElement(Flex, { style: { position: 'static', width: 20, height: 20, minWidth: 0, flexShrink: 0 }, children: [createElement(A, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }), createElement(Rectangle, { style: { position: 'absolute', left: 70, top: 30, width: 10, height: 5, fill: '#426b61' } })] }),
    createElement(B, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(positions).toEqual([2, 0]);
    expect([...canvas.getContext('2d')!.getImageData(75, 32, 1, 1).data]).toEqual([66, 107, 97, 255]);
    const before = snapshotWasmLayoutDiagnostics(), priorQueries = queries;
    label.set('other'); driver.flush(2);
    expect(queries).toBeGreaterThan(priorQueries);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    baseline.set(15); driver.flush(3); expect(positions).toEqual([0, 3]);
    expect([...canvas.getContext('2d')!.getImageData(75, 32, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('compares demanded measurements with mutable class-model props before parent allocation', () => {
  class Model { width = 20; }
  const data = new Model(), revision = signal(0);
  let measurements = 0, width = 0;
  const Measured = definePrimitive<{ data: Model }, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
    revision.get(); width = useLayoutBox().width; return createElement(Rectangle, { style: { width, height: 10, fill: '#426b61' } });
  }, {
    resolveStyle: () => ({}),
    measureIntrinsic: ({ props }) => {
      revision.get(); measurements++;
      return { status: 'measured', minContent: { width: props.data.width, height: 10 }, maxContent: { width: props.data.width, height: 10 } };
    },
    measure: ({ props }) => ({ status: 'measured', size: { width: props.data.width, height: 10 } }),
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 20, alignItems: 'flex-start' }, children: [
    createElement(Measured, { data, style: { width: 'min-content', height: 10, minWidth: 0, flexShrink: 0 } }),
  ] }));
  try {
    driver.flush(1); expect(width).toBe(20);
    const before = snapshotWasmLayoutDiagnostics(), measuredBefore = measurements;
    revision.set(1); driver.flush(2);
    expect(measurements).toBeGreaterThan(measuredBefore);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    data.width = 30; revision.set(2); driver.flush(3); expect(width).toBe(30);
    expect([...canvas.getContext('2d')!.getImageData(25, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('retires removed deferred absolute phase dependencies while the static owner stays mounted', () => {
  const visible = signal(false);
  const Leaf = definePrimitive<{}, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => null, {
    resolveStyle: () => ({}), measureBaselines: () => ({ status: 'measured', first: 10, last: 10 }),
  });
  function Scene() {
    const extra = visible.get() ? [0, 1, 2, 3].map(index => createElement(Rectangle, {
      key: String(index), style: { position: 'absolute', left: index * 10, top: 30, width: 5, height: 5, fill: '#426b61' },
    })) : [];
    return createElement(Flex, { style: { width: 100, height: 40, alignItems: 'first-baseline' }, children: [
      createElement(Flex, { style: { position: 'static', width: 20, height: 20, minWidth: 0, flexShrink: 0 }, children: [
        createElement(Leaf, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0 } }), ...extra,
      ] }),
    ] });
  }
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Scene, {}));
  try {
    driver.flush(1); const before = snapshotAllocationDependencies();
    visible.set(true); driver.flush(2);
    expect(snapshotAllocationDependencies().dependencies).toBeGreaterThan(before.dependencies);
    expect(canvas.getContext('2d')!.getImageData(2, 32, 1, 1).data[3]).toBe(255);
    visible.set(false); driver.flush(3);
    expect(canvas.getContext('2d')!.getImageData(2, 32, 1, 1).data[3]).toBe(0);
    expect(snapshotAllocationDependencies()).toEqual(before);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('retains numeric allocation while replacing a supported CanvasGradient fill', () => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const context = canvas.getContext('2d')!;
  const first = context.createLinearGradient(0, 0, 20, 0), second = context.createLinearGradient(0, 0, 20, 0);
  first.addColorStop(0, '#19375b'); first.addColorStop(1, '#19375b');
  second.addColorStop(0, '#426b61'); second.addColorStop(1, '#426b61');
  const fill = signal(first);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 20 }, children: [
    createElement(Rectangle, { style: { width: 20, height: 10, minWidth: 0, flexShrink: 0, fill } }),
  ] }));
  try {
    driver.flush(1); const before = snapshotWasmLayoutDiagnostics();
    expect([...context.getImageData(5, 5, 1, 1).data]).toEqual([25, 55, 91, 255]);
    fill.set(second); driver.flush(2);
    expect([...context.getImageData(5, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('updates fixed Group presentation and hit geometry without numeric allocation', () => {
  const translateX = signal(0); let hits = 0;
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 20 }, children: [
    createElement(Group, { style: { width: 20, height: 10, minWidth: 0, translateX }, children: [
      createElement(Rectangle, { onClick: () => hits++, style: { width: 20, height: 10, fill: '#426b61' } }),
    ] }),
  ] }));
  const click = (x: number) => { const box = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: box.left + x, clientY: box.top + 5 })); };
  try {
    driver.flush(1); click(5); expect(hits).toBe(1); const before = snapshotWasmLayoutDiagnostics();
    translateX.set(30); driver.flush(2);
    expect(canvas.getContext('2d')!.getImageData(5, 5, 1, 1).data[3]).toBe(0);
    expect([...canvas.getContext('2d')!.getImageData(35, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    click(5); expect(hits).toBe(1); click(35); expect(hits).toBe(2);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('stops staged intrinsic allocation after equal current class-model contributions', () => {
  class Model { width = 20; }
  const data = new Model(), revision = signal(0);
  let measurements = 0, width = 0;
  const Measured = definePrimitive<{ data: Model }, BoxStyle & FlexItemStyle, BoxStyle & FlexItemStyle, SystemStyle>(() => {
    revision.get(); width = useLayoutBox().width; return createElement(Rectangle, { style: { width, height: 10, fill: '#426b61' } });
  }, {
    resolveStyle: () => ({}),
    measureIntrinsic: ({ props }) => {
      revision.get(); measurements++;
      return { status: 'measured', minContent: { width: props.data.width, height: 10 }, maxContent: { width: props.data.width, height: 10 } };
    },
    measure: ({ props }) => { revision.get(); measurements++; return { status: 'measured', size: { width: props.data.width, height: 10 } }; },
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 20, alignItems: 'flex-start' }, children: [
    createElement(Flex, { style: { width: 'auto', height: 10, minWidth: 100, flexGrow: 0, flexShrink: 0, alignItems: 'flex-start' }, children: [
      createElement(Measured, { data, style: { width: 'auto', height: 10, minWidth: '10%', flexBasis: 'auto', flexGrow: 0, flexShrink: 0 } }),
    ] }),
  ] }));
  try {
    driver.flush(1); expect(width).toBe(20);
    const before = snapshotWasmLayoutDiagnostics(), measuredBefore = measurements;
    revision.set(1); driver.flush(2);
    expect(measurements).toBeGreaterThan(measuredBefore);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBe(before.allocationPasses);
    expect(snapshotWasmLayoutDiagnostics().allocationItemVisits).toBe(before.allocationItemVisits);
    data.width = 30; revision.set(2); driver.flush(3); expect(width).toBe(30);
    expect([...canvas.getContext('2d')!.getImageData(25, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('reselects an authored responsive list mutated from empty during ordinary component evaluation', () => {
  const revision = signal(0), rules: { query: { minWidth: number }; style: { width: number } }[] = [];
  function Scene() {
    revision.get();
    return createElement(Flex, { style: { width: 100, height: 20 }, children: [
      createElement(Rectangle, { style: { width: 20, height: 10, minWidth: 0, flexShrink: 0, fill: '#426b61', when: rules } }),
    ] });
  }
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 20; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Scene, {}));
  try {
    driver.flush(1); expect(canvas.getContext('2d')!.getImageData(35, 5, 1, 1).data[3]).toBe(0);
    rules.push({ query: { minWidth: 50 }, style: { width: 40 } }); revision.set(1); driver.flush(2);
    expect([...canvas.getContext('2d')!.getImageData(35, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    rules[0].style.width = 60; revision.set(2); driver.flush(3);
    expect([...canvas.getContext('2d')!.getImageData(55, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
