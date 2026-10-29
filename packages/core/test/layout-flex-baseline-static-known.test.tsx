import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type FlexStyle, type LayoutBox, type PibblNodeInput, type PibblResponsiveStyle, type SystemStyle, useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}
interface Style extends SystemStyle {
  readonly position?: 'static' | 'relative' | 'absolute';
  readonly left?: number;
  readonly top?: number;
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly flexBasis?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly fill?: string;
}
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
type First = number | { get(): number };
const fixed = (width: number, height: number, fill: string): Style & { readonly width: number; readonly height: number } => ({ width, height, minWidth: 0, minHeight: 0, flexBasis: width, flexGrow: 0, flexShrink: 0, fill });

it.runIf(nativeLayout)(
  'uses static known Flex content for the baseline while its absolute badge anchors to the non-static outer owner',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), relativeTop = signal(0), ink = signal('#ffffff'), boxes = new Map<string, Box>(), hits: string[] = [], allocations: LayoutBox[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: First }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        const value = typeof props.first === 'number' ? props.first : props.first.get();
        if (props.name === 'A') allocations.push({ ...allocation });
        return { status: 'measured' as const, first: value, last: value };
      },
    });
    const Badge = definePrimitive<{ readonly name: 'badge' }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    });
    const a = <Leaf key="A" name="A" first={first} style={{ ...fixed(40, 20, '#8a3248'), position: 'relative', top: relativeTop }} />;
    const badge = <Badge key="badge" name="badge" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, fill: '#d9a744' }} />;
    const inner = <Flex key="inner" style={{ ...fixed(40, 20, '#ffffff'), position: 'static', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>{a}{badge}</Flex>;
    const b = <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <><Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{inner}{b}</Flex><Rectangle pointerEvents="none" style={{ left: 90, top: 70, width: 8, height: 8, fill: ink }} /></>);
    controllers.push(controller); await frame();

    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 3 });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: 2 });
    expect(allocations.at(-1)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp, badge: boxes.get('badge')!.stamp };
    const mounted = snapshotWasmLayoutDiagnostics();
    ink.set('#112233'); await frame();
    const painted = snapshotWasmLayoutDiagnostics();
    // Stable direct roots retain their completed allocation on unrelated paint.
    expect(painted.solves).toBe(mounted.solves);
    expect([painted.nodeCreates, painted.activeNodes, painted.activeArenas, painted.activeWasmInstances]).toEqual([mounted.nodeCreates, mounted.activeNodes, mounted.activeArenas, mounted.activeWasmInstances]);
    expect(boxes.get('badge')).toMatchObject({ x: 0, y: 0, stamp: stamps.badge });
    click(canvas, 4, 4); click(canvas, 4, 34); expect(hits).toEqual(['badge', 'A']);

    first.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stamps.b });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: stamps.badge });
    click(canvas, 4, 34); click(canvas, 4, 14); expect(hits).toEqual(['badge', 'A', 'A']);

    relativeTop.set(10); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stamps.b });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: stamps.badge });
    click(canvas, 4, 14); click(canvas, 4, 24); expect(hits).toEqual(['badge', 'A', 'A', 'A']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); relativeTop.set(0); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);

it.runIf(nativeLayout).each([false, true])(
  'keeps a nested static badge anchored to the nearest non-static owner (absolute first: %s)',
  async absoluteFirst => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, Box>(), hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: number }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => ({ status: 'measured' as const, first: props.first, last: props.first }),
    });
    const Badge = definePrimitive<{ readonly name: 'badge' }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
    const leaf = <Leaf key="A" name="A" first={12} style={fixed(40, 20, '#8a3248')} />;
    const badge = <Badge key="badge" name="badge" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, fill: '#d9a744' }} />;
    const nested = <Flex key="outer-static" style={{ ...fixed(40, 20, '#ffffff'), position: 'static', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Flex key="inner-static" style={{ ...fixed(40, 20, '#ffffff'), position: 'static', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        {absoluteFirst ? badge : leaf}{absoluteFirst ? leaf : badge}
      </Flex>
    </Flex>;
    const b = <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{nested}{b}</Flex>);
    controllers.push(controller); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: absoluteFirst ? 2 : 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 3 });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: absoluteFirst ? 1 : 2 });
    click(canvas, 4, 4); click(canvas, 4, 24); expect(hits).toEqual(['badge', 'A']);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);


