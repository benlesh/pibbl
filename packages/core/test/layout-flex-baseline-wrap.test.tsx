import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  FocusManagement,
  Flex,
  Text,
  createElement,
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
  width?: number; height?: number; fill?: string; marginLeft?: number;
  minWidth?: number; minHeight?: number;
  flexBasis?: number; flexGrow?: number; flexShrink?: number;
}
interface BaselineProps { readonly name: string; readonly first: number | ReturnType<typeof signal<number>>; }

it.runIf(experimentalLayout)(
  'shares first baselines within each finite wrapped row while retaining source identity and cleanup',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const dFirst = signal(20);
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
    canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 100, height: 100, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent: 'flex-start' }}>
        <Leaf key="A" name="A" first={12} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="C" name="C" first={8} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
        <Leaf key="D" name="D" first={dFirst} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
      </Flex></FocusManagement>);
      controllers.push(controller);
      await nextFrame();

      expect(errors).toEqual([]);
      expect(Object.fromEntries(boxes)).toEqual({
        A: { x: 0, y: 18, width: 60, height: 20 },
        B: { x: 60, y: 0, width: 40, height: 40 },
        C: { x: 0, y: 52, width: 60, height: 20 },
        D: { x: 60, y: 40, width: 40, height: 30 },
      });
      const initialStamps = Object.fromEntries(stamps);
      const mounted = snapshotWasmLayoutDiagnostics();

      canvas.blur(); canvas.focus({ preventScroll: true });
      for (let index = 0; index < 4; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
      expect(focused).toEqual(['A', 'B', 'C', 'D']);
      click(canvas, 4, 54);
      expect(hits).toEqual(['C']);

      dFirst.set(26);
      await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('C')).toEqual({ x: 0, y: 58, width: 60, height: 20 });
      expect(boxes.get('D')).toEqual({ x: 60, y: 40, width: 40, height: 30 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      click(canvas, 4, 54);
      click(canvas, 4, 60);
      expect(hits).toEqual(['C', 'C']);

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

it.runIf(experimentalLayout)(
  'keeps wrapped first-baseline lines physical across row reversal and writing direction',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const errors: unknown[] = [];
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      const variants = [
        { flexDirection: 'row' as const, layoutDirection: 'ltr' as const, reversed: false },
        { flexDirection: 'row' as const, layoutDirection: 'rtl' as const, reversed: true },
        { flexDirection: 'row-reverse' as const, layoutDirection: 'ltr' as const, reversed: true },
        { flexDirection: 'row-reverse' as const, layoutDirection: 'rtl' as const, reversed: false },
      ];
      for (const variant of variants) {
        const dFirst = signal(20);
        const boxes = new Map<string, LayoutBox>();
        const stamps = new Map<string, number>();
        const hits: string[] = [];
        const focused: string[] = [];
        let serial = 0;
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
        canvas.width = 100; canvas.height = 100; document.body.append(canvas);
        const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 100, height: 100, flexDirection: variant.flexDirection, flexWrap: 'wrap', layoutDirection: variant.layoutDirection, alignItems: 'first-baseline', alignContent: 'flex-start' }}>
          <Leaf key="A" name="A" first={12} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="C" name="C" first={8} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0 }} />
          <Leaf key="D" name="D" first={dFirst} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
        </Flex></FocusManagement>);
        controllers.push(controller);
        await nextFrame();
        const wideX = variant.reversed ? 40 : 0;
        const narrowX = variant.reversed ? 0 : 60;
        expect(Object.fromEntries(boxes)).toEqual({
          A: { x: wideX, y: 18, width: 60, height: 20 },
          B: { x: narrowX, y: 0, width: 40, height: 40 },
          C: { x: wideX, y: 52, width: 60, height: 20 },
          D: { x: narrowX, y: 40, width: 40, height: 30 },
        });
        const initialStamps = Object.fromEntries(stamps);
        canvas.blur(); canvas.focus({ preventScroll: true });
        for (let index = 0; index < 4; index++) canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
        expect(focused).toEqual(['A', 'B', 'C', 'D']);
        click(canvas, wideX + 4, 54);
        expect(hits).toEqual(['C']);
        dFirst.set(26);
        await nextFrame();
        expect(boxes.get('C')).toEqual({ x: wideX, y: 58, width: 60, height: 20 });
        expect(boxes.get('D')).toEqual({ x: narrowX, y: 40, width: 40, height: 30 });
        expect(Object.fromEntries(stamps)).toEqual(initialStamps);
        expect(boxes.get('A')).toEqual({ x: wideX, y: 18, width: 60, height: 20 });
        expect(boxes.get('B')).toEqual({ x: narrowX, y: 0, width: 40, height: 40 });
        const beforeStale = hits.length;
        click(canvas, wideX + 4, 54);
        expect(hits).toHaveLength(beforeStale);
        click(canvas, wideX + 4, 60);
        expect(hits).toHaveLength(beforeStale + 1);
        expect(hits.at(-1)).toBe('C');
        controller.dispose();
        const disposed = snapshotWasmLayoutDiagnostics();
        expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
          baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
        ]);
      }
      expect(errors).toEqual([]);
    } finally {
      window.removeEventListener('error', receive);
    }
  },
);


