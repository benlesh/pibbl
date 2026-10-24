import { afterEach, expect, it, vi } from 'vitest';
import {
  defineLayoutComponent, definePrimitive, Flex, Rectangle, Text, signal, measureElement,
  type FlexStyle, type PibblController, type PibblResponsiveStyle, type SystemStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
  }));
}

it.runIf(experimentalLayout)('measures an unwrapped row Text height before a top auto margin without changing its settled main slot', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const margin = signal<0 | 'auto'>(0), peerFill = signal('#426b61');
  const hits: string[] = [];
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
  const context = canvas.getContext('2d')!;
  const draws: Array<{ x: number; y: number }> = [], native = context.fillText;
  vi.spyOn(context, 'fillText').mockImplementation(function(this: CanvasRenderingContext2D, text, x, y, maximum) {
    if (text === 'alpha') { const transform = this.getTransform(); draws.push({ x: transform.e + x, y: transform.f + y }); }
    return maximum === undefined ? native.call(this, text, x, y) : native.call(this, text, x, y, maximum);
  });
  let peer: Readonly<{ x: number; y: number; stamp: number }> | undefined;
  let serial = 0;
  const Peer = definePrimitive<{ readonly fill: typeof peerFill }, FlexStyle, FlexStyle, SystemStyle & { readonly width: number; readonly height: number }>((props, style) => {
    const transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    peer = { x: transform.e, y: transform.f, stamp };
    return <Rectangle style={{ width: style.width, height: style.height, fill: props.fill }} />;
  }, { preserveSignalProps: ['fill'], resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
  const controller = pibblSync(canvas, <Flex style={{ width: 180, height: 100, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Text key="text" onClick={() => hits.push('text')} style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop: margin, wrap: false, font: '10px monospace', lineHeight: 10, fill: '#8a3248', cursor: 'pointer' }}>alpha</Text>
    <Peer key="peer" fill={peerFill} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
  </Flex>);
  controllers.push(controller); await frame();
  const zero = draws.at(-1)!;
  expect(zero).toEqual({ x: 0, y: 0 });
  expect(peer).toMatchObject({ x: 80, y: 0 });
  const mounted = snapshotWasmLayoutDiagnostics(), zeroPeer = peer!;

  const natural = measureElement(<Text style={{ width: 80, wrap: false, font: '10px monospace', lineHeight: 10 }}>alpha</Text>, { minWidth: 0, maxWidth: 80, minHeight: 0, maxHeight: 100 }, { measureText: (text, font) => { context.save(); context.font = font; const metrics = context.measureText(text); context.restore(); return metrics; } });
  expect(natural.status).toBe('measured');
  if (natural.status !== 'measured') throw Error('Text natural measurement unavailable');
  margin.set('auto'); await frame();
  const automatic = draws.at(-1)!;
  expect(automatic).toEqual({ x: 0, y: 100 - natural.size.height });
  expect(peer).toEqual(zeroPeer);
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
  click(canvas, 4, automatic.y + 4); await frame(); expect(hits).toEqual(['text']);

  const beforePaint = snapshotWasmLayoutDiagnostics();
  peerFill.set('#19375b'); await frame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(mounted.nodeCreates);
  expect(peer!.stamp).toBe(zeroPeer.stamp);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});

it.runIf(experimentalLayout)('measures a paired wrapped-row leaf before line-local top-auto placement and keeps final-width ownership stable', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const margin = signal<0 | 'auto'>(0), ownerWidth = signal(180), peerFill = signal('#426b61');
  const hits: string[] = [], queries: number[][] = [];
  let serial = 0, leaf: Readonly<{ x: number; y: number; width: number; height: number; stamp: number }> | undefined;
  type Resolved = SystemStyle & { readonly width: number; readonly height: number };
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    leaf = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
    return <Rectangle onClick={() => hits.push('leaf')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
  }, {
    resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 80, height: 20 }, maxContent: { width: 80, height: 20 } }),
    measure: ({ constraints }) => {
      queries.push([constraints.minWidth, constraints.maxWidth, constraints.minHeight, constraints.maxHeight]);
      return { status: 'measured' as const, size: { width: 80, height: 20 } };
    },
  });
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
  const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start' }}>
    <Leaf key="leaf" style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop: margin }} />
    <Rectangle key="peer" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
  </Flex>);
  controllers.push(controller); await frame();
  const zero = leaf!;
  expect(zero).toMatchObject({ x: 0, y: 0, width: 80, height: 20 });
  const mounted = snapshotWasmLayoutDiagnostics();

  queries.length = 0;
  margin.set('auto'); await frame();
  const automatic = leaf!;
  expect(queries).toContainEqual([80, 80, 0, 100]);
  expect(automatic).toMatchObject({ x: 0, y: 20, width: 80, height: 20, stamp: zero.stamp });
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
  click(canvas, 4, 24); await frame(); expect(hits).toEqual(['leaf']);

  ownerWidth.set(100); await frame();
  expect(leaf).toMatchObject({ x: 0, y: 0, width: 80, height: 20, stamp: zero.stamp });
  click(canvas, 4, 4); await frame(); expect(hits).toEqual(['leaf', 'leaf']);
  const beforePaint = snapshotWasmLayoutDiagnostics(), queryCount = queries.length;
  peerFill.set('#19375b'); await frame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(queries).toHaveLength(queryCount);
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});


