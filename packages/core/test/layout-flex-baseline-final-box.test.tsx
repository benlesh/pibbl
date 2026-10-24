import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  Flex,
  Rectangle,
  Text,
  definePrimitive,
  signal,
  type BaselineMeasureInput,
  type BaselinesResult,
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
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: bounds.left + x, clientY: bounds.top + y, bubbles: true, button: 0 }));
}

const appFontUrl = new URL('../../scenarios/src/assets/agent-space-grotesk.woff2', import.meta.url).href;
let nextApplicationFontFamily = 0;

interface FinalStyle extends SystemStyle {
  width?: number; height?: number | 'auto'; minWidth?: number; minHeight?: number;
  flexBasis?: number; flexGrow?: number; flexShrink?: number; aspectRatio?: number; fill?: string;
}
interface FinalProps { readonly name: 'A' | 'B' | 'C'; readonly height?: number | ReturnType<typeof signal<number>>; }

it.runIf(experimentalLayout)(
  'settles a direct ordinary provider width before its automatic cross size and first baseline',
  async () => {
    const naturalHeight = signal(20);
    const boxes = new Map<string, LayoutBox>();
    const stamps = new Map<string, number>();
    const baselineAllocations: LayoutBox[] = [];
    const measureCalls: { minWidth: number; maxWidth: number; maxHeight: number }[] = [];
    const hits: string[] = [];
    let serial = 0;
    const Leaf = definePrimitive<FinalProps, FinalStyle, FinalStyle, FinalStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      stamps.set(props.name, useConst(() => ++serial));
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'A' ? '#8a3248' : '#426b61', cursor: 'pointer' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: ({ props, constraints }) => {
        measureCalls.push({ minWidth: constraints.minWidth, maxWidth: constraints.maxWidth, maxHeight: constraints.maxHeight });
        return { status: 'measured' as const, size: { width: 40, height: typeof props.height === 'number' ? props.height : props.height?.get() ?? 40 } };
      },
      measureBaselines: ({ props, allocation }): BaselinesResult => {
        baselineAllocations.push({ ...allocation });
        const first = props.name === 'A' ? allocation.height - 8 : props.name === 'B' ? 30 : 8;
        return { status: 'measured', first, last: first };
      },
    });
    const a = <Leaf key="A" name="A" height={naturalHeight} style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    const b = <Leaf key="B" name="B" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />;
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const baseline = snapshotWasmLayoutDiagnostics();
    const c = <Leaf key="C" name="C" style={{width:60,height:20,minWidth:0,minHeight:0,flexGrow:0,flexShrink:0}} />;
    const controller = pibbl(canvas, <Flex style={{ width: 100, height: 80, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'first-baseline', alignContent:'flex-start' }}>{[a, b, c]}</Flex>);
    controllers.push(controller);
    await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    expect(baselineAllocations).toContainEqual({ x: 0, y: 0, width: 40, height: 20 });
    expect(measureCalls).toContainEqual({ minWidth: 40, maxWidth: 40, maxHeight: 80 });
    expect(boxes.get('C')).toEqual({x:0,y:40,width:60,height:20});
    const initialStamps = Object.fromEntries(stamps);
    click(canvas, 5, 15); expect(hits).toEqual([]);
    naturalHeight.set(30);
    await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 8, width: 40, height: 30 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    expect(baselineAllocations).toContainEqual({ x: 0, y: 0, width: 40, height: 30 });
    expect(boxes.get('C')).toEqual({x:0,y:40,width:60,height:20});
    expect(Object.fromEntries(stamps)).toEqual(initialStamps);
    click(canvas, 5, 15); expect(hits).toEqual(['A']);
    controller.dispose();
    const disposed=snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes,disposed.activeArenas,disposed.cachedMeasurements,disposed.activeWasmInstances]).toEqual([baseline.activeNodes,baseline.activeArenas,baseline.cachedMeasurements,baseline.activeWasmInstances]);
  },
);

