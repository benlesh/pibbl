import { blur, brightness, contrast, dropShadow, grayscale, hueRotate, invert, opacity, saturate, sepia } from '@crc/core/filters';
import type {
  CRCAnimationProgram,
  CRCController,
  CRCElement,
  CRCFilter,
  CRCNode,
  CRCNodeInput,
  CRCTextChild,
  CRCTextInput,
  Signal,
  SignalValue,
  SystemStyle,
} from '@crc/core';
import {
  Absolute,
  Flex,
  Flow,
  Grid,
  Group,
  Path,
  Overlay,
  RegularPolygon,
  Rectangle,
  Star,
  Text,
  computed,
  createElement,
  crc,
  resolveSignalValue,
  useComputed,
  usePlayback,
  useSignal,
  useAnimatedValue,
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
  Particles2D,
  defineParticleEffect2D,
  particleCurve,
  particleRange,
} from '@crc/particles';
import {
  defineThreeLayer,
  type CRCThreeLayerResources,
} from '@crc/three';
import { PerspectiveCamera, Scene } from 'three';
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
const jsxLabel = signal('Current');
const jsxSelectedNode = signal<CRCNode>(
  <Rectangle style={{ width: 10, height: 10 }} />,
);
const jsxNodeInput: CRCNodeInput = jsxSelectedNode;
const jsxTextInput: CRCTextInput = ['Label: ', jsxLabel];
export const signalChildInputs = (
  <Group>
    {jsxNodeInput}
    <Text>{jsxTextInput}</Text>
  </Group>
);

function SignalLabel(): CRCNode {
  const suffix = useSignal('signals');
  const count = untracked(() => jsxDoubled.get());
  return (
    <Text>
      {count} {suffix.get()}
    </Text>
  );
}

export const signalElement: CRCElement = <SignalLabel />;
void isSignal(jsxCallback.asReadonly());

interface Datum {
  readonly x: number;
  readonly y: number;
  readonly metadata?: unknown;
}

function buildPath(rows: readonly Datum[]): Path2D {
  const path = new Path2D();
  rows.forEach((row, index) => {
    if (index === 0) path.moveTo(row.x, row.y);
    else path.lineTo(row.x, row.y);
  });
  return path;
}

function LineSeries(props: {
  readonly data: SignalValue<readonly Datum[]>;
}): CRCNode {
  const rows = resolveSignalValue(props.data);
  return <Path style={{ d: buildPath(rows), stroke: 'black', strokeWidth: 1 }} />;
}

function Axis(props: {
  readonly domain: SignalValue<readonly [number, number]>;
}): CRCNode {
  const domain = resolveSignalValue(props.domain);
  return <Text>{`${domain[0]}–${domain[1]}`}</Text>;
}

const visualizationRows = signal<readonly Datum[]>([
  { x: 0, y: 2, metadata: { hiddenSignal: signal('opaque') } },
  { x: 10, y: 8 },
]);

function VisualizationContract(): CRCNode {
  const domain = useComputed(
    () => {
      const rows = visualizationRows.get();
      return [
        Math.min(...rows.map(row => row.x)),
        Math.max(...rows.map(row => row.x)),
      ] as const;
    },
    undefined,
    {
      equals: (previous, next) =>
        previous[0] === next[0] && previous[1] === next[1],
    },
  );
  return (
    <Group>
      <LineSeries data={visualizationRows} />
      <Axis domain={domain} />
    </Group>
  );
}

export const visualizationSignalInputs: CRCElement = <VisualizationContract />;

function AnimatedLabel(): CRCNode {
  const x = useSignal(0);
  const program: CRCAnimationProgram = sequence(
    track(x, tween({ to: 40, duration: 120 })),
    marker('arrived'),
    track(x, spring({ to: 0 })),
  );
  const player = usePlayback(program);
  const transitioned = useAnimatedValue(x.get(), {
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
  blur({  radius: 2 }) satisfies CRCFilter,
  brightness({  amount: 1.25 }) satisfies CRCFilter,
  contrast({  amount: 0.8 }) satisfies CRCFilter,
  dropShadow({
    
    offsetX: 3,
    offsetY: 4,
    color: 'black',
  }) satisfies CRCFilter,
  grayscale({  amount: 0.5 }) satisfies CRCFilter,
  hueRotate({  degrees: 45 }) satisfies CRCFilter,
  invert({  amount: 0.25 }) satisfies CRCFilter,
  opacity({  amount: 0.75 }) satisfies CRCFilter,
  saturate({  amount: 1.5 }) satisfies CRCFilter,
  sepia({  amount: 0.4 }) satisfies CRCFilter,
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

const AutomaticThreeLayer = defineThreeLayer<
  { exposure: number },
  CRCThreeLayerResources
>({
  create() {
    return { scene: new Scene(), camera: new PerspectiveCamera() };
  },
});

export const automaticThreeLayerElement: CRCElement = (
  <AutomaticThreeLayer
    exposure={1}
    missBehavior="block"
    style={{ width: 80, height: 60, filter: jsxFilterTypes[0] }}
  />
);

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

const automaticParticleOpacity = particleCurve([
  [0, 1],
  [1, 0],
]);
const automaticParticleEffect2D = defineParticleEffect2D({
  emitters: [{
    name: 'spark',
    capacity: 16,
    emission: [{ type: 'rate', particlesPerSecond: 4 }],
    shape: { type: 'point' },
    initial: {
      lifetimeMilliseconds: 500,
      velocity: [particleRange(-10, 10), particleRange(-20, -5)],
      size: 3,
    },
    appearance: { opacity: automaticParticleOpacity },
    renderer: { type: 'circle' },
    bounds: { min: [-20, -30], max: [20, 10] },
  }],
});
const automaticParticleEffect2DSignal = signal(automaticParticleEffect2D);

export const automaticParticleScene: CRCElement = (
  <Particles2D
    effect={automaticParticleEffect2DSignal}
    autoplay={signal(true)}
    seed={signal(42)}
    pointerEvents="none"
    style={{ width: 100, height: 100 }}
  />
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
