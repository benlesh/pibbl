import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, Rectangle, defineLayoutComponent, definePrimitive, signal,
  type SystemStyle, useCanvasContext, useConst, useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
let serial = 0;
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y }));
}
interface Style extends SystemStyle { width?: number; height?: number; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; fill?: string; }
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;
const fixed = (width: number, height: number, fill: string): Style & { width: number; height: number } => ({ width, height, minWidth: 0, minHeight: 0, flexBasis: width, flexGrow: 0, flexShrink: 0, fill });
const Leaf = definePrimitive<{ readonly first: number; readonly capture: (box: Box) => void; readonly hit: () => void }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
  const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
  props.capture({ x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
  return <Rectangle keyboardFocusable onClick={props.hit} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
}, {
  resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
  measureBaselines: ({ props }) => ({ status: 'measured' as const, first: props.first, last: props.first }),
});

it.runIf(experimentalLayout)(
  'uses only a native first-wrap-line source child for finite wrapped known Flex baseline selection',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const direction = signal<'row' | 'row-reverse' | 'column' | 'column-reverse'>('row');
    const wrap = signal<'wrap' | 'wrap-reverse'>('wrap');
    const writing = signal<'ltr' | 'rtl'>('ltr');
    const paint = signal('#ffffff');
    let a: Box | undefined, b: Box | undefined;
    const hits: string[] = [];
    const Inner = defineLayoutComponent(() => {
      const axis = direction.get(), vertical = axis.startsWith('column');
      const width = vertical ? 20 : 40, height = vertical ? 40 : 20, basis = 40;
      return <Flex style={{ ...fixed(80, 80, '#ffffff'), flexDirection: axis, flexWrap: wrap.get(), layoutDirection: writing.get(), alignItems: 'flex-start', alignContent: 'flex-start' }}>
        <Leaf key="A" first={12} capture={box => { a = box; }} hit={() => hits.push('A')} style={{ ...fixed(width, height, '#8a3248'), flexBasis: basis }} />
        <Rectangle key="D" pointerEvents="none" style={{ ...fixed(width, height, '#ffffff'), flexBasis: basis }} />
        <Rectangle key="E" pointerEvents="none" style={{ ...fixed(width, height, '#ffffff'), flexBasis: basis }} />
      </Flex>;
    });
    const peer = <Leaf key="B" first={30} capture={box => { b = box; }} hit={() => hits.push('B')} style={fixed(40, 40, '#426b61')} />;
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 100; document.body.append(canvas);
    controllers.push(pibbl(canvas, <><Flex style={{ width: 140, height: 100, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}><Inner key="inner" />{peer}</Flex><Rectangle pointerEvents="none" style={{left:120,top:90,width:10,height:10,fill:paint}} /></>));
    await frame();
    const stampA = a!.stamp, stampB = b!.stamp, mounted = snapshotWasmLayoutDiagnostics();
    paint.set('#112233'); await frame();
    const painted = snapshotWasmLayoutDiagnostics();
    expect([painted.solves,painted.lineFormations,painted.nodeCreates]).toEqual([mounted.solves,mounted.lineFormations,mounted.nodeCreates]);
    expect(a).toMatchObject({y:18,stamp:stampA});expect(b).toMatchObject({y:0,stamp:stampB});
    for (const [axis, mode, layoutDirection, expectedA, expectedB] of [
      ['row', 'wrap', 'ltr', 18, 0], ['row', 'wrap', 'rtl', 18, 0], ['row-reverse', 'wrap-reverse', 'ltr', 60, 42],
      ['column', 'wrap', 'ltr', 18, 0], ['column-reverse', 'wrap', 'ltr', 40, 22], ['column-reverse', 'wrap-reverse', 'ltr', 40, 22],
    ] as const) {
      direction.set(axis); wrap.set(mode); writing.set(layoutDirection); await frame();
      expect(a).toMatchObject({ y: expectedA, width: axis.startsWith('column') ? 20 : 40, height: axis.startsWith('column') ? 40 : 20, stamp: stampA });
      expect(b).toMatchObject({ x: 80, y: expectedB, width: 40, height: 40, stamp: stampB });
      click(canvas, a!.x + 4, a!.y + 4);
    }
    expect(hits).toEqual(['A', 'A', 'A', 'A', 'A', 'A']);
    controllers.pop()!.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);