it.runIf(experimentalLayout)(
  'derives a fixed first-baseline content box from final main allocation and aspect ratio',
  async () => {
    const allocations: LayoutBox[] = [];
    const ordinaryMeasure = vi.fn(() => { throw new Error('aspect-derived baseline leaf must not require ordinary measure'); });
    const boxes = new Map<string, LayoutBox>();
    const Aspect = definePrimitive<FinalProps, FinalStyle, FinalStyle, FinalStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle style={{ width: box.width, height: box.height, fill: '#8a3248' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: ordinaryMeasure,
      measureBaselines: ({ allocation }: BaselineMeasureInput<FinalProps, FinalStyle>): BaselinesResult => {
        allocations.push({ ...allocation }); return { status: 'measured', first: 12, last: 12 };
      },
    });
    const Peer = definePrimitive<FinalProps, FinalStyle, FinalStyle, FinalStyle & { readonly width: number; readonly height: number }>((props) => {
      const box = useLayoutBox(); const matrix = useCanvasContext().getTransform();
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height });
      return <Rectangle style={{ width: box.width, height: box.height, fill: '#426b61' }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureBaselines: () => ({ status: 'measured' as const, first: 30, last: 30 }),
    });
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Aspect key="A" name="A" style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, aspectRatio: 2 }} />
      <Peer key="B" name="B" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0 }} />
    </Flex>);
    controllers.push(controller);
    await nextFrame();
    expect(boxes.get('A')).toEqual({ x: 0, y: 18, width: 40, height: 20 });
    expect(boxes.get('B')).toEqual({ x: 40, y: 0, width: 40, height: 40 });
    expect(allocations).toEqual([{ x: 0, y: 0, width: 40, height: 20 }]);
    expect(ordinaryMeasure).not.toHaveBeenCalled();
  },
);


it.runIf(experimentalLayout)(
  'fails before baseline or paint when a settled direct final-cross measurement is unsupported',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const measurements = vi.fn(() => ({ status: 'unsupported' as const, reason: 'final cross unavailable' }));
    const baselines = vi.fn(() => ({ status: 'measured' as const, first: 12, last: 12 }));
    const paints = vi.fn(); const errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    const Bad = definePrimitive<FinalProps, FinalStyle, FinalStyle, FinalStyle & { readonly width: number; readonly height: number }>(() => { paints(); }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: measurements,
      measureBaselines: baselines,
    });
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    window.addEventListener('error', prevent);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
        <Bad name="A" style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      </Flex>);
      controllers.push(controller); await nextFrame();
      expect(errors).toHaveLength(1); expect(String(errors[0])).toMatch(/final cross unavailable/i);
      expect(measurements).toHaveBeenCalled(); expect(baselines).not.toHaveBeenCalled(); expect(paints).not.toHaveBeenCalled();
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally { window.removeEventListener('error', prevent); }
  },
);

it.runIf(experimentalLayout)(
  'aligns an automatic-height generic Text leaf from live Canvas baseline metrics and preserves its glyph hit target',
  async () => {
    const hits: string[] = []; const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const original = context.fillText.bind(context);
    const draws: { text: string; x: number; y: number; font: string }[] = [];
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maxWidth?: number) => {
      const matrix = context.getTransform(); draws.push({ text, x: matrix.e + x, y: matrix.f + y, font: context.font }); original(text, x, y, maxWidth);
    }) as typeof context.fillText);
    const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Text onClick={() => hits.push('small')} style={{ width: 40, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, font: '10px monospace', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#8a3248', cursor: 'pointer' }}>Ag</Text>
      <Text style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'top', fill: '#426b61' }}>Ag</Text>
    </Flex>);
    controllers.push(controller); await nextFrame();
    const small = draws.find(draw => draw.font === '10px monospace')!;
    const large = draws.find(draw => draw.font === '20px sans-serif')!;
    const alphabeticY = (draw: { text: string; y: number; font: string }) => {
      context.save();
      try {
        context.font = draw.font; context.textBaseline = 'top'; const top = context.measureText(draw.text).actualBoundingBoxAscent;
        context.textBaseline = 'alphabetic'; const alphabetic = context.measureText(draw.text).actualBoundingBoxAscent;
        return draw.y + alphabetic - top;
      } finally { context.restore(); }
    };
    expect(alphabeticY(small)).toBeCloseTo(alphabeticY(large), 5);
    context.save(); context.font = small.font; context.textBaseline = 'top'; const metrics = context.measureText(small.text); context.restore();
    click(canvas, small.x - metrics.actualBoundingBoxLeft + 1, small.y - metrics.actualBoundingBoxAscent + 1);
    expect(hits).toEqual(['small']);
  },
);

