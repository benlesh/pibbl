import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  FocusManagement,
  Flex,
  Rectangle,
  Text,
  createElement,
  definePrimitive,
  signal,
  type LayoutBox,
  type BaselineMeasureInput,
  type BaselinesResult,
  type SystemStyle,
  useCanvasContext,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import {
  experimentalLayout,
  snapshotWasmLayoutDiagnostics,
} from '../src/lib/layout/wasm/region';

const controllers: { dispose(): void }[] = [];
beforeAll(() => {
  if (experimentalLayout) prepareLayoutEngineSync();
});
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      clientX: bounds.left + x,
      clientY: bounds.top + y,
      bubbles: true,
      button: 0,
    }));
  }
}

interface BaselineStyle extends SystemStyle {
  width?: number;
  height?: number;
  fill?: string;
  minWidth?: number;
  minHeight?: number;
  flexBasis?: number;
  flexGrow?: number;
  flexShrink?: number;
}
interface BaselineProps {
  readonly name: string;

}

it.runIf(experimentalLayout)(
  'aligns direct fixed primitive leaves on their measured first baseline without losing ownership',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const cjkFirst = signal(30);
    const latinInk = signal('#19375b');
    const hits: string[] = [];
    const focused: string[] = [];
    const boxes = new Map<string, LayoutBox>();
    const allocations: LayoutBox[] = [];
    const latinBaselines = vi.fn(() => ({ status: 'measured' as const, first: 12, last: 12 }));
    const cjkBaselines = vi.fn((input: { allocation: Readonly<LayoutBox> }) => {
      allocations.push({ ...input.allocation });
      return { status: 'measured' as const, first: cjkFirst.get(), last: cjkFirst.get() };
    });
    const Leaf = (measureBaselines: (input: BaselineMeasureInput<BaselineProps, BaselineStyle>) => BaselinesResult) => definePrimitive<
      BaselineProps,
      BaselineStyle,
      BaselineStyle,
      BaselineStyle & { width: number; height: number }
    >((props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle
        keyboardFocusable
        onFocus={() => focused.push(props.name)}
        onClick={() => hits.push(props.name)}
        style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }}
      />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines,
    });
    const Latin = Leaf(latinBaselines);
    const Cjk = Leaf(cjkBaselines);
    const latinNode = createElement(Latin, {
      key: 'latin', name: 'latin',
      style: { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: latinInk },
    });
    const cjkNode = createElement(Cjk, {
      key: 'cjk', name: 'cjk',
      style: { width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#a63758' },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 120; canvas.height = 60; document.body.append(canvas);
    const controller = pibbl(canvas, <FocusManagement><Flex style={{
      width: 120,
      height: 60,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: 'first-baseline',
    }}>{[latinNode, cjkNode]}</Flex></FocusManagement>);
    controllers.push(controller);
    await nextFrame();

    expect(boxes.get('latin')).toEqual({ x: 0, y: 18, width: 40, height: 20 });
    expect(boxes.get('cjk')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    expect(allocations).toEqual([{ x: 0, y: 0, width: 40, height: 40 }]);
    expect(latinBaselines).toHaveBeenCalledTimes(1);
    expect(cjkBaselines).toHaveBeenCalledTimes(1);

    canvas.blur(); canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['latin', 'cjk']);
    click(canvas, 5, 20);
    expect(hits).toEqual(['latin']);

    const initial = snapshotWasmLayoutDiagnostics();
    cjkFirst.set(34); await nextFrame();
    expect(boxes.get('latin')).toEqual({ x: 0, y: 22, width: 40, height: 20 });
    expect(boxes.get('cjk')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    click(canvas, 5, 20);
    expect(hits).toEqual(['latin']);
    click(canvas, 5, 24);
    expect(hits).toEqual(['latin', 'latin']);
    const afterBaseline = snapshotWasmLayoutDiagnostics();
    expect(afterBaseline.nodeCreates).toBe(initial.nodeCreates);
    expect(cjkBaselines).toHaveBeenCalledTimes(2);

    // Settle the explicit input/focus render requested by the preceding clicks.
    await nextFrame();
    const beforeLatinPaintCalls = latinBaselines.mock.calls.length;
    const beforePaintCalls = cjkBaselines.mock.calls.length;
    const beforePaint = snapshotWasmLayoutDiagnostics();
    latinInk.set('#6e9d35'); await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.nodeCreates).toBe(afterBaseline.nodeCreates);
    expect(latinBaselines).toHaveBeenCalledTimes(beforeLatinPaintCalls + 1);
    expect(cjkBaselines).toHaveBeenCalledTimes(beforePaintCalls);
    expect(afterPaint.solves).toBe(beforePaint.solves);
    expect(afterPaint.crossPlacements).toBe(beforePaint.crossPlacements);

    controller.dispose();
    const afterDispose = snapshotWasmLayoutDiagnostics();
    expect(afterDispose.activeNodes).toBe(baseline.activeNodes);
    expect(afterDispose.activeArenas).toBe(baseline.activeArenas);
    expect(afterDispose.cachedMeasurements).toBe(baseline.cachedMeasurements);
  },
);

it.runIf(experimentalLayout)(
  'uses the bottom edge only when a direct fixed leaf omits the baseline capability',
  async () => {
    const boxes = new Map<string, LayoutBox>();
    const Measured = definePrimitive<{ name: string }, BaselineStyle, BaselineStyle, BaselineStyle & { width: number; height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 12, last: 12 }),
    });
    const Missing = definePrimitive<{ name: string }, BaselineStyle, BaselineStyle, BaselineStyle & { width: number; height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 60; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 120, height: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      {[
        createElement(Measured, { key: 'measured', name: 'measured', style: { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 } }),
        createElement(Missing, { key: 'missing', name: 'missing', style: { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 } }),
      ]}
    </Flex>); controllers.push(controller); await nextFrame();
    expect(boxes.get('measured')).toEqual({ x: 0, y: 8, width: 40, height: 20 });
    expect(boxes.get('missing')).toEqual({ x: 40, y: 0, width: 40, height: 20 });
  },
);

