import { beforeAll, expect, it } from 'vitest';
import { createElement, definePrimitive, Absolute, Rectangle, Text, signal, Flex, measureElement, type BoxStyle, type FlexItemStyle, type FlexStyle, type CanvasMeasurementService, type SystemStyle, useLayoutBox, useCanvasContext } from '@pibbl/core';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded.js';
import { pibblSync } from '@pibbl/core/sync';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';
import { nativeLayout } from '../src/lib/layout/wasm/region.js';

beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
const service: CanvasMeasurementService = { measureText: () => ({ width: 0 }) as TextMetrics };
type LeafStyle = BoxStyle & FlexItemStyle;
const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, SystemStyle & { width: number; height: number }>(() => null, {
  resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
  measureIntrinsic: () => ({ status: 'measured', minContent: { width: 20, height: 10 }, maxContent: { width: 60, height: 10 } }),
  measure: ({ constraints }) => ({ status: 'measured', size: { width: constraints.maxWidth, height: 10 } }),
});
it.runIf(nativeLayout).each([
  { flexDirection: 'row', flexWrap: 'wrap', layoutDirection: 'ltr' },
  { flexDirection: 'row-reverse', flexWrap: 'wrap', layoutDirection: 'rtl' },
  { flexDirection: 'row', flexWrap: 'wrap-reverse', layoutDirection: 'rtl' },
] as const)('measures wrapped growing paired leaves at their finite owner width: %j', options => {
  const style: FlexStyle = { width: 100, height: 'auto', gap: 5, ...options };
  const element = createElement(Flex, { style, children: [
    createElement(Leaf, { style: { flexBasis: 60, flexGrow: 1, flexShrink: 0, minWidth: 0, height: 'auto' } }),
    createElement(Leaf, { style: { flexBasis: 60, flexGrow: 1, flexShrink: 0, minWidth: 0, height: 'auto' } }),
  ] });
  expect(measureElement(element, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 200 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 25 } });
});

it.runIf(nativeLayout)('excludes absolute and relative displacement from wrapped intrinsic height while retaining margins', () => {
  const element = createElement(Flex, { style: { width: 100, height: 'auto', flexWrap: 'wrap', gap: 5 }, children: [
    createElement(Leaf, { style: { flexBasis: 60, flexGrow: 1, flexShrink: 0, minWidth: 0, height: 'auto', marginTop: 3, marginBottom: 4, position: 'relative', top: 50 } }),
    createElement(Leaf, { style: { flexBasis: 60, flexGrow: 1, flexShrink: 0, minWidth: 0, height: 'auto', marginTop: 3, marginBottom: 4 } }),
    createElement(Leaf, { style: { position: 'absolute', width: 10, height: 100, left: 0, top: 0 } }),
  ] });
  expect(measureElement(element, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 200 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 39 } });
});