it.runIf(experimentalLayout)(
  'uses each resolved Canvas textBaseline for a custom-family ellipsis final-box baseline',
  async () => {
    const words = signal('this app family text is deliberately longer than its settled box');
    const hits: string[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!; const original = context.fillText.bind(context);
    const draws: { text: string; x: number; y: number; font: string; baseline: CanvasTextBaseline }[] = [];
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maxWidth?: number) => {
      const matrix = context.getTransform(); draws.push({ text, x: matrix.e + x, y: matrix.f + y, font: context.font, baseline: context.textBaseline }); original(text, x, y, maxWidth);
    }) as typeof context.fillText);
    const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Text onClick={() => hits.push('custom')} style={{ width: 30, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, font: '10px "Pibbl App Font", serif', wrap: false, fit: 'ellipsis', overflow: 'clip', textBaseline: 'middle', fill: '#8a3248', cursor: 'pointer' }}>{words}</Text>
      <Text style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'middle', fill: '#426b61' }}>Ag</Text>
    </Flex>);
    controllers.push(controller); await nextFrame();
    const custom = draws.find(draw => draw.text !== 'Ag')!;
    const peer = draws.find(draw => draw.text === 'Ag')!;
    expect(custom.text.length).toBeGreaterThan(0); expect(custom.text).toContain('...');
    const alphabeticY = (draw: typeof custom) => {
      context.save();
      try { context.font = draw.font; context.textBaseline = draw.baseline; const metric = context.measureText(draw.text); expect(Number.isFinite(metric.alphabeticBaseline)).toBe(true); return draw.y - metric.alphabeticBaseline; }
      finally { context.restore(); }
    };
    expect(alphabeticY(custom)).toBeCloseTo(alphabeticY(peer), 5);
    context.save(); context.font = custom.font; context.textBaseline = custom.baseline; const metrics = context.measureText(custom.text); context.restore();
    click(canvas, custom.x - metrics.actualBoundingBoxLeft + 1, custom.y - metrics.actualBoundingBoxAscent + 1);
    expect(hits).toEqual(['custom']);
    draws.splice(0); words.set('app'); await nextFrame();
    expect(draws.some(draw => draw.text === 'app')).toBe(true);
  },
);

for (const [fit, textBaseline] of [
  ['clip', 'top'], ['squish', 'hanging'], ['clip', 'middle'],
  ['squish', 'alphabetic'], ['clip', 'ideographic'], ['squish', 'bottom'],
] as const) it.runIf(experimentalLayout)(
  `uses a resolved ${fit} Text line with ${textBaseline} Canvas baseline for first-baseline placement`,
  async () => {
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!; const original = context.fillText.bind(context);
    const draws: { text: string; y: number; font: string; baseline: CanvasTextBaseline }[] = [];
    vi.spyOn(context, 'fillText').mockImplementation(((text: string, _x: number, y: number, maxWidth?: number) => {
      const matrix = context.getTransform(); draws.push({ text, y: matrix.f + y, font: context.font, baseline: context.textBaseline }); original(text, _x, y, maxWidth);
    }) as typeof context.fillText);
    const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      <Text style={{ width: 30, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, font: '10px/14px "Pibbl App Font", serif', wrap: false, fit, overflow: 'clip', textBaseline, fill: '#8a3248' }}>a long visible run</Text>
      <Text style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', textBaseline: 'middle', fill: '#426b61' }}>Ag</Text>
    </Flex>);
    controllers.push(controller); await nextFrame();
    const [first, peer] = draws;
    expect(first?.text.length).toBeGreaterThan(0); expect(peer?.text).toBe('Ag');
    const baseline = (draw: NonNullable<typeof first>) => { context.save(); try { context.font = draw.font; context.textBaseline = draw.baseline; return draw.y - context.measureText(draw.text).alphabeticBaseline; } finally { context.restore(); } };
    expect(baseline(first!)).toBeCloseTo(baseline(peer!), 5);
  },
);

