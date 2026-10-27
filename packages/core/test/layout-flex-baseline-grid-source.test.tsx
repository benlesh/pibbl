import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Grid, Rectangle, FocusManagement, defineLayoutComponent, definePrimitive, signal,
  type GridItemStyle, type GridStyle, type PibblNodeInput, type SystemStyle, useCanvasContext, useConst, useLayoutBox,
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
interface Style extends SystemStyle, GridItemStyle {
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

it.runIf(experimentalLayout)(
  'uses the first declared Grid cell as the structural first-baseline source instead of visual row order',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), boxes = new Map<string, Box>(), hits: string[] = [], focused: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: First }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onFocus={() => focused.push(props.name)} onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        const value = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first: value, last: value };
      },
    });
    const VisualFirstMustNotMeasure = definePrimitive<{}, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox();
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => { throw new Error('Grid baseline policy must not query the later visual-row cell'); },
    });
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 180, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Grid key="grid" style={{ width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: 100, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40, 60], gridTemplateRows: [20, 40] }}>
        <Leaf key="A" name="A" first={first} style={{ ...fixed(40, 20, '#8a3248'), gridColumnStart: 2, gridRowStart: 2 }} />
        <VisualFirstMustNotMeasure key="D" style={{ ...fixed(40, 20, '#e7e5df'), gridColumnStart: 1, gridRowStart: 1 }} />
      </Grid>
      <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />
    </Flex></FocusManagement>);
    controllers.push(controller); await frame();
    // A is declared first but occupies row 2. Its physical row offset (20) plus
    // first baseline (12) selects Grid's source baseline; visual row 1 is ignored.
    expect(boxes.get('A')).toEqual({ x: 40, y: 20, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 100, y: 2, width: 40, height: 40, stamp: 2 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp }, mounted = snapshotWasmLayoutDiagnostics();
    click(canvas, 44, 24); click(canvas, 104, 6); expect(hits).toEqual(['A', 'B']);
    canvas.blur(); focused.length = 0; canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['A', 'B']);

    first.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 40, y: 20, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 100, y: 12, width: 40, height: 40, stamp: stamps.b });
    const beforeMoved = hits.length; click(canvas, 104, 6); click(canvas, 104, 16); expect(hits.length).toBe(beforeMoved + 1); expect(hits.at(-1)).toBe('B');
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);

it.runIf(experimentalLayout)(
  'uses the settled Grid content bottom when it has no declared source cell',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, Box>(); let serial = 0;
    const Peer = definePrimitive<{}, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set('peer', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 30, last: 30 }),
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Grid key="empty-grid" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40], gridTemplateRows: [40] }} children={null} />
      <Peer key="peer" style={fixed(40, 40, '#426b61')} />
    </Flex></FocusManagement>);
    controllers.push(controller); await frame();
    expect(boxes.get('peer')).toEqual({ x: 40, y: 10, width: 40, height: 40, stamp: 1 });
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);


it.runIf(experimentalLayout)(
  'uses the allocated content box of a spanning first declared cell through a described Grid root',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), boxes = new Map<string, Box>(), hits: string[] = [], allocations: { width: number; height: number }[] = [];
    let serial = 0;
    const SpanningSource = definePrimitive<{ readonly first: First }, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set('A', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onClick={() => hits.push('A')} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        allocations.push({ width: allocation.width, height: allocation.height });
        const value = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first: value, last: value };
      },
    });
    const LaterMustNotMeasure = definePrimitive<{}, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => <Rectangle style={{ width: style.width, height: style.height, fill: style.fill }} />, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => { throw new Error('Grid baseline policy must not query a later declared cell'); },
    });
    const Peer = definePrimitive<{}, Style, Style, Style & { readonly width: number; readonly height: number }>((_props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set('B', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onClick={() => hits.push('B')} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 30, last: 30 }),
    });
    const GridCard = defineLayoutComponent((props: { readonly style: GridStyle; readonly children: PibblNodeInput }) => <Grid style={props.style}>{props.children}</Grid>);
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 90; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 180, height: 90, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <GridCard key="grid" style={{ boxSizing: 'border-box', width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: 100, flexGrow: 0, flexShrink: 0, padding: { top: 3, bottom: 2 }, gridTemplateColumns: [40, 60], gridTemplateRows: [20, 35] }}>
        <SpanningSource key="A" first={first} style={{ minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#8a3248', gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 2 }} />
        <LaterMustNotMeasure key="D" style={{ minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#e7e5df', gridColumnStart: 2, gridRowStart: 2 }} />
      </GridCard>
      <Peer key="B" style={fixed(40, 40, '#426b61')} />
    </Flex>);
    controllers.push(controller); await frame();
    // The selected span receives Grid's settled 100×55 content allocation. Its
    // content-local first baseline 12 is lifted by the Grid's top padding once.
    expect(allocations).toEqual([{ width: 100, height: 55 }]);
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 100, height: 55, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 100, y: 0, width: 40, height: 40, stamp: 2 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp }, mounted = snapshotWasmLayoutDiagnostics();
    click(canvas, 4, 22); click(canvas, 104, 4); expect(hits).toEqual(['A', 'B']);

    first.set(22); await frame();
    expect(allocations).toEqual([{ width: 100, height: 55 }, { width: 100, height: 55 }]);
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 100, height: 55, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 100, y: 0, width: 40, height: 40, stamp: stamps.b });
    const before = hits.length; click(canvas, 4, 68); click(canvas, 4, 12); expect(hits.length).toBe(before + 1); expect(hits.at(-1)).toBe('A');
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);
