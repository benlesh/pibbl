import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, FocusManagement, Rectangle, Text, createElement, signal,
  type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, type TextStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

it.runIf(nativeLayout)('measures direct wrapped Text absolute height in every finite nowrap direction without joining flow', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type FlowStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type AbsoluteTextStyle = PibblResponsiveStyle<TextStyle & FlexItemStyle>;
    const baseline = snapshotWasmLayoutDiagnostics();
    const direction = signal<Direction>('row');
    const writing = signal<'ltr' | 'rtl'>('ltr');
    const words = signal('aaaa aaaa');
    const ink = signal('#246b61');
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    const hits: string[] = [];
    const focused: string[] = [];
    let serial = 1;
    function FlowProbe({ name, style: _style }: { readonly name: string; readonly style: FlowStyle }) {
      const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
      boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onFocus={() => focused.push(name)} onClick={() => hits.push(name)} style={{ width: box.width, height: box.height, fill: name === 'A' ? '#19375b' : ink, cursor: 'pointer' }} />;
    }
    const flow: FlowStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const textStyle: AbsoluteTextStyle = { position: 'absolute', width: 40, height: 'auto', left: 12, bottom: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, fill: '#a63758', cursor: 'pointer' };
    function Scene() {
      const children = useConst(() => [
        createElement(FlowProbe, { key: 'A', name: 'A', style: flow }),
        createElement(Text, { key: 'TEXT', keyboardFocusable: true, onFocus: () => focused.push('TEXT'), onClick: () => hits.push('TEXT'), style: textStyle, children: words }),
        createElement(FlowProbe, { key: 'B', name: 'B', style: flow }),
      ]);
      return <FocusManagement><Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: direction.get(), flexWrap: 'nowrap', layoutDirection: writing.get(), alignItems: 'flex-start', gap: 10 }}>{children}</Flex></FocusManagement>;
    }
    const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
    const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
    const expected = {
      row: { ltr: [[12, 22], [72, 22]], rtl: [[122, 22], [62, 22]] },
      'row-reverse': { ltr: [[122, 22], [62, 22]], rtl: [[12, 22], [72, 22]] },
      column: { ltr: [[12, 22], [12, 52]], rtl: [[122, 22], [122, 52]] },
      'column-reverse': { ltr: [[12, 62], [12, 32]], rtl: [[122, 62], [122, 32]] },
    } as const;
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['A', 'TEXT', 'B']);
    for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
      direction.set(axis); writing.set(rtl); await nextFrame();
      const [a, b] = expected[axis][rtl];
      expect(boxes.get('A')).toMatchObject({ x: a[0], y: a[1], width: 50, height: 20, stamp: 1 });
      expect(boxes.get('B')).toMatchObject({ x: b[0], y: b[1], width: 50, height: 20, stamp: 2 });
      click(canvas, 18, 68);
      expect(hits).not.toContain('TEXT');
    }
    direction.set('row'); writing.set('ltr'); await nextFrame();
    click(canvas, 18, 78); click(canvas, 80, 25);
    expect(hits.slice(-2)).toEqual(['TEXT', 'B']);
    const initial = snapshotWasmLayoutDiagnostics();
    words.set('aaaa aaaa aaaa'); await nextFrame();
    click(canvas, 18, 68);
    expect(hits.at(-1)).toBe('TEXT');
    const measured = snapshotWasmLayoutDiagnostics();
    expect(measured.nodeCreates).toBe(initial.nodeCreates);
    expect(measured.measuredLeaves).toBe(initial.measuredLeaves + 1);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    ink.set('#6e9d35'); await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.solves).toBe(beforePaint.solves);
    // Handler functions keep this interactive descriptor on the conservative measurement path.
    expect(afterPaint.measuredLeaves).toBe(beforePaint.measuredLeaves + 1);
    expect(afterPaint.nodeCreates).toBe(beforePaint.nodeCreates);
    controller.dispose();
    const afterDispose = snapshotWasmLayoutDiagnostics();
    expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
    expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
    expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('reuses a stable plain absolute Text measurement until its width or content changes, then releases it on removal', async () => {
  type FlowStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type AbsoluteTextStyle = PibblResponsiveStyle<TextStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const width = signal(40);
  const words = signal('aaaa aaaa aaaa');
  const mounted = signal(true);
  const font = signal('10px monospace');
  const lineHeight = signal(10);
  const siblingInk = signal('#246b61');
  const flow: FlowStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const textStyle: AbsoluteTextStyle = { position: 'absolute', width, height: 'auto', left: 12, bottom: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, wrap: true, overflow: 'visible', font, lineHeight, fill: '#a63758' };
  const textNode = createElement(Text, { key: 'TEXT', style: textStyle, children: words });
  function Scene() {
    const children = mounted.get() ? [
      createElement(Rectangle, { key: 'A', style: { ...flow, fill: '#19375b' } }),
      textNode,
      createElement(Rectangle, { key: 'B', style: { ...flow, fill: siblingInk } }),
    ] : [
      createElement(Rectangle, { key: 'A', style: { ...flow, fill: '#19375b' } }),
      createElement(Rectangle, { key: 'B', style: { ...flow, fill: siblingInk } }),
    ];
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>{children}</Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
  const initial = snapshotWasmLayoutDiagnostics();
  expect(initial.cachedMeasurements).toBeGreaterThan(baseline.cachedMeasurements);
  siblingInk.set('#6e9d35'); await nextFrame();
  const afterPaint = snapshotWasmLayoutDiagnostics();
  expect(afterPaint.measuredLeaves).toBe(initial.measuredLeaves);
  expect(afterPaint.solves).toBe(initial.solves);
  expect(afterPaint.nodeCreates).toBe(initial.nodeCreates);
  width.set(80); await nextFrame();
  const afterWidth = snapshotWasmLayoutDiagnostics();
  expect(afterWidth.measuredLeaves).toBe(afterPaint.measuredLeaves + 1);
  expect(afterWidth.nodeCreates).toBe(afterPaint.nodeCreates);
  words.set('aaaa aaaa aaaa aaaa'); await nextFrame();
  const afterContent = snapshotWasmLayoutDiagnostics();
  expect(afterContent.measuredLeaves).toBe(afterWidth.measuredLeaves + 1);
  expect(afterContent.nodeCreates).toBe(afterWidth.nodeCreates);
  font.set('12px monospace'); lineHeight.set(15); await nextFrame();
  const afterMetrics = snapshotWasmLayoutDiagnostics();
  expect(afterMetrics.measuredLeaves).toBe(afterContent.measuredLeaves + 1);
  expect(afterMetrics.nodeCreates).toBe(afterContent.nodeCreates);
  mounted.set(false); await nextFrame();
  const afterRemove = snapshotWasmLayoutDiagnostics();
  expect(afterRemove.cachedMeasurements).toBe(baseline.cachedMeasurements);
  words.set('aaaa aaaa aaaa aaaa aaaa aaaa'); width.set(40); await nextFrame();
  expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(afterMetrics.measuredLeaves);
  mounted.set(true); await nextFrame();
  const afterRestore = snapshotWasmLayoutDiagnostics();
  expect(afterRestore.measuredLeaves).toBe(afterMetrics.measuredLeaves + 1);
  expect(afterRestore.nodeCreates).toBe(afterContent.nodeCreates);
  controller.dispose();
  const afterDispose = snapshotWasmLayoutDiagnostics();
  expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
  expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
  expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('keeps paired insets and aspect sizing ahead of bounded direct Text measurement', async () => {
  type AbsoluteTextStyle = PibblResponsiveStyle<TextStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const originalFillText = CanvasRenderingContext2D.prototype.fillText;
  const origins: { x: number; y: number }[] = [];
  CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...rest) {
    if (String(text).includes('aaaa')) { const transform = this.getTransform(); origins.push({ x: transform.e, y: transform.f }); }
    return originalFillText.call(this, text, x, y, ...rest);
  };
  try {
    const cases: readonly {
      readonly name: string;
      readonly style: AbsoluteTextStyle;
      readonly expected: { x: number; y: number; width: number; height: number };
      readonly measures: boolean;
    }[] = [
      { name: 'paired insets', style: { position: 'absolute', width: 40, height: 'auto', left: 12, top: 8, bottom: 10, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, cursor: 'pointer' }, expected: { x: 14, y: 10, width: 40, height: 82 }, measures: false },
      { name: 'aspect', style: { position: 'absolute', width: 80, height: 'auto', left: 12, bottom: 10, aspectRatio: 2, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, cursor: 'pointer' }, expected: { x: 14, y: 52, width: 80, height: 40 }, measures: false },
      { name: 'paired insets win over aspect', style: { position: 'absolute', width: 80, height: 'auto', left: 12, top: 8, bottom: 10, aspectRatio: 2, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, cursor: 'pointer' }, expected: { x: 14, y: 10, width: 80, height: 82 }, measures: false },
      { name: 'maximum after measurement', style: { position: 'absolute', width: 40, height: 'auto', left: 12, bottom: 10, maxHeight: 10, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, cursor: 'pointer' }, expected: { x: 14, y: 82, width: 40, height: 10 }, measures: true },
      { name: 'minimum after measurement', style: { position: 'absolute', width: 40, height: 'auto', left: 12, bottom: 10, minHeight: 40, wrap: true, overflow: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, flexGrow: 0, flexShrink: 0, cursor: 'pointer' }, expected: { x: 14, y: 52, width: 40, height: 40 }, measures: true },
    ];
    for (const fixture of cases) {
      origins.length = 0;
      const hits: string[] = [];
      const before = snapshotWasmLayoutDiagnostics();
      const controller = pibbl(canvas, <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Text onClick={() => hits.push(fixture.name)} style={{ ...fixture.style, fill: '#a63758' }}>aaaa aaaa aaaa</Text>
      </Flex>); controllers.push(controller); await nextFrame();
      const after = snapshotWasmLayoutDiagnostics();
      expect(after.measuredLeaves - before.measuredLeaves, fixture.name).toBe(fixture.measures ? 1 : 0);
      expect(origins[0], fixture.name).toEqual({ x: fixture.expected.x, y: fixture.expected.y });
      click(canvas, fixture.expected.x + 4, fixture.expected.y + 6);
      expect(hits, fixture.name).toEqual([fixture.name]);
      controller.dispose(); controllers.splice(controllers.indexOf(controller), 1);
    }
  } finally { CanvasRenderingContext2D.prototype.fillText = originalFillText; }
  const afterDispose = snapshotWasmLayoutDiagnostics();
  expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
  expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
  expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
