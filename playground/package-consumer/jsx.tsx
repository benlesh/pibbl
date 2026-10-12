import { blur, brightness, contrast, dropShadow, grayscale, hueRotate, invert, opacity, saturate, sepia } from '@pibbl/core/filters';
import type {
  PibblAnimationProgram,
  PibblController,
  PibblElement,
  PibblFilter,
  PibblNode,
  PibblNodeInput,
  PibblTextChild,
  PibblTextInput,
  Signal,
  SignalValue,
  SystemStyle,
} from '@pibbl/core';
import { tween, spring,
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
  pibbl,
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
  drive,
  untracked,
} from '@pibbl/core';
import {
  Particles2D,
  defineParticleEffect2D,
  particleCurve,
  particleRange,
} from '@pibbl/core/particles';
import {
  defineThreeLayer,
  type PibblThreeLayerResources,
} from '@pibbl/three';
import { PerspectiveCamera, Scene } from 'three';
import {
  Fragment as DevelopmentFragment,
  jsxDEV,
  type JSX as DevelopmentJSX,
} from '@pibbl/core/jsx-dev-runtime';

function Label(props: { value: string; children?: PibblTextChild }): PibblNode {
  void props;
  return undefined;
}

const jsxCount = signal(2);
const jsxDoubled: Signal<number> = computed(() => jsxCount.get() * 2);
const jsxCallback = signal<() => string>(() => 'ready');
jsxCallback.set(() => 'updated');
const jsxLabel = signal('Current');
const jsxSelectedNode = signal<PibblNode>(
  <Rectangle style={{ width: 10, height: 10 }} />,
);
const jsxNodeInput: PibblNodeInput = jsxSelectedNode;
const jsxTextInput: PibblTextInput = ['Label: ', jsxLabel];
export const signalChildInputs = (
  <Group>
    {jsxNodeInput}
    <Text>{jsxTextInput}</Text>
  </Group>
);

function SignalLabel(): PibblNode {
  const suffix = useSignal('signals');
  const count = untracked(() => jsxDoubled.get());
  return (
    <Text>
      {count} {suffix.get()}
    </Text>
  );
}

export const signalElement: PibblElement = <SignalLabel />;
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
}): PibblNode {
  const rows = resolveSignalValue(props.data);
  return <Path style={{ d: buildPath(rows), stroke: 'black', strokeWidth: 1 }} />;
}

function Axis(props: {
  readonly domain: SignalValue<readonly [number, number]>;
}): PibblNode {
  const domain = resolveSignalValue(props.domain);
  return <Text>{`${domain[0]}–${domain[1]}`}</Text>;
}

const visualizationRows = signal<readonly Datum[]>([
  { x: 0, y: 2, metadata: { hiddenSignal: signal('opaque') } },
  { x: 10, y: 8 },
]);

function VisualizationContract(): PibblNode {
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

export const visualizationSignalInputs: PibblElement = <VisualizationContract />;

function AnimatedLabel(): PibblNode {
  const x = useSignal(0);
  const program: PibblAnimationProgram = sequence(
    drive(x, tween({ to: 40, duration: 120 })),
    marker('arrived'),
    drive(x, spring({ to: 0 })),
  );
  const player = usePlayback(program);
  const transitioned = useAnimatedValue(x.get(), { animation: tween({ duration: 80 }) });
  return (
    <Group style={{ translateX: transitioned.get() }}>
      <Rectangle
        style={{ left: x.get(), width: 10, height: 10 }}
        onClick={() => player.play()}
      />
    </Group>
  );
}

export const animatedElement: PibblElement = <AnimatedLabel />;

const jsxFilterTypes = [
  blur({  radius: 2 }) satisfies PibblFilter,
  brightness({  amount: 1.25 }) satisfies PibblFilter,
  contrast({  amount: 0.8 }) satisfies PibblFilter,
  dropShadow({
    offsetX: 3,
    offsetY: 4,
    color: 'black',
  }) satisfies PibblFilter,
  grayscale({  amount: 0.5 }) satisfies PibblFilter,
  hueRotate({  degrees: 45 }) satisfies PibblFilter,
  invert({  amount: 0.25 }) satisfies PibblFilter,
  opacity({  amount: 0.75 }) satisfies PibblFilter,
  saturate({  amount: 1.5 }) satisfies PibblFilter,
  sepia({  amount: 0.4 }) satisfies PibblFilter,
] as const satisfies readonly PibblFilter[];

interface FilterPrimitiveStyle extends SystemStyle {
  width: number;
}

const FilterPrimitive = definePrimitive<{}, FilterPrimitiveStyle>(
  (_props, style, context) => {
    context.fillRect(0, 0, style.width, style.width);
  },
);

export const jsxFilterElements: readonly PibblElement[] = [
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
  PibblThreeLayerResources
>({
  create() {
    return { scene: new Scene(), camera: new PerspectiveCamera() };
  },
});

export const automaticThreeLayerElement: PibblElement = (
  <AutomaticThreeLayer
    exposure={1}
    missBehavior="block"
    style={{ width: 80, height: 60, filter: jsxFilterTypes[0] }}
  />
);

export const automaticElement: PibblElement = (
  <Label key="automatic" value="ready">
    Pibbl
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

function Poster({ labels, showTitle }: PosterProps): PibblNode {
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
        <Group
          style={{
            gridColumnStart: 1,
            gridColumnSpan: 2,
            gridRowStart: 2,
          }}
        >
          <Text style={{ left: 12, top: 24 }}>{labels.join(', ')}</Text>
        </Group>
      )}
    </Grid>
  );
}

export function mountAutomaticJSXConsumer(
  canvas: HTMLCanvasElement,
): PibblController {
  return pibbl(canvas, <Poster labels={['Bundler', 'NodeNext']} showTitle />);
}

function* layoutChildren(): Generator<PibblNode> {
  yield [[
    <Rectangle key="child" style={{ width: 10, height: 10 }} />,
  ], false];
}

export const layoutElements: readonly PibblElement[] = [
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

export const roundedShapeElements: readonly PibblElement<any>[] = [
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

export const automaticParticleScene: PibblElement = (
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

// Visibility controllers bind through SystemStyle and expose request-scoped completion.
import { bifrost, hologram, slide, zoom, wipe, blurReveal, dissolve, defineTransition, embers, fade, useVisibilityTransition, type PibblVisibilityTransitionResult } from '@pibbl/core';
export function VisibilityConsumer() {
  const visibility = useVisibilityTransition({ initial: true, enter: fade(), exit: embers({ region: { x: 0, y: 0, width: 100, height: 100 }, wind: -80, seed: 2, linger: 700 }), duration: 150 });
  const hide = async (): Promise<PibblVisibilityTransitionResult> => visibility.hide();
  return <Group style={{ transition: visibility.binding }}><Rectangle style={{ width: 10, height: 10, fill: 'red' }} onClick={() => { void hide(); }} /></Group>;
}

const transitionRegion = { x: 0, y: 0, width: 100, height: 100 };
void [bifrost({ region: transitionRegion }), hologram({ region: transitionRegion }), slide(), zoom({ origin: { x: 50, y: 50 } }), wipe({ region: transitionRegion }), blurReveal(), dissolve({ region: transitionRegion }), defineTransition({ render({ context, progress, drawSource }) { context.globalAlpha = progress; drawSource(); } })];
