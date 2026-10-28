import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex,
  Rectangle,
  definePrimitive,
  signal,
  type LayoutBox,
  type Signal,
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

interface LeafStyle extends SystemStyle {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  flexBasis?: number;
  flexGrow?: number;
  flexShrink?: number;
  marginTop?: number | 'auto';
  alignSelf?: 'auto' | 'flex-end';
  fill?: string;
}
interface LeafProps {
  readonly name: string;
  readonly last: number | Signal<number>;
  readonly boxes: Map<string, LayoutBox>;
  readonly stamps: Map<string, number>;
  readonly hits?: string[];
  readonly rejectQuery?: boolean;
}

it.runIf(experimentalLayout)(
  'aligns direct finite leaves by their last baseline at the safe cross end across row directions and wrapping',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const errors: unknown[] = [];
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const variants = [
      ['row', 'ltr', false], ['row', 'rtl', true], ['row-reverse', 'ltr', true], ['row-reverse', 'rtl', false],
    ] as const;
    window.addEventListener('error', receive);
    try {
      for (const [flexDirection, layoutDirection, reversed] of variants) {
        const lastA = signal(30);
        const boxes = new Map<string, LayoutBox>();
        const stamps = new Map<string, number>();
        const hits: string[] = [];
        let serial = 0;
        const Leaf = definePrimitive<LeafProps, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
          const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
          boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
          stamps.set(props.name, useConst(() => ++serial));
          return <Rectangle onClick={props.hits ? () => props.hits!.push(props.name) : undefined} style={{ width: box.width, height: box.height, fill: '#426b61', cursor: props.hits ? 'pointer' : undefined }} />;
        }, {
          resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
          measureBaselines: ({ props }) => {
            if (props.rejectQuery) throw new Error('last-baseline opt-out must not query this leaf');
            const last = typeof props.last === 'number' ? props.last : props.last.get();
            return { status: 'measured' as const, first: 0, last };
          },
        });
        const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
        const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection, layoutDirection, alignItems: 'last-baseline' }}>
          <Leaf key="A" name="A" last={lastA} boxes={boxes} stamps={stamps} hits={hits} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="B" name="B" last={50} boxes={boxes} stamps={stamps} style={{ width: 40, height: 60, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        </Flex>);
        controllers.push(controller); await nextFrame();
        const ax = reversed ? 60 : 0, bx = reversed ? 20 : 40;
        expect(errors).toEqual([]);
        expect(Object.fromEntries(boxes)).toEqual({
          A: { x: ax, y: 40, width: 40, height: 40 }, B: { x: bx, y: 20, width: 40, height: 60 },
        });
        const initialStamps = Object.fromEntries(stamps);
        click(canvas, ax + 4, 44); expect(hits).toEqual(['A']);
        lastA.set(20); await nextFrame();
        expect(errors).toEqual([]);
        expect(boxes.get('A')).toEqual({ x: ax, y: 40, width: 40, height: 40 });
        expect(boxes.get('B')).toEqual({ x: bx, y: 10, width: 40, height: 60 });
        expect(Object.fromEntries(stamps)).toEqual(initialStamps);
        click(canvas, ax + 4, 24); click(canvas, ax + 4, 44);
        expect(hits).toEqual(['A', 'A']);
        controller.dispose();
        const disposed = snapshotWasmLayoutDiagnostics();
        expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
          baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
        ]);
      }

      const wrappedBoxes = new Map<string, LayoutBox>();
      const wrappedStamps = new Map<string, number>();
      let wrappedSerial = 0;
      const WrappedLeaf = definePrimitive<LeafProps, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
        const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
        wrappedBoxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
        wrappedStamps.set(props.name, useConst(() => ++wrappedSerial));
        return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
      }, {
        resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
        measureBaselines: ({ props }) => ({ status: 'measured' as const, first: 0, last: typeof props.last === 'number' ? props.last : props.last.get() }),
      });
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
      const wrappedController = pibbl(canvas, <Flex style={{ width: 100, height: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'last-baseline', alignContent: 'flex-start' }}>
        <WrappedLeaf key="A" name="A" last={10} boxes={wrappedBoxes} stamps={wrappedStamps} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <WrappedLeaf key="B" name="B" last={30} boxes={wrappedBoxes} stamps={wrappedStamps} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        <WrappedLeaf key="C" name="C" last={5} boxes={wrappedBoxes} stamps={wrappedStamps} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <WrappedLeaf key="D" name="D" last={20} boxes={wrappedBoxes} stamps={wrappedStamps} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(wrappedController); await nextFrame();
      expect(errors).toEqual([]);
      expect(Object.fromEntries(wrappedBoxes)).toEqual({
        A: { x: 0, y: 20, width: 60, height: 20 }, B: { x: 60, y: 0, width: 40, height: 40 },
        C: { x: 0, y: 55, width: 60, height: 20 }, D: { x: 60, y: 40, width: 40, height: 30 },
      });
      wrappedController.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally { window.removeEventListener('error', receive); }
  },
);

