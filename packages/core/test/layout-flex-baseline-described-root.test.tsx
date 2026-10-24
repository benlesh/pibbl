import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type PibblResponsiveStyle, type SystemStyle,
  useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}

interface LeafStyle extends SystemStyle { width?: number; height?: number; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; fill?: string; }
interface LeafProps { readonly name: 'A' | 'B'; readonly first: number | ReturnType<typeof signal<number>>; }
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

it.runIf(experimentalLayout)(
  'propagates a transparent described primitive root into first-baseline membership and detaches its receiver inputs on removal',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), mounted = signal(true), paint = signal('#426b61');
    const boxes = new Map<string, Box>(); const hits: string[] = []; const errors: unknown[] = [];
    let serial = 0, descriptions = 0, baselineCalls = 0;
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Leaf = definePrimitive<LeafProps, LeafStyle, LeafStyle, LeafStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => { baselineCalls++; const value = typeof props.first === 'number' ? props.first : props.first.get(); return { status: 'measured' as const, first: value, last: value }; },
    });
    const Badge = defineLayoutComponent((props: { readonly first: ReturnType<typeof signal<number>>; readonly style: PibblResponsiveStyle<LeafStyle> }) => {
      descriptions++;
      return <Leaf key="root" name="A" first={props.first} style={props.style} />;
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const second = signal(30);
      const badge = <Badge key="badge" first={first} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#8a3248' }} />;
      const peer = <Leaf key="B" name="B" first={second} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />;
      const indicator = <Rectangle style={{ left: 90, top: 60, width: 5, height: 5, fill: paint }} />;
      const Scene = () => <><Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'first-baseline' }}>
        {mounted.get() ? badge : null}{peer}
      </Flex>{indicator}</>;
      const controller = pibbl(canvas, <Scene />);
      controllers.push(controller); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
      expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
      expect(descriptions).toBe(1); expect(baselineCalls).toBeGreaterThan(0);
      const initialBaselineCalls = baselineCalls;
      const mountedDiagnostics = snapshotWasmLayoutDiagnostics(), stamp = boxes.get('A')!.stamp;
      click(canvas, 4, 34); expect(hits).toEqual(['A']);

      first.set(22); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp });
      expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
      expect(baselineCalls).toBeGreaterThan(initialBaselineCalls);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mountedDiagnostics.nodeCreates);
      click(canvas, 4, 34); click(canvas, 4, 14); expect(hits).toEqual(['A', 'A']);

      await frame(); // Settle input/focus work before isolating the paint update.
      const beforePaint = snapshotWasmLayoutDiagnostics(), callsBeforePaint = baselineCalls;
      paint.set('#19375b'); await frame();
      expect(baselineCalls).toBe(callsBeforePaint);
      expect(snapshotWasmLayoutDiagnostics().solves).toBe(beforePaint.solves);
      mounted.set(false); await frame();
      const removed = snapshotWasmLayoutDiagnostics(), callsAfterRemoval = baselineCalls;
      expect(boxes.get('B')).toEqual({ x: 0, y: 0, width: 40, height: 40, stamp: 2 });
      first.set(12); await frame();
      expect(baselineCalls).toBe(callsAfterRemoval);
      expect(snapshotWasmLayoutDiagnostics().solves).toBe(removed.solves);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    } finally { window.removeEventListener('error', receive); }
  },
);

