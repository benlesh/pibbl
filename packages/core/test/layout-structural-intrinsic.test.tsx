import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  FocusManagement,
  Flex,
  Rectangle,
  defineLayoutComponent,
  definePrimitive,
  signal,
  measureElement,
  type PibblController,
  type SystemStyle,
  type FlexStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { nativeLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
beforeAll(() => { if (nativeLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
  }));
}

interface BadgeStyle extends SystemStyle {
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly fill?: string;
}
type ResolvedBadgeStyle = BadgeStyle & { readonly width: number; readonly height: number };

it.runIf(nativeLayout)(
  'lets a pure structural wrapper contribute a paired provider automatic minimum without losing keyed ownership',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const minimum = signal(60);
    const siblingFill = signal('#426b61');
    const hits: string[] = [];
    const focused: string[] = [];
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let stamps = 0;
    let intrinsicCalls = 0;
    let descriptions = 0;

    const Leaf = definePrimitive<
      { readonly minimum: typeof minimum; readonly name: string },
      BadgeStyle,
      BadgeStyle,
      ResolvedBadgeStyle
    >((props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++stamps);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle
        keyboardFocusable
        onFocus={() => focused.push(props.name)}
        onClick={() => hits.push(props.name)}
        style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }}
      />;
    }, {
      preserveSignalProps: ['minimum'],
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: ({ props }) => {
        intrinsicCalls++;
        return {
          status: 'measured' as const,
          minContent: { width: props.minimum.get(), height: 20 },
          maxContent: { width: 100, height: 20 },
        };
      },
      measure: ({ constraints }) => ({
        status: 'measured' as const,
        size: { width: constraints.maxWidth, height: 20 },
      }),
    });

    const Badge = defineLayoutComponent((props: {
      readonly minimum: typeof minimum;
      readonly style: BadgeStyle;
    }) => {
      descriptions++;
      return <Leaf key="leaf" name="badge" minimum={props.minimum} style={props.style} />;
    });

    const badge = <Badge key="badge" minimum={minimum} style={{ height: 20, flexShrink: 1, fill: '#19375b' }} />;
    const sibling = <Rectangle
      key="sibling"
      keyboardFocusable
      onFocus={() => focused.push('sibling')}
      onClick={() => hits.push('sibling')}
      style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: siblingFill, cursor: 'pointer' }}
    />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40; document.body.append(canvas);
    const controller = pibbl(canvas, <FocusManagement><Flex style={{ width: 80, height: 20, alignItems: 'flex-start' }}>{[badge, sibling]}</Flex></FocusManagement>);
    controllers.push(controller);
    await nextFrame();

    // Before this bridge the structural child requires an explicit minimum. The slice
    // makes this wrapper use the same bounded paired-provider rule as Leaf itself.
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 60, height: 20, stamp: 1 });
    expect(intrinsicCalls).toBe(1);
    expect(descriptions).toBe(1);
    canvas.focus({ preventScroll: true });
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true }));
    expect(focused).toEqual(['badge', 'sibling']);
    click(canvas, 65, 10); expect(hits).toEqual(['sibling']);

    const initial = snapshotWasmLayoutDiagnostics();
    minimum.set(70); await nextFrame();
    expect(boxes.get('badge')).toEqual({ x: 0, y: 0, width: 70, height: 20, stamp: 1 });
    expect(intrinsicCalls).toBeGreaterThan(1);
    expect(descriptions).toBe(2);
    click(canvas, 65, 10); expect(hits).toEqual(['sibling', 'badge']);
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(initial.nodeCreates);

    await nextFrame();
    const paintDiagnostic = snapshotWasmLayoutDiagnostics();
    const beforePaint = intrinsicCalls;
    siblingFill.set('#a63758'); await nextFrame();
    expect(intrinsicCalls, JSON.stringify({ before: paintDiagnostic, after: snapshotWasmLayoutDiagnostics() })).toBe(beforePaint);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
    ]);
    minimum.set(80); await nextFrame();
    expect(intrinsicCalls).toBe(beforePaint);
  },
);

