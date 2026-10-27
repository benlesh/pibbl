import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Flow, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type BoxStyle, type FlowStyle, type PibblNodeInput, type PibblResponsiveStyle, type SystemStyle, useCanvasContext, useConst, useLayoutBox,
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
interface Style extends SystemStyle {
  readonly padding?: BoxStyle['padding'];
  readonly position?: 'relative';
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

it.runIf(experimentalLayout)(
  'uses the settled first in-flow Flow source for an outer baseline while preserving relative paint-only movement',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), top = signal(0), boxes = new Map<string, Box>(), hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: First }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
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
    const flow = <Flow key="flow" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, position: 'relative', top, direction: 'horizontal', wrap: false, alignItems: 'start' }}>
      <Leaf key="A" name="A" first={first} style={fixed(40, 20, '#8a3248')} />
    </Flow>;
    const b = <Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{flow}{b}</Flex>);
    controllers.push(controller); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    const stamps = { a: boxes.get('A')!.stamp, b: boxes.get('B')!.stamp }, mounted = snapshotWasmLayoutDiagnostics();
    click(canvas, 4, 34); expect(hits).toEqual(['A']);

    first.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stamps.b });
    const movedHits = hits.length; click(canvas, 4, 34); click(canvas, 4, 14); expect(hits.length).toBe(movedHits + 1); expect(hits.at(-1)).toBe('A');

    top.set(10); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: stamps.a });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stamps.b });
    const relativeHits = hits.length; click(canvas, 4, 14); click(canvas, 4, 24); expect(hits.length).toBe(relativeHits + 1); expect(hits.at(-1)).toBe('A');
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); top.set(0); await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);


it.runIf(experimentalLayout)(
  'uses an empty Flow content bottom as the settled outer baseline fallback',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, Box>(), hits: string[] = [];
    let serial = 0;
    const Peer = definePrimitive<{ readonly name: 'B' }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 30, last: 30 }),
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Flow key="empty-flow" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, direction: 'horizontal', wrap: false, alignItems: 'start' }} children={null} />
      <Peer key="B" name="B" style={fixed(40, 40, '#426b61')} />
    </Flex>);
    controllers.push(controller); await frame();
    // The empty Flow contributes its settled content bottom (40), putting the peer's first baseline at y=40.
    expect(boxes.get('B')).toEqual({ x: 40, y: 10, width: 40, height: 40, stamp: 1 });
    click(canvas, 44, 14); expect(hits).toEqual(['B']);
    const mounted = snapshotWasmLayoutDiagnostics();
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
    expect(mounted.activeNodes).toBeGreaterThan(baseline.activeNodes);
  },
);


it.runIf(experimentalLayout)(
  'uses the source-first settled Flow child across directions and wrapping, including described content padding',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, Box>(), hits: string[] = [];
    let selectedAllocation: { width: number; height: number } | undefined;
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B' | 'D'; readonly first: number }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        if (props.name === 'D') throw new Error('Later Flow source must not supply the first baseline.');
        if (props.name === 'A') selectedAllocation = { width: allocation.width, height: allocation.height };
        return { status: 'measured' as const, first: props.first, last: props.first };
      },
    });
    const DescribedFlow = defineLayoutComponent<{ readonly style: PibblResponsiveStyle<FlowStyle>; readonly children: PibblNodeInput }>(props =>
      <Flow style={props.style}>{props.children}</Flow>,
    );
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const cases = [
      ['horizontal', false, false, false],
      ['horizontal', true, false, false],
      ['vertical', false, false, false],
      ['vertical', true, false, false],
      ['horizontal', true, true, true],
    ] as const;
    for (let index = 0; index < cases.length; index++) {
      const [direction, wrap, described, padded] = cases[index]!;
      boxes.clear(); hits.length = 0; selectedAllocation = undefined;
      const flowStyle: FlowStyle = {
        width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0,
        direction, wrap, alignItems: 'start' as const,
        ...(padded ? { padding: { top: 3, bottom: 2 } } : {}),
      };
      const a = <Leaf key="A" name="A" first={12} style={{ ...fixed(40, 20, '#8a3248'), padding: padded ? { top: 3, bottom: 2 } : 0 }} />;
      const later = <Leaf key="D" name="D" first={99} style={fixed(40, 20, '#8a3248')} />;
      const flow = described
        ? <DescribedFlow key="flow" style={flowStyle}>{a}{later}</DescribedFlow>
        : <Flow key="flow" style={flowStyle}>{a}{later}</Flow>;
      const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
        {flow}<Leaf key="B" name="B" first={30} style={fixed(40, 40, '#426b61')} />
      </Flex>);
      controllers.push(controller); await frame();
      // useLayoutBox exposes the primitive outer allocation. Its provider receives
      // the content allocation, whose origin is the outer y plus its top inset.
      // The later source forces real wrapping in both native main directions.
      expect(boxes.get('A')).toMatchObject({ x: 0, y: padded ? 15 : 18, width: 40, height: padded ? 25 : 20 });
      expect(boxes.get('A')!.y + (padded ? 3 : 0) + 12).toBe(boxes.get('B')!.y + 30);
      expect(boxes.get('B')).toMatchObject({ x: 40, y: 0, width: 40, height: 40 });
      expect(selectedAllocation).toEqual({ width: 40, height: 20 });
      if (wrap) expect(boxes.get('D')).toMatchObject(direction === 'horizontal' ? { x: 0, y: padded ? 40 : 38 } : { x: 40, y: 18 });
      click(canvas, 4, 22); expect(hits).toEqual(['A']);
      controller.dispose(); controllers.splice(controllers.indexOf(controller), 1);
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    }
  },
);
