import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, FocusManagement, Rectangle, Text, createElement, signal,
  type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, type TextStyle,
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

it.runIf(nativeLayout)('measures one direct unwrapped Text natural ink box when both absolute axes are automatic', async () => {
  type FlowStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type AbsoluteTextStyle = PibblResponsiveStyle<TextStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const words = signal('aaaa aaaa');
  const font = signal('10px monospace');
  const hits: string[] = [];
  const focused: string[] = [];
  const flow: FlowStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const textStyle: AbsoluteTextStyle = {
    position: 'absolute', width: 'auto', height: 'auto', right: 18, bottom: 10,
    minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
    wrap: false, fit: 'visible', overflow: 'visible', font, lineHeight: 10, fill: '#a63758', cursor: 'pointer',
  };
  const textNode = createElement(Text, { key: 'TEXT', keyboardFocusable: true, onFocus: () => focused.push('TEXT'), onClick: () => hits.push('TEXT'), style: textStyle, children: words });
  function Scene() {
    const children = [
      createElement(Rectangle, { key: 'A', keyboardFocusable: true, onFocus: () => focused.push('A'), style: { ...flow, fill: '#19375b', cursor: 'pointer' } }),
      textNode,
      createElement(Rectangle, { key: 'B', keyboardFocusable: true, onFocus: () => focused.push('B'), style: { ...flow, fill: '#246b61', cursor: 'pointer' } }),
    ];
    return <FocusManagement><Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>{children}</Flex></FocusManagement>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const context = canvas.getContext('2d')!;
  const originalFillText = context.fillText;
  const origins: { x: number; y: number }[] = [];
  context.fillText = function(text, x, y, maxWidth) {
    if (String(text).includes('aaaa')) { const transform = this.getTransform(); origins.push({ x: transform.e + x, y: transform.f + y }); }
    if (maxWidth === undefined) originalFillText.call(this, text, x, y);
    else originalFillText.call(this, text, x, y, maxWidth);
  };
  const metric = (value: string, selectedFont: string) => {
    context.font = selectedFont; context.textBaseline = 'top'; context.textAlign = 'left';
    const valueMetrics = context.measureText(value);
    const width = valueMetrics.actualBoundingBoxLeft + valueMetrics.actualBoundingBoxRight;
    const height = valueMetrics.actualBoundingBoxAscent + valueMetrics.actualBoundingBoxDescent;
    const origin = { x: 184 - width, y: 92 - height };
    const left = origin.x - valueMetrics.actualBoundingBoxLeft;
    const top = origin.y - valueMetrics.actualBoundingBoxAscent;
    return { origin, left, top, right: left + width, bottom: top + height };
  };
  const oldMetric = metric('aaaa aaaa', '10px monospace');
  const contentMetric = metric('aaaa aaaa aaaa', '10px monospace');
  const fontMetric = metric('aaaa aaaa aaaa', '16px monospace');
  expect(contentMetric.left).toBeLessThan(oldMetric.left);
  expect(fontMetric.left).toBeLessThan(contentMetric.left);
  try {
    const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
    expect(origins.at(-1)).toEqual(oldMetric.origin);
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['A', 'TEXT', 'B']);
    const contentBand = { x: Math.floor((oldMetric.left + contentMetric.left) / 2), y: Math.ceil(contentMetric.top + 1) };
    click(canvas, contentBand.x, contentBand.y);
    expect(hits).toEqual([]);
    const initial = snapshotWasmLayoutDiagnostics();
    origins.length = 0;
    words.set('aaaa aaaa aaaa'); await nextFrame();
    expect(origins.at(-1)).toEqual(contentMetric.origin);
    click(canvas, contentBand.x, contentBand.y);
    expect(hits).toEqual(['TEXT']);
    const afterContent = snapshotWasmLayoutDiagnostics();
    expect(afterContent.measuredLeaves).toBe(initial.measuredLeaves + 1);
    expect(afterContent.nodeCreates).toBe(initial.nodeCreates);
    // Font rasterizers can move the top edge by less than one pixel. Rounding a
    // point in that narrow vertical strip can move it outside the new ink box.
    // Use the much wider newly exposed horizontal strip and the ink's vertical
    // center, then check the actual MouseEvent coordinates before testing it.
    const fontBand = { x: Math.floor((fontMetric.left + contentMetric.left) / 2), y: Math.floor((fontMetric.top + fontMetric.bottom) / 2) };
    const canvasBounds = canvas.getBoundingClientRect();
    const fontProbe = new MouseEvent('click', { clientX: canvasBounds.left + fontBand.x, clientY: canvasBounds.top + fontBand.y });
    const dispatchedFontPoint = { x: fontProbe.clientX - canvasBounds.left, y: fontProbe.clientY - canvasBounds.top };
    expect(dispatchedFontPoint.x).toBeGreaterThan(fontMetric.left);
    expect(dispatchedFontPoint.x).toBeLessThan(fontMetric.right);
    expect(dispatchedFontPoint.y).toBeGreaterThan(fontMetric.top);
    expect(dispatchedFontPoint.y).toBeLessThan(fontMetric.bottom);
    expect(dispatchedFontPoint.x).toBeLessThan(contentMetric.left);
    click(canvas, fontBand.x, fontBand.y);
    expect(hits).toEqual(['TEXT']);
    origins.length = 0;
    font.set('16px monospace'); await nextFrame();
    expect(origins.at(-1)).toEqual(fontMetric.origin);
    click(canvas, fontBand.x, fontBand.y);
    expect(hits).toEqual(['TEXT', 'TEXT']);
    const afterFont = snapshotWasmLayoutDiagnostics();
    expect(afterFont.measuredLeaves).toBe(afterContent.measuredLeaves + 1);
    expect(afterFont.nodeCreates).toBe(afterContent.nodeCreates);
    controller.dispose();
    const afterDispose = snapshotWasmLayoutDiagnostics();
    expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
    expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
    expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
  } finally { context.fillText = originalFillText; }
});