it.runIf(nativeLayout)(
  'remeasures a structural paired provider at its settled row width before assigning automatic cross size',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let stamps = 0;
    const measuredWidths: number[] = [];

    interface AdaptiveStyle extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedAdaptiveStyle = AdaptiveStyle & { readonly width: number; readonly height: number };

    const AdaptiveLeaf = definePrimitive<
      { readonly name: string }, AdaptiveStyle, AdaptiveStyle, ResolvedAdaptiveStyle
    >((props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++stamps);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ constraints }) => {
        measuredWidths.push(constraints.maxWidth);
        return {
          status: 'measured' as const,
          size: { width: constraints.maxWidth, height: constraints.maxWidth <= 40 ? 40 : 20 },
        };
      },
    });

    const Adaptive = defineLayoutComponent((props: { readonly name: string; readonly style: AdaptiveStyle }) =>
      <AdaptiveLeaf key="leaf" name={props.name} style={props.style} />,
    );
    const adaptive = <Adaptive key="adaptive" name="adaptive" style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />;
    const sibling = <Rectangle key="sibling" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />;
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: 60, height: 60, alignItems: 'flex-start' }}>{[adaptive, sibling]}</Flex>);
    controllers.push(controller);
    await nextFrame();

    expect(boxes.get('adaptive')).toEqual({ x: 0, y: 0, width: 40, height: 40, stamp: 1 });
    expect([...canvas.getContext('2d')!.getImageData(40, 5, 1, 1).data]).toEqual([66, 107, 97, 255]);
    expect(measuredWidths).toContain(60);
    expect(measuredWidths).toContain(40);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
    ]);
  },
);

it.runIf(nativeLayout)(
  'cleans up a failed structural final-width query before later paint, then remounts and detaches provider inputs',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const owner = signal(70);
    const fail = signal(false);
    const show = signal(true);
    const content = signal(20);
    const hits: string[] = [];
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let stamps = 0;
    let calls = 0;
    let laterEvaluations = 0;

    interface FailureStyle extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly minHeight?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedFailureStyle = FailureStyle & { readonly width: number; readonly height: number };

    const Leaf = definePrimitive<
      { readonly content: typeof content; readonly name: string }, FailureStyle, FailureStyle, ResolvedFailureStyle
    >((props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++stamps);
      boxes.set(props.name, { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      preserveSignalProps: ['content'],
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ props, constraints }) => {
        calls++;
        if (fail.get() && constraints.minWidth === constraints.maxWidth) {
          return { status: 'unsupported' as const, reason: 'structural final width unavailable' };
        }
        return {
          status: 'measured' as const,
          size: { width: constraints.maxWidth, height: constraints.maxWidth <= 40 ? props.content.get() : 20 },
        };
      },
    });
    const Badge = defineLayoutComponent((props: { readonly content: typeof content; readonly style: FailureStyle }) =>
      <Leaf key="leaf" name="badge" content={props.content} style={props.style} />,
    );
    function Later({ style: _style }: { style: FailureStyle }) {
      laterEvaluations++;
      const box = useLayoutBox();
      return <Rectangle style={{ width: box.width, height: box.height, fill: '#a63758' }} />;
    }

    const badge = <Badge key="badge" content={content} style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />;
    const sibling = <Rectangle key="sibling" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />;
    const later = <Later key="later" style={{ width: 10, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#a63758' }} />;
    const App = () => <Flex style={{ width: owner, height: 60, alignItems: 'flex-start' }}>{[show.get() ? badge : null, sibling, later]}</Flex>;
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 60; document.body.append(canvas);
    const errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', prevent);
    try {
      const controller = pibbl(canvas, <App />);
      controllers.push(controller);
      await nextFrame();
      const committed = boxes.get('badge');
      const committedLater = laterEvaluations;

      expect(committed).toEqual({ x: 0, y: 0, width: 40, height: 20, stamp: 1 });
      click(canvas, 38, 10); expect(hits).toEqual(['badge']);

      fail.set(true); owner.set(65); await nextFrame();
      expect(errors.some(error => error instanceof Error && error.message.includes('final-width measurement is required but unsupported: structural final width unavailable'))).toBe(true);
      expect(boxes.get('badge')).toEqual(committed);
      expect(laterEvaluations).toBe(committedLater);
      const failedResources = snapshotWasmLayoutDiagnostics();
      expect([failedResources.activeNodes, failedResources.activeArenas, failedResources.cachedMeasurements]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
      ]);
      click(canvas, 38, 10); expect(hits).toEqual(['badge']);

      // The current general render-failure contract tears down component ownership.
      // Recovery explicitly mounts again and creates fresh hook identities.
      fail.set(false); owner.set(70);
      expect(pibbl(canvas, <App />)).toBe(controller);
      await nextFrame();
      expect(boxes.get('badge')).toEqual({ ...committed, stamp: 2 });
      expect(laterEvaluations).toBe(committedLater + 1);
      click(canvas, 38, 10); expect(hits).toEqual(['badge', 'badge']);

      show.set(false); await nextFrame();
      const removedCalls = calls;
      content.set(70); await nextFrame();
      expect(calls).toBe(removedCalls);
      controller.dispose();
      const disposed = snapshotWasmLayoutDiagnostics();
      expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
      ]);
    } finally {
      window.removeEventListener('error', prevent);
    }
  },
);

