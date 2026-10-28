import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Flow, Grid, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type FlexStyle, type GridItemStyle, type LayoutBox,
  type PibblNodeInput, type PibblResponsiveStyle, type SystemStyle, useCanvasContext, useConst, useLayoutBox,
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
  readonly width?: number; readonly height?: number; readonly minWidth?: number; readonly minHeight?: number;
  readonly flexBasis?: number; readonly flexGrow?: number; readonly flexShrink?: number; readonly fill?: string;
  readonly position?: 'absolute' | 'static' | 'relative'; readonly left?: number; readonly top?: number;
}
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
type Last = number | { get(): number };
const fixed = (width: number, height: number, fill: string): Style => ({ width, height, minWidth: 0, minHeight: 0, flexBasis: width, flexGrow: 0, flexShrink: 0, fill });

it.runIf(experimentalLayout)(
  'uses the last declared in-flow primitive of a described known Flex root, skipping an absolute decoration and retaining receiver-owned last dependencies',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const last = signal(12), relative = signal(0), boxes = new Map<string, Box>(), hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly last: Last }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        const value = typeof props.last === 'number' ? props.last : props.last.get();
        return { status: 'measured' as const, first: 0, last: value };
      },
    });
    const Card = defineLayoutComponent<{ readonly style: PibblResponsiveStyle<FlexStyle>; readonly children: PibblNodeInput }>(props => <Flex style={props.style}>{props.children}</Flex>);
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
      <Card key="card" style={{ position: 'static', padding: { top: 3, bottom: 2 }, width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Flex key="source" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, alignItems: 'flex-start' }}>
          <Leaf key="A" name="A" last={last} style={{ ...fixed(40, 20, '#8a3248'), position: 'relative', top: relative }} />
        </Flex>
        <Rectangle key="badge" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, fill: '#ffffff' }} />
      </Card>
      <Leaf key="B" name="B" last={30} style={fixed(40, 40, '#426b61')} />
    </Flex>);
    controllers.push(controller); await frame();
    // Safe-end last grouping: common last baseline 70, Card source last 12.
    expect(boxes.get('A')).toEqual({ x: 0, y: 58, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 40, width: 40, height: 40, stamp: 2 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp }, mounted = snapshotWasmLayoutDiagnostics();
    click(canvas, 4, 64); expect(hits).toEqual(['A']);
    last.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 48, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 40, width: 40, height: 40, stamp: stamps.b });
    click(canvas, 4, 74); click(canvas, 4, 54); expect(hits).toEqual(['A', 'A']);
    relative.set(10); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 58, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')!.y).toBe(40);
    const beforeRelativeHits = hits.length; click(canvas,4,54); click(canvas,4,64); expect(hits.length).toBe(beforeRelativeHits+1);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    last.set(12); await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);