it.runIf(nativeLayout)('caches stable direct Text natural boxes, then remeasures width, font, bounds and empty content through the same measured path', async () => {
  type FlowStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type AbsoluteTextStyle = PibblResponsiveStyle<TextStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const words = signal('aaaa aaaa');
  const width = signal<number | 'auto'>('auto');
  const font = signal('10px monospace');
  const minimum = signal<number | undefined>(undefined);
  const maximumHeight = signal<number | undefined>(undefined);
  const mounted = signal(true);
  const siblingInk = signal('#246b61');
  const flow: FlowStyle = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  const textStyle: AbsoluteTextStyle = {
    position: 'absolute', width, height: 'auto', right: 18, bottom: 10,
    minWidth: minimum, maxHeight: maximumHeight, minHeight: 0,
    flexGrow: 0, flexShrink: 0, wrap: false, fit: 'visible', overflow: 'visible', font, lineHeight: 10, fill: '#a63758',
  };
  const textNode = createElement(Text, { key: 'TEXT', style: textStyle, children: words });
  function Scene() {
    const children = mounted.get() ? [
      createElement(Rectangle, { key: 'A', style: { ...flow, fill: '#19375b' } }), textNode,
      createElement(Rectangle, { key: 'B', style: { ...flow, fill: siblingInk } }),
    ] : [
      createElement(Rectangle, { key: 'A', style: { ...flow, fill: '#19375b' } }),
      createElement(Rectangle, { key: 'B', style: { ...flow, fill: siblingInk } }),
    ];
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>{children}</Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const context = canvas.getContext('2d')!;
  const originalFillText = context.fillText;
  const origins: { x: number; y: number }[] = [];
  context.fillText = function(text, x, y, maxWidth) {
    if (String(text).includes('aaaa')) { const transform = this.getTransform(); origins.push({ x: transform.e + x, y: transform.f + y }); }
    if (maxWidth === undefined) originalFillText.call(this, text, x, y);
    else originalFillText.call(this, text, x, y, maxWidth);
  };
  const metric = (selectedFont: string) => {
    context.font = selectedFont; context.textBaseline = 'top'; context.textAlign = 'left';
    const measured = context.measureText('aaaa aaaa');
    return {
      width: measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight,
      height: measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent,
    };
  };
  const ink10 = metric('10px monospace');
  const ink16 = metric('16px monospace');
  const expectOrigin = (usedWidth: number, usedHeight: number) => ({ x: 184 - usedWidth, y: 92 - usedHeight });
  try {
    const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
    expect(origins.at(-1)).toEqual(expectOrigin(ink10.width, ink10.height));
    const initial = snapshotWasmLayoutDiagnostics();
    expect(initial.cachedMeasurements).toBeGreaterThan(baseline.cachedMeasurements);

    siblingInk.set('#6e9d35'); await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.measuredLeaves).toBe(initial.measuredLeaves);
    expect(afterPaint.solves).toBe(initial.solves);
    expect(afterPaint.nodeCreates).toBe(initial.nodeCreates);

    origins.length = 0; width.set(80); await nextFrame();
    expect(origins.at(-1)).toEqual(expectOrigin(80, ink10.height));
    const afterWidth = snapshotWasmLayoutDiagnostics();
    expect(afterWidth.measuredLeaves).toBe(afterPaint.measuredLeaves + 1);
    expect(afterWidth.nodeCreates).toBe(afterPaint.nodeCreates);

    origins.length = 0; font.set('16px monospace'); await nextFrame();
    expect(origins.at(-1)).toEqual(expectOrigin(80, ink16.height));
    const afterFont = snapshotWasmLayoutDiagnostics();
    expect(afterFont.measuredLeaves).toBe(afterWidth.measuredLeaves + 1);

    expect(ink16.width).toBeLessThan(100); expect(ink16.height).toBeGreaterThan(5);
    origins.length = 0; width.set('auto'); minimum.set(100); maximumHeight.set(5); await nextFrame();
    expect(origins.at(-1)).toEqual(expectOrigin(100, 5));
    const afterBounds = snapshotWasmLayoutDiagnostics();
    expect(afterBounds.measuredLeaves).toBe(afterFont.measuredLeaves + 1);

    words.set(''); await nextFrame();
    const afterEmpty = snapshotWasmLayoutDiagnostics();
    expect(afterEmpty.measuredLeaves).toBe(afterBounds.measuredLeaves + 1);
    mounted.set(false); await nextFrame();
    expect(snapshotWasmLayoutDiagnostics().cachedMeasurements).toBe(baseline.cachedMeasurements);
    words.set('aaaa aaaa aaaa'); width.set('auto'); font.set('10px monospace'); minimum.set(undefined); maximumHeight.set(undefined); await nextFrame();
    expect(snapshotWasmLayoutDiagnostics().measuredLeaves).toBe(afterEmpty.measuredLeaves);
    mounted.set(true); await nextFrame();
    const afterRestore = snapshotWasmLayoutDiagnostics();
    expect(afterRestore.measuredLeaves).toBe(afterEmpty.measuredLeaves + 1);
    expect(afterRestore.nodeCreates).toBe(afterFont.nodeCreates);
    controller.dispose();
    const afterDispose = snapshotWasmLayoutDiagnostics();
    expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
    expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
    expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
  } finally { context.fillText = originalFillText; }
});