it.runIf(nativeLayout).each([
  { name: 'reverse row', direction: 'row-reverse' as const, aspectRatio: undefined },
  { name: 'aspect sizing', direction: 'row' as const, aspectRatio: 2 },
])('applies paired intrinsic admission for structural $name', async ({ direction, aspectRatio }) => {
  let calls = 0;
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(() => null, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => {
      calls++;
      return { status: 'measured', minContent: { width: 0, height: 20 }, maxContent: { width: 100, height: 20 } };
    },
    measure: () => ({ status: 'measured', size: { width: 100, height: 20 } }),
  });
  const Badge = defineLayoutComponent(() => <Leaf style={{ height: 20, flexBasis: 80, flexShrink: 1, aspectRatio }} />);
  const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 40; document.body.append(canvas);
  const errors: unknown[] = [];
  const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
  window.addEventListener('error', prevent);
  try {
    controllers.push(pibbl(canvas, <Flex style={{ width: 80, height: 40, flexDirection: direction }}><Badge /></Flex>));
    await nextFrame();
    if (direction === 'row-reverse') {
      expect(calls).toBeGreaterThan(0);
      expect(errors).toHaveLength(0);
    } else {
      expect(calls).toBe(0);
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toContain('an explicit main-axis minimum is required');
    }
  } finally { window.removeEventListener('error', prevent); }
});

it.runIf(nativeLayout)(
  'measures a described known Flex root through a paired leaf at the final outer width',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const owner = signal(80);
    const contentHeight = signal(40);
    const footerFill = signal('#a63758');
    const fail = signal(false);
    let footerRenders = 0;
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let stamps = 0;
    let measurements = 0;
    const rawQueryArenas: number[] = [];
    const rawQueryInstances: number[] = [];

    interface ProviderStyle extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly minHeight?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedProviderStyle = ProviderStyle & { readonly width: number; readonly height: number };
    const Provider = definePrimitive<
      { readonly contentHeight: number }, ProviderStyle, ProviderStyle, ResolvedProviderStyle
    >((_props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++stamps);
      boxes.set('provider', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ props, constraints }) => {
        measurements++;
        if (constraints.maxHeight === Infinity && fail.get()) throw new Error('paired row measurement failed');
        // The new native main query is complete before this unbounded-height
        // provider callback. A mounted root may own its normal region later,
        // but no disposable raw arena may leak into this callback.
        if (constraints.maxHeight === Infinity) {
          const diagnostics = snapshotWasmLayoutDiagnostics();
          rawQueryArenas.push(diagnostics.activeArenas);
          rawQueryInstances.push(diagnostics.wasmInstanceCreates);
        }
        return {
          status: 'measured' as const,
          size: { width: constraints.maxWidth, height: constraints.maxWidth <= 40 ? props.contentHeight : 20 },
        };
      },
    });
    const Footer = definePrimitive<{}, ProviderStyle, ProviderStyle, ResolvedProviderStyle>((_props, style) => {
      footerRenders++;
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++stamps);
      boxes.set('footer', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });

    const provider = <Provider key="provider" contentHeight={contentHeight} style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />;
    const follower = <Rectangle key="follower" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />;
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={{ ...props.style, width: owner.get() }}>{[provider, follower]}</Flex>,
    );
    const card = <Card key="card" style={{ minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }} />;
    const footer = <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: footerFill }} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: owner, height: 80, flexDirection: 'column', alignItems: 'flex-start' }}>{[card, footer]}</Flex>);
    controllers.push(controller);
    await nextFrame();

    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 60, height: 20, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 20, width: 20, height: 20, stamp: 2 });
    expect(rawQueryArenas).toEqual([baseline.activeArenas]);
    expect(rawQueryInstances).toEqual([baseline.wasmInstanceCreates + 1]);
    const mountedArenas = snapshotWasmLayoutDiagnostics().activeArenas;
    const beforeFooterPaint = snapshotWasmLayoutDiagnostics();
    const beforeFooterPaintMeasurements = measurements;
    footerFill.set('#8c3154'); await nextFrame();
    // A footer-only paint input must not repeat the described Card's paired
    // measurement or disposable native main query after aggregate caching.
    expect(measurements).toBe(beforeFooterPaintMeasurements);
    expect(snapshotWasmLayoutDiagnostics().measurementSolves).toBe(beforeFooterPaint.measurementSolves);
    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 60, height: 20, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 20, width: 20, height: 20, stamp: 2 });
    const initialMeasurements = measurements;
    owner.set(60); await nextFrame();
    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 40, height: 40, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 40, width: 20, height: 20, stamp: 2 });
    expect(measurements).toBeGreaterThan(initialMeasurements);
    expect(rawQueryArenas).toEqual([baseline.activeArenas, mountedArenas]);
    expect(rawQueryInstances).toEqual([baseline.wasmInstanceCreates + 1, baseline.wasmInstanceCreates + 1]);

    const beforeNarrowPaint = measurements;
    footerFill.set('#426b61'); await nextFrame();
    expect(measurements).toBe(beforeNarrowPaint);
    const afterResize = measurements;
    contentHeight.set(50); await nextFrame();
    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 40, height: 50, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 50, width: 20, height: 20, stamp: 2 });
    expect(measurements).toBeGreaterThan(afterResize);
    const errors: unknown[] = [];
    const prevent = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault(); };
    window.addEventListener('error', prevent);
    try {
      footerFill.set('#a63758'); await nextFrame();
      const beforeFailure = footerRenders;
      const cachedFailureMeasurements = measurements;
      fail.set(true); await nextFrame();
      expect(measurements).toBeGreaterThan(cachedFailureMeasurements);
      expect(errors).toHaveLength(1);
      expect(String(errors[0])).toContain('paired row measurement failed');
      expect(footerRenders).toBe(beforeFailure);
      const failed = snapshotWasmLayoutDiagnostics();
      expect([failed.activeNodes, failed.activeArenas, failed.cachedMeasurements]).toEqual([
        baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
      ]);
    } finally { window.removeEventListener('error', prevent); }
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
    ]);
  },
);

