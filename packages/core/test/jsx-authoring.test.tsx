import {
  Arc,
  Circle,
  Clip,
  createElement,
  crc,
  useSignal,
  Ellipse,
  Group,
  HorizontalLine,
  Image,
  Layer,
  Line,
  Path,
  Polygon,
  RegularPolygon,
  Rectangle,
  Star,
  SvgPath,
  Text,
  VerticalLine,
  Wedge,
  type ArcProps,
  type ArcStyle,
  type CircleProps,
  type CircleStyle,
  type CRCController,
  type CRCNode,
  type EllipseProps,
  type EllipseStyle,
  type PolygonProps,
  type PolygonStyle,
  type RegularPolygonProps,
  type RegularPolygonStyle,
  type StarProps,
  type StarStyle,
  type TextStyle,
  type WedgeProps,
  type WedgeStyle,
} from '@crc/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface CanvasTraceEntry {
  readonly operation: 'fill' | 'fillText';
  readonly value: string;
  readonly x?: number;
  readonly y?: number;
  readonly fillStyle: string | CanvasGradient | CanvasPattern;
  readonly textAlign?: CanvasTextAlign;
}

const controllers = new Set<CRCController>();

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('public JSX component authoring', () => {
  it('gives JSX and createElement the same scheduled interactive lifecycle', () => {
    const jsxLifecycle = driveInteractiveScene('jsx');
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    const createElementLifecycle = driveInteractiveScene('createElement');

    expect(createElementLifecycle).toEqual(jsxLifecycle);
    expect(jsxLifecycle).toEqual({
      synchronousMountTrace: [],
      initialFrameTrace: expectedTrace('HELLO'),
      synchronousEventTrace: expectedTrace('HELLO'),
      updatedFrameTrace: [
        ...expectedTrace('HELLO'),
        ...expectedTrace('CRC'),
      ],
      disposedTrace: [
        ...expectedTrace('HELLO'),
        ...expectedTrace('CRC'),
      ],
      pendingFramesAfterDisposal: 0,
    });
  });

  it('rejects a CRC element inside Text at runtime', () => {
    let pendingFrame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      pendingFrame = callback;
      return 1;
    });
    const invalid = createElement(
      Text,
      null,
      createElement(Rectangle, {
        style: { width: 10, height: 10 },
      }) as never,
    );
    const controller = crc(createCanvas(), invalid);
    controllers.add(controller);

    expect(() => pendingFrame?.(0)).toThrowError(
      'Text received a CRC element inside textual content as a CRC child.',
    );
  });

  it('types Text content separately from leaf and style input', () => {
    const style: TextStyle = { fill: '#fff' };
    void style;

    // @ts-expect-error TextStyle no longer contains textual content
    const legacyStyle: TextStyle = { text: 'legacy' };
    // @ts-expect-error Rectangle is a leaf and rejects JSX children
    const rectangleWithChild = <Rectangle style={{ width: 10, height: 10 }}>bad</Rectangle>;
    // @ts-expect-error Text rejects CRC elements as textual children
    const textWithElement = <Text><Rectangle style={{ width: 10, height: 10 }} /></Text>;

    expect(legacyStyle).toEqual({ text: 'legacy' });
    expect([rectangleWithChild, textWithElement]).toHaveLength(2);
  });

  it('renders Path style and geometry and dispatches through its event path', async () => {
    const value = new Path2D();
    value.rect(10, 12, 24, 18);
    const onClick = vi.fn();
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <Path style={{ d: value, fill: '#7c3aed' }} onClick={onClick} />
    )));

    await nextFrame();
    expect(pixel(canvas, 20, 20)).toEqual([124, 58, 237, 255]);

    dispatchCanvasClick(canvas, 20, 20);
    dispatchCanvasClick(canvas, 60, 60);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders SvgPath data and updates its browser-parsed geometry', async () => {
    const canvas = createCanvas();
    const controller = crc(canvas, (
      <SvgPath
        style={{ d: 'M 10 10 H 30 V 30 H 10 Z', fill: '#ef4444' }}
      />
    ));
    controllers.add(controller);
    await nextFrame();

    crc(canvas, (
      <SvgPath
        style={{ d: 'M 40 10 H 60 V 30 H 40 Z', fill: '#2563eb' }}
      />
    ));
    await nextFrame();

    expect(pixel(canvas, 20, 20)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas, 50, 20)).toEqual([37, 99, 235, 255]);
  });

  it('renders Line coordinates and uses its expanded interaction geometry', async () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const onClick = vi.fn();
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <Line
        style={{
          coords: [[10, 20], [80, 20]],
          stroke: '#111827',
          strokeWidth: 2,
          lineInteractionWidth: 20,
        }}
        onClick={onClick}
      />
    )));
    await nextFrame();

    expect(moveTo).toHaveBeenLastCalledWith(10, 20);
    expect(lineTo).toHaveBeenLastCalledWith(80, 20);
    dispatchCanvasClick(canvas, 40, 28);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('resolves HorizontalLine geometry against the root allocation', async () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <HorizontalLine
        style={{ y: 25, x1: 5, stroke: '#dc2626', strokeWidth: 1 }}
      />
    )));
    await nextFrame();

    expect(moveTo).toHaveBeenLastCalledWith(5, 25);
    expect(lineTo).toHaveBeenLastCalledWith(240, 25);
  });

  it('resolves VerticalLine geometry against the root allocation', async () => {
    const moveTo = vi.spyOn(Path2D.prototype, 'moveTo');
    const lineTo = vi.spyOn(Path2D.prototype, 'lineTo');
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <VerticalLine
        style={{ x: 35, y1: 7, stroke: '#2563eb', strokeWidth: 1 }}
      />
    )));
    await nextFrame();

    expect(moveTo).toHaveBeenLastCalledWith(35, 7);
    expect(lineTo).toHaveBeenLastCalledWith(35, 120);
  });

  it('invalidates Image generations without confusing the browser constructor', () => {
    class FakeBrowserImage {
      static instances: FakeBrowserImage[] = [];
      readonly naturalWidth = 30;
      readonly naturalHeight = 20;
      readonly width = 30;
      readonly height = 20;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';

      constructor() {
        FakeBrowserImage.instances.push(this);
      }

      removeAttribute(name: string): void {
        if (name === 'src') this.src = '';
      }
    }
    vi.stubGlobal('Image', FakeBrowserImage);
    const drawImage = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      'drawImage',
    ).mockImplementation(() => {});
    const frames = useManualAnimationFrames();
    const canvas = createCanvas();
    const controller = crc(canvas, (
      <Image style={{ src: 'first.png', left: 4, top: 6 }} />
    ));
    controllers.add(controller);
    frames.flushNext();
    const first = FakeBrowserImage.instances[0];
    const savedFirstLoad = first.onload;

    crc(canvas, <Image style={{ src: 'second.png', left: 4, top: 6 }} />);
    frames.flushNext();
    const second = FakeBrowserImage.instances[1];
    second.onload?.();
    frames.flushNext();

    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenLastCalledWith(second, 4, 6, 30, 20);
    savedFirstLoad?.();
    expect(frames.pendingCount()).toBe(0);
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it('clips multiple Clip children with the declared path and fill rule', async () => {
    const clippingPath = new Path2D();
    clippingPath.rect(10, 10, 40, 30);
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <Clip style={{ d: clippingPath, fillRule: 'evenodd' }}>
        <Rectangle style={{ width: 30, height: 50, fill: '#f97316' }} />
        <Rectangle
          style={{ left: 30, width: 30, height: 50, fill: '#0ea5e9' }}
        />
      </Clip>
    )));
    await nextFrame();

    expect(pixel(canvas, 5, 20)).toEqual([0, 0, 0, 0]);
    expect(pixel(canvas, 20, 20)).toEqual([249, 115, 22, 255]);
    expect(pixel(canvas, 40, 20)).toEqual([14, 165, 233, 255]);
    expect(pixel(canvas, 55, 20)).toEqual([0, 0, 0, 0]);
  });

  it('composites Layer children in source order under parent transforms', async () => {
    const onClick = vi.fn();
    const canvas = createCanvas();
    controllers.add(crc(canvas, (
      <Group style={{ translateX: 25, translateY: 15 }}>
        <Layer style={{ width: 80, height: 60 }}>
          <Rectangle style={{ width: 60, height: 40, fill: '#2563eb' }} />
          <Rectangle
            style={{ left: 20, top: 10, width: 40, height: 30, fill: '#ef4444' }}
            onClick={onClick}
          />
        </Layer>
      </Group>
    )));
    await nextFrame();

    expect(pixel(canvas, 30, 20)).toEqual([37, 99, 235, 255]);
    expect(pixel(canvas, 55, 35)).toEqual([239, 68, 68, 255]);
    dispatchCanvasClick(canvas, 55, 35);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('types drawing leaves as childless and Clip and Layer as CRCNode containers', () => {
    const iterable: Iterable<CRCNode> = [
      <Rectangle key="a" style={{ width: 1, height: 1 }} />,
    ];
    const clipContainer = <Clip style={{ d: new Path2D() }}>{iterable}</Clip>;
    const layerContainer = <Layer>{[iterable, false, null]}</Layer>;

    // @ts-expect-error Path is a drawing leaf and rejects children
    const pathWithChild = <Path style={{ d: new Path2D() }}>bad</Path>;
    // @ts-expect-error SvgPath is a drawing leaf and rejects children
    const svgPathWithChild = <SvgPath style={{ d: '' }}>bad</SvgPath>;
    // @ts-expect-error Line is a drawing leaf and rejects children
    const lineWithChild = <Line style={{ coords: [] }}>bad</Line>;
    // @ts-expect-error HorizontalLine is a drawing leaf and rejects children
    const horizontalLineWithChild = <HorizontalLine style={{ y: 0 }}>bad</HorizontalLine>;
    // @ts-expect-error VerticalLine is a drawing leaf and rejects children
    const verticalLineWithChild = <VerticalLine style={{ x: 0 }}>bad</VerticalLine>;
    // @ts-expect-error Image is a drawing leaf and rejects children
    const imageWithChild = <Image style={{ src: 'image.png' }}>bad</Image>;

    expect([
      clipContainer,
      layerContainer,
      pathWithChild,
      svgPathWithChild,
      lineWithChild,
      horizontalLineWithChild,
      verticalLineWithChild,
      imageWithChild,
    ]).toHaveLength(8);
  });

  it('types every standard shape as a childless JSX drawing leaf', () => {
    const circleStyle: CircleStyle = { radius: 12, fill: '#2563eb' };
    const ellipseStyle: EllipseStyle = {
      radiusX: 18,
      radiusY: 9,
      rotation: Math.PI / 8,
      stroke: '#0f172a',
    };
    const arcStyle: ArcStyle = {
      radius: 16,
      startAngle: 0,
      endAngle: Math.PI,
      stroke: '#dc2626',
    };
    const wedgeStyle: WedgeStyle = {
      radius: 20,
      startAngle: 0,
      endAngle: Math.PI / 2,
      fill: '#f97316',
    };
    const polygonStyle: PolygonStyle = {
      coords: [[0, 0], [24, 0], [12, 18]],
      fill: '#16a34a',
    };
    const regularPolygonCircumradiusStyle: RegularPolygonStyle = {
      sides: 6,
      circumradius: 20,
      cornerRadius: 2,
      fill: '#0891b2',
    };
    const regularPolygonInradiusStyle: RegularPolygonStyle = {
      sides: 6,
      inradius: 16,
      cornerRadii: [2, 0],
      fill: '#0891b2',
    };
    const regularPolygonSideLengthStyle: RegularPolygonStyle = {
      sides: 6,
      sideLength: 12,
      fill: '#0891b2',
    };
    const starStyle: StarStyle = {
      points: 5,
      outerRadius: 20,
      innerRadius: 8,
      cornerRadius: 2,
      fill: '#f59e0b',
    };
    const circleProps: CircleProps = { onClick: () => undefined };
    const ellipseProps: EllipseProps = { onClick: () => undefined };
    const arcProps: ArcProps = { onClick: () => undefined };
    const wedgeProps: WedgeProps = { onClick: () => undefined };
    const polygonProps: PolygonProps = { onClick: () => undefined };
    const regularPolygonProps: RegularPolygonProps = { onClick: () => undefined };
    const starProps: StarProps = { onClick: () => undefined };

    const shapes = [
      <Circle {...circleProps} style={circleStyle} />,
      <Ellipse {...ellipseProps} style={ellipseStyle} />,
      <Arc {...arcProps} style={arcStyle} />,
      <Wedge {...wedgeProps} style={wedgeStyle} />,
      <Polygon {...polygonProps} style={polygonStyle} />,
      <RegularPolygon {...regularPolygonProps} style={regularPolygonCircumradiusStyle} />,
      <RegularPolygon {...regularPolygonProps} style={regularPolygonInradiusStyle} />,
      <RegularPolygon {...regularPolygonProps} style={regularPolygonSideLengthStyle} />,
      <Star {...starProps} style={starStyle} />,
    ];

    // @ts-expect-error Circle is a drawing leaf and rejects children
    const circleWithChild = <Circle style={{ radius: 10 }}>bad</Circle>;
    // @ts-expect-error Ellipse is a drawing leaf and rejects children
    const ellipseWithChild = <Ellipse style={{ radiusX: 10, radiusY: 5 }}>bad</Ellipse>;
    // @ts-expect-error Arc is a drawing leaf and rejects children
    const arcWithChild = <Arc style={{ radius: 10, startAngle: 0, endAngle: 1 }}>bad</Arc>;
    // @ts-expect-error Wedge is a drawing leaf and rejects children
    const wedgeWithChild = <Wedge style={{ radius: 10, startAngle: 0, endAngle: 1 }}>bad</Wedge>;
    // @ts-expect-error Polygon is a drawing leaf and rejects children
    const polygonWithChild = <Polygon style={{ coords: [[0, 0], [1, 0], [0, 1]] }}>bad</Polygon>;
    // @ts-expect-error RegularPolygon is a drawing leaf and rejects children
    const regularPolygonWithChild = <RegularPolygon style={{ sides: 3, circumradius: 10 }}>bad</RegularPolygon>;
    // @ts-expect-error Star is a drawing leaf and rejects children
    const starWithChild = <Star style={{ points: 5, outerRadius: 10, innerRadius: 4 }}>bad</Star>;
    // @ts-expect-error Arc is stroke-only and rejects fill paint
    const filledArc = <Arc style={{ radius: 10, startAngle: 0, endAngle: 1, fill: 'red' }} />;
    // @ts-expect-error circular radius excludes auto
    const automaticCircle = <Circle style={{ radius: 'auto' }} />;
    // @ts-expect-error ellipse radii exclude auto
    const automaticEllipse = <Ellipse style={{ radiusX: 'auto', radiusY: 5 }} />;
    // @ts-expect-error Arc radius excludes auto
    const automaticArc = <Arc style={{ radius: 'auto', startAngle: 0, endAngle: 1 }} />;
    // @ts-expect-error Wedge radius excludes auto
    const automaticWedge = <Wedge style={{ radius: 'auto', startAngle: 0, endAngle: 1 }} />;
    // @ts-expect-error Circle requires radius geometry
    const missingCircleGeometry = <Circle style={{ fill: 'red' }} />;
    // @ts-expect-error Ellipse requires both radii
    const missingEllipseGeometry = <Ellipse style={{ radiusX: 10 }} />;
    // @ts-expect-error Arc requires radius and both angles
    const missingArcGeometry = <Arc style={{ stroke: 'red' }} />;
    // @ts-expect-error Wedge requires radius and both angles
    const missingWedgeGeometry = <Wedge style={{ fill: 'red' }} />;
    // @ts-expect-error Polygon requires coordinates
    const missingPolygonGeometry = <Polygon style={{ fill: 'red' }} />;
    // @ts-expect-error RegularPolygon requires exactly one size field
    const missingRegularPolygonSize = <RegularPolygon style={{ sides: 6, fill: 'red' }} />;
    // @ts-expect-error RegularPolygon rejects conflicting size fields
    const conflictingRegularPolygonSize = <RegularPolygon style={{ sides: 6, circumradius: 10, inradius: 8 }} />;
    // @ts-expect-error RegularPolygon rounded corners exclude auto
    const automaticRegularPolygonCorner = <RegularPolygon style={{ sides: 6, circumradius: 10, cornerRadius: 'auto' }} />;
    // @ts-expect-error Star requires both radii
    const missingStarRadii = <Star style={{ points: 5, outerRadius: 10 }} />;
    // @ts-expect-error Star rounded corners exclude auto
    const automaticStarCorner = <Star style={{ points: 5, outerRadius: 10, innerRadius: 4, cornerRadius: 'auto' }} />;

    expect([
      ...shapes,
      circleWithChild,
      ellipseWithChild,
      arcWithChild,
      wedgeWithChild,
      polygonWithChild,
      regularPolygonWithChild,
      starWithChild,
      filledArc,
      automaticCircle,
      automaticEllipse,
      automaticArc,
      automaticWedge,
      missingCircleGeometry,
      missingEllipseGeometry,
      missingArcGeometry,
      missingWedgeGeometry,
      missingPolygonGeometry,
      missingRegularPolygonSize,
      conflictingRegularPolygonSize,
      automaticRegularPolygonCorner,
      missingStarRadii,
      automaticStarCorner,
    ]).toHaveLength(31);
  });
});

