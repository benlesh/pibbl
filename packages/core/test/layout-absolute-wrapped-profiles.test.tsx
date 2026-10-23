import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, Text, createElement, definePrimitive, signal,
  type BoxStyle, type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, type SystemStyle,
  useCanvasContext, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

type ProviderStyle = BoxStyle & FlexItemStyle;
type ResolvedProviderStyle = SystemStyle & { readonly width: number; readonly height: number };

it.runIf(experimentalLayout)('keeps every admitted anchored absolute sizing profile out of a hard wrapped Flex line', async () => {
  type Mode = 'bounds' | 'paired' | 'aspect' | 'provider-width' | 'provider-height' | 'text-height' | 'text-width' | 'text-both';
  type ProbeStyle = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const mode = signal<Mode>('bounds');
  const flowBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const absoluteBoxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const providerQueries: Array<readonly [string, number, number, number, number]> = [];
  let textOrigins: { x: number; y: number }[] = [];
  function FlowProbe({ name, style: _style }: { readonly name: string; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    flowBoxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#19375b' }} />;
  }
  function AbsoluteProbe({ name, style: _style }: { readonly name: string; readonly style: ProbeStyle }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    absoluteBoxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }
  const ProviderWidth = definePrimitive<{}, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, _style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    absoluteBoxes.set('provider-width', { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 60, height: 20 } }),
    measure: ({ constraints }) => { providerQueries.push(['width', constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]); return { status: 'measured' as const, size: { width: 60, height: 20 } }; },
  });
  const ProviderHeight = definePrimitive<{}, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, _style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform();
    absoluteBoxes.set('provider-height', { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 80, height: 20 } }),
    measure: ({ constraints }) => { providerQueries.push(['height', constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]); return { status: 'measured' as const, size: { width: 80, height: 20 } }; },
  });
  const flow: ProbeStyle = { width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const current = mode.get();
    let absolute: ReturnType<typeof createElement>;
    if (current === 'bounds') absolute = <AbsoluteProbe key="absolute" name="bounds" style={{ position: 'absolute', left: 12, top: 8, width: 30, height: 20, minWidth: 60, maxHeight: 10, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    else if (current === 'paired') absolute = <AbsoluteProbe key="absolute" name="paired" style={{ position: 'absolute', left: 12, right: 18, top: 8, bottom: 10, width: 'auto', height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    else if (current === 'aspect') absolute = <AbsoluteProbe key="absolute" name="aspect" style={{ position: 'absolute', left: 12, top: 8, width: 80, height: 'auto', aspectRatio: 2, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    else if (current === 'provider-width') absolute = <ProviderWidth key="absolute" style={{ position: 'absolute', right: 18, top: 8, width: 'auto', height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    else if (current === 'provider-height') absolute = <ProviderHeight key="absolute" style={{ position: 'absolute', left: 12, bottom: 10, width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    else if (current === 'text-height') absolute = <Text key="absolute" style={{ position: 'absolute', left: 12, bottom: 10, width: 40, height: 'auto', wrap: true, overflow: 'visible', fit: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#a63758' }}>aaaa aaaa aaaa</Text>;
    else if (current === 'text-width') absolute = <Text key="absolute" style={{ position: 'absolute', right: 18, top: 8, width: 'auto', height: 20, wrap: false, overflow: 'visible', fit: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#a63758' }}>aaaa aaaa</Text>;
    else absolute = <Text key="absolute" style={{ position: 'absolute', right: 18, bottom: 10, width: 'auto', height: 'auto', wrap: false, overflow: 'visible', fit: 'visible', font: '10px monospace', lineHeight: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#a63758' }}>aaaa aaaa</Text>;
    return <Flex style={{ width: 164, height: 84, boxSizing: 'border-box', borderWidth: 2, padding: 10, flexDirection: 'column-reverse', flexWrap: 'wrap-reverse', layoutDirection: 'rtl', alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}>
      <FlowProbe key="A" name="A" style={flow} />{absolute}<FlowProbe key="C" name="C" style={flow} /><FlowProbe key="D" name="D" style={flow} />
    </Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 164; canvas.height = 84; document.body.append(canvas);
  const context = canvas.getContext('2d')!, originalFillText = context.fillText;
  context.fillText = function(text, x, y, maxWidth) { if (String(text).includes('aaaa')) { const transform = this.getTransform(); textOrigins.push({ x: transform.e + x, y: transform.f + y }); } if (maxWidth === undefined) originalFillText.call(this, text, x, y); else originalFillText.call(this, text, x, y, maxWidth); };
  const textMetric = (value: string) => { context.font = '10px monospace'; context.textBaseline = 'top'; context.textAlign = 'left'; const metrics = context.measureText(value); return { width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent, left: metrics.actualBoundingBoxLeft, ascent: metrics.actualBoundingBoxAscent }; };
  const widthMetric = textMetric('aaaa aaaa'), bothMetric = textMetric('aaaa aaaa');
  try {
    const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
    const baselineFlow = [...flowBoxes.entries()].sort();
    const cases: readonly [Mode, Readonly<{ x: number; y: number; width: number; height: number }> | undefined][] = [
      ['bounds', { x: 14, y: 10, width: 60, height: 10 }], ['paired', { x: 14, y: 10, width: 130, height: 62 }], ['aspect', { x: 14, y: 10, width: 80, height: 40 }], ['provider-width', { x: 84, y: 10, width: 60, height: 20 }], ['provider-height', { x: 14, y: 52, width: 80, height: 20 }], ['text-height', undefined], ['text-width', undefined], ['text-both', undefined],
    ];
    for (const [next, expected] of cases) {
      textOrigins = []; mode.set(next); await nextFrame();
      expect([...flowBoxes.entries()].sort(), next).toEqual(baselineFlow);
      if (expected) expect(absoluteBoxes.get(next)).toEqual(expected);
      if (next === 'text-height') expect(textOrigins).toEqual([{ x: 14, y: 42 }, { x: 14, y: 52 }, { x: 14, y: 62 }]);
      if (next === 'text-width') expect(textOrigins.at(-1)).toEqual({ x: 144 - widthMetric.width, y: 10 });
      if (next === 'text-both') expect(textOrigins.at(-1)).toEqual({ x: 144 - bothMetric.width, y: 72 - bothMetric.height });
    }
    expect(providerQueries).toContainEqual(['width', 0, Infinity, 20, 20]);
    expect(providerQueries).toContainEqual(['height', 80, 80, 0, Infinity]);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes);
    expect(disposed.activeArenas).toBe(baseline.activeArenas);
    expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
  } finally { context.fillText = originalFillText; }
});
