import {
  Absolute,
  Flow,
  Flex,
  Grid,
  Group,
  Layer,
  Overlay,
  Rectangle,
  Text,
  pibbl,
  useCanvasContext,
  useLayoutBox,
  useConst,
  definePrimitive,
  measureElement,
  signal,
  type BoxStyle,
  type PibblController,
  type PibblNode,
  type LayoutBox,
  type LayoutItemStyle,
  type SystemStyle,
} from '@pibbl/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPibblInstance } from '../global-state.js';
import { executeRender } from '../execute-render.js';
import { mountPibbl } from '../mount-pibbl.js';
import { signalGraphSnapshot } from '../signals/graph.js';

interface CardStyle extends BoxStyle, LayoutItemStyle {}

interface CardObservation {
  readonly box: Readonly<LayoutBox>;
  readonly mount: number;
  readonly origin: Readonly<{ x: number; y: number }>;
  readonly style: Readonly<CardStyle>;
}

interface LayoutCapture {
  mounts: number;
  readonly observations: Map<string, CardObservation>;
}

interface CardProps {
  readonly capture: LayoutCapture;
  readonly fill: string;
  readonly name: string;
  readonly overflowPaint?: number;
  readonly style: Readonly<CardStyle>;
}

function Card(props: CardProps): PibblNode {
  const box = useLayoutBox();
  const mount = useConst(() => ++props.capture.mounts);
  const transform = useCanvasContext().getTransform();
  props.capture.observations.set(props.name, {
    box,
    mount,
    origin: { x: transform.e, y: transform.f },
    style: props.style,
  });
  return (
    <Rectangle
      style={{
        width: box.width + (props.overflowPaint ?? 0),
        height: box.height,
        fill: props.fill,
      }}
    />
  );
}

interface RenderLayoutCase {
  readonly name: string;
  readonly expected: Readonly<Record<
    'a' | 'b',
    Readonly<{ x: number; y: number; width: number; height: number }>
  >>;
  readonly expectedReordered?: RenderLayoutCase['expected'];
  readonly insideColor?: readonly [number, number, number, number];
  readonly insideClip: readonly [number, number];
  readonly outsideClip: readonly [number, number];
  build(
    capture: LayoutCapture,
    reverse: boolean,
    execution: { runs: number },
  ): Readonly<{
    node: PibblNode;
    styles: Readonly<Record<'a' | 'b', Readonly<CardStyle>>>;
  }>;
}