function observeCanvasTrace(): CanvasTraceEntry[] {
  const trace: CanvasTraceEntry[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fill')
    .mockImplementation(function (this: CanvasRenderingContext2D) {
      trace.push({
        operation: 'fill',
        value: 'rectangle',
        fillStyle: this.fillStyle,
      });
    });
  vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')
    .mockImplementation(function (
      this: CanvasRenderingContext2D,
      value: string,
      x: number,
      y: number,
    ) {
      trace.push({
        operation: 'fillText',
        value,
        x,
        y,
        fillStyle: this.fillStyle,
        textAlign: this.textAlign,
      });
    });
  return trace;
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 120;
  document.body.appendChild(canvas);
  return canvas;
}

type AuthoringMode = 'createElement' | 'jsx';

function driveInteractiveScene(authoring: AuthoringMode) {
  const frames = useManualAnimationFrames();
  const trace = observeCanvasTrace();
  const canvas = createCanvas();
  const controller = crc(canvas, interactiveScene(authoring));
  const synchronousMountTrace = trace.slice();

  frames.flushNext();
  const initialFrameTrace = trace.slice();

  dispatchCanvasClick(canvas, 20, 20);
  const synchronousEventTrace = trace.slice();

  frames.flushNext();
  const updatedFrameTrace = trace.slice();

  controller.dispose();
  controller.dispose();
  dispatchCanvasClick(canvas, 20, 20);

  return {
    synchronousMountTrace,
    initialFrameTrace,
    synchronousEventTrace,
    updatedFrameTrace,
    disposedTrace: trace.slice(),
    pendingFramesAfterDisposal: frames.pendingCount(),
  };
}

function interactiveScene(authoring: AuthoringMode): CRCNode {
  function Poster(_props: { readonly children?: never }): CRCNode {
    const message = useSignal('HELLO');
    const rectangleProps = {
      style: { width: 240, height: 120, fill: '#1f4bd8' } as const,
      onClick: () => message.set('CRC'),
    };
    const textStyle = {
      x: 120,
      y: 48,
      fill: '#fff',
      textAlign: 'center',
    } as const;

    return authoring === 'jsx' ? (
      <Group>
        <Rectangle {...rectangleProps} />
        <Text style={textStyle}>{message.get()} {0}</Text>
      </Group>
    ) : createElement(Group, null, [
      createElement(Rectangle, rectangleProps),
      createElement(Text, { style: textStyle }, message.get(), ' ', 0),
    ]);
  }

  return authoring === 'jsx' ? <Poster /> : createElement(Poster, {});
}

function expectedTrace(message: string): CanvasTraceEntry[] {
  return [
    {
      operation: 'fill',
      value: 'rectangle',
      fillStyle: '#1f4bd8',
    },
    {
      operation: 'fillText',
      value: `${message} 0`,
      x: 120,
      y: 48,
      fillStyle: '#ffffff',
      textAlign: 'center',
    },
  ];
}

function dispatchCanvasClick(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
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

function useManualAnimationFrames() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = nextId++;
    pending.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id);
  });

  return {
    flushNext() {
      const next = pending.entries().next().value as
        [number, FrameRequestCallback] | undefined;
      if (!next) throw new Error('Expected a pending animation frame.');
      pending.delete(next[0]);
      next[1](performance.now());
    },
    pendingCount: () => pending.size,
  };
}