it.runIf(nativeLayout).each(['column', 'column-reverse'] as const)('uses the final stretched width for automatic measured minima in %s', flexDirection => {
  const boxes: { width: number; height: number; y: number }[] = [];
  const Leaf = definePrimitive<{}, LeafStyle, LeafStyle, SystemStyle & { width: number; height: number }>(() => {
    const box = useLayoutBox();
    boxes.push({ width: box.width, height: box.height, y: useCanvasContext().getTransform().f });
    return null;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 20, height: 50 }, maxContent: { width: 100, height: 10 } }),
    measure: ({ constraints }) => {
      expect(constraints.minWidth).toBe(80); expect(constraints.maxWidth).toBe(80);
      return { status: 'measured', size: { width: 80, height: 10 } };
    },
  });
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 100, flexDirection, gap: 5 }, children: [
    createElement(Leaf, { style: { width: 'auto', height: 'auto', marginLeft: 10, marginRight: 10 } }),
    createElement(Leaf, { style: { width: 'auto', height: 'auto', marginLeft: 10, marginRight: 10 } }),
  ] }));
  try {
    driver.flush(1);
    expect(boxes).toEqual(flexDirection === 'column' ? [{ width: 80, height: 10, y: 0 }, { width: 80, height: 10, y: 15 }] : [{ width: 80, height: 10, y: 90 }, { width: 80, height: 10, y: 75 }]);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('uses an aspect-sized Absolute root for paint and hit geometry', () => {
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100; document.body.append(canvas);
  const hits: number[] = [];
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Absolute, { style: { width: 120, height: 'auto', aspectRatio: 2 }, children:
    createElement(Rectangle, { style: { width: '100%', height: '100%', fill: '#426b61' }, onClick: () => hits.push(1) }),
  }));
  try {
    driver.flush(1);
    const context = canvas.getContext('2d')!;
    expect([...context.getImageData(5, 55, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect([...context.getImageData(5, 65, 1, 1).data]).toEqual([0, 0, 0, 0]);
    const bounds = canvas.getBoundingClientRect();
    for (const y of [55, 65]) for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + 5, clientY: bounds.top + y }));
    expect(hits).toEqual([1]);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('composes a min-content Flex around wrapping Text and moves its following target', () => {
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 80; document.body.append(canvas);
  const content = signal('aa bb'), hits: string[] = [];
  const context = canvas.getContext('2d')!; context.font = '10px monospace';
  const first = context.measureText('aa').width, second = context.measureText('aaaa').width;
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 180, height: 80, alignItems: 'flex-start' }, children: [
    createElement(Flex, { style: { width: 'min-content', minWidth: 0, flexShrink: 0, height: 'auto', alignItems: 'flex-start' }, children:
      createElement(Text, { style: { width: 'auto', height: 'auto', wrap: true, lineHeight: 10, font: '10px monospace', fill: '#19375b' }, children: content }),
    }),
    createElement(Rectangle, { style: { width: 20, height: 20, minWidth: 0, flexShrink: 0, fill: '#426b61' }, onClick: () => hits.push('tail') }),
  ] }));
  const click = (x: number) => { const bounds = canvas.getBoundingClientRect(); for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + 5 })); };
  try {
    driver.flush(1);
    click(first + 4); expect(hits).toEqual(['tail']);
    content.set('aaaa bbbb'); driver.flush(2);
    click(first + 4); expect(hits).toEqual(['tail']);
    click(second + 4); expect(hits).toEqual(['tail', 'tail']);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout).each([
  { flexDirection: 'row', flexWrap: 'wrap-reverse', layoutDirection: 'rtl' },
  { flexDirection: 'row-reverse', flexWrap: 'wrap', layoutDirection: 'ltr' },
  { flexDirection: 'row-reverse', flexWrap: 'wrap-reverse', layoutDirection: 'rtl' },
] as const)('measures automatic growing Text in each native row orientation: %j', options => {
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
  const service: CanvasMeasurementService = { measureText: (text, font) => { context.font = font; return context.measureText(text); } };
  const element = createElement(Flex, { style: { width: 100, height: 'auto', ...options }, children:
    createElement(Text, { style: { width: 'auto', height: 'auto', wrap: true, lineHeight: 10, font: '10px AppFont, monospace', flexGrow: 1 }, children: 'aa bb' }),
  });
  expect(measureElement(element, { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 }, service)).toEqual({ status: 'measured', size: { width: 100, height: 10 } });
});

it.runIf(nativeLayout).each(['row', 'column'] as const)('infers an automatic %s main dimension from its definite cross axis and aspect ratio', flexDirection => {
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
  let box: { width: number; height: number } | undefined;
  const Probe = definePrimitive<{}, LeafStyle, LeafStyle, SystemStyle & { width: number; height: number }>(() => { box = { ...useLayoutBox() }; return null; }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
  });
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, createElement(Flex, { style: { width: 100, height: 80, flexDirection, alignItems: 'flex-start' }, children:
    createElement(Probe, { style: { width: flexDirection === 'row' ? 'auto' : 20, height: flexDirection === 'row' ? 20 : 'auto', aspectRatio: 2, minWidth: 0, minHeight: 0, flexShrink: 0 } }),
  }));
  try { driver.flush(1); expect(box).toMatchObject(flexDirection === 'row' ? { width: 40, height: 20 } : { width: 20, height: 10 }); }
  finally { controller.dispose(); restore(); canvas.remove(); }
});

it.runIf(nativeLayout)('keeps clip overflow out of intrinsic Text sizing and its automatic minimum', () => {
  const overflow = signal<'visible' | 'clip'>('visible');
  const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 40; document.body.append(canvas);
  const context = canvas.getContext('2d')!; context.font = '10px monospace';
  const expected = context.measureText('XXXXXXXXXX').width;
  let followingX = 0, hits = 0;
  function Following({ style: _style }: { style: LeafStyle }) {
    followingX = useCanvasContext().getTransform().e;
    return <Rectangle onClick={() => hits++} style={{ width: 10, height: 10, fill: '#a63758' }} />;
  }
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  const controller = pibblSync(canvas, <Flex style={{ width: 40, height: 20, alignItems: 'flex-start' }}>
    <Text style={{ width: 'auto', height: 'auto', wrap: true, overflow, font: '10px monospace', lineHeight: 10, fill: '#19375b' }}>XXXXXXXXXX</Text>
    <Following style={{ width: 10, height: 10, minWidth: 0, flexShrink: 0 }} />
  </Flex>);
  try {
    driver.flush(1); expect(followingX).toBeCloseTo(expected);
    overflow.set('clip'); driver.flush(2); expect(followingX).toBeCloseTo(expected);
    const bounds = canvas.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + expected + 5, clientY: bounds.top + 5 }));
    expect(hits).toBe(1);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