const renderLayoutCases: readonly RenderLayoutCase[] = [
  {
    name: 'Absolute',
    expected: {
      a: { x: 10, y: 5, width: 20, height: 15 },
      b: { x: 40, y: 10, width: 15, height: 20 },
    },
    insideColor: [124, 58, 237, 255],
    insideClip: [95, 55],
    outsideClip: [105, 55],
    build(capture, reverse, execution) {
      const styles = {
        a: { left: 10, top: 5, width: 20, height: 15 },
        b: { left: 40, top: 10, width: 15, height: 20 },
      } as const;
      const cards = [
        <Card key="a" capture={capture} fill="#ef4444" name="a" style={styles.a} />,
        <Card key="b" capture={capture} fill="#22c55e" name="b" style={styles.b} />,
      ];
      function* children(): Generator<PibblNode> {
        execution.runs++;
        yield [reverse ? cards.toReversed() : cards, [false, null]];
        yield execution.runs > 0 && (
          <Rectangle
            key="primitive"
            style={{
              left: 90,
              top: 50,
              width: 20,
              height: 20,
              fill: '#7c3aed',
            }}
          />
        );
      }
      return {
        node: (
          <Absolute style={{ width: 100, height: 60, overflow: 'clip' }}>
            {[children(), undefined]}
          </Absolute>
        ),
        styles,
      };
    },
  },
  {
    name: 'Overlay',
    expected: {
      a: { x: 40, y: 25, width: 20, height: 10 },
      b: { x: 70, y: 40, width: 30, height: 20 },
    },
    insideColor: [34, 197, 94, 255],
    insideClip: [95, 45],
    outsideClip: [105, 45],
    build(capture, reverse, execution) {
      const styles = {
        a: { width: 20, height: 10 },
        b: {
          width: 30,
          height: 20,
          justifySelf: 'end',
          alignSelf: 'end',
        },
      } as const;
      const cards = [
        <Card key="a" capture={capture} fill="#ef4444" name="a" style={styles.a} />,
        <Card
          key="b"
          capture={capture}
          fill="#22c55e"
          name="b"
          overflowPaint={20}
          style={styles.b}
        />,
      ];
      function* children(): Generator<PibblNode> {
        execution.runs++;
        yield [[reverse ? cards.toReversed() : cards], false];
        yield (
          <Rectangle
            key="primitive"
            style={{
              width: 5,
              height: 5,
              justifySelf: 'start',
              alignSelf: 'start',
              fill: '#7c3aed',
            }}
          />
        );
      }
      return {
        node: (
          <Overlay
            style={{
              width: 100,
              height: 60,
              overflow: 'clip',
              justifyItems: 'center',
              alignItems: 'center',
            }}
          >
            {[null, children()]}
          </Overlay>
        ),
        styles,
      };
    },
  },
  {
    name: 'Flow',
    expected: {
      a: { x: 0, y: 0, width: 20, height: 15 },
      b: { x: 25, y: 0, width: 30, height: 20 },
    },
    expectedReordered: {
      a: { x: 35, y: 0, width: 20, height: 15 },
      b: { x: 0, y: 0, width: 30, height: 20 },
    },
    insideColor: [124, 58, 237, 255],
    insideClip: [65, 5],
    outsideClip: [75, 5],
    build(capture, reverse, execution) {
      const styles = {
        a: { width: 20, height: 15 },
        b: { width: 30, height: 20 },
      } as const;
      const cards = [
        <Card key="a" capture={capture} fill="#ef4444" name="a" style={styles.a} />,
        <Card key="b" capture={capture} fill="#22c55e" name="b" style={styles.b} />,
      ];
      function* children(): Generator<PibblNode> {
        execution.runs++;
        yield [[reverse ? cards.toReversed() : cards], [false, '']];
        yield (
          <Rectangle
            key="primitive"
            style={{ width: 20, height: 10, fill: '#7c3aed' }}
          />
        );
      }
      return {
        node: (
          <Flow
            style={{
              width: 70,
              height: 40,
              gap: 5,
              alignItems: 'start',
              overflow: 'clip',
            }}
          >
            {[children(), true]}
          </Flow>
        ),
        styles,
      };
    },
  },
  {
    name: 'Flex',
    expected: {
      a: { x: 0, y: 0, width: 20, height: 15 },
      b: { x: 25, y: 0, width: 30, height: 20 },
    },
    expectedReordered: {
      a: { x: 35, y: 0, width: 20, height: 15 },
      b: { x: 0, y: 0, width: 30, height: 20 },
    },
    insideColor: [124, 58, 237, 255],
    insideClip: [65, 5],
    outsideClip: [75, 5],
    build(capture, reverse, execution) {
      const styles = {
        a: { width: 20, height: 15, minWidth: 0, flexShrink: 0 },
        b: { width: 30, height: 20, minWidth: 0, flexShrink: 0 },
      } as const;
      const cards = [
        <Card key="a" capture={capture} fill="#ef4444" name="a" style={styles.a} />,
        <Card key="b" capture={capture} fill="#22c55e" name="b" style={styles.b} />,
      ];
      function* children(): Generator<PibblNode> {
        execution.runs++;
        yield [[reverse ? cards.toReversed() : cards], [false, undefined]];
        yield (
          <Rectangle
            key="primitive"
            style={{
              width: 20,
              height: 10,
              minWidth: 0,
              flexShrink: 0,
              fill: '#7c3aed',
            }}
          />
        );
      }
      return {
        node: (
          <Flex
            style={{
              width: 70,
              height: 40,
              gap: 5,
              alignItems: 'flex-start',
              overflow: 'clip',
            }}
          >
            {[0, children()]}
          </Flex>
        ),
        styles,
      };
    },
  },
  {
    name: 'Grid',
    expected: {
      a: { x: 0, y: 0, width: 20, height: 15 },
      b: { x: 50, y: 30, width: 30, height: 20 },
    },
    insideColor: [124, 58, 237, 255],
    insideClip: [95, 5],
    outsideClip: [105, 5],
    build(capture, reverse, execution) {
      const styles = {
        a: {
          width: 20,
          height: 15,
          gridColumnStart: 1,
          gridRowStart: 1,
        },
        b: {
          width: 30,
          height: 20,
          gridColumnStart: 2,
          gridRowStart: 2,
        },
      } as const;
      const cards = [
        <Card key="a" capture={capture} fill="#ef4444" name="a" style={styles.a} />,
        <Card key="b" capture={capture} fill="#22c55e" name="b" style={styles.b} />,
      ];
      function* children(): Generator<PibblNode> {
        execution.runs++;
        yield [[reverse ? cards.toReversed() : cards], [false, null]];
        yield (
          <Rectangle
            key="primitive"
            style={{
              width: 60,
              height: 10,
              gridColumnStart: 2,
              gridRowStart: 1,
              fill: '#7c3aed',
            }}
          />
        );
      }
      return {
        node: (
          <Grid
            style={{
              width: 100,
              height: 60,
              gridTemplateColumns: [50, 50],
              gridTemplateRows: [30, 30],
              justifyItems: 'start',
              alignItems: 'start',
              overflow: 'clip',
            }}
          >
            {[children(), false]}
          </Grid>
        ),
        styles,
      };
    },
  },
];

