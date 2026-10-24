import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  FocusManagement,
  Flex,
  Group,
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
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
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

interface BaselineStyle extends SystemStyle {
  width?: number; height?: number; fill?: string;
  minWidth?: number; minHeight?: number;
  flexBasis?: number; flexGrow?: number; flexShrink?: number;
}
interface BaselineProps { readonly name: 'A' | 'B' | 'C' | 'D'; readonly first: number | ReturnType<typeof signal<number>>; }

type CrossPolicy = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';

it.runIf(experimentalLayout)(
  'distributes fixed wrapped first-baseline lines through numeric cross gaps and every align-content policy',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const alignContent = signal<CrossPolicy>('flex-start');
    const wrapMode = signal<'wrap' | 'wrap-reverse'>('wrap');
    const rowGap = signal<number | '10%'>(8);
    const columnGap = signal(10);
    const dFirst = signal(20);
    const ink = signal('#426b61');
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
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
      return <Rectangle keyboardFocusable onFocus={() => focused.push(props.name)} onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'A' || props.name === 'C' ? '#8a3248' : '#426b61', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props }) => {
        const first = typeof props.first === 'number' ? props.first : props.first.get();
        return { status: 'measured' as const, first, last: first };
      },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 110; canvas.height = 120; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <FocusManagement><Group>
        <Flex style={{ width: 110, height: 120, flexDirection: 'row', flexWrap: wrapMode, alignItems: 'first-baseline', alignContent, columnGap, rowGap }}>
          <Leaf key="A" name="A" first={12} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="C" name="C" first={8} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="D" name="D" first={dFirst} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        </Flex>
        <Rectangle pointerEvents="none" style={{ width: 10, height: 10, fill: ink }} />
      </Group></FocusManagement>);
      controllers.push(controller);
      const expected: ReadonlyArray<readonly [CrossPolicy, number, number]> = [
        ['flex-start', 0, 48], ['flex-end', 40, 88], ['center', 20, 68],
        ['space-between', 0, 88], ['space-around', 10, 78],
        ['space-evenly', 40 / 3, 224 / 3], ['stretch', 0, 68],
      ];
      const expectPolicy = (bY: number, dY: number) => {
        for (const [name, x, y, width, height] of [
          ['A', 0, bY + 18, 60, 20], ['B', 70, bY, 40, 40],
          ['C', 0, dY + 12, 60, 20], ['D', 70, dY, 40, 30],
        ] as const) {
          expect(boxes.get(name)).toMatchObject({ x, width, height });
          // Canvas translations quantize fractional positions; native tests retain f64 arithmetic.
          expect(Math.abs(boxes.get(name)!.y - y)).toBeLessThan(1e-5);
        }
      };
      for (const [policy, bY, dY] of expected) {
        alignContent.set(policy);
        await nextFrame();
        expect(errors).toEqual([]);
        expectPolicy(bY, dY);
      }
      // Chromium preserves each source line's baseline alignment, then reverses
      // the physical line origins. Yoga's per-leaf reflection differs, so this
      // locks Pibbl's public physical-content-top contract before kernel admission.
      alignContent.set('flex-start');
      await nextFrame();
      const reverseStamps = Object.fromEntries(stamps);
      const beforeWrapReverse = snapshotWasmLayoutDiagnostics();
      wrapMode.set('wrap-reverse');
      await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 0, y: 98, width: 60, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 70, y: 80, width: 40, height: 40 });
      expect(boxes.get('C')).toEqual({ x: 0, y: 52, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 70, y: 40, width: 40, height: 30 });
      expect(snapshotWasmLayoutDiagnostics().crossPlacements).toBe(beforeWrapReverse.crossPlacements + 1);
      for (const [policy, bY, dY] of [
        ['flex-start', 80, 40], ['flex-end', 40, 0], ['center', 60, 20],
        ['space-between', 80, 0], ['space-around', 70, 10],
        ['space-evenly', 200 / 3, 40 / 3], ['stretch', 80, 20],
      ] as const) {
        alignContent.set(policy); await nextFrame(); expect(errors).toEqual([]);
        expectPolicy(bY, dY);
      }
      alignContent.set('flex-start'); await nextFrame();
      dFirst.set(26); await nextFrame();
      expect(boxes.get('A')).toEqual({ x: 0, y: 98, width: 60, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 70, y: 80, width: 40, height: 40 });
      expect(boxes.get('C')).toEqual({ x: 0, y: 52, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 70, y: 34, width: 40, height: 30 });
      dFirst.set(20); await nextFrame();
      const beforeWrapRestore = snapshotWasmLayoutDiagnostics();
      wrapMode.set('wrap');
      await nextFrame();
      expectPolicy(0, 48);
      expect(snapshotWasmLayoutDiagnostics().crossPlacements).toBe(beforeWrapRestore.crossPlacements + 1);

      expect(Object.fromEntries(stamps)).toEqual(reverseStamps);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(beforeWrapReverse.nodeCreates);
      const initialStamps = Object.fromEntries(stamps);
      const mounted = snapshotWasmLayoutDiagnostics();
      alignContent.set('flex-start');
      await nextFrame();
      canvas.blur(); canvas.focus({ preventScroll: true });
      for (let index = 0; index < 4; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
      expect(focused).toEqual(['A', 'B', 'C', 'D']);
      click(canvas, 4, 62);
      expect(hits).toEqual(['C']);
      dFirst.set(26);
      await nextFrame();
      expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 60, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 70, y: 0, width: 40, height: 40 });
      expect(boxes.get('C')).toEqual({ x: 0, y: 66, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 70, y: 48, width: 40, height: 30 });
      rowGap.set(12);
      await nextFrame();
      expect(boxes.get('C')).toEqual({ x: 0, y: 70, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 70, y: 52, width: 40, height: 30 });
      rowGap.set('10%');
      await nextFrame();
      expect(boxes.get('C')).toEqual({ x: 0, y: 70, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 70, y: 52, width: 40, height: 30 });
      columnGap.set(0);
      await nextFrame();
      expect(boxes.get('B')).toEqual({ x: 60, y: 0, width: 40, height: 40 });
      expect(boxes.get('D')).toEqual({ x: 60, y: 52, width: 40, height: 30 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      const beforeStale = hits.length;
      click(canvas, 4, 62);
      expect(hits).toHaveLength(beforeStale);
      click(canvas, 4, 72);
      expect(hits).toHaveLength(beforeStale + 1);
      expect(hits.at(-1)).toBe('C');
      const beforePaint = snapshotWasmLayoutDiagnostics();
      ink.set('#6e9d35');
      await nextFrame();
      const painted = snapshotWasmLayoutDiagnostics();
      expect([painted.solves, painted.crossPlacements, painted.nodeCreates]).toEqual([beforePaint.solves, beforePaint.crossPlacements, beforePaint.nodeCreates]);
      expect(errors).toEqual([]);
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