it.runIf(experimentalLayout)(
  'uses final main growth and an automatic main margin for fixed generic Text in a wrapped first-baseline line',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const growth = signal(1);
    const leadingMargin = signal<0 | 'auto'>(0);
    const hits: string[] = [];
    const errors: unknown[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    interface Draw { readonly text: string; readonly x: number; readonly y: number; readonly font: string; }
    const draws: Draw[] = [];
    const originalFillText = context.fillText.bind(context);
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maxWidth?: number) => {
      const transform = context.getTransform();
      draws.push({ text, x: transform.e + x, y: transform.f + y, font: context.font });
      originalFillText(text, x, y, maxWidth);
    }) as typeof context.fillText);
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const small = createElement(Text, {
      key: 'small', children: 'Ag', onClick: () => hits.push('small'),
      style: {
        width: 40, height: 20, minWidth: 0, minHeight: 0,
        flexBasis: 40, flexGrow: growth, flexShrink: 1, marginLeft: leadingMargin,
        font: '10px monospace', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#8a3248', cursor: 'pointer',
      },
    });
    const large = createElement(Text, {
      key: 'large', children: 'Ag',
      style: {
        width: 40, height: 40, minWidth: 0, minHeight: 0,
        flexBasis: 40, flexGrow: growth, flexShrink: 1,
        font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#426b61',
      },
    });
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent: 'flex-start' }}>{[small, large]}</Flex>);
      controllers.push(controller);
      await nextFrame();

      expect(errors).toEqual([]);
      const drawFor = (font: string) => draws.find(draw => draw.font === font)!;
      const baselineAt = (draw: Draw) => {
        context.save();
        try {
          context.font = draw.font;
          context.textBaseline = 'top';
          const top = context.measureText(draw.text).actualBoundingBoxAscent;
          context.textBaseline = 'alphabetic';
          return draw.y + context.measureText(draw.text).actualBoundingBoxAscent - top;
        } finally { context.restore(); }
      };
      const glyphPoint = (draw: Draw): readonly [number, number] => {
        context.save();
        try {
          context.font = draw.font;
          context.textBaseline = 'top';
          const metrics = context.measureText(draw.text);
          return [draw.x - metrics.actualBoundingBoxLeft + 1, draw.y - metrics.actualBoundingBoxAscent + 1];
        } finally { context.restore(); }
      };
      const initialSmall = drawFor('10px monospace');
      const initialLarge = drawFor('20px sans-serif');
      // Both 40px bases consume the 20px free main space, so baseline measurement
      // must use their settled 50px allocations rather than their declared bases.
      expect(initialSmall.x).toBeCloseTo(0, 5);
      expect(initialLarge.x).toBeCloseTo(50, 5);
      expect(baselineAt(initialSmall)).toBeCloseTo(baselineAt(initialLarge), 5);
      const initialHit = glyphPoint(initialSmall);
      click(canvas, initialHit[0], initialHit[1]);
      expect(hits).toEqual(['small']);
      const mounted = snapshotWasmLayoutDiagnostics();

      draws.splice(0);
      growth.set(0);
      leadingMargin.set('auto');
      await nextFrame();
      expect(errors).toEqual([]);
      const autoSmall = drawFor('10px monospace');
      const autoLarge = drawFor('20px sans-serif');
      // Automatic margins are zero for the intrinsic/baseline pass and consume
      // the remaining 20px only after the final main placement is known.
      expect(autoSmall.x).toBeCloseTo(20, 5);
      expect(autoLarge.x).toBeCloseTo(60, 5);
      expect(baselineAt(autoSmall)).toBeCloseTo(baselineAt(autoLarge), 5);
      const autoHit = glyphPoint(autoSmall);
      click(canvas, autoHit[0], autoHit[1]);
      expect(hits).toEqual(['small', 'small']);
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

