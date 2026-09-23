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
  usePlayback,
  useSignal,
  useTransition,
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
  AmbientLight,
  Cube,
  DirectionalLight,
  Group3D,
  HemisphereLight,
  Mesh,
  PointLight,
  Sphere,
  SpotLight,
  WebGLBackground,
  WebGLLayer,
  useOrbitCamera,
  createWebGLGeometry,
  type CRCOrbitCameraHandlers,
  type CRCOrbitCameraOptions,
  type CRCOrbitCameraResult,
  type CRCWebGLLambertMaterial,
  type CRCWebGLMaterial,
  type CRCWebGLPerspectiveCamera,
  type CRCWebGLShadowQuality,
} from '@crc/webgl';
import {
  useGLTF,
  type CRCWebGLAssetLoadResult,
} from '@crc/webgl/gltf';
import {
  Particles2D,
  defineParticleEffect2D,
  particleCurve,
  particleRange,
} from '@crc/particles';
import {
  Particles3D,
  defineParticleEffect3D,
} from '@crc/particles/webgl';
import {
  defineThreeLayer,
  type CRCThreeLayerResources,
} from '@crc/three';
import { PerspectiveCamera, Scene } from 'three';
import {
  Box3D,
  Capsule3D,
  Cone3D,
  ConvexHull3D,
  Cylinder3D,
  Ellipsoid3D,
  Heightfield3D,
  PhysicsShape3D,
  PhysicsWorld3D,
  collider3D,
  dynamicBody3D,
  kinematicBody3D,
  sphereShape3D,
  staticBody3D,
} from '@crc/physics/3d';
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
  const suffix = useSignal('signals');
  const count = untracked(() => jsxDoubled.get());
  return (
    <Text>
      {count} {suffix.get()}
    </Text>
  );
}

function ImportedModelStatus(): CRCNode {
  const loaded: CRCWebGLAssetLoadResult = useGLTF('/model.glb');
  return <Text>{loaded.status}</Text>;
}

void (<ImportedModelStatus />);

export const signalElement: CRCElement = <SignalLabel />;
void isSignal(jsxCallback.asReadonly());