it.runIf(experimentalLayout)(
  'invalidates a described-root baseline cache when only its fresh scalar root props change',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const paint = signal('#426b61');
    let rootFirst = 12, serial = 0, baselineCalls = 0;
    const boxes = new Map<string, Box>(); const hits: string[] = [];
    const Leaf = definePrimitive<LeafProps, LeafStyle, LeafStyle, LeafStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        baselineCalls++;
        const first = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first, last: first };
      },
    });
    // `rootFirst` is deliberately plain closure state. `paint` is the only
    // reactive render trigger, so the wrapper props and allocation revision stay
    // stable while `Badge` materializes fresh root program props.
    const Badge = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<LeafStyle> }) =>
      <Leaf key="root" name="A" first={rootFirst} style={props.style} />,
    );
    const badge = <Badge key="badge" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#8a3248' }} />;
    const peer = <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />;
    const Scene = () => <><Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', layoutDirection: 'ltr', alignItems: 'first-baseline' }}>{badge}{peer}</Flex><Rectangle style={{ left: 90, top: 60, width: 5, height: 5, fill: paint }} /></>;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Scene />); controllers.push(controller); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    const callsBefore = baselineCalls, before = snapshotWasmLayoutDiagnostics();

    rootFirst = 22;
    paint.set('#19375b'); await frame();
    // The source wrapper is unchanged. The actual root's scalar snapshot must
    // reject its 12px cached baseline while native allocation stays reused.
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    expect(baselineCalls).toBeGreaterThan(callsBefore);
    const after = snapshotWasmLayoutDiagnostics();
    expect(after.solves).toBe(before.solves);
    expect(after.nodeCreates).toBe(before.nodeCreates);
    click(canvas, 4, 34); click(canvas, 4, 14); expect(hits).toEqual(['A']);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'measures a wrapped transparent described provider at its final width before first-baseline placement',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const natural = signal(20), paint = signal('#426b61');
    const boxes = new Map<string, Box>(); const hits: string[] = []; const queries: { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }[] = [];
    let serial = 0;
    interface WrappedStyle extends SystemStyle { width?: number; height?: number | 'auto'; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; fill?: string; }
    interface WrappedProps { readonly name: 'A' | 'B'; readonly natural?: number | typeof natural; readonly first: number; }
    const Leaf = definePrimitive<WrappedProps, WrappedStyle, WrappedStyle, WrappedStyle & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: ({ props, constraints }) => {
        if (props.name !== 'A') return { status: 'unsupported' as const, reason: 'fixed peer' };
        queries.push({ ...constraints });
        return { status: 'measured' as const, size: { width: constraints.maxWidth, height: typeof props.natural === 'number' ? props.natural : props.natural!.get() } };
      },
      measureBaselines: ({ props, allocation }) => {
        const first = props.name === 'A' ? allocation.height - 8 : props.first;
        return { status: 'measured' as const, first, last: first };
      },
    });
    const Badge = defineLayoutComponent((props: { readonly natural: typeof natural; readonly style: PibblResponsiveStyle<WrappedStyle> }) =>
      <Leaf key="root" name="A" natural={props.natural} first={0} style={props.style} />,
    );
    const badge = <Badge key="badge" natural={natural} style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#8a3248' }} />;
    const peer = <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />;
    const follower = <Rectangle key="C" onClick={() => hits.push('C')} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#19375b', cursor: 'pointer' }} />;
    const indicator = <Rectangle style={{ left: 94, top: 74, width: 4, height: 4, fill: paint }} />;
    const layout = <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'wrap', layoutDirection: 'ltr', alignItems: 'first-baseline', alignContent: 'flex-start' }}>{badge}{peer}{follower}</Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <>{layout}{indicator}</>); controllers.push(controller);
    await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    expect(queries).toContainEqual({ minWidth: 40, maxWidth: 40, minHeight: 0, maxHeight: 80 });
    const initial = snapshotWasmLayoutDiagnostics(), stamp = boxes.get('A')!.stamp;
    click(canvas, 4, 14); click(canvas, 4, 44); expect(hits).toEqual(['C']);

    natural.set(30); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 30, stamp });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    expect(queries).toContainEqual({ minWidth: 40, maxWidth: 40, minHeight: 0, maxHeight: 80 });
    click(canvas, 4, 14); expect(hits).toEqual(['C', 'A']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

    const beforePaint = snapshotWasmLayoutDiagnostics(); paint.set('#19375b'); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(beforePaint.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    natural.set(20); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);