it.runIf(nativeLayout)('releases a standalone native row query before invoking its provider without a Canvas mount', () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  type Style = SystemStyle & { flexBasis?: number; flexShrink?: number; minWidth?: number; height?: number | 'auto' };
  const Leaf = definePrimitive<{}, Style, Style, SystemStyle>(() => null, {
    resolveStyle: () => ({}),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 20 }, maxContent: { width: 100, height: 20 } }),
    measure: ({ constraints }) => {
      const during = snapshotWasmLayoutDiagnostics();
      expect(during.activeArenas).toBe(baseline.activeArenas);
      expect(during.activeWasmInstances).toBe(baseline.activeWasmInstances);
      expect(constraints).toEqual({ minWidth: 40, maxWidth: 40, minHeight: 0, maxHeight: Infinity });
      return { status: 'measured', size: { width: 40, height: 40 } };
    },
  });
  const result = measureElement(<Flex style={{ width: 60, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
    <Leaf style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto' }} />
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, flexShrink: 0 }} />
  </Flex>, { minWidth: 0, maxWidth: 60, minHeight: 0, maxHeight: Infinity }, {
    measureText: () => { throw new Error('This numeric query must not measure text.'); },
  });
  expect(result).toEqual({ status: 'measured', size: { width: 60, height: 40 } });
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.activeWasmInstances, after.cachedMeasurements]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.activeWasmInstances, baseline.cachedMeasurements,
  ]);
  expect(after.measurementSolves).toBe(baseline.measurementSolves + 1);
  expect(after.wasmInstanceCreates).toBe(baseline.wasmInstanceCreates + 1);
});

