import { afterEach, beforeAll, expect, it } from 'vitest';
import { Flex, Rectangle, definePrimitive, signal, type BoxStyle, type FlexItemStyle, type PibblResponsiveStyle, type RectStyle, type SystemStyle, useCanvasContext, useConst, useLayoutBox } from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
type Box = { x: number; y: number; width: number; height: number; stamp: number };

it.runIf(nativeLayout)('resolves absolute percentage sizes and bounds once from the direct Flex padding box before provider measurement', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  type MeasuredStyle = BoxStyle & FlexItemStyle;
  type Resolved = SystemStyle & { width: number; height: number };
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row'), wrap = signal<'wrap' | 'wrap-reverse'>('wrap'), writing = signal<'ltr' | 'rtl'>('ltr'), ownerWidth = signal(204), ownerHeight = signal(104), mode = signal<'size' | 'bounds' | 'paired' | 'aspect' | 'provider'>('size'), ink = signal('#a63758');
  const boxes = new Map<string, Box>(); const queries: [number, number, number, number][] = []; let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'ABS' | 'C'; readonly style: Style }) {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set(name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: name === 'ABS' ? ink : '#19375b' }} />;
  }
  const Provider = definePrimitive<{}, MeasuredStyle, MeasuredStyle, Resolved>((_props, _style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set('ABS', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: ink }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 160, height: 20 } }),
    measure: ({ constraints }) => { queries.push([constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]); return { status: 'measured' as const, size: { width: 100, height: 20 } }; },
  });
  const flow: Style = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const next = mode.get();
    const absolute = next === 'size' ? <Probe key="absolute" name="ABS" style={{ position: 'absolute', width: '50%', height: '50%', left: '10%', top: '20%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      : next === 'bounds' ? <Probe key="absolute" name="ABS" style={{ position: 'absolute', width: '50%', height: '50%', left: 12, top: 8, minWidth: '60%', maxHeight: '25%', minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      : next === 'paired' ? <Probe key="absolute" name="ABS" style={{ position: 'absolute', width: 'auto', height: 'auto', left: '10%', right: '15%', top: '10%', bottom: '20%', minWidth: '60%', maxHeight: '25%', minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      : next === 'aspect' ? <Probe key="absolute" name="ABS" style={{ position: 'absolute', width: '40%', height: 'auto', aspectRatio: 2, right: '10%', bottom: '20%', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      : <Provider key="absolute" style={{ position: 'absolute', width: '50%', height: 'auto', left: '10%', top: '20%', minWidth: 0, flexGrow: 0, flexShrink: 0 }} />;
    return <Flex style={{ width: ownerWidth.get(), height: ownerHeight.get(), boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}><Probe key="A" name="A" style={flow} />{absolute}<Probe key="C" name="C" style={flow} /></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 264; canvas.height = 154; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  const expectAbs = (x: number, y: number, width: number, height: number) => expect(boxes.get('ABS')).toEqual({ x, y, width, height, stamp: mode.get() === 'provider' ? 4 : 2 });
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); mode.set('size'); await frame(); expectAbs(22, 22, 100, 50);
  }
  direction.set('column-reverse'); wrap.set('wrap-reverse'); writing.set('rtl'); mode.set('bounds'); await frame(); expectAbs(14, 10, 120, 25);
  ownerWidth.set(264); ownerHeight.set(154); await frame(); expectAbs(14, 10, 156, 37.5);
  ownerWidth.set(204); ownerHeight.set(104); mode.set('paired'); await frame(); expectAbs(22, 12, 150, 25);
  ownerWidth.set(264); ownerHeight.set(154); await frame(); expectAbs(28, 17, 195, 37.5);
  ownerWidth.set(204); ownerHeight.set(104); mode.set('aspect'); await frame(); expectAbs(102, 42, 80, 40);
  ownerWidth.set(264); ownerHeight.set(154); await frame(); expectAbs(132, 70, 104, 52);
  ownerWidth.set(204); ownerHeight.set(104); mode.set('provider'); await frame(); expectAbs(22, 22, 100, 20); expect(queries).toEqual([[100, 100, 0, Infinity]]);
  ownerWidth.set(264); ownerHeight.set(154); await frame(); expectAbs(28, 32, 130, 20); expect(queries).toEqual([[100, 100, 0, Infinity], [130, 130, 0, Infinity]]);
  const initial = snapshotWasmLayoutDiagnostics(); const beforePaint = snapshotWasmLayoutDiagnostics(); ink.set('#6e9d35'); await frame(); const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves); expect(painted.nodeCreates).toBe(initial.nodeCreates); expect([...boxes.values()].map(value => value.stamp)).toEqual([1, 4, 3]);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('forwards authored percentage sizes and bounds once through a direct function leaf', async () => {
  type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
  const baseline = snapshotWasmLayoutDiagnostics();
  const phase = signal<'object' | 'signals'>('object');
  const left = signal<'10%'>('10%'), width = signal<'50%'>('50%'), height = signal<'50%'>('50%'), minWidth = signal<'60%' | '30%'>('60%'), maxHeight = signal<'25%'>('25%');
  const ownerWidth = signal(204), ownerHeight = signal(104); const boxes = new Map<string, Box>(); let serial = 1;
  function Probe({ style: _style }: { readonly style: Style }) { const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => serial++); boxes.set('ABS', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp }); return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />; }
  function Forwarded({ style }: { readonly style: Style }) { return <Probe style={{ ...style }} />; }
  function Scene() {
    const signalOwned = phase.get() === 'signals';
    const absolute: Style = signalOwned ? { position: 'absolute', left, top: 8, width, height, minWidth, maxHeight, minHeight: 0, flexGrow: 0, flexShrink: 0 } : { position: 'absolute', left: 12, top: 8, width: '50%', height: '50%', minWidth: '60%', maxHeight: '25%', minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{ width: ownerWidth.get(), height: ownerHeight.get(), boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, alignItems: 'flex-start' }}><Forwarded key="absolute" style={absolute} /></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 264; canvas.height = 154; document.body.append(canvas); const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  expect(boxes.get('ABS')).toEqual({ x: 14, y: 10, width: 120, height: 25, stamp: 1 });
  phase.set('signals'); await frame(); expect(boxes.get('ABS')).toEqual({ x: 22, y: 10, width: 120, height: 25, stamp: 1 });
  minWidth.set('30%'); await frame(); expect(boxes.get('ABS')).toEqual({ x: 22, y: 10, width: 100, height: 25, stamp: 1 });
  ownerWidth.set(264); ownerHeight.set(154); await frame(); expect(boxes.get('ABS')).toEqual({ x: 28, y: 10, width: 130, height: 37.5, stamp: 1 });
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics(); expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