interface MeasurementCapture {
  measurements: number;
  renders: number;
  box?: Readonly<LayoutBox>;
}

interface NestedLayoutCase {
  readonly name: 'Flow' | 'Flex' | 'Grid';
  readonly expectedChildMeasurements: number;
  build(children: PibblNode): PibblNode;
}

const nestedLayoutCases: readonly NestedLayoutCase[] = [
  {
    name: 'Flow',
    expectedChildMeasurements: 2,
    build: children => (
      <Flow style={{ width: 'auto', height: 'auto' }}>{children}</Flow>
    ),
  },
  {
    name: 'Flex',
    expectedChildMeasurements: 0,
    build: children => (
      <Flex style={{ width: 'auto', height: 'auto' }}>{children}</Flex>
    ),
  },
  {
    name: 'Grid',
    expectedChildMeasurements: 0,
    build: children => (
      <Grid
        style={{
          width: 'auto',
          height: 'auto',
          gridTemplateColumns: [18],
          gridTemplateRows: [12],
        }}
      >
        {children}
      </Grid>
    ),
  },
];

interface MeasuredProbeProps {
  readonly capture: MeasurementCapture;
}

interface MeasuredProbeStyle extends BoxStyle, LayoutItemStyle {}

function renderMeasuredProbe(
  props: Readonly<MeasuredProbeProps>,
): PibblNode {
  props.capture.renders++;
  const box = useLayoutBox();
  props.capture.box = box;
  return <Rectangle style={{ width: box.width, height: box.height, fill: '#2563eb' }} />;
}

const MeasuredProbe = definePrimitive<
  MeasuredProbeProps,
  MeasuredProbeStyle,
  MeasuredProbeStyle,
  SystemStyle
>(renderMeasuredProbe, {
  resolveStyle: () => ({}),
  measure: ({ props }) => {
    props.capture.measurements++;
    return { status: 'measured', size: { width: 18, height: 12 } };
  },
});

const controllers = new Set<PibblController>();