it.runIf(nativeLayout)(
  'finalizes a transparent static Flex root only after its outer first-baseline origin is known',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), boxes = new Map<string, Box>(), hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: number | typeof first }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        const value = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first: value, last: value };
      },
    });
    const Badge = definePrimitive<{}, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set('badge', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push('badge')} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
    const StaticCard = defineLayoutComponent((props: { readonly style: PibblResponsiveStyle<FlexStyle>; readonly children: PibblNodeInput }) =>
      <Flex style={props.style}>{props.children}</Flex>,
    );
    const badge = <Badge key="badge" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, fill: '#d9a744' }} />;
    const a = <Leaf key="A" name="A" first={first} style={fixed(40, 20, '#8a3248')} />;
    const inner = <StaticCard key="inner" style={{ ...fixed(40, 20, '#ffffff'), position: 'static', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>{badge}{a}</StaticCard>;
    const b = <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{inner}{b}</Flex>);
    controllers.push(controller); await frame();

    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 2 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 3 });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: 1 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp, badge: boxes.get('badge')!.stamp };
    click(canvas, 4, 4); click(canvas, 4, 24); expect(hits).toEqual(['badge', 'A']);

    first.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stamps.b });
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 8, height: 8, stamp: stamps.badge });
    click(canvas, 4, 34); click(canvas, 4, 14); expect(hits).toEqual(['badge', 'A', 'A']);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); await frame();
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);


it.runIf(nativeLayout)(
  'releases pending static structural plans when late absolute measurement fails and recovers on a fresh mount',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const errors: unknown[] = [], boxes = new Map<string, Box>();
    let failLateMeasurement = true, paints = 0, serial = 0, baselineCalls = 0;
    type AutoStyle = Omit<Style, 'width'> & { readonly width?: number | 'auto' };
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: number }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      paints++; boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => { baselineCalls++; return { status: 'measured' as const, first: props.first, last: props.first }; },
    });
    const LateBadge = definePrimitive<{}, AutoStyle, AutoStyle, AutoStyle & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); paints++;
      boxes.set('badge', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp: useConst(() => ++serial) });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({ status: 'measured' as const, minContent: { width: 0, height: 8 }, maxContent: { width: 8, height: 8 } }),
      measure: () => {
        if (failLateMeasurement) throw new Error('late static absolute measurement');
        return { status: 'measured' as const, size: { width: 8, height: 8 } };
      },
    });
    const Scene = () => <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Flex style={{ ...fixed(40, 20, '#ffffff'), position: 'static', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <LateBadge key="badge" style={{ position: 'absolute', left: 0, top: 0, width: 'auto', height: 8, minWidth: 0, minHeight: 0, fill: '#d9a744' }} />
        <Leaf key="A" name="A" first={12} style={fixed(40, 20, '#8a3248')} />
      </Flex>
      <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />
    </Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      const first = pibbl(canvas, <Scene />); controllers.push(first); await frame();
      expect(errors).toHaveLength(1); expect(String(errors[0])).toMatch(/late static absolute measurement/);
      expect(paints).toBe(0); expect(baselineCalls).toBeGreaterThan(0);
      first.dispose(); controllers.splice(controllers.indexOf(first), 1);
      let released = snapshotWasmLayoutDiagnostics();
      expect([released.activeNodes, released.activeArenas, released.cachedMeasurements, released.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);

      failLateMeasurement = false; errors.length = 0;
      const recovered = pibbl(canvas, <Scene />); controllers.push(recovered); await frame();
      expect(errors).toEqual([]);
      expect(boxes.get('badge')).toMatchObject({ x: 0, y: 0, width: 8, height: 8 });
      expect(boxes.get('A')).toMatchObject({ x: 0, y: 18, width: 40, height: 20 });
      expect(boxes.get('B')).toMatchObject({ x: 40, y: 0, width: 40, height: 40 });
      recovered.dispose(); controllers.splice(controllers.indexOf(recovered), 1);
      released = snapshotWasmLayoutDiagnostics();
      expect([released.activeNodes, released.activeArenas, released.cachedMeasurements, released.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    } finally { window.removeEventListener('error', receive); }
  },
);