it.runIf(nativeLayout)(
  'releases a removed described paired row cache and detaches its provider signal while the parent stays mounted',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const shown = signal(true);
    const content = signal(40);
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let serial = 0;
    let calls = 0;

    interface Style extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly minHeight?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedStyle = Style & { readonly width: number; readonly height: number };
    const Provider = definePrimitive<
      { readonly content: typeof content }, Style, Style, ResolvedStyle
    >((_props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      boxes.set('provider', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      preserveSignalProps: ['content'],
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ props, constraints }) => {
        calls++;
        return {
          status: 'measured' as const,
          size: { width: constraints.maxWidth, height: constraints.maxWidth <= 60 ? props.content.get() : 20 },
        };
      },
    });
    const Footer = definePrimitive<{}, Style, Style, ResolvedStyle>((_props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      boxes.set('footer', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    });
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={{ ...props.style, width: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Provider key="provider" content={content} style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />
        <Rectangle key="fixed" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />
      </Flex>,
    );
    const card = <Card key="card" style={{ minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    const footer = <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />;
    function Scene() {
      return <Flex style={{ width: 80, height: 80, flexDirection: 'column', alignItems: 'flex-start' }}>
        {shown.get() ? card : null}
        {footer}
      </Flex>;
    }

    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    const controller = pibbl(canvas, <Scene />);
    controllers.push(controller);
    await nextFrame();
    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 60, height: 40, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 40, width: 20, height: 20, stamp: 2 });
    const mounted = snapshotWasmLayoutDiagnostics();

    shown.set(false); await nextFrame();
    expect(boxes.get('footer')).toEqual({ x: 0, y: 0, width: 20, height: 20, stamp: 2 });
    const removed = snapshotWasmLayoutDiagnostics();
    expect(removed.activeNodes).toBeLessThan(mounted.activeNodes);
    const callsAfterRemoval = calls;
    content.set(60); await nextFrame();
    expect(calls).toBe(callsAfterRemoval);
    expect(boxes.get('footer')).toEqual({ x: 0, y: 0, width: 20, height: 20, stamp: 2 });
    expect(snapshotWasmLayoutDiagnostics().nodeCreates).toBe(removed.nodeCreates);

    shown.set(true); await nextFrame();
    expect(boxes.get('provider')).toEqual({ x: 0, y: 0, width: 60, height: 60, stamp: 3 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 60, width: 20, height: 20, stamp: 2 });
    expect(calls).toBeGreaterThan(callsAfterRemoval);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
    ]);
    const finalCalls = calls;
    content.set(20); await nextFrame();
    expect(calls).toBe(finalCalls);
  },
);

it.runIf(nativeLayout).each([false, true])(
  'does not cache an untraced nested public measurement (wrapped provider: %s)',
  async (wrappedProvider) => {
    const owner = signal(80);
    const footerFill = signal('#a63758');
    let providerCalls = 0;
    let nestedCalls = 0;

    interface Style extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly minHeight?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedStyle = Style & { readonly width: number; readonly height: number };
    const Nested = definePrimitive<{}, Style, Style, ResolvedStyle>(() => null, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measure: () => {
        nestedCalls++;
        return { status: 'measured' as const, size: { width: 1, height: 1 } };
      },
    });
    const nested = <Nested key="nested" style={{ width: 1, height: 1 }} />;
    const Provider = definePrimitive<{}, Style, Style, ResolvedStyle>((_props, style) => {
      const box = useLayoutBox();
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, {
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ constraints, measureElement }) => {
        providerCalls++;
        const nestedResult = measureElement(nested, { minWidth: 0, maxWidth: 1, minHeight: 0, maxHeight: 1 });
        expect(nestedResult.status).toBe('measured');
        return { status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } };
      },
    });
    const NestedBadge = defineLayoutComponent((props: { readonly style: Style }) => <Provider style={props.style} />);
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={{ ...props.style, width: owner.get(), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        {wrappedProvider ?
          <NestedBadge key="provider" style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} /> :
          <Provider key="provider" style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />}
        <Rectangle key="fixed" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61' }} />
      </Flex>,
    );
    const card = <Card key="card" style={{ minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 80; document.body.append(canvas);
    const controller = pibbl(canvas, <Flex style={{ width: owner, height: 60, flexDirection: 'column', alignItems: 'flex-start' }}>
      {card}
      <Rectangle key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: footerFill }} />
    </Flex>);
    controllers.push(controller);
    await nextFrame();
    expect(providerCalls).toBeGreaterThan(0);
    expect(nestedCalls).toBeGreaterThan(0);
    const beforePaint = snapshotWasmLayoutDiagnostics();
    const providerBeforePaint = providerCalls;
    const nestedBeforePaint = nestedCalls;

    footerFill.set('#426b61'); await nextFrame();
    const afterPaint = snapshotWasmLayoutDiagnostics();
    // `input.measureElement` has no direct-child receiver index. Until it has a
    // replay receipt, aggregate reuse must decline rather than retain its reads.
    expect(providerCalls).toBeGreaterThan(providerBeforePaint);
    expect(nestedCalls).toBeGreaterThan(nestedBeforePaint);
    expect(afterPaint.measurementSolves).toBeGreaterThan(beforePaint.measurementSolves);
    controller.dispose();
  },
);