it.runIf(experimentalLayout)(
  'fails before paint when a declared baseline provider is unsupported', async () => {
    const paints = vi.fn();
    const Bad = definePrimitive<{}, BaselineStyle, BaselineStyle, BaselineStyle & { width: number; height: number }>(() => { paints(); }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'unsupported' as const, reason: 'not this allocation' }),
    });
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 60; document.body.append(canvas);
    const errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', prevent);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 120, height: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
        {createElement(Bad, { style: { width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 } })}
      </Flex>);
      controllers.push(controller); await nextFrame();
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toMatch(/baseline.*not this allocation/i);
      expect(paints).not.toHaveBeenCalled();
    } finally { window.removeEventListener('error', prevent); }
  },
);

it.runIf(experimentalLayout)('rejects invalid baseline results and impure providers before paint with exact cleanup', async () => {
  const writeProbe = signal(0);
  const failures: readonly { name: string; provide: () => BaselinesResult; message: RegExp }[] = [
    { name: 'NaN', provide: () => ({status:'measured',first:NaN,last:0}), message: /baselines must be finite/ },
    { name: 'infinite', provide: () => ({status:'measured',first:0,last:Infinity}), message: /baselines must be finite/ },
    { name: 'reversed', provide: () => ({status:'measured',first:12,last:11}), message: /first not after last/ },
    { name: 'write', provide: () => { writeProbe.set(1); return {status:'measured',first:0,last:0}; }, message: /Signal writes are forbidden/ },
    { name: 'context hook', provide: () => { useCanvasContext(); return {status:'measured',first:0,last:0}; }, message: /context/i },
  ];
  for (const failure of failures) {
    const baseline = snapshotWasmLayoutDiagnostics(), paints = vi.fn(), errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Bad = definePrimitive<{}, BaselineStyle, BaselineStyle, BaselineStyle & {width:number;height:number}>(() => { paints(); }, {
      resolveStyle: (style, context) => ({...style,width:context.allocation.width,height:context.allocation.height}),
      measureBaselines: failure.provide,
    });
    const canvas = document.createElement('canvas'); canvas.width=120;canvas.height=60;document.body.append(canvas);
    window.addEventListener('error', prevent);
    try {
      const controller = pibbl(canvas,<Flex style={{width:120,height:60,alignItems:'first-baseline'}}>
        <Bad style={{width:40,height:20,flexBasis:40,flexGrow:0,flexShrink:0,minWidth:0,minHeight:0}} />
      </Flex>); controllers.push(controller); await nextFrame();
      expect(errors,failure.name).toHaveLength(1); expect(String(errors[0]),failure.name).toMatch(failure.message);
      expect(paints,failure.name).not.toHaveBeenCalled(); expect(writeProbe.get()).toBe(0);
      controller.dispose();
      const disposed=snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances],failure.name).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements,baseline.activeWasmInstances]);
    } finally { window.removeEventListener('error',prevent); canvas.remove(); }
  }
});

