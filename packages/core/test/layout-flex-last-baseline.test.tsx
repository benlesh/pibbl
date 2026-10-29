import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  Flex,
  Rectangle,
  Text,
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
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.restoreAllMocks();
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

it.runIf(nativeLayout)(
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

it.runIf(nativeLayout)(
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

it.runIf(nativeLayout)('invalidates frozen placements when first and last baseline modes change during paint', async () => {
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

it.runIf(nativeLayout)(
  'aligns the actual last visible wrapped Text line at the safe end through reflow and preserves its glyph target',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const width = signal(40), words = signal('Ag Ag Ag Ag'), hits: string[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 140; canvas.height = 100; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const draws: Array<{ readonly text: string; readonly x: number; readonly y: number; readonly font: string }> = [];
    const original = context.fillText.bind(context);
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maxWidth?: number) => {
      const matrix = context.getTransform(); draws.push({ text, x: matrix.e + x, y: matrix.f + y, font: context.font });
      return maxWidth === undefined ? original(text, x, y) : original(text, x, y, maxWidth);
    }) as typeof context.fillText);
    const controller = pibbl(canvas, <Flex style={{ width: 140, height: 100, flexDirection: 'row', alignItems: 'last-baseline' }}>
      <Text key="wrapped" onClick={() => hits.push('wrapped')} style={{ width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: width, flexGrow: 0, flexShrink: 0, font: '10px monospace', lineHeight: 10, wrap: true, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#19375b', cursor: 'pointer' }}>{words}</Text>
      <Text key="peer" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#a63758' }}>Ag</Text>
    </Flex>);
    controllers.push(controller); await nextFrame();
    const alphabetic = (draw: { readonly text: string; readonly y: number; readonly font: string }) => {
      context.save();
      try {
        context.font = draw.font; context.textBaseline = 'top'; const top = context.measureText(draw.text).actualBoundingBoxAscent;
        context.textBaseline = 'alphabetic'; const alpha = context.measureText(draw.text).actualBoundingBoxAscent;
        return draw.y + alpha - top;
      } finally { context.restore(); }
    };
    const wrapped = () => draws.filter(draw => draw.font === '10px monospace');
    const peer = () => draws.find(draw => draw.font === '20px sans-serif')!;
    expect(wrapped()).toHaveLength(2);
    expect(alphabetic(wrapped().at(-1)!)).toBeCloseTo(alphabetic(peer()), 5);
    const hitLast = (draw: { readonly text: string; readonly x: number; readonly y: number; readonly font: string }) => {
      context.save(); context.font = draw.font; context.textBaseline = 'top'; const metrics = context.measureText(draw.text); context.restore();
      click(canvas, draw.x - metrics.actualBoundingBoxLeft + 1, draw.y - metrics.actualBoundingBoxAscent + 1);
    };
    hitLast(wrapped().at(-1)!); expect(hits).toEqual(['wrapped']);
    const mounted = snapshotWasmLayoutDiagnostics(); draws.splice(0);
    width.set(28); words.set('Ag Ag Ag'); await nextFrame();
    expect(wrapped()).toHaveLength(3);
    expect(alphabetic(wrapped().at(-1)!)).toBeCloseTo(alphabetic(peer()), 5);
    hitLast(wrapped().at(-1)!); expect(hits).toEqual(['wrapped', 'wrapped']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(nativeLayout)(
  'uses the current finite responsive selection for a direct provider last baseline',
  async () => {
    const ownerWidth = signal(100), selectedHeight = signal(30), boxes = new Map<string, LayoutBox>(), allocations: LayoutBox[] = [], hits: string[] = [];
    const Leaf = definePrimitive<{ readonly name: 'A' | 'B' }, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'A' ? '#8a3248' : '#426b61', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        if (props.name === 'A') allocations.push({ ...allocation });
        const last = props.name === 'A' ? allocation.height - 8 : 30;
        return { status: 'measured' as const, first: 0, last };
      },
    });
    const baseline = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: ownerWidth, height: 80, flexDirection: 'row', alignItems: 'last-baseline' }}>
      <Leaf key="A" name="A" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#8a3248', when: [{ query: { minWidth: 90 }, style: { height: selectedHeight } }] }} />
      <Leaf key="B" name="B" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
    </Flex>);
    controllers.push(controller); await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 48, width: 40, height: 30 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 40, width: 40, height: 40 });
    expect(allocations).toContainEqual({ x: 0, y: 0, width: 40, height: 30 });
    click(canvas, 4, 44); click(canvas, 4, 54); expect(hits).toEqual(['A']);
    selectedHeight.set(34); await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 44, width: 40, height: 34 });
    expect(allocations.at(-1)).toEqual({ x: 0, y: 0, width: 40, height: 34 });
    ownerWidth.set(80); await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 58, width: 40, height: 20 });
    expect(allocations.at(-1)).toEqual({ x: 0, y: 0, width: 40, height: 20 });
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);

it.runIf(nativeLayout)(
  'keeps wrap-reverse last baseline groups physical and falls back to a missing provider bottom edge',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics(), boxes = new Map<string, LayoutBox>(), hits: string[] = [];
    const Missing = definePrimitive<{ readonly name: 'A' }, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
    const Leaf = definePrimitive<{ readonly name: 'B' | 'C' | 'D'; readonly last: number }, LeafStyle, LeafStyle, SystemStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(), matrix = useCanvasContext().getTransform(); boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61' }} />;
    }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }), measureBaselines: ({ props }) => ({ status: 'measured' as const, first: 0, last: props.last }) });
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 100, flexDirection: 'row', flexWrap: 'wrap-reverse', alignItems: 'last-baseline', alignContent: 'stretch' }}>
      <Missing key="A" name="A" style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
      <Leaf key="B" name="B" last={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
      <Leaf key="C" name="C" last={5} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
      <Leaf key="D" name="D" last={20} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller); await nextFrame();
    const a = boxes.get('A')!, b = boxes.get('B')!, c = boxes.get('C')!, d = boxes.get('D')!;
    expect([a.y,b.y,c.y,d.y]).toEqual([57.5,47.5,15,0]);
    expect(a.y + a.height).toBe(b.y + 30);
    expect(c.y + 5).toBe(d.y + 20);
    expect(Math.min(a.y, b.y)).toBeGreaterThan(Math.max(c.y, d.y));
    click(canvas, a.x + 4, a.y + 4); expect(hits).toEqual(['A']);
    controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
  },
);