const signalLayoutCases = [
  {
    name: 'Absolute',
    type: Absolute,
    build() {
      const style = signal({ left: 2, top: 3, width: 20, height: 10 });
      return (
        <Absolute style={{ width: 100, height: 40 }}>
          <Rectangle style={style} />
        </Absolute>
      );
    },
  },
  {
    name: 'Overlay',
    type: Overlay,
    build() {
      const style = signal({ width: 20, height: 10 });
      return (
        <Overlay style={{ width: 100, height: 40 }}>
          <Rectangle style={style} />
        </Overlay>
      );
    },
  },
  {
    name: 'Flow',
    type: Flow,
    build() {
      const style = signal({ width: 20, height: 10 });
      return (
        <Flow style={{ width: 100, height: 40 }}>
          <Rectangle style={style} />
        </Flow>
      );
    },
  },
  {
    name: 'Flex',
    type: Flex,
    build() {
      const style = signal({
        width: 20,
        height: 10,
        minWidth: 0,
        flexShrink: 0,
      });
      return (
        <Flex style={{ width: 100, height: 40 }}>
          <Rectangle style={style} />
        </Flex>
      );
    },
  },
  {
    name: 'Grid',
    type: Grid,
    build() {
      const style = signal({
        width: 20,
        height: 10,
        gridColumnStart: 1,
        gridRowStart: 1,
      });
      return (
        <Grid
          style={{
            width: 100,
            height: 40,
            gridTemplateColumns: [100],
            gridTemplateRows: [40],
          }}
        >
          <Rectangle style={style} />
        </Grid>
      );
    },
  },
] as const;

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('JSX layout boundaries', () => {
  it.each(signalLayoutCases)(
    '$name attributes child style signals only to the child receiver',
    async layoutCase => {
      const baseline = signalGraphSnapshot();
      const canvas = createCanvas();
      controllers.add(pibbl(canvas, layoutCase.build()));
      await nextFrame();
      const refs = Array.from(getPibblInstance(canvas).refs.values());

      expect(refs.find(ref => ref.element.type === layoutCase.type)?.signalConsumer)
        .toBeUndefined();
      expect(refs.find(ref => ref.element.type === Rectangle)?.signalConsumer)
        .toBeDefined();
      expect(signalGraphSnapshot().rendererEdges)
        .toBe(baseline.rendererEdges + 1);
      expect(signalGraphSnapshot().receiverInputProvisions)
        .toBe(baseline.receiverInputProvisions);
    },
  );

  it('attributes intrinsic Text child reads to Text after measurement', async () => {
    const label = signal('measured label');
    const baseline = signalGraphSnapshot();
    const canvas = createCanvas();
    controllers.add(pibbl(canvas, (
      <Flow style={{ width: 200, height: 40 }}>
        <Text style={{ width: 'auto', height: 'auto', fill: 'black' }}>
          {label}
        </Text>
      </Flow>
    )));
    await nextFrame();
    const refs = Array.from(getPibblInstance(canvas).refs.values());

    expect(refs.find(ref => ref.element.type === Flow)?.signalConsumer)
      .toBeUndefined();
    expect(refs.find(ref => ref.element.type === Text)?.signalConsumer)
      .toBeDefined();
    expect(signalGraphSnapshot().rendererEdges)
      .toBe(baseline.rendererEdges + 1);
    expect(signalGraphSnapshot().receiverInputProvisions)
      .toBe(baseline.receiverInputProvisions);
  });

  it('rolls back unclaimed child provisions when layout rendering fails', () => {
    const baseline = signalGraphSnapshot();
    const firstStyle = signal({ width: 20, height: 10 });
    const canvas = createCanvas();
    const controller = mountPibbl(canvas, (
      <Absolute style={{ width: 100, height: 40 }}>
        <Rectangle style={firstStyle} />
        <Rectangle style={{ height: 10 } as never} />
      </Absolute>
    ));
    controllers.add(controller);

    expect(() => executeRender(canvas, 0)).toThrowError(/width/iu);
    const after = signalGraphSnapshot();
    expect(after.rendererEdges).toBe(baseline.rendererEdges);
    expect(after.receiverInputProvisions).toBe(baseline.receiverInputProvisions);
    expect(after.rolledBackReceiverInputProvisions)
      .toBeGreaterThan(baseline.rolledBackReceiverInputProvisions);
  });

  it.each(renderLayoutCases)(
    '$name materializes recursive children once and preserves exact keyed placement',
    async layoutCase => {
      const capture: LayoutCapture = { mounts: 0, observations: new Map() };
      const execution = { runs: 0 };
      const initial = layoutCase.build(capture, false, execution);
      const initialAuthoredStyleKeys = {
        a: Reflect.ownKeys(initial.styles.a),
        b: Reflect.ownKeys(initial.styles.b),
      };
      const initialAuthoredStyleEntries = {
        a: Object.entries(initial.styles.a),
        b: Object.entries(initial.styles.b),
      };
      const canvas = createCanvas();
      const controller = pibbl(canvas, initial.node);
      controllers.add(controller);
      await nextFrame();

      expect(execution.runs).toBe(1);
      expectObservations(
        capture,
        initial.styles,
        layoutCase.expected,
        layoutCase.name,
        initialAuthoredStyleKeys,
        initialAuthoredStyleEntries,
      );
      const initialMounts = new Map(
        [...capture.observations].map(([name, value]) => [name, value.mount]),
      );
      expect(pixel(canvas, ...layoutCase.insideClip)).toEqual(
        layoutCase.insideColor,
      );
      expect(pixel(canvas, ...layoutCase.outsideClip)).toEqual([0, 0, 0, 0]);

      const reordered = layoutCase.build(capture, true, execution);
      const reorderedAuthoredStyleKeys = {
        a: Reflect.ownKeys(reordered.styles.a),
        b: Reflect.ownKeys(reordered.styles.b),
      };
      const reorderedAuthoredStyleEntries = {
        a: Object.entries(reordered.styles.a),
        b: Object.entries(reordered.styles.b),
      };
      pibbl(canvas, reordered.node);
      await nextFrame();

      expect(execution.runs).toBe(2);
      expectObservations(
        capture,
        reordered.styles,
        layoutCase.expectedReordered ?? layoutCase.expected,
        layoutCase.name,
        reorderedAuthoredStyleKeys,
        reorderedAuthoredStyleEntries,
      );
      expect(capture.observations.get('a')!.mount).toBe(initialMounts.get('a'));
      expect(capture.observations.get('b')!.mount).toBe(initialMounts.get('b'));
    },
  );

  it.each([
    {
      name: 'Flow',
      build: (child: PibblNode) => (
        <Flow style={{ width: 100, height: 40, alignItems: 'start' }}>
          {child}
        </Flow>
      ),
    },
    {
      name: 'Flex',
      build: (child: PibblNode) => (
        <Flex style={{ width: 100, height: 40, alignItems: 'flex-start' }}>
          {child}
        </Flex>
      ),
    },
    {
      name: 'Grid',
      build: (child: PibblNode) => (
        <Grid
          style={{
            width: 100,
            height: 40,
            gridTemplateColumns: [100],
            gridTemplateRows: [40],
            justifyItems: 'start',
            alignItems: 'start',
          }}
        >
          {child}
        </Grid>
      ),
    },
  ])('$name reuses one materialization for child measurement and paint', async ({
    name,
    build,
  }) => {
    const capture: MeasurementCapture = { measurements: 0, renders: 0 };
    let generatorRuns = 0;
    function* children(): Generator<PibblNode> {
      generatorRuns++;
      yield [[
        <MeasuredProbe
          style={{
            width: 'auto',
            height: 'auto',
            minWidth: name === 'Flex' ? 0 : undefined,
            flexShrink: name === 'Flex' ? 0 : undefined,
            alignSelf: name === 'Flex' ? 'flex-start' : 'start',
            gridColumnStart: name === 'Grid' ? 1 : undefined,
            gridRowStart: name === 'Grid' ? 1 : undefined,
          }}
          capture={capture}
        />,
      ], false];
    }
    const canvas = createCanvas();
    controllers.add(pibbl(canvas, build(children())));
    await nextFrame();

    expect(generatorRuns).toBe(1);
    expect(capture.measurements).toBe(1);
    expect(capture.renders).toBe(1);
    expect(capture.box).toEqual({ x: 0, y: 0, width: 18, height: 12 });
  });

  it.each(nestedLayoutCases)(
    '$name shares a one-shot child sequence between nested measurement and paint',
    async layoutCase => {
      const capture: MeasurementCapture = { measurements: 0, renders: 0 };
      let generatorRuns = 0;
      function* children(): Generator<PibblNode> {
        generatorRuns++;
        yield nestedMeasuredProbe(layoutCase.name, capture);
      }
      const nested = layoutCase.build(children());
      const canvas = createCanvas();
      controllers.add(pibbl(canvas, outerMeasuringFlow(nested)));
      await nextFrame();

      expect(generatorRuns).toBe(1);
      expect(capture.renders).toBe(1);
      expect(capture.measurements).toBe(
        layoutCase.expectedChildMeasurements,
      );
      expect(capture.box).toEqual({ x: 0, y: 0, width: 18, height: 12 });
    },
  );

  it.each(nestedLayoutCases)(
    '$name isolates a shared descriptor by occurrence while reusing each prepared sequence',
    async layoutCase => {
      const captures = Array.from({ length: 4 }, () => ({
        measurements: 0,
        renders: 0,
      } satisfies MeasurementCapture));
      let iterations = 0;
      const children: Iterable<PibblNode> = {
        [Symbol.iterator]() {
          const capture = captures[iterations++];
          return [nestedMeasuredProbe(layoutCase.name, capture)][Symbol.iterator]();
        },
      };
      const shared = layoutCase.build(children);
      const canvas = createCanvas();
      controllers.add(pibbl(canvas, outerMeasuringFlow([shared, shared])));
      await nextFrame();

      expect(iterations).toBe(2);
      expect(captures.slice(0, 2).map(capture => capture.renders)).toEqual([1, 1]);
      expect(captures.slice(0, 2).map(capture => capture.measurements)).toEqual([
        layoutCase.expectedChildMeasurements,
        layoutCase.expectedChildMeasurements,
      ]);
    },
  );

  it.each(nestedLayoutCases)(
    '$name revalidates a reusable child sequence on later renders and standalone measurements',
    async layoutCase => {
      const captures = Array.from({ length: 6 }, () => ({
        measurements: 0,
        renders: 0,
      } satisfies MeasurementCapture));
      let iterations = 0;
      const children: Iterable<PibblNode> = {
        [Symbol.iterator]() {
          const capture = captures[iterations++];
          return [nestedMeasuredProbe(layoutCase.name, capture)][Symbol.iterator]();
        },
      };
      const shared = layoutCase.build(children);
      const canvas = createCanvas();
      controllers.add(pibbl(canvas, outerMeasuringFlow(shared)));
      await nextFrame();
      pibbl(canvas, outerMeasuringFlow(shared));
      await nextFrame();

      expect(iterations).toBe(2);
      expect(captures.slice(0, 2).map(capture => capture.renders)).toEqual([1, 1]);

      const constraints = {
        minWidth: 0,
        maxWidth: 100,
        minHeight: 0,
        maxHeight: 100,
      };
      const service = {
        measureText: () => ({ width: 0 }) as TextMetrics,
      };
      expect(measureElement(shared as never, constraints, service).status)
        .toBe('measured');
      expect(measureElement(shared as never, constraints, service).status)
        .toBe('measured');

      expect(iterations).toBe(4);
      expect(captures.slice(2, 4).map(capture => capture.renders)).toEqual([0, 0]);
    },
  );

  it.each([
    {
      name: 'Flow',
      build: (children: PibblNode) => (
        <Flow style={{ width: 'auto', height: 'auto' }}>{children}</Flow>
      ),
      expected: { width: 18, height: 12 },
      expectedChildMeasurements: 1,
    },
    {
      name: 'Flex',
      build: (children: PibblNode) => (
        <Flex style={{ width: 'auto', height: 'auto' }}>{children}</Flex>
      ),
      expected: { width: 18, height: 12 },
      expectedChildMeasurements: 0,
    },
    {
      name: 'Grid',
      build: (children: PibblNode) => (
        <Grid
          style={{
            width: 'auto',
            height: 'auto',
            gridTemplateColumns: [18],
            gridTemplateRows: [12],
          }}
        >
          {children}
        </Grid>
      ),
      expected: { width: 18, height: 12 },
      expectedChildMeasurements: 0,
    },
  ])('$name materializes recursive children once during pure measurement', ({
    name,
    build,
    expected,
    expectedChildMeasurements,
  }) => {
    const capture: MeasurementCapture = { measurements: 0, renders: 0 };
    let generatorRuns = 0;
    function* children(): Generator<PibblNode> {
      generatorRuns++;
      yield [[
        <MeasuredProbe
          style={name === 'Flow' ? {
            width: 'auto',
            height: 'auto',
          } : {
            width: 18,
            height: 12,
            minWidth: name === 'Flex' ? 0 : undefined,
            flexShrink: name === 'Flex' ? 0 : undefined,
            gridColumnStart: name === 'Grid' ? 1 : undefined,
            gridRowStart: name === 'Grid' ? 1 : undefined,
          }}
          capture={capture}
        />,
      ], false];
    }

    const result = measureElement(
      build(children()) as never,
      { minWidth: 0, maxWidth: 100, minHeight: 0, maxHeight: 100 },
      { measureText: () => ({ width: 0 }) as TextMetrics },
    );

    expect(result).toEqual({ status: 'measured', size: expected });
    expect(generatorRuns).toBe(1);
    expect(capture.measurements).toBe(expectedChildMeasurements);
    expect(capture.renders).toBe(0);
  });

  it('keeps shared Text occurrences distinct while sharing measurement with paint', async () => {
    let iterations = 0;
    const content: Iterable<string> = {
      [Symbol.iterator]() {
        const value = `occurrence-${++iterations}`;
        return [value][Symbol.iterator]();
      },
    };
    const shared = (
      <Text style={{ width: 'auto', height: 'auto', fill: '#000' }}>
        {content}
      </Text>
    );
    const values: string[] = [];
    vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
      .mockImplementation(value => values.push(value));
    const canvas = createCanvas();
    controllers.add(pibbl(canvas, (
      <Flow style={{ width: 200, height: 40 }}>
        {[shared, shared]}
      </Flow>
    )));
    await nextFrame();

    expect(iterations).toBe(2);
    expect(values).toEqual(['occurrence-1', 'occurrence-2']);
  });

  it('does not execute a retained layout iterable when Layer reuses its snapshot', async () => {
    let generatorRuns = 0;
    function* children(): Generator<PibblNode> {
      generatorRuns++;
      yield <Rectangle style={{ width: 20, height: 10, fill: '#7c3aed' }} />;
    }
    const layout = (
      <Flow style={{ width: 80, height: 40 }}>{children()}</Flow>
    );
    const retainedLayer = <Layer style={{ width: 80, height: 40 }}>{layout}</Layer>;
    const canvas = createCanvas();
    controllers.add(pibbl(canvas, <Group>{retainedLayer}</Group>));
    await nextFrame();
    expect(generatorRuns).toBe(1);
    expect(pixel(canvas, 5, 5)).toEqual([124, 58, 237, 255]);

    pibbl(canvas, <Group>{retainedLayer}</Group>);
    await nextFrame();
    expect(generatorRuns).toBe(1);
  });
});

