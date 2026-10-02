import { dropShadow } from '@crc/core/filters';
/** @jsxImportSource @crc/core */
// Adapted from Three.js "webgl_instancing_raycast":
// https://github.com/mrdoob/three.js/blob/dev/examples/webgl_instancing_raycast.html
// Three.js is MIT licensed: https://github.com/mrdoob/three.js/blob/dev/LICENSE
import {
  Clip,
  FocusManagement,
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { defineThreeLayer } from '@crc/three';
import {
  Color,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

type MissBehavior = 'pass-through' | 'block' | 'target-layer';

interface InstancingProps {
  readonly onBlockedInstance: () => void;
  readonly onRegisteredTarget: () => void;
  readonly onCameraChanged: () => void;
}

interface InstancingResources {
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  instances: InstancedMesh;
  registered: Mesh;
  raycaster: Raycaster;
  pointer: Vector2;
  hoveredInstance: number | undefined;
  props: Readonly<InstancingProps>;
}

const MISS_BEHAVIORS: readonly MissBehavior[] = [
  'pass-through',
  'block',
  'target-layer',
];
const INSTANCE_COUNT = 22;
const LAYER_X = 90;
const LAYER_Y = 58;
const LAYER_WIDTH = 540;
const LAYER_HEIGHT = 300;
const HOVER_COLOR = new Color('#ffffff');
const TEMP_COLOR = new Color();

function colorForInstance(index: number, target = new Color()): Color {
  return target.setHSL(((index * 43) % 360) / 360, 0.76, 0.55);
}

function positionForInstance(index: number): readonly [number, number, number] {
  if (index === 0) return [-6.25, 0, 0];
  if (index === 1) return [0, 2.7, -0.05];
  const latticeIndex = index - 1;
  return [
    -3.6 + (latticeIndex % 7) * 0.82,
    -1.15 + Math.floor(latticeIndex / 7) * 1.05,
    (latticeIndex % 3) * -0.09,
  ];
}

function instanceAtPointer(
  resources: InstancingResources,
  event: PointerEvent,
  element: HTMLElement,
): number | undefined {
  const bounds = element.getBoundingClientRect();
  resources.pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    1 - ((event.clientY - bounds.top) / bounds.height) * 2,
  );
  resources.raycaster.setFromCamera(resources.pointer, resources.camera);
  const first = resources.raycaster.intersectObject(resources.scene, true)[0];
  return first?.object === resources.instances ? first.instanceId : undefined;
}

function highlightInstance(
  resources: InstancingResources,
  next: number | undefined,
): void {
  if (resources.hoveredInstance === next) return;
  if (resources.hoveredInstance !== undefined) {
    resources.instances.setColorAt(
      resources.hoveredInstance,
      colorForInstance(resources.hoveredInstance, TEMP_COLOR),
    );
  }
  if (next !== undefined) resources.instances.setColorAt(next, HOVER_COLOR);
  resources.hoveredInstance = next;
  if (resources.instances.instanceColor) {
    resources.instances.instanceColor.needsUpdate = true;
  }
}

const ThreeInstancingLayer = defineThreeLayer<
  InstancingProps,
  InstancingResources
>({
  renderer: { antialias: true },
  create(context, initialProps) {
    const scene = new Scene();
    const camera = new PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 0, 8.8);
    camera.lookAt(0, 0, 0);
    scene.add(new HemisphereLight('#e0f2fe', '#172554', 2.7));

    const instances = new InstancedMesh(
      new IcosahedronGeometry(0.42, 0),
      new MeshPhongMaterial({
        color: '#ffffff',
        shininess: 56,
      }),
      INSTANCE_COUNT,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < INSTANCE_COUNT; index += 1) {
      const [x, y, z] = positionForInstance(index);
      instances.setMatrixAt(index, matrix.makeTranslation(x, y, z));
      instances.setColorAt(index, colorForInstance(index));
    }
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    scene.add(instances);

    const registered = new Mesh(
      new IcosahedronGeometry(0.72, 1),
      new MeshPhongMaterial({
        color: '#ffd166',
        emissive: '#5b2500',
        shininess: 92,
      }),
    );
    registered.position.set(2.75, 0, 0.2);
    registered.rotation.set(0.35, 0.55, 0.1);
    scene.add(registered);

    let resources: InstancingResources;
    const controls = context.input.connect((element) => {
      const orbit = new OrbitControls(camera, element);
      orbit.enablePan = false;
      orbit.minDistance = 6;
      orbit.maxDistance = 12;
      element.addEventListener('pointermove', (event) => {
        highlightInstance(
          resources,
          instanceAtPointer(resources, event, element),
        );
      });
      element.addEventListener('pointerdown', (event) => {
        if (instanceAtPointer(resources, event, element) !== undefined) {
          resources.props.onBlockedInstance();
        }
      });
      return orbit;
    });
    resources = {
      scene,
      camera,
      controls,
      instances,
      registered,
      raycaster: new Raycaster(),
      pointer: new Vector2(),
      hoveredInstance: undefined,
      props: initialProps,
    };
    controls.update();
    controls.addEventListener('change', () =>
      resources.props.onCameraChanged(),
    );
    return resources;
  },
  update(resources, props) {
    resources.props = props;
  },
  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },
  render(resources, frame, context) {
    const controlsChanged = resources.controls.update(frame.deltaSeconds);
    context.renderer.render(resources.scene, resources.camera);
    if (controlsChanged) frame.invalidate();
  },
  targets(resources, props) {
    return [
      {
        object: resources.registered,
        handlers: {
          onClick: props.onRegisteredTarget,
        },
        cursor: 'pointer',
        keyboardFocusable: true,
      },
    ];
  },
  dispose(resources) {
    resources.controls.dispose();
    resources.instances.geometry.dispose();
    const instanceMaterial = resources.instances.material;
    if (Array.isArray(instanceMaterial)) {
      for (const material of instanceMaterial) material.dispose();
    } else {
      instanceMaterial.dispose();
    }
    resources.registered.geometry.dispose();
    const registeredMaterial = resources.registered.material;
    if (Array.isArray(registeredMaterial)) {
      for (const material of registeredMaterial) material.dispose();
    } else {
      registeredMaterial.dispose();
    }
  },
});