it.runIf(!experimentalLayout)('keeps first-baseline alignment explicitly experimental without evaluating providers', async () => {
  const measureBaselines=vi.fn(()=>({status:'measured' as const,first:12,last:12})), paints=vi.fn(), errors:unknown[]=[];
  const Bad=definePrimitive<{},BaselineStyle,BaselineStyle,BaselineStyle&{width:number;height:number}>(()=>{paints();},{resolveStyle:(style,context)=>({...style,width:context.allocation.width,height:context.allocation.height}),measureBaselines});
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=60;document.body.append(canvas);
  const prevent=(event:ErrorEvent)=>{errors.push(event.error);event.preventDefault();};window.addEventListener('error',prevent);
  try{const controller=pibbl(canvas,<Flex style={{width:120,height:60,alignItems:'first-baseline'}}><Bad style={{width:40,height:20,flexBasis:40,minWidth:0,minHeight:0,flexShrink:0}} /></Flex>);controllers.push(controller);await nextFrame();expect(errors).toHaveLength(1);expect(String(errors[0])).toMatch(/alignItems/);expect(measureBaselines).not.toHaveBeenCalled();expect(paints).not.toHaveBeenCalled();}finally{window.removeEventListener('error',prevent);}
});


it.runIf(experimentalLayout)(
  'aligns fixed unwrapped Text leaves from their live Canvas top-baseline metrics',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const words = signal('Ag');
    const font = signal('10px monospace');
    const decoration = signal('#557a8b');
    const hits: string[] = [];
    const focused: string[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 240; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    interface Draw { readonly text: string; readonly x: number; readonly y: number; readonly font: string; }
    const draws: Draw[] = [];
    const originalFillText = context.fillText.bind(context);
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maxWidth?: number) => {
      const transform = context.getTransform();
      draws.push({ text, x: transform.e + x, y: transform.f + y, font: context.font });
      originalFillText(text, x, y, maxWidth);
    }) as typeof context.fillText);
    const small = createElement(Text, {
      key: 'small', children: words, keyboardFocusable: true,
      onFocus: () => focused.push('small'), onClick: () => hits.push('small'),
      style: { width: 60, height: 32, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, font, wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#19375b', cursor: 'pointer' },
    });
    const large = createElement(Text, {
      key: 'large', children: 'Ag', keyboardFocusable: true,
      onFocus: () => focused.push('large'), onClick: () => hits.push('large'),
      style: { width: 80, height: 32, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#a63758', cursor: 'pointer' },
    });
    const accent = createElement(Rectangle, {
      key: 'accent', pointerEvents: 'none',
      style: { width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: decoration },
    });
    const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 240, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>{[small, large, accent]}</Flex></FocusManagement>);
    controllers.push(controller);
    await nextFrame();

    const firstDraw = (expectedFont: string) => draws.find(draw => draw.font === expectedFont)!;
    const topToAlphabetic = (draw: Draw) => {
      context.save();
      try {
        context.font = draw.font;
        context.textBaseline = 'top';
        const top = context.measureText(draw.text).actualBoundingBoxAscent;
        context.textBaseline = 'alphabetic';
        const alphabetic = context.measureText(draw.text).actualBoundingBoxAscent;
        expect(Number.isFinite(top)).toBe(true);
        expect(Number.isFinite(alphabetic)).toBe(true);
        return alphabetic - top;
      } finally { context.restore(); }
    };
    const smallInitial = firstDraw('10px monospace');
    const largeInitial = firstDraw('20px sans-serif');
    expect(smallInitial.y + topToAlphabetic(smallInitial)).toBeCloseTo(largeInitial.y + topToAlphabetic(largeInitial), 5);

    canvas.blur(); canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['small', 'large']);
    context.save(); context.font = smallInitial.font; context.textBaseline = 'top';
    const initialMetrics = context.measureText(smallInitial.text); context.restore();
    click(canvas, smallInitial.x - initialMetrics.actualBoundingBoxLeft + 1, smallInitial.y - initialMetrics.actualBoundingBoxAscent + 1);
    expect(hits).toEqual(['small']);

    const beforeFont = snapshotWasmLayoutDiagnostics();
    draws.splice(0);
    font.set('16px monospace'); words.set('B'); await nextFrame();
    const smallUpdated = firstDraw('16px monospace');
    const largeUpdated = firstDraw('20px sans-serif');
    expect(smallUpdated.y).not.toBeCloseTo(smallInitial.y, 5);
    expect(smallUpdated.y + topToAlphabetic(smallUpdated)).toBeCloseTo(largeUpdated.y + topToAlphabetic(largeUpdated), 5);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(beforeFont.nodeCreates);
    context.save(); context.font = smallUpdated.font; context.textBaseline = 'top';
    const updatedMetrics = context.measureText(smallUpdated.text); context.restore();
    click(canvas, smallUpdated.x - updatedMetrics.actualBoundingBoxLeft + 1, smallUpdated.y - updatedMetrics.actualBoundingBoxAscent + 1);
    expect(hits).toEqual(['small', 'small']);

    await nextFrame();
    const beforePaint = snapshotWasmLayoutDiagnostics();
    decoration.set('#9f7d35'); await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    expect(afterPaint.nodeCreates).toBe(beforePaint.nodeCreates);
    expect(afterPaint.solves).toBe(beforePaint.solves);
    expect(afterPaint.crossPlacements).toBe(beforePaint.crossPlacements);

    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements]);
  },
);