function expectObservations(
  capture: LayoutCapture,
  styles: Readonly<Record<'a' | 'b', Readonly<CardStyle>>>,
  expected: RenderLayoutCase['expected'],
  layout: RenderLayoutCase['name'],
  authoredStyleKeys: Readonly<Record<'a' | 'b', readonly PropertyKey[]>>,
  authoredStyleEntries: Readonly<Record<
    'a' | 'b',
    readonly (readonly [string, unknown])[]
  >>,
): void {
  for (const name of ['a', 'b'] as const) {
    const observation = capture.observations.get(name)!;
    if (layout === 'Absolute') {
      expect(observation.style).not.toBe(styles[name]);
      expect(Object.isFrozen(observation.style)).toBe(true);
      expect(Object.fromEntries(Object.entries(observation.style))).toEqual(
        Object.fromEntries(authoredStyleEntries[name]),
      );
      expect(Reflect.ownKeys(styles[name])).toEqual(authoredStyleKeys[name]);
      expect(Object.entries(styles[name])).toEqual(authoredStyleEntries[name]);
    } else {
      expect(observation.style).toBe(styles[name]);
    }
    expect(observation.box).toEqual({
      x: 0,
      y: 0,
      width: expected[name].width,
      height: expected[name].height,
    });
    expect(observation.origin).toEqual({
      x: expected[name].x,
      y: expected[name].y,
    });
  }
}

function nestedMeasuredProbe(
  layout: NestedLayoutCase['name'],
  capture: MeasurementCapture,
): PibblNode {
  return (
    <MeasuredProbe
      capture={capture}
      style={layout === 'Flow' ? {
        width: 'auto',
        height: 'auto',
      } : {
        width: 18,
        height: 12,
        minWidth: layout === 'Flex' ? 0 : undefined,
        flexShrink: layout === 'Flex' ? 0 : undefined,
        gridColumnStart: layout === 'Grid' ? 1 : undefined,
        gridRowStart: layout === 'Grid' ? 1 : undefined,
      }}
    />
  );
}

function outerMeasuringFlow(children: PibblNode): PibblNode {
  return (
    <Flow style={{ width: 200, height: 40, alignItems: 'start' }}>
      {children}
    </Flow>
  );
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 130;
  canvas.height = 90;
  canvas.style.width = '130px';
  canvas.style.height = '90px';
  document.body.appendChild(canvas);
  return canvas;
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function pixel(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}