it.runIf(experimentalLayout)(
  'measures a wrapped first-baseline provider at its final oversized-item shrink allocation',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const shrink = signal(1);
    const widths: number[] = [];
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
    const hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: string; readonly first: number }, BaselineStyle, BaselineStyle, BaselineStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      stamps.set(props.name, useConst(() => ++serial));
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        if (props.name === 'A') widths.push(allocation.width);
        return { status: 'measured' as const, first: props.first, last: props.first };
      },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 140; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent: 'flex-start' }}>
      <Leaf key="A" name="A" first={12} style={{ width: 120, height: 20, minWidth: 0, minHeight: 0, flexBasis: 120, flexGrow: 0, flexShrink: shrink }} />
      <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller);
    await nextFrame();

    expect(boxes.get('A')).toEqual({ x: 0, y: 0, width: 100, height: 20 });
    expect(widths).toContain(100);
    const mounted = snapshotWasmLayoutDiagnostics();
    const initialStamps = Object.fromEntries(stamps);
    click(canvas, 90, 4);
    expect(hits).toEqual(['A']);

    shrink.set(0);
    await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 0, width: 120, height: 20 });
    expect(widths).toContain(120);
    expect(Object.fromEntries(stamps)).toEqual(initialStamps);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
    click(canvas, 110, 4);
    expect(hits).toEqual(['A', 'A']);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
    ]);
  },
);

it.runIf(experimentalLayout)(
  'places a numeric main margin after wrapped first-baseline allocation without replacing its final-width baseline query',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const margin = signal(10);
    const widths: number[] = [];
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
    const hits: string[] = [];
    const errors: unknown[] = [];
    let serial = 0;
    const Leaf = definePrimitive<{ readonly name: string; readonly first: number }, BaselineStyle, BaselineStyle, BaselineStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      stamps.set(props.name, useConst(() => ++serial));
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: '#8a3248', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: ({ props, allocation }) => {
        if (props.name === 'A') widths.push(allocation.width);
        return { status: 'measured' as const, first: props.first, last: props.first };
      },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const receive = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', receive);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent: 'flex-start' }}>
        <Leaf key="A" name="A" first={12} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginLeft: margin }} />
        <Leaf key="B" name="B" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(controller);
      await nextFrame();

      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 10, y: 18, width: 40, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 50, y: 0, width: 40, height: 40 });
      expect(widths).toContain(40);
      const initialStamps = Object.fromEntries(stamps);
      const mounted = snapshotWasmLayoutDiagnostics();
      click(canvas, 14, 22);
      expect(hits).toEqual(['A']);

      margin.set(20);
      await nextFrame();
      expect(errors).toEqual([]);
      expect(boxes.get('A')).toEqual({ x: 20, y: 18, width: 40, height: 20 });
      expect(boxes.get('B')).toEqual({ x: 60, y: 0, width: 40, height: 40 });
      expect(Object.fromEntries(stamps)).toEqual(initialStamps);
      expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(mounted.nodeCreates);
      const beforeOldTarget = hits.length;
      click(canvas, 14, 22);
      expect(hits).toHaveLength(beforeOldTarget);
      click(canvas, 24, 22);
      expect(hits).toEqual(['A', 'A']);

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