function tiles(onTile: () => void): CRCNode {
  return Array.from({ length: 45 }, (_, index) => {
    const column = index % 9;
    const row = Math.floor(index / 9);
    return (
      <Rectangle
        key={`tile-${index}`}
        keyboardFocusable={false}
        style={{
          x: 8 + column * 80,
          y: 8 + row * 80,
          width: 70,
          height: 70,
          fill: index % 2 ? '#183b61' : '#224f75',
          stroke: '#4d7898',
          strokeWidth: 1,
          cornerRadius: 6,
          cursor: 'pointer',
        }}
        onClick={onTile}
      />
    );
  });
}

function clipPath(): Path2D {
  const path = new Path2D();
  path.rect(LAYER_X + 12, LAYER_Y + 10, LAYER_WIDTH - 24, LAYER_HEIGHT - 20);
  return path;
}

function ThreeInstancingExample() {
  const state = useSignal({
    missBehavior: 'pass-through' as MissBehavior,
    lastResolution: 'none',
    tileClicks: 0,
    threeClicks: 0,
    blockedInputs: 0,
    cameraChanges: 0,
    trace: [] as string[],
  });
  const recordTile = () =>
    state.update((current) => ({
      ...current,
      lastResolution: 'CRC tile',
      tileClicks: current.tileClicks + 1,
    }));
  const recordBlocked = () =>
    state.update((current) => ({
      ...current,
      lastResolution: 'Three blocked',
      blockedInputs: current.blockedInputs + 1,
    }));
  const recordTarget = () =>
    state.update((current) => ({
      ...current,
      lastResolution: 'Three target',
      threeClicks: current.threeClicks + 1,
      trace: [...current.trace, 'target'],
    }));
  const cyclePolicy = () =>
    state.update((current) => ({
      ...current,
      missBehavior:
        MISS_BEHAVIORS[
          (MISS_BEHAVIORS.indexOf(current.missBehavior) + 1) %
            MISS_BEHAVIORS.length
        ]!,
      lastResolution: 'Toolbar',
    }));
  const clip = clipPath();

  return (
    <FocusManagement>
      <Group>
        {tiles(recordTile)}
        <Group
          onClickCapture={() =>
            state.update((current) => ({ ...current, trace: ['capture'] }))
          }
          onClick={() =>
            state.update((current) => ({
              ...current,
              trace: [...current.trace, 'bubble'],
            }))
          }
          style={{
            filter: dropShadow({
              
              offsetX: 12,
              offsetY: 8,
              blurRadius: 6,
              color: 'rgb(2 8 23 / 82%)',
            }),
          }}
        >
          <Clip style={{ d: clip }}>
            <Group style={{ translateX: LAYER_X, translateY: LAYER_Y }}>
              <ThreeInstancingLayer
                missBehavior={state.get().missBehavior}
                style={{ width: LAYER_WIDTH, height: LAYER_HEIGHT }}
                onBlockedInstance={recordBlocked}
                onRegisteredTarget={recordTarget}
                onCameraChanged={() =>
                  state.update((current) => ({
                    ...current,
                    cameraChanges: current.cameraChanges + 1,
                  }))
                }
              />
            </Group>
          </Clip>
        </Group>
        <Rectangle
          keyboardFocusable={false}
          style={{
            x: 258,
            y: 48,
            width: 204,
            height: 58,
            fill: '#f8fafc',
            stroke: '#0f172a',
            strokeWidth: 2,
            cornerRadius: 9,
            cursor: 'pointer',
          }}
          onClick={cyclePolicy}
        />
        <Text
          pointerEvents="none"
          style={{
            x: 360,
            y: 71,
            fill: '#0f172a',
            font: '700 13px monospace',
            textAlign: 'center',
          }}
        >
          {`MISS · ${state.get().missBehavior}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            x: 360,
            y: 94,
            fill: '#334155',
            font: '10px monospace',
            textAlign: 'center',
          }}
        >
          {`${state.get().lastResolution} · ${state.get().trace.join(' → ') || 'no trace'}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            x: 20,
            y: 404,
            fill: '#e2e8f0',
            font: '700 11px monospace',
          }}
        >
          {`CRC ${state.get().tileClicks} · TARGET ${state.get().threeClicks} · BLOCK ${state.get().blockedInputs} · CAMERA ${state.get().cameraChanges}`}
        </Text>
      </Group>
    </FocusManagement>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ThreeInstancingExample />, { pixelRatio: 1 });
}
