import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type SystemStyle, useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
let nextStamp = 1;
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}
interface Style extends SystemStyle { position?: 'static' | 'relative'; top?: number; width?: number; height?: number; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; fill?: string; }
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
type First = number | { get(): number };
interface LeafProps { readonly name: string; readonly first: First; readonly capture: (name: string, box: Box) => void; readonly hit: (name: string) => void; }
const Leaf = definePrimitive<LeafProps, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
  const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => nextStamp++);
  props.capture(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
  return <Rectangle keyboardFocusable onClick={() => props.hit(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
}, {
  resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
  measureBaselines: ({ props }) => {
    const first = typeof props.first === 'number' ? props.first : props.first.get();
    return { status: 'measured' as const, first, last: first };
  },
});
const fixed = (width: number, height: number, fill: string): Style & { width: number; height: number } => ({ width, height, minWidth: 0, minHeight: 0, flexBasis: width, flexGrow: 0, flexShrink: 0, fill });

it.runIf(experimentalLayout)(
  'uses source-first physical placement for all finite nowrap known Flex directions, including explicit RTL',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const direction = signal<'row' | 'row-reverse' | 'column' | 'column-reverse'>('row');
    const writing = signal<'ltr' | 'rtl'>('ltr');
    const boxes = new Map<string, Box>(), hits: string[] = [];
    const capture = (name: string, box: Box) => boxes.set(name, box);
    const DirectionInner = defineLayoutComponent(() => {
      const current = direction.get(), basis = current.startsWith('column') ? 20 : 40;
      return <Flex key="inner" style={{ ...fixed(40, 40, '#ffffff'), flexDirection: current, layoutDirection: writing.get(), flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Leaf key="A" name="A" first={12} capture={capture} hit={name => hits.push(name)} style={{ ...fixed(40, 20, '#8a3248'), flexBasis: basis }} />
        <Rectangle key="D" pointerEvents="none" style={{ ...fixed(40, 20, '#ffffff'), flexBasis: basis }} />
      </Flex>;
    });
    const b = <Leaf key="B" name="B" first={30} capture={capture} hit={name => hits.push(name)} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    controllers.push(pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}><DirectionInner key="described-inner" />{b}</Flex>));
    await frame();
    const initialAStamp = boxes.get('A')!.stamp, initialBStamp = boxes.get('B')!.stamp;
    for (const [value, layoutDirection, expectedA, expectedB] of [
      ['row', 'ltr', 18, 0], ['row', 'rtl', 18, 0], ['row-reverse', 'ltr', 18, 0], ['column', 'ltr', 18, 0], ['column-reverse', 'ltr', 20, 2],
    ] as const) {
      direction.set(value); writing.set(layoutDirection); await frame();
      const a = boxes.get('A')!;
      expect(a).toMatchObject({ y: expectedA, width: 40, height: 20 });
      expect(boxes.get('B')).toMatchObject({ x: 40, y: expectedB, width: 40, height: 40 });
      expect(a.stamp).toBe(initialAStamp);
      expect(boxes.get('B')!.stamp).toBe(initialBStamp);
      click(canvas, a.x + 4, expectedA + 4);
    }
    expect(hits).toEqual(['A', 'A', 'A', 'A', 'A']);
    controllers.pop()!.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'uses a finite empty known Flex content bottom while skipping absolute decoration',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, Box>(), hits: string[] = [];
    const capture = (name: string, box: Box) => boxes.set(name, box);
    const inner = <Flex key="inner" style={{ ...fixed(40, 20, '#ffffff'), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Rectangle key="decoration" onClick={() => hits.push('decoration')} style={{ position: 'absolute', left: 0, top: 0, width: 40, height: 20, fill: '#8a3248', cursor: 'pointer' }} />
    </Flex>;
    const b = <Leaf key="B" name="B" first={30} capture={capture} hit={() => {}} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 60; document.body.append(canvas);
    controllers.push(pibbl(canvas, <Flex style={{ width: 100, height: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{inner}{b}</Flex>));
    await frame();
    expect(boxes.get('B')).toMatchObject({ x: 40, y: 0, width: 40, height: 40 });
    click(canvas, 4, 14); expect(hits).toEqual(['decoration']);
    controllers.pop()!.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'uses described known Flex roots, described primitive roots, and recursively prepared sources',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), relativeTop = signal(0), boxes = new Map<string, Box>(), hits: string[] = [];
    const capture = (name: string, box: Box) => boxes.set(name, box);
    const Badge = defineLayoutComponent<{ readonly first: First; readonly style: Style }>(props =>
      <Leaf key="badge-root" name="A" first={props.first} capture={capture} hit={name => hits.push(name)} style={props.style} />,
    );
    const DescribedInner = defineLayoutComponent<{ readonly first: First }>(props =>
      <Flex key="described-inner-root" style={{ ...fixed(40, 20, '#ffffff'), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Badge key="badge" first={props.first} style={{ ...fixed(40, 20, '#8a3248'), position: 'relative', top: relativeTop.get() }} />
      </Flex>,
    );
    const recursive = <Flex key="middle" style={{ ...fixed(40, 20, '#ffffff'), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Leaf key="A" name="A" first={first} capture={capture} hit={name => hits.push(name)} style={fixed(40, 20, '#8a3248')} />
    </Flex>;
    const b = <Leaf key="B" name="B" first={30} capture={capture} hit={name => hits.push(name)} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    let controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <DescribedInner key="described-inner" first={first} />{b}
    </Flex>);
    controllers.push(controller); await frame();
    expect(boxes.get('A')).toMatchObject({ x: 0, y: 18, width: 40, height: 20 });
    first.set(22); await frame(); expect(boxes.get('A')).toMatchObject({ x: 0, y: 8, width: 40, height: 20 });
    relativeTop.set(10); await frame(); expect(boxes.get('A')).toMatchObject({ x: 0, y: 18, width: 40, height: 20 });
    expect(boxes.get('B')).toMatchObject({ y: 0 });
    controller.dispose(); controllers.splice(controllers.indexOf(controller), 1);

    boxes.clear(); first.set(12);
    controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Flex key="inner" style={{ ...fixed(40, 20, '#ffffff'), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>{recursive}</Flex>{b}
    </Flex>);
    controllers.push(controller); await frame();
    expect(boxes.get('A')).toMatchObject({ x: 0, y: 18, width: 40, height: 20 });
    first.set(22); await frame(); expect(boxes.get('A')).toMatchObject({ x: 0, y: 8, width: 40, height: 20 });
    const a = boxes.get('A')!; click(canvas, a.x + 4, a.y + 4); expect(hits.at(-1)).toBe('A');
    controller.dispose(); controllers.splice(controllers.indexOf(controller), 1);
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);
