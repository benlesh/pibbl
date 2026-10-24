import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex, FocusManagement, Rectangle, definePrimitive, signal,
  type LayoutBox, type SystemStyle, useCanvasContext, useConst, useLayoutBox,
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
interface Style extends SystemStyle { width?: number; height?: number; minWidth?: number; minHeight?: number; flexBasis?: number; flexGrow?: number; flexShrink?: number; position?: 'absolute'; left?: number; top?: number; fill?: string; }
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

it.runIf(experimentalLayout)(
  'uses a direct known Flex descendant baseline while skipping its absolute decoration',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const first = signal(12), boxes = new Map<string, Box>(), hits: string[] = [], focused: string[] = [], allocations: LayoutBox[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B'; readonly first: number | typeof first }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle keyboardFocusable onClick={() => hits.push(props.name)} onFocus={() => focused.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        if (props.name === 'A') allocations.push({ ...allocation });
        const value = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first: value, last: value };
      },
    });
    const a = <Leaf key="A" name="A" first={first} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#8a3248' }} />;
    const inner = <Flex key="inner" style={{ width: 40, height: 20, padding: { top: 6 }, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
      <Rectangle key="decoration" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 40, height: 20, fill: '#ffffff' }} />
      {a}
    </Flex>;
    const b = <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{inner}{b}</Flex></FocusManagement>);
    controllers.push(controller); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20, stamp: 1 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: 2 });
    expect(allocations).toContainEqual({ x: 0, y: 0, width: 40, height: 20 });
    const stampA = boxes.get('A')!.stamp, stampB = boxes.get('B')!.stamp, mounted = snapshotWasmLayoutDiagnostics();
    click(canvas, 4, 34); expect(hits).toEqual(['A']);
    canvas.blur(); focused.length = 0; canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['A', 'B']);

    first.set(22); await frame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 20, stamp: stampA });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40, stamp: stampB });
    click(canvas, 4, 34); click(canvas, 4, 14); expect(hits).toEqual(['A', 'A']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    first.set(12); await frame(); expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(disposed.nodeCreates);
  },
);

it.runIf(experimentalLayout)(
  'uses the first direct known Flex descendant content bottom when no provider reports a baseline',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const hits: string[] = []; const boxes = new Map<string, LayoutBox>();
    const Peer = definePrimitive<{ readonly name: 'B' }, Style, Style, Style & { readonly width: number; readonly height: number }>((props, style) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 30, last: 30 }),
    });
    const child = <Rectangle key="child" onClick={() => hits.push('child')} style={{ width: 40, height: 10, padding: { top: 3, bottom: 2 }, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#8a3248', cursor: 'pointer' }} />;
    const inner = <Flex key="inner" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>{child}</Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 60; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{inner}<Peer key="B" name="B" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} /></Flex>);
    controllers.push(controller); await frame();
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    click(canvas, 4, 14); click(canvas, 4, 18); click(canvas, 4, 24); expect(hits).toEqual(['child', 'child']);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);
