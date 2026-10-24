import { afterEach, beforeAll, expect, it } from 'vitest';
import {
  Flex,
  Rectangle,
  defineLayoutComponent,
  definePrimitive,
  measureElement,
  signal,
  type FlexStyle,
  type PibblController,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
} from '@pibbl/core';
import { pibblSync as pibbl } from '@pibbl/core/sync';
import { prepareLayoutEngineSync } from '../src/lib/layout/wasm/embedded';
import { experimentalLayout, snapshotWasmLayoutDiagnostics } from '../src/lib/layout/wasm/region';

const controllers: PibblController[] = [];
beforeAll(() => { if (experimentalLayout) prepareLayoutEngineSync(); });
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); document.body.replaceChildren(); });
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function click(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true, button: 0, clientX: bounds.left + x, clientY: bounds.top + y,
  }));
}

it.runIf(experimentalLayout)(
  'measures a paired leaf described inside a measured Flex row at its final width',
  async () => {
    const baseline = snapshotWasmLayoutDiagnostics();
    const owner = signal(80);
    const contentHeight = signal(40);
    const shown = signal(true);
    const hits: string[] = [];
    const boxes = new Map<string, { x: number; y: number; width: number; height: number; stamp: number }>();
    let serial = 0;
    let calls = 0;
    const aggregateWidths: number[] = [];

    interface BadgeStyle extends SystemStyle {
      readonly width?: number;
      readonly height?: number | 'auto';
      readonly minWidth?: number;
      readonly minHeight?: number;
      readonly flexBasis?: number;
      readonly flexGrow?: number;
      readonly flexShrink?: number;
      readonly fill?: string;
    }
    type ResolvedBadgeStyle = BadgeStyle & { readonly width: number; readonly height: number };
    const Leaf = definePrimitive<
      { readonly contentHeight: typeof contentHeight }, BadgeStyle, BadgeStyle, ResolvedBadgeStyle
    >((_props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      boxes.set('leaf', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle onClick={() => hits.push('leaf')} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} />;
    }, {
      preserveSignalProps: ['contentHeight'],
      resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: 'measured' as const,
        minContent: { width: 0, height: 20 },
        maxContent: { width: 100, height: 20 },
      }),
      measure: ({ props, constraints }) => {
        calls++;
        if (constraints.maxHeight === Infinity) {
          expect(constraints.minWidth).toBe(constraints.maxWidth);
          expect(constraints.minHeight).toBe(0);
          aggregateWidths.push(constraints.maxWidth);
        }
        return {
          status: 'measured' as const,
          size: {
            width: constraints.maxWidth,
            height: constraints.maxWidth <= 40 ? props.contentHeight.get() : 20,
          },
        };
      },
    });
    const Badge = defineLayoutComponent((props: { readonly contentHeight: typeof contentHeight; readonly style: BadgeStyle }) =>
      <Leaf key="leaf" contentHeight={props.contentHeight} style={props.style} />,
    );
    const Card = defineLayoutComponent((props: { readonly style: FlexStyle }) =>
      <Flex style={{ ...props.style, width: owner.get(), flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <Badge key="badge" contentHeight={contentHeight} style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto', fill: '#19375b' }} />
        <Rectangle key="follower" onClick={() => hits.push('follower')} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: '#426b61', cursor: 'pointer' }} />
      </Flex>,
    );
    const Footer = definePrimitive<{}, BadgeStyle, BadgeStyle, ResolvedBadgeStyle>((_props, style) => {
      const box = useLayoutBox();
      const matrix = useCanvasContext().getTransform();
      const stamp = useConst(() => ++serial);
      boxes.set('footer', { x: matrix.e, y: matrix.f, width: box.width, height: box.height, stamp });
      return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
    }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
    const card = <Card key="card" style={{ minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />;
    const footer = <Footer key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />;
    function Scene() {
      return <Flex style={{ width: owner, height: 100, flexDirection: 'column', alignItems: 'flex-start' }}>
        {shown.get() ? card : null}
        {footer}
      </Flex>;
    }

    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
    const controller = pibbl(canvas, <Scene />); controllers.push(controller);
    await nextFrame();

    expect(boxes.get('leaf')).toEqual({ x: 0, y: 0, width: 60, height: 20, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 20, width: 20, height: 20, stamp: 2 });
    click(canvas, 65, 10); expect(hits).toEqual(['follower']);
    const initialCalls = calls;

    owner.set(60); await nextFrame();
    expect(boxes.get('leaf')).toEqual({ x: 0, y: 0, width: 40, height: 40, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 40, width: 20, height: 20, stamp: 2 });
    expect(aggregateWidths).toContain(60);
    expect(aggregateWidths).toContain(40);
    expect(calls).toBeGreaterThan(initialCalls);
    click(canvas, 45, 10); expect(hits).toEqual(['follower', 'follower']);
    click(canvas, 35, 10); expect(hits).toEqual(['follower', 'follower', 'leaf']);

    contentHeight.set(50); await nextFrame();
    expect(boxes.get('leaf')).toEqual({ x: 0, y: 0, width: 40, height: 50, stamp: 1 });
    expect(boxes.get('footer')).toEqual({ x: 0, y: 50, width: 20, height: 20, stamp: 2 });

    shown.set(false); await nextFrame();
    const callsAfterRemoval = calls;
    contentHeight.set(70); await nextFrame();
    expect(calls).toBe(callsAfterRemoval);
    controller.dispose();
    const disposed = snapshotWasmLayoutDiagnostics();
    expect([disposed.activeNodes, disposed.activeArenas, disposed.cachedMeasurements]).toEqual([
      baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements,
    ]);
  },
);

it.runIf(experimentalLayout)('preserves cycle detection through a described paired leaf query', () => {
  const baseline = snapshotWasmLayoutDiagnostics();
  const Leaf = definePrimitive<{}, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(() => null, {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: () => ({ status: 'measured', minContent: { width: 0, height: 20 }, maxContent: { width: 100, height: 20 } }),
    measure: ({ constraints, measureElement }) => measureElement(badge, constraints),
  });
  const leaf = <Leaf key="leaf" style={{ flexBasis: 100, flexShrink: 1, minWidth: 0, height: 'auto' }} />;
  const Badge = defineLayoutComponent(() => leaf);
  const badge = <Badge key="badge" />;
  const row = <Flex style={{ width: 80, flexDirection: 'row', alignItems: 'flex-start' }}>
    {badge}
    <Rectangle style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0 }} />
  </Flex>;
  expect(() => measureElement(row, { minWidth: 80, maxWidth: 80, minHeight: 0, maxHeight: Infinity }, { measureText: () => { throw new Error('Numeric query must not measure text.'); } }))
    .toThrow(/cyclic measurement dependency/);
  const after = snapshotWasmLayoutDiagnostics();
  expect([after.activeNodes, after.activeArenas, after.cachedMeasurements, after.activeWasmInstances]).toEqual([
    baseline.activeNodes, baseline.activeArenas, baseline.cachedMeasurements, baseline.activeWasmInstances,
  ]);
});
