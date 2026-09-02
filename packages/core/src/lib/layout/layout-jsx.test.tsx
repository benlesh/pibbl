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
  crc,
  crcCanvasContext,
  crcLayoutBox,
  crcMemo,
  definePrimitive,
  measureElement,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type LayoutBox,
  type LayoutItemStyle,
  type SystemStyle,
} from '@crc/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function Card(props: CardProps): CRCNode {
  const box = crcLayoutBox();
  const mount = crcMemo(() => ++props.capture.mounts, []);
  const transform = crcCanvasContext().getTransform();
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
    node: CRCNode;
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
      function* children(): Generator<CRCNode> {
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
      function* children(): Generator<CRCNode> {
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
      function* children(): Generator<CRCNode> {
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
      function* children(): Generator<CRCNode> {
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
      function* children(): Generator<CRCNode> {
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

interface MeasuredProbeProps {
  readonly capture: MeasurementCapture;
}

interface MeasuredProbeStyle extends BoxStyle, LayoutItemStyle {}

function renderMeasuredProbe(
  props: Readonly<MeasuredProbeProps>,
): CRCNode {
  props.capture.renders++;
  const box = crcLayoutBox();
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

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('JSX layout boundaries', () => {
  it.each(renderLayoutCases)(
    '$name materializes recursive children once and preserves exact keyed placement',
    async layoutCase => {
      const capture: LayoutCapture = { mounts: 0, observations: new Map() };
      const execution = { runs: 0 };
      const initial = layoutCase.build(capture, false, execution);
      const canvas = createCanvas();
      const controller = crc(canvas, initial.node);
      controllers.add(controller);
      await nextFrame();

      expect(execution.runs).toBe(1);
      expectObservations(capture, initial.styles, layoutCase.expected);
      const initialMounts = new Map(
        [...capture.observations].map(([name, value]) => [name, value.mount]),
      );
      expect(pixel(canvas, ...layoutCase.insideClip)).toEqual(
        layoutCase.insideColor,
      );
      expect(pixel(canvas, ...layoutCase.outsideClip)).toEqual([0, 0, 0, 0]);

      const reordered = layoutCase.build(capture, true, execution);
      crc(canvas, reordered.node);
      await nextFrame();

      expect(execution.runs).toBe(2);
      expectObservations(
        capture,
        reordered.styles,
        layoutCase.expectedReordered ?? layoutCase.expected,
      );
      expect(capture.observations.get('a')!.mount).toBe(initialMounts.get('a'));
      expect(capture.observations.get('b')!.mount).toBe(initialMounts.get('b'));
    },
  );

  it.each([
    {
      name: 'Flow',
      build: (child: CRCNode) => (
        <Flow style={{ width: 100, height: 40, alignItems: 'start' }}>
          {child}
        </Flow>
      ),
    },
    {
      name: 'Flex',
      build: (child: CRCNode) => (
        <Flex style={{ width: 100, height: 40, alignItems: 'flex-start' }}>
          {child}
        </Flex>
      ),
    },
    {
      name: 'Grid',
      build: (child: CRCNode) => (
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
    function* children(): Generator<CRCNode> {
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
    controllers.add(crc(canvas, build(children())));
    await nextFrame();

    expect(generatorRuns).toBe(1);
    expect(capture.measurements).toBe(1);
    expect(capture.renders).toBe(1);
    expect(capture.box).toEqual({ x: 0, y: 0, width: 18, height: 12 });
  });

  it.each([
    {
      name: 'Flow',
      build: (children: CRCNode) => (
        <Flow style={{ width: 'auto', height: 'auto' }}>{children}</Flow>
      ),
      expected: { width: 18, height: 12 },
      expectedChildMeasurements: 1,
    },
    {
      name: 'Flex',
      build: (children: CRCNode) => (
        <Flex style={{ width: 'auto', height: 'auto' }}>{children}</Flex>
      ),
      expected: { width: 18, height: 12 },
      expectedChildMeasurements: 0,
    },
    {
      name: 'Grid',
      build: (children: CRCNode) => (
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
    function* children(): Generator<CRCNode> {
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
    controllers.add(crc(canvas, (
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
    function* children(): Generator<CRCNode> {
      generatorRuns++;
      yield <Rectangle style={{ width: 20, height: 10, fill: '#7c3aed' }} />;
    }
    const layout = (
      <Flow style={{ width: 80, height: 40 }}>{children()}</Flow>
    );
    const retainedLayer = <Layer style={{ width: 80, height: 40 }}>{layout}</Layer>;
    const canvas = createCanvas();
    controllers.add(crc(canvas, <Group>{retainedLayer}</Group>));
    await nextFrame();
    expect(generatorRuns).toBe(1);
    expect(pixel(canvas, 5, 5)).toEqual([124, 58, 237, 255]);

    crc(canvas, <Group>{retainedLayer}</Group>);
    await nextFrame();
    expect(generatorRuns).toBe(1);
  });
});

function expectObservations(
  capture: LayoutCapture,
  styles: Readonly<Record<'a' | 'b', Readonly<CardStyle>>>,
  expected: RenderLayoutCase['expected'],
): void {
  for (const name of ['a', 'b'] as const) {
    const observation = capture.observations.get(name)!;
    expect(observation.style).toBe(styles[name]);
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
