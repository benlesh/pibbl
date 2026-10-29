import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, definePrimitive, signal,
  type BoxStyle, type FlexItemStyle, type PibblResponsiveStyle, type RectStyle,
  type SystemStyle, useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

type Style = PibblResponsiveStyle<RectStyle & FlexItemStyle>;
type Box = { x: number; y: number; width: number; height: number; stamp: number };

it.runIf(nativeLayout)('maps direct absolute logical insets to the receiving Flex direction before physical placement and admitted sizing', async () => {
  type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
  type Mode = 'fixed' | 'paired' | 'aspect' | 'provider';
  type PrimitiveStyle = BoxStyle & FlexItemStyle;
  type Resolved = SystemStyle & { width: number; height: number };
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<Direction>('row'), wrap = signal<'wrap' | 'wrap-reverse'>('wrap'), writing = signal<'ltr' | 'rtl'>('ltr'), mode = signal<Mode>('fixed');
  const boxes = new Map<string, Box>(); const queries: [number, number, number, number][] = []; let serial = 1;
  function Probe({ name, style: _style }: { readonly name: 'A' | 'ABS' | 'C'; readonly style: Style }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: name === 'ABS' ? '#a63758' : '#246b61' }} />;
  }
  const Provider = definePrimitive<{}, PrimitiveStyle, PrimitiveStyle, Resolved>((_props, _style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++);
    boxes.set('ABS', { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 20 }, maxContent: { width: 100, height: 20 } }),
    measure: ({ constraints }) => { queries.push([constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]); return { status: 'measured' as const, size: { width: 100, height: 20 } }; },
  });
  const flow: Style = { width: 50, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
  function Scene() {
    const current = mode.get();
    const absolute: Style = current === 'fixed' ? { position: 'absolute', width: 50, height: 20, left: 30, right: 30, insetStart: 10, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : current === 'paired' ? { position: 'absolute', width: 'auto', height: 20, insetStart: '10%', insetEnd: '15%', top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : current === 'aspect' ? { position: 'absolute', width: 80, height: 'auto', aspectRatio: 2, insetEnd: '10%', bottom: 10, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }
      : { position: 'absolute', width: 'auto', height: 20, insetStart: '10%', top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    const leaf = current === 'provider' ? <Provider key="absolute" style={absolute as PrimitiveStyle} /> : <Probe key="absolute" name="ABS" style={absolute} />;
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, flexDirection: direction.get(), flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start', gap: 10 }}><Probe key="A" name="A" style={flow} />{leaf}<Probe key="C" name="C" style={flow} /></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  const expectAbs = (x: number, y: number, width: number, height: number, stamp = 2) => expect(boxes.get('ABS')).toEqual({ x, y, width, height, stamp });
  for (const axis of ['row', 'row-reverse', 'column', 'column-reverse'] as const) for (const wrapped of ['wrap', 'wrap-reverse'] as const) for (const rtl of ['ltr', 'rtl'] as const) {
    direction.set(axis); wrap.set(wrapped); writing.set(rtl); mode.set('fixed'); await frame();
    expectAbs(rtl === 'ltr' ? 12 : 142, 10, 50, 20);
  }
  direction.set('column-reverse'); wrap.set('wrap-reverse'); writing.set('ltr'); mode.set('paired'); await frame(); expectAbs(22, 10, 150, 20);
  writing.set('rtl'); await frame(); expectAbs(32, 10, 150, 20);
  mode.set('aspect'); writing.set('ltr'); await frame(); expectAbs(102, 52, 80, 40);
  writing.set('rtl'); await frame(); expectAbs(22, 52, 80, 40);
  mode.set('provider'); writing.set('ltr'); await frame(); expectAbs(22, 10, 100, 20, 4); expect(queries).toEqual([[0, Infinity, 20, 20]]);
  writing.set('rtl'); await frame(); expectAbs(82, 10, 100, 20, 4); expect(queries).toEqual([[0, Infinity, 20, 20], [0, Infinity, 20, 20]]);
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});

it.runIf(nativeLayout)('forwards logical absolute inset signals exactly once and keeps zero logical precedence over physical insets', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<'ltr' | 'rtl'>('ltr');
  const start = signal<'10%' | 0>('10%');
  const boxes = new Map<string, Box>(); let serial = 1;
  function Probe({ style: _style }: { readonly style: Style }) { const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => serial++); boxes.set('ABS', { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp }); return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />; }
  function Forwarded({ style }: { readonly style: Style }) { return <Probe style={{ ...style }} />; }
  function Scene() {
    const absolute: Style = { position: 'absolute', width: 50, height: 20, left: 30, right: 30, insetStart: start, top: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 };
    return <Flex style={{ width: 204, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, layoutDirection: direction.get(), alignItems: 'flex-start' }}><Forwarded key="absolute" style={absolute} /></Flex>;
  }
  const canvas = document.createElement('canvas'); canvas.width = 204; canvas.height = 104; document.body.append(canvas); const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  expect(boxes.get('ABS')).toEqual({ x: 22, y: 10, width: 50, height: 20, stamp: 1 });
  direction.set('rtl'); await frame(); expect(boxes.get('ABS')).toEqual({ x: 132, y: 10, width: 50, height: 20, stamp: 1 });
  start.set(0); await frame(); expect(boxes.get('ABS')).toEqual({ x: 152, y: 10, width: 50, height: 20, stamp: 1 });
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});


it.runIf(nativeLayout)('consumes a forwarded logical style signal once while its edge and owner direction change', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const direction = signal<'ltr' | 'rtl'>('ltr'), ownerWidth = signal(204);
  const authored = signal<Style>({ position: 'absolute', width: 50, height: 20, left: 30, right: 30, insetStart: 0, top: 8, minWidth: 0, minHeight: 0 });
  const boxes: Box[] = []; let serial = 0;
  function Probe({ style: _style }: { readonly style: typeof authored }) {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    boxes.push({ x: transform.e, y: transform.f, width: box.width, height: box.height, stamp });
    return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
  }
  function Forwarded({ style }: { readonly style: typeof authored }) { return <Probe style={style} />; }
  function Scene() { return <Flex style={{ width: ownerWidth, height: 104, boxSizing: 'border-box', borderWidth: 2, padding: { left: 10, right: 30, top: 20, bottom: 20 }, layoutDirection: direction }}><Forwarded key="absolute" style={authored} /></Flex>; }
  const canvas = document.createElement('canvas'); canvas.width = 264; canvas.height = 104; document.body.append(canvas);
  const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
  expect(boxes.at(-1)).toEqual({ x: 2, y: 10, width: 50, height: 20, stamp: 1 });
  authored.set({ position: 'absolute', width: 50, height: 20, insetEnd: '10%', top: 8, minWidth: 0, minHeight: 0 }); await frame();
  expect(boxes.at(-1)).toEqual({ x: 132, y: 10, width: 50, height: 20, stamp: 1 });
  direction.set('rtl'); await frame(); expect(boxes.at(-1)).toEqual({ x: 22, y: 10, width: 50, height: 20, stamp: 1 });
  ownerWidth.set(264); await frame(); expect(boxes.at(-1)).toEqual({ x: 28, y: 10, width: 50, height: 20, stamp: 1 });
  controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
  expect(disposed.activeNodes).toBe(baseline.activeNodes); expect(disposed.activeArenas).toBe(baseline.activeArenas); expect(disposed.cachedMeasurements).toBe(baseline.cachedMeasurements);
});