function AnimatedLabel(): CRCNode {
  const x = useSignal(0);
  const program: CRCAnimationProgram = sequence(
    track(x, tween({ to: 40, duration: 120 })),
    marker('arrived'),
    track(x, spring({ to: 0 })),
  );
  const player = usePlayback(program);
  const transitioned = useTransition(x.get(), {
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

const automaticWebGLGeometry = createWebGLGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
});
const automaticShadowQualities = [
  false,
  'low',
  'medium',
  'high',
] as const satisfies readonly CRCWebGLShadowQuality[];
const automaticLambertMaterial: CRCWebGLMaterial = {
  type: 'lambert',
  emissiveColor: '#102040',
  emissiveIntensity: 0.25,
} satisfies CRCWebGLLambertMaterial;

function AutomaticWebGLScene(): CRCNode {
  const orbitOptions: CRCOrbitCameraOptions = {
    orbitPoint: [0, 0, 0],
    initialPosition: [0, 2, 5],
    minDistance: 2,
    maxDistance: 12,
    rotateSpeed: 0.8,
    zoomSpeed: 1.2,
  };
  const orbit: CRCOrbitCameraResult = useOrbitCamera(orbitOptions);
  const handlers: CRCOrbitCameraHandlers = orbit.handlers;
  const camera: CRCWebGLPerspectiveCamera = {
    type: 'perspective',
    position: orbit.position,
    lookAt: orbit.lookAt,
    up: [0, 1, 0],
    fieldOfViewDegrees: 45,
    near: 0.1,
    far: 100,
  };
  return (
    <Group {...handlers}>
      <Rectangle style={{ width: 320, height: 180, fill: 'transparent' }} />
      <WebGLLayer
        camera={camera}
        style={{
          width: 320,
          height: 180,
          shadows: automaticShadowQualities[3],
        }}
      >
        <WebGLBackground style={{ color: '#08111fcc' }} />
        <AmbientLight style={{ color: '#ffffff', intensity: 0.1 }} />
        <HemisphereLight
          style={{
            skyColor: '#b9dcff',
            groundColor: '#302418',
            intensity: 0.3,
            rotationZDegrees: 5,
          }}
        />
        <DirectionalLight
          style={{
            color: '#ffffff',
            intensity: 1.2,
            rotationXDegrees: -35,
            rotationYDegrees: 45,
            castShadow: false,
          }}
        />
        <PointLight
          style={{
            color: '#ff8a4c',
            intensity: 4,
            range: 12,
            translateX: 3,
            translateY: 4,
            translateZ: 2,
            castShadow: true,
          }}
        />
        <SpotLight
          style={{
            color: '#80c8ff',
            intensity: 5,
            range: 20,
            innerConeAngleDegrees: 15,
            outerConeAngleDegrees: 28,
            translateX: -3,
            translateY: 5,
            translateZ: 4,
            rotationXDegrees: -40,
            castShadow: true,
          }}
        />
        <Group3D style={{ rotationYDegrees: 15 }}>
          <Cube
            style={{
              color: '#74d3ae',
              size: 1,
              material: automaticLambertMaterial,
              castShadow: true,
              receiveShadow: false,
            }}
          />
          <Sphere
            style={{
              radius: 0.5,
              translateX: 1,
              lit: false,
              castShadow: false,
              receiveShadow: true,
            }}
          />
          <Mesh
            geometry={automaticWebGLGeometry}
            style={{ color: '#f7c948' }}
          />
        </Group3D>
      </WebGLLayer>
    </Group>
  );
}

export const automaticWebGLScene: CRCElement = (
  <AutomaticWebGLScene />
);

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
const automaticParticleEffect3D = defineParticleEffect3D({
  emitters: [{
    name: 'ember',
    capacity: 32,
    emission: [{ type: 'rate', particlesPerSecond: 8 }],
    shape: { type: 'sphere', radius: 1, sample: 'volume' },
    initial: {
      lifetimeMilliseconds: particleRange(600, 900),
      velocity: [0, particleRange(0.5, 1), 0],
      size: 4,
    },
    appearance: { opacity: automaticParticleOpacity },
    renderer: { type: 'point', material: 'emissive', blend: 'additive' },
    bounds: { min: [-2, -1, -2], max: [2, 3, 2] },
  }],
});

export const automaticParticleScene: CRCElement = (
  <Group>
    <Particles2D
      effect={automaticParticleEffect2D}
      autoplay
      seed={42}
      pointerEvents="none"
      style={{ width: 100, height: 100 }}
    />
    <WebGLLayer
      camera={{
        type: 'perspective',
        position: [0, 0, 5],
        lookAt: [0, 0, 0],
        up: [0, 1, 0],
        fieldOfViewDegrees: 45,
        near: 0.1,
        far: 100,
      }}
      style={{ width: 100, height: 100 }}
    >
      <Particles3D
        effect={automaticParticleEffect3D}
        autoplay
        seed={42}
        pointerEvents="none"
      />
    </WebGLLayer>
  </Group>
);

const jsxPhysicsShape3D = sphereShape3D({ radius: 0.5 });
export const automaticPhysics3DScene: CRCElement = (
  <WebGLLayer style={{ width: 320, height: 180 }}>
    <PhysicsWorld3D gravity={[0, -9.81, 0]}>
      <Group3D physics={staticBody3D({ collider: false })}>
        <Cube physics={collider3D()} style={{ lit: false }} />
      </Group3D>
      <Sphere physics={dynamicBody3D({ mass: 1 })} style={{ lit: false }} />
      <Mesh
        geometry={automaticWebGLGeometry}
        physics={kinematicBody3D()}
        style={{ lit: false }}
      />
      <PhysicsShape3D shape={jsxPhysicsShape3D} />
      <Box3D width={1} height={1} depth={1} />
      <Ellipsoid3D radii={[1, 2, 1]} />
      <Capsule3D start={[0, -1, 0]} end={[0, 1, 0]} radius={0.5} />
      <Cylinder3D radius={1} halfHeight={1} />
      <Cone3D radius={1} halfHeight={1} />
      <ConvexHull3D points={[[-1, -1, -1], [1, -1, -1], [0, 1, -1], [0, 0, 1]]} />
      <Heightfield3D rows={2} columns={2} heights={[0, 0, 0, 0]} />
    </PhysicsWorld3D>
  </WebGLLayer>
);

// @ts-expect-error 2D physics attachments cannot be used by WebGL hosts.
<Cube physics={{} as import('@crc/physics/2d').CRCPhysicsAttachment2D} />;
// @ts-expect-error 3D physics attachments cannot be used by Canvas hosts.
<Rectangle physics={dynamicBody3D()} style={{ width: 1, height: 1 }} />;
// @ts-expect-error nominal lookalikes are not registered physics attachments.
<Sphere physics={{ physics: 'dynamic' }} />;

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