it.runIf(experimentalLayout)(
  'rejects an ellipsis allocation that resolves no rendered baseline line before paint',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics(); const errors: unknown[] = [];
    const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!; const fill = vi.spyOn(context, 'fillText');
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); }; window.addEventListener('error', prevent);
    try {
      const controller = pibbl(canvas, <Flex style={{ width: 120, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
        <Text style={{ width: 0, height: 'auto', minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, font: '10px "Pibbl App Font", serif', wrap: false, fit: 'ellipsis', overflow: 'clip', textBaseline: 'middle', fill: '#8a3248' }}>too long</Text>
      </Flex>);
      controllers.push(controller); await nextFrame();
      expect(errors).toHaveLength(1); expect(String(errors[0])).toMatch(/nonempty rendered baseline line/i); expect(fill).not.toHaveBeenCalled();
      controller.dispose(); const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances]);
    } finally { window.removeEventListener('error', prevent); }
  },
);

it.runIf(experimentalLayout)(
  'remeasures a stable custom-family Text baseline when its application-owned face becomes available',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 80; document.body.append(canvas);
    const context = canvas.getContext('2d')!;
    const original = context.fillText.bind(context);
    const draws: Array<{ text: string; x: number; y: number; font: string; baseline: CanvasTextBaseline }> = [];
    const fill = vi.spyOn(context, 'fillText').mockImplementation(((text: string, x: number, y: number, maximum?: number) => {
      const matrix = context.getTransform();
      draws.push({ text, x: matrix.e + x, y: matrix.f + y, font: context.font, baseline: context.textBaseline });
      return maximum === undefined ? original(text, x, y) : original(text, x, y, maximum);
    }) as typeof context.fillText);
    const family = `PibblBaselineApplication${++nextApplicationFontFamily}`;
    const font = `24px "${family}", monospace`;
    const face = new FontFace(family, `url("${appFontUrl}")`);
    const paint = signal('#426b61');
    const stableText = <Text key="custom" style={{ width: 60, height: 40, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, font, wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'middle', fill: '#8a3248' }}>MMMM</Text>;
    const peer = <Text key="peer" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, font: '20px sans-serif', wrap: false, fit: 'visible', overflow: 'visible', textBaseline: 'middle', fill: '#19375b' }}>Ag</Text>;
    const Scene = () => <Flex style={{ width: 180, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      {stableText}{peer}<Rectangle key="paint" style={{ width: 20, height: 20, fill: paint }} />
    </Flex>;
    const alphabeticY = (draw: { text: string; y: number; font: string; baseline: CanvasTextBaseline }) => {
      context.save();
      try { context.font = draw.font; context.textBaseline = draw.baseline; return draw.y - context.measureText(draw.text).alphabeticBaseline; }
      finally { context.restore(); }
    };
    try {
      const controller = pibbl(canvas, <Scene />); controllers.push(controller); await nextFrame();
      const fallbackCustom = draws.find(draw => draw.font.includes(family));
      const fallbackPeer = draws.find(draw => draw.text === 'Ag');
      expect(fallbackCustom).toBeDefined(); expect(fallbackPeer).toBeDefined();
      expect(alphabeticY(fallbackCustom!)).toBeCloseTo(alphabeticY(fallbackPeer!), 5);
      context.save(); context.font = font; const fallbackWidth = context.measureText('MMMM').width; context.restore();
      const before = snapshotWasmLayoutDiagnostics();

      document.fonts.add(await face.load());
      context.save(); context.font = font; const loadedWidth = context.measureText('MMMM').width; context.restore();
      expect(Math.abs(loadedWidth - fallbackWidth)).toBeGreaterThan(1);
      draws.splice(0);
      // The Text descriptor and every Text input stay fixed. This application
      // signal schedules the render that observes its own FontFace readiness.
      paint.set('#6e3e79'); await nextFrame();
      const loadedCustom = draws.find(draw => draw.font.includes(family));
      const loadedPeer = draws.find(draw => draw.text === 'Ag');
      expect(loadedCustom).toBeDefined(); expect(loadedPeer).toBeDefined();
      expect(alphabeticY(loadedCustom!)).toBeCloseTo(alphabeticY(loadedPeer!), 5);
      expect(loadedCustom!.y).not.toBe(fallbackCustom!.y);
      const after = snapshotWasmLayoutDiagnostics();
      expect(after.nodeCreates).toBe(before.nodeCreates);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements, disposed.activeWasmInstances]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
      ]);
    } finally {
      document.fonts.delete(face); fill.mockRestore();
    }
  },
);