it.runIf(experimentalLayout)('measures a known Flex root before line-local top-auto placement in a wrapped row', async () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const margin = signal<0 | 'auto'>(0), ownerWidth = signal(180), peerFill = signal('#426b61');
  const hits: string[] = [];
  let serial = 0, known: Readonly<{ x: number; y: number; width: number; height: number; stamp: number }> | undefined;
  type Resolved = SystemStyle & { readonly width: number; readonly height: number };
  const KnownLeaf = definePrimitive<{}, FlexStyle, FlexStyle, Resolved>((_props, style) => {
    const box = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    known = { x: transform.e, y: transform.f, width: box.width, height: box.height, stamp };
    return <Rectangle onClick={() => hits.push('known')} style={{ width: style.width, height: style.height, fill: '#8a3248', cursor: 'pointer' }} />;
  }, { resolveStyle: (_style, allocation) => ({ width: allocation.allocation.width, height: allocation.allocation.height }) });
  const Card = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle> }) => <Flex style={props.style}>
    <KnownLeaf key="known-leaf" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    <Rectangle key="tail" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#6e3e79' }} />
  </Flex>);
  const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 120; document.body.append(canvas);
  const controller = pibblSync(canvas, <Flex style={{ width: ownerWidth, height: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start' }}>
    <Card key="card" style={{ width: 80, height: 'auto', minWidth: 0, minHeight: 0, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'flex-start', flexBasis: 80, flexGrow: 0, flexShrink: 0, marginTop: margin }} />
    <Rectangle key="peer" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: peerFill }} />
  </Flex>);
  controllers.push(controller); await frame();
  const zero = known!;
  expect(zero).toMatchObject({ x: 0, y: 0, width: 40, height: 20 });
  const mounted = snapshotWasmLayoutDiagnostics();

  margin.set('auto'); await frame();
  expect(known).toMatchObject({ x: 0, y: 20, width: 40, height: 20, stamp: zero.stamp });
  expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
  click(canvas, 4, 4); await frame(); expect(hits).toEqual([]);
  click(canvas, 4, 24); await frame(); expect(hits).toEqual(['known']);

  ownerWidth.set(100); await frame();
  expect(known).toMatchObject({ x: 0, y: 0, width: 40, height: 20, stamp: zero.stamp });
  click(canvas, 4, 4); await frame(); expect(hits).toEqual(['known', 'known']);
  const beforePaint = snapshotWasmLayoutDiagnostics();
  peerFill.set('#19375b'); await frame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.solves).toBe(beforePaint.solves);
  expect(painted.nodeCreates).toBe(mounted.nodeCreates);
  controller.dispose();
  const disposed = snapshotWasmLayoutDiagnostics();
  expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});
