import type {
  CRCAnimationProgram,
  CRCBlurFilter,
  CRCBrightnessFilter,
  CRCContrastFilter,
  CRCController,
  CRCDropShadowFilter,
  CRCElement,
  CRCFilter,
  CRCGrayscaleFilter,
  CRCHueRotateFilter,
  CRCInvertFilter,
  CRCNode,
  CRCOpacityFilter,
  CRCSaturateFilter,
  CRCSepiaFilter,
  CRCTextChild,
  Signal,
  SystemStyle,
} from '@crc/core';
import {
  Absolute,
  Flex,
  Flow,
  Grid,
  Group,
  Overlay,
  RegularPolygon,
  Rectangle,
  Star,
  Text,
  computed,
  createElement,
  crc,
  crcPlayback,
  crcSignal,
  crcTransition,
  definePrimitive,
  isSignal,
  marker,
  signal,
  sequence,
  spring,
  track,
  tween,
  untracked,
} from '@crc/core';
import {
  Cube,
  Group3D,
  Mesh,
  Sphere,
  WebGLLayer,
  createWebGLGeometry,
  type CRCWebGLPerspectiveCamera,
} from '@crc/webgl';
import {
  Fragment as DevelopmentFragment,
  jsxDEV,
  type JSX as DevelopmentJSX,
} from '@crc/core/jsx-dev-runtime';

function Label(props: { value: string; children?: CRCTextChild }): CRCNode {
  void props;
  return undefined;
}

const jsxCount = signal(2);
const jsxDoubled: Signal<number> = computed(() => jsxCount.get() * 2);
const jsxCallback = signal<() => string>(() => 'ready');
jsxCallback.set(() => 'updated');

function SignalLabel(): CRCNode {
  const suffix = crcSignal('signals');
  const count = untracked(() => jsxDoubled.get());
  return (
    <Text>
      {count} {suffix.get()}
    </Text>
  );
}

export const signalElement: CRCElement = <SignalLabel />;
void isSignal(jsxCallback.asReadonly());

function AnimatedLabel(): CRCNode {
  const x = crcSignal(0);
  const program: CRCAnimationProgram = sequence(
    track(x, tween({ to: 40, duration: 120 })),
    marker('arrived'),
    track(x, spring({ to: 0 })),
  );
  const player = crcPlayback(program);
  const transitioned = crcTransition(x.get(), {
    type: 'tween',
    duration: 80,
  });
  return (
    <Group style={{ translateX: transitioned.get() }}>
      <Rectangle
        style={{ x: x.get(), width: 10, height: 10 }}
        onClick={() => player.play()}
      />
    </Group>
  );
}

export const animatedElement: CRCElement = <AnimatedLabel />;

const jsxFilterTypes = [
  { type: 'blur', radius: 2 } satisfies CRCBlurFilter,
  { type: 'brightness', amount: 1.25 } satisfies CRCBrightnessFilter,
  { type: 'contrast', amount: 0.8 } satisfies CRCContrastFilter,
  {
    type: 'dropShadow',
    offsetX: 3,
    offsetY: 4,
    color: 'black',
  } satisfies CRCDropShadowFilter,
  { type: 'grayscale', amount: 0.5 } satisfies CRCGrayscaleFilter,
  { type: 'hueRotate', degrees: 45 } satisfies CRCHueRotateFilter,
  { type: 'invert', amount: 0.25 } satisfies CRCInvertFilter,
  { type: 'opacity', amount: 0.75 } satisfies CRCOpacityFilter,
  { type: 'saturate', amount: 1.5 } satisfies CRCSaturateFilter,
  { type: 'sepia', amount: 0.4 } satisfies CRCSepiaFilter,
] as const satisfies readonly CRCFilter[];

interface FilterPrimitiveStyle extends SystemStyle {
  width: number;
}

const FilterPrimitive = definePrimitive<{}, FilterPrimitiveStyle>(
  (_props, style, context) => {
    context.fillRect(0, 0, style.width, style.width);
  },
);

