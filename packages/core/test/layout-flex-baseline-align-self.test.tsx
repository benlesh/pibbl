import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  FocusManagement,
  Flex,
  Rectangle,
  definePrimitive,
  signal,
  type LayoutBox,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
  }
}

type Alignment = 'auto' | 'start' | 'flex-start' | 'end' | 'flex-end' | 'center' | 'stretch';
interface BaselineStyle extends SystemStyle {
  width?: number; height?: number; fill?: string; marginLeft?: number; marginTop?: number; marginBottom?: number;
  minWidth?: number; minHeight?: number;
  flexBasis?: number; flexGrow?: number; flexShrink?: number;
  alignSelf?: Alignment;
}
interface BaselineProps {
  readonly name: string;
  readonly first: number | ReturnType<typeof signal<number>>;
}

it.runIf(nativeLayout)(
  'treats auto as the only first-baseline member while explicit alignSelf values use ordinary wrapped-line placement',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const alignment = signal<Alignment>('auto');
    const dFirst = signal(4);
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
    const calls = new Map<string, number>();
    const hits: string[] = [];
    const focused: string[] = [];
    const errors: unknown[] = [];
    let serial = 0;
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Leaf = definePrimitive<BaselineProps, BaselineStyle, BaselineStyle, BaselineStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      stamps.set(props.name, stamp);
      return <Rectangle keyboardFocusable onFocus={() => focused.push(props.name)} onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'D' ? '#426b61' : '#8a3248', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        calls.set(props.name, (calls.get(props.name) ?? 0) + 1);
        if (props.name === 'D' && alignment.get() !== 'auto') throw new Error('explicit alignSelf must not query D baseline');
        const first = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first, last: first };
      },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 100, height: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent: 'flex-start' }}>
        <Leaf key="A" name="A" first={12} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="C" name="C" first={8} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="D" name="D" first={dFirst} style={{ width: 40, height: 10, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, alignSelf: alignment }} />
        <Leaf key="E" name="E" first={10} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
      </Flex></FocusManagement>);
      controllers.push(controller);
      await nextFrame();

      expect(errors).toEqual([]);
      expect(Object.fromEntries(boxes)).toEqual({
        A: { x: 0, y: 18, width: 60, height: 20 }, B: { x: 60, y: 0, width: 40, height: 40 },
        C: { x: 0, y: 40, width: 60, height: 20 }, D: { x: 60, y: 44, width: 40, height: 10 },
        E: { x: 0, y: 60, width: 60, height: 20 },
      });
      const mounted = snapshotWasmLayoutDiagnostics();
      const initialStamps = Object.fromEntries(stamps);
      canvas.blur(); canvas.focus({ preventScroll: true });
      for (let index = 0; index < 5; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
      expect(focused).toEqual(['A', 'B', 'C', 'D', 'E']);
      click(canvas, 4, 66);
      click(canvas, 64, 42);
      expect(hits).toEqual(['E']);

      dFirst.set(18);
      await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('C')).toEqual({ x: 0, y: 50, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 60, y: 40, width: 40, height: 10 });
      expect(boxes.get('E')).toEqual({ x: 0, y: 70, width: 60, height: 20 });
      expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 60, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 60, y: 0, width: 40, height: 40 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      click(canvas, 64, 42);
      click(canvas, 4, 74);
      expect(hits).toEqual(['E', 'D', 'E']);

      dFirst.set(4);
      await nextFrame();
      const variants: readonly [Alignment, number, number][] = [
        ['start', 40, 10], ['flex-start', 40, 10], ['center', 45, 10], ['end', 50, 10], ['flex-end', 50, 10], ['stretch', 40, 10],
      ];
      for (const [value, dY, dHeight] of variants) {
        alignment.set(value);
        await nextFrame();
        expect(errors).toEqual([]);
        expect(boxes.get('C')).toEqual({ x: 0, y: 40, width: 60, height: 20 });
        expect(boxes.get('D')).toEqual({ x: 60, y: dY, width: 40, height: dHeight });
        expect(boxes.get('E')).toEqual({ x: 0, y: 60, width: 60, height: 20 });
        const before = calls.get('D');
        dFirst.set(18);
        await nextFrame();
        expect(errors).toEqual([]);
        expect(calls.get('D')).toBe(before);
        expect(boxes.get('C')).toEqual({ x: 0, y: 40, width: 60, height: 20 });
        expect(boxes.get('D')).toEqual({ x: 60, y: dY, width: 40, height: dHeight });
        expect(boxes.get('E')).toEqual({ x: 0, y: 60, width: 60, height: 20 });
        dFirst.set(4);
        await nextFrame();
      }
      alignment.set('auto');
      await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('D')).toEqual({ x: 60, y: 44, width: 40, height: 10 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);

      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally {
      window.removeEventListener('error', receive);
    }
  },
);


for (const [top, bottom, endY, startY, oldHit, newHit] of [[0,0,80,100,85,105], [5,10,85,90,87,107]] as const) it.runIf(nativeLayout)(
  `keeps inherited baselines physical while explicit self alignment follows wrap-reverse cross placement with margins ${top}/${bottom}`,
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const alignment = signal<'flex-end' | 'flex-start'>('flex-end');
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
    const hits: string[] = [];
    const errors: unknown[] = [];
    let serial = 0;
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Leaf = definePrimitive<BaselineProps, BaselineStyle, BaselineStyle, BaselineStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      stamps.set(props.name, useConst(() => ++serial));
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: '#426b61', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        if (props.name === 'A') throw new Error('explicit self alignment must not query A baseline');
        return { status: 'measured' as const, first: 30, last: 30 };
      },
    });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 120; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 100, height: 120, flexDirection: 'row', flexWrap: 'wrap-reverse', alignItems: 'first-baseline', alignContent: 'flex-start' }}>
        <Leaf key="A" name="A" first={0} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: top, marginBottom: bottom, alignSelf: alignment }} />
        <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(controller); await nextFrame();
      expect(errors).toEqual([]);
      expect(Object.fromEntries(boxes)).toEqual({
        A: { x: 0, y: endY, width: 40, height: 20 }, B: { x: 40, y: 80, width: 40, height: 40 },
      });
      const initialStamps = Object.fromEntries(stamps);
      click(canvas, 4, oldHit); expect(hits).toEqual(['A']);
      click(canvas, 4, newHit); expect(hits).toEqual(['A']);

      alignment.set('flex-start'); await nextFrame();
      expect(errors).toEqual([]);
      expect(Object.fromEntries(boxes)).toEqual({
        A: { x: 0, y: startY, width: 40, height: 20 }, B: { x: 40, y: 80, width: 40, height: 40 },
      });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      click(canvas, 4, oldHit); click(canvas, 4, newHit);
      expect(hits).toEqual(['A', 'A']);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally { window.removeEventListener('error', receive); }
  },
);