it.runIf(experimentalLayout)(
  'excludes explicit self alignment and automatic cross margins from last-baseline membership',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const errors: unknown[] = [];
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      for (const style of [
        { alignSelf: 'flex-end' as const },
        { marginTop: 'auto' as const },
      ]) {
        const boxes = new Map<string, LayoutBox>();
        const stamps = new Map<string, number>();
        let serial = 0;
        const Leaf = definePrimitive<LeafProps, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
          const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
          boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
          stamps.set(props.name, useConst(() => ++serial));
          return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
        }, {
          resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
          measureBaselines: ({ props }) => {
            if (props.rejectQuery) throw new Error('last-baseline opt-out queried the excluded leaf');
            return { status: 'measured' as const, first: 0, last: typeof props.last === 'number' ? props.last : props.last.get() };
          },
        });
        const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
        const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
          <Leaf key="A" name="A" last={0} boxes={boxes} stamps={stamps} rejectQuery style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, ...style }} />
          <Leaf key="B" name="B" last={50} boxes={boxes} stamps={stamps} style={{ width: 40, height: 60, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        </Flex>);
        controllers.push(controller); await nextFrame();
        expect(errors).toEqual([]);
        expect(boxes.get('A')).toEqual({ x: 0, y: 60, width: 40, height: 20 });
        expect(boxes.get('B')).toEqual({ x: 40, y: 20, width: 40, height: 60 });
        controller.dispose();
        const disposed = snapshotWasmLayoutDiagnostics();
        expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
          baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
        ]);
      }
    } finally { window.removeEventListener('error', receive); }
  },
);

it.runIf(experimentalLayout)('invalidates frozen placements when first and last baseline modes change during paint', async () => {
  const fill = signal('#a63758'), hits: string[] = [];
  const a = <Rectangle onClick={() => hits.push('A')} style={Object.freeze({ width: 40, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill })} />;
  const b = <Rectangle style={Object.freeze({ width: 40, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#19375b' })} />;
  Object.freeze(a.props); Object.freeze(a); Object.freeze(b.props); Object.freeze(b);
  const children = Object.freeze([a, b]);
  const style: import('@pibbl/core').FlexStyle = { width: 100, height: 80, alignItems: 'first-baseline' };
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
  const controller = pibbl(canvas, <Flex style={style}>{children}</Flex>); controllers.push(controller); await nextFrame();
  const pixel = (x: number, y: number) => Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
  expect(pixel(4,24)).toEqual([166,55,88,255]); expect(pixel(4,64)[3]).toBe(0);
  style.alignItems = 'last-baseline'; fill.set('#426b61'); await nextFrame();
  expect(pixel(4,24)[3]).toBe(0); expect(pixel(4,64)).toEqual([66,107,97,255]);
  click(canvas,4,24);click(canvas,4,64);expect(hits).toEqual(['A']);
  style.alignItems = 'first-baseline'; fill.set('#a63758'); await nextFrame();
  expect(pixel(4,24)).toEqual([166,55,88,255]); expect(pixel(4,64)[3]).toBe(0);
});