export const jsxFilterElements: readonly CRCElement[] = [
  <Rectangle
    style={{ width: 40, height: 20, filter: jsxFilterTypes[0] }}
  />,
  <Rectangle style={{ width: 40, height: 20, filter: jsxFilterTypes }} />,
  <Group style={{ filter: jsxFilterTypes[3] }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Group>,
  <Group style={{ filter: jsxFilterTypes }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Group>,
  <Absolute style={{ width: 100, height: 50, filter: jsxFilterTypes[7] }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Absolute>,
  <Absolute style={{ width: 100, height: 50, filter: jsxFilterTypes }}>
    <Rectangle style={{ width: 40, height: 20 }} />
  </Absolute>,
  <FilterPrimitive style={{ width: 12, filter: jsxFilterTypes[9] }} />,
  <FilterPrimitive style={{ width: 12, filter: jsxFilterTypes }} />,
];

export const automaticElement: CRCElement = (
  <Label key="automatic" value="ready">
    CRC
  </Label>
);

export type DevelopmentElement = DevelopmentJSX.Element;

export const developmentElement = jsxDEV(
  Label,
  { value: 'ready' },
  'development',
  false,
  {
    fileName: 'jsx.tsx',
    lineNumber: 22,
    columnNumber: 65,
  },
  undefined,
);

export const developmentFragment: DevelopmentJSX.ElementType =
  DevelopmentFragment;

interface PosterProps {
  readonly labels: readonly string[];
  readonly showTitle: boolean;
}

function Poster({ labels, showTitle }: PosterProps): CRCNode {
  return (
    <Grid
      style={{
        width: 240,
        height: 120,
        gridTemplateColumns: [120, 120],
        gridTemplateRows: [60, 60],
      }}
    >
      {labels.map((label, index) => (
        <Rectangle
          key={label}
          style={{
            width: 120,
            height: 60,
            fill: index % 2 === 0 ? '#2563eb' : '#7c3aed',
            gridColumnStart: index + 1,
            gridRowStart: 1,
          }}
        />
      ))}
      {showTitle && (
        <Text
          style={{
            x: 12,
            y: 24,
            gridColumnStart: 1,
            gridColumnSpan: 2,
            gridRowStart: 2,
          }}
        >
          {labels.join(', ')}
        </Text>
      )}
    </Grid>
  );
}

export function mountAutomaticJSXConsumer(
  canvas: HTMLCanvasElement,
): CRCController {
  return crc(canvas, <Poster labels={['Bundler', 'NodeNext']} showTitle />);
}

function* layoutChildren(): Generator<CRCNode> {
  yield [[
    <Rectangle key="child" style={{ width: 10, height: 10 }} />,
  ], false];
}

export const layoutElements: readonly CRCElement[] = [
  <Absolute style={{ width: 100, height: 50 }}>{layoutChildren()}</Absolute>,
  <Overlay style={{ width: 100, height: 50 }}>{layoutChildren()}</Overlay>,
  <Flow style={{ width: 100, height: 50 }}>{layoutChildren()}</Flow>,
  <Flex style={{ width: 100, height: 50 }}>{layoutChildren()}</Flex>,
  <Grid
    style={{
      width: 100,
      height: 50,
      gridTemplateColumns: [100],
      gridTemplateRows: [50],
    }}
  >
    {layoutChildren()}
  </Grid>,
];

export const roundedShapeElements: readonly CRCElement<any>[] = [
  <RegularPolygon
    style={{ sides: 6, circumradius: 20, cornerRadius: 2, fill: '#0ea5e9' }}
  />,
  <RegularPolygon
    style={{ sides: 6, inradius: 16, cornerRadii: [2, 0], fill: '#0ea5e9' }}
  />,
  <RegularPolygon style={{ sides: 6, sideLength: 12, fill: '#0ea5e9' }} />,
  <Star
    style={{
      points: 5,
      outerRadius: 20,
      innerRadius: 8,
      cornerRadius: 2,
      fill: '#f59e0b',
    }}
  />,
  createElement(RegularPolygon, {
    style: { sides: 6, sideLength: 12, cornerRadii: [2, 0] },
  }),
  createElement(Star, {
    style: { points: 5, outerRadius: 20, innerRadius: 8, cornerRadii: [2, 0] },
  }),
];

const automaticWebGLCamera = {
  type: 'perspective',
  position: [0, 0, 5],
  lookAt: [0, 0, 0],
  up: [0, 1, 0],
  fieldOfViewDegrees: 45,
  near: 0.1,
  far: 100,
} as const satisfies CRCWebGLPerspectiveCamera;
const automaticWebGLGeometry = createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
});

export const automaticWebGLScene: CRCElement = (
  <WebGLLayer
    camera={automaticWebGLCamera}
    style={{ width: 320, height: 180 }}
  >
    <Group3D style={{ rotationYDegrees: 15 }}>
      <Cube style={{ color: '#74d3ae', size: 1 }} />
      <Sphere style={{ radius: 0.5, translateX: 1 }} />
      <Mesh
        geometry={automaticWebGLGeometry}
        style={{ color: '#f7c948' }}
      />
    </Group3D>
  </WebGLLayer>
);

// @ts-expect-error RegularPolygon requires exactly one size property
const missingRegularPolygonSize = <RegularPolygon style={{ sides: 6 }} />;
// @ts-expect-error RegularPolygon rejects multiple size properties
const conflictingRegularPolygonSizes = <RegularPolygon style={{ sides: 6, circumradius: 20, inradius: 16 }} />;
// @ts-expect-error Star requires both radii
const missingStarRadius = <Star style={{ points: 5, outerRadius: 20 }} />;
// @ts-expect-error rounded corner radius excludes auto
const automaticCornerRadius = <Star style={{ points: 5, outerRadius: 20, innerRadius: 8, cornerRadius: 'auto' }} />;
void [
  missingRegularPolygonSize,
  conflictingRegularPolygonSizes,
  missingStarRadius,
  automaticCornerRadius,
];