it.runIf(experimentalLayout)(
  'takes a Flow last source and a Grid last declared cell rather than their visual first records',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const flowLast = signal(12), gridLast = signal(10);
    const boxes = new Map<string, Box>(); let serial = 0;
    const Leaf = definePrimitive<{ readonly name: string; readonly last: Last; readonly reject?: boolean }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        if (props.reject) throw new Error(`${props.name} must not be selected as last source`);
        const value = typeof props.last === 'number' ? props.last : props.last.get();
        return { status: 'measured' as const, first: 0, last: value };
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 160; document.body.append(canvas);
    const controller = pibbl(canvas, <>
      <Flex style={{ width: 100, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
        <Flow key="flow" style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, direction: 'horizontal', wrap: false, alignItems: 'start' }}>
          <Leaf key="flow-first" name="flow-first" last={0} reject style={fixed(40, 20, '#e7e5df')} />
          <Leaf key="flow-last" name="flow-last" last={flowLast} style={fixed(40, 20, '#8a3248')} />
        </Flow>
        <Leaf key="flow-peer" name="flow-peer" last={30} style={fixed(40, 40, '#426b61')} />
      </Flex>
      <Flex style={{ top: 80, width: 140, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
        <Grid key="grid" style={{ width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: 100, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40, 60], gridTemplateRows: [20, 40] }}>
          <Leaf key="grid-first" name="grid-first" last={0} reject style={{ ...fixed(40, 20, '#e7e5df'), gridColumnStart: 2, gridRowStart: 2 }} />
          <Leaf key="grid-last" name="grid-last" last={gridLast} style={{ ...fixed(40, 20, '#8a3248'), gridColumnStart: 1, gridRowStart: 1 }} />
        </Grid>
        <Leaf key="grid-peer" name="grid-peer" last={30} style={fixed(40, 40, '#426b61')} />
      </Flex>
    </>);
    controllers.push(controller); await frame();
    // Flow's final declared child is its second horizontal leaf. Grid's final
    // declared child is visually row 1; selection does not reorder by row.
    expect(boxes.get('flow-last')).toMatchObject({ x: 40, y: 58, width: 40, height: 20 });
    expect(boxes.get('flow-peer')).toMatchObject({ x: 80, y: 40, width: 40, height: 40 });
    expect(boxes.get('grid-last')).toMatchObject({ x: 0, y: 100, width: 40, height: 20 });
    expect(boxes.get('grid-peer')).toMatchObject({ x: 100, y: 80, width: 40, height: 40 });
    flowLast.set(22); gridLast.set(20); await frame();
    expect(boxes.get('flow-last')).toMatchObject({ y: 48 });
    expect(boxes.get('grid-peer')).toMatchObject({ y: 90 });
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'uses the settled structural content bottom as the last-baseline fallback when Flow and Grid have no in-flow source',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, LayoutBox>();
    const Peer = definePrimitive<{ readonly name: string }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }), measureBaselines: () => ({ status: 'measured' as const, first: 0, last: 30 }) });
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 180, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
      <Flow key="flow" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, direction: 'horizontal', wrap: false, alignItems: 'start' }} children={null} />
      <Grid key="grid" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40], gridTemplateRows: [40] }} children={null} />
      <Flex key="empty-flex" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} children={null} />
      <Peer key="peer" name="peer" style={fixed(40, 40, '#426b61')} />
    </Flex>);
    controllers.push(controller); await frame();
    // Each empty owner contributes a local last baseline at its 40px content bottom.
    expect(boxes.get('peer')).toEqual({ x: 120, y: 40, width: 40, height: 40 });
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'uses only the last native wrapped line when a known Flex root contributes its final declared last baseline',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const last = signal(8), boxes = new Map<string, Box>(); let serial = 0;
    const Leaf = definePrimitive<{ readonly name: string; readonly last: Last; readonly reject?: boolean }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        if (props.reject) throw new Error(`${props.name} is not on the final wrapped source line`);
        const value = typeof props.last === 'number' ? props.last : props.last.get();
        return { status: 'measured' as const, first: 0, last: value };
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 160, height: 100, flexDirection: 'row', alignItems: 'last-baseline' }}>
      <Flex key="inner" style={{ width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: 100, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-start' }}>
        <Leaf key="A" name="A" last={0} reject style={fixed(60, 20, '#e7e5df')} />
        <Leaf key="B" name="B" last={0} reject style={fixed(40, 20, '#e7e5df')} />
        <Leaf key="D" name="D" last={last} style={fixed(60, 20, '#8a3248')} />
      </Flex>
      <Leaf key="peer" name="peer" last={30} style={fixed(40, 40, '#426b61')} />
    </Flex>);
    controllers.push(controller); await frame();
    // D is declared last and occupies the native final line at local y=20.
    expect(boxes.get('D')).toEqual({ x: 0, y: 60, width: 60, height: 20, stamp: 3 });
    expect(boxes.get('peer')).toEqual({ x: 100, y: 38, width: 40, height: 40, stamp: 4 });
    const initial = { d: boxes.get('D')!.stamp, peer: boxes.get('peer')!.stamp };
    last.set(18); await frame();
    expect(boxes.get('D')).toEqual({ x: 0, y: 60, width: 60, height: 20, stamp: initial.d });
    expect(boxes.get('peer')).toEqual({ x: 100, y: 48, width: 40, height: 40, stamp: initial.peer });
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);
