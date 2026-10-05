import type { threeInstancingLabScenarioEntry } from './catalog.js';
import type { ThreeInstancingLabAction } from './three-instancing-lab.js';
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

export const THREE_INSTANCING_LAB_SOURCE_ID = 'three-instancing-laboratory-example';

/**
 * Supported three instancing miss behavior values: `"pass-through"`, `"block"`, `"target-layer"`.
 *
 * @see {@link ThreeInstancingLabState}
 */
export type ThreeInstancingMissBehavior =
  | 'pass-through'
  | 'block'
  | 'target-layer';

/**
 * Supported three instancing resolution values: `"none"`, `"CRC tile"`, `"Three blocked"`, `"Three
 * target"`, `"Toolbar"`.
 *
 * @see {@link ThreeInstancingLabState}
 */
export type ThreeInstancingResolution =
  | 'none'
  | 'CRC tile'
  | 'Three blocked'
  | 'Three target'
  | 'Toolbar';

/**
 * Observable state exposed by the three instancing lab scenario for controls and assertions.
 *
 * @see {@link ThreeInstancingMissBehavior}
 * @see {@link ThreeInstancingResolution}
 * @see {@link ThreeInstancingLabPoint}
 * @see {@link threeInstancingLabScenarioEntry}
 * @see {@link ThreeInstancingLabAction}
 */
export interface ThreeInstancingLabState {
  /**
   * Miss behavior recorded or configured by this scenario. See {@link ThreeInstancingMissBehavior}
   * .
   */
  readonly missBehavior: ThreeInstancingMissBehavior;
  /**
   * Last resolution recorded or configured by this scenario. See {@link ThreeInstancingResolution}
   * .
   */
  readonly lastResolution: ThreeInstancingResolution;
  /** Tile clicks recorded or configured by this scenario. See {@link ThreeInstancingLabState}. */
  readonly tileClicks: number;
  /**
   * Three target clicks recorded or configured by this scenario. See
   * {@link ThreeInstancingLabState}.
   */
  readonly threeTargetClicks: number;
  /**
   * Blocked three inputs recorded or configured by this scenario. See
   * {@link ThreeInstancingLabState}.
   */
  readonly blockedThreeInputs: number;
  /**
   * Camera changes recorded or configured by this scenario. See {@link ThreeInstancingLabState}.
   */
  readonly cameraChanges: number;
  /**
   * Target propagation trace recorded or configured by this scenario. See
   * {@link ThreeInstancingLabState}.
   */
  readonly targetPropagationTrace: readonly string[];
  /** Revision recorded or configured by this scenario. See {@link ThreeInstancingLabState}. */
  readonly revision: number;
}

/**
 * A logical coordinate pair used by the three instancing lab scenario.
 *
 * @see {@link ThreeInstancingLabState}
 * @see {@link THREE_INSTANCING_LAB_PROBES}
 */
export interface ThreeInstancingLabPoint {
  /** X recorded or configured by this scenario. See {@link ThreeInstancingLabPoint}. */
  readonly x: number;
  /** Y recorded or configured by this scenario. See {@link ThreeInstancingLabPoint}. */
  readonly y: number;
}

/**
 * Deterministic geometry probe locations for the three instancing lab scenario.
 *
 * @see {@link ThreeInstancingLabPoint}
 */
export const THREE_INSTANCING_LAB_PROBES = {
  /**
   * Probe for exposed tile in the deterministic scenario. See {@link THREE_INSTANCING_LAB_PROBES}
   * .
   */
  exposedTile: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 34,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 326 },
  /**
   * Probe for unregistered instance in the deterministic scenario. See
   * {@link THREE_INSTANCING_LAB_PROBES}.
   */
  unregisteredInstance: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 193,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 171 },
  /**
   * Probe for registered target in the deterministic scenario. See
   * {@link THREE_INSTANCING_LAB_PROBES}.
   */
  registeredTarget: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 418,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 171 },
  /** Probe for empty gap in the deterministic scenario. See {@link THREE_INSTANCING_LAB_PROBES}. */
  emptyGap: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 520,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 260 },
  /**
   * Probe for foreground toolbar in the deterministic scenario. See
   * {@link THREE_INSTANCING_LAB_PROBES}.
   */
  foregroundToolbar: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 320,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 72 },
  /**
   * Probe for clipped away in the deterministic scenario. See {@link THREE_INSTANCING_LAB_PROBES}
   * .
   */
  clippedAway: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 74,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 171 },
  /**
   * Probe for filtered shadow in the deterministic scenario. See
   * {@link THREE_INSTANCING_LAB_PROBES}.
   */
  filteredShadow: {
  /** Horizontal coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  x: 108,
  /** Vertical coordinate of the probe. See {@link THREE_INSTANCING_LAB_PROBES}. */
  y: 193 },
} as const satisfies Readonly<Record<string, ThreeInstancingLabPoint>>;

interface InstancingProps {
  readonly onThreeBlocked: () => void;
  readonly onThreeTarget: () => void;
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

const INSTANCE_COUNT = 16;
const INSTANCE_RADIUS = 0.42;
const LAYER_X = 70;
const LAYER_Y = 36;
const LARGE_LAYER_WIDTH = 500;
const LARGE_LAYER_HEIGHT = 270;
const SMALL_LAYER_WIDTH = 430;
const SMALL_LAYER_HEIGHT = 232;
const TILE_COLORS = ['#16355c', '#1c466f', '#24557f', '#2c668b'] as const;
const HOVER_COLOR = new Color('#ffffff');
const TEMP_COLOR = new Color();

function instancePosition(index: number): readonly [number, number, number] {
  if (index === 0) return [-6.15, 0, 0];
  if (index === 1) return [0, 2.7, -0.05];
  const latticeIndex = index - 1;
  return [
    -3.4 + (latticeIndex % 5) * 0.88,
    -1 + Math.floor(latticeIndex / 5),
    (latticeIndex % 3) * -0.08,
  ];
}

function instanceColor(index: number, target = new Color()): Color {
  return target.setHSL(((index * 47) % 360) / 360, 0.72, 0.55);
}

function pointerForEvent(
  pointer: Vector2,
  event: PointerEvent,
  element: HTMLElement,
): void {
  const bounds = element.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    1 - ((event.clientY - bounds.top) / bounds.height) * 2,
  );
}

function instanceAtPointer(
  resources: InstancingResources,
  event: PointerEvent,
  element: HTMLElement,
): number | undefined {
  pointerForEvent(resources.pointer, event, element);
  resources.raycaster.setFromCamera(resources.pointer, resources.camera);
  const first = resources.raycaster.intersectObject(resources.scene, true)[0];
  return first?.object === resources.instances ? first.instanceId : undefined;
}

function updateHoveredInstance(
  resources: InstancingResources,
  next: number | undefined,
): void {
  if (resources.hoveredInstance === next) return;
  if (resources.hoveredInstance !== undefined) {
    resources.instances.setColorAt(
      resources.hoveredInstance,
      instanceColor(resources.hoveredInstance, TEMP_COLOR),
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
    camera.position.set(0, 0, 8.5);
    camera.lookAt(0, 0, 0);

    const light = new HemisphereLight('#dff4ff', '#1d3354', 2.6);
    scene.add(light);

    const instanceGeometry = new IcosahedronGeometry(INSTANCE_RADIUS, 0);
    const instanceMaterial = new MeshPhongMaterial({
      color: '#ffffff',
      shininess: 54,
    });
    const instances = new InstancedMesh(
      instanceGeometry,
      instanceMaterial,
      INSTANCE_COUNT,
    );
    const matrix = new Matrix4();
    for (let index = 0; index < INSTANCE_COUNT; index += 1) {
      const [x, y, z] = instancePosition(index);
      instances.setMatrixAt(index, matrix.makeTranslation(x, y, z));
      instances.setColorAt(index, instanceColor(index));
    }
    instances.instanceMatrix.needsUpdate = true;
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    scene.add(instances);

    const registered = new Mesh(
      new IcosahedronGeometry(0.7, 1),
      new MeshPhongMaterial({
        color: '#ffd166',
        emissive: '#5b2500',
        shininess: 90,
      }),
    );
    registered.position.set(2.6, 0, 0.2);
    registered.rotation.set(0.35, 0.55, 0.1);
    scene.add(registered);

    let resources: InstancingResources;
    const controls = context.input.connect((element) => {
      const orbit = new OrbitControls(camera, element);
      orbit.enableDamping = false;
      orbit.enablePan = false;
      orbit.minDistance = 6;
      orbit.maxDistance = 12;
      orbit.target.set(0, 0, 0);
      element.addEventListener('pointermove', (event) => {
        updateHoveredInstance(
          resources,
          instanceAtPointer(resources, event, element),
        );
      });
      element.addEventListener('pointerdown', (event) => {
        if (instanceAtPointer(resources, event, element) !== undefined) {
          resources.props.onThreeBlocked();
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
          onClick: props.onThreeTarget,
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

export interface ThreeInstancingLabSceneProps {
  readonly state: Readonly<ThreeInstancingLabState>;
  readonly compact: boolean;
  readonly onTile: () => void;
  readonly onThreeBlocked: () => void;
  readonly onThreeTargetCapture: () => void;
  readonly onThreeTarget: () => void;
  readonly onThreeTargetBubble: () => void;
  readonly onCameraChanged: () => void;
  readonly onToolbar: () => void;
}

function tileField(onTile: () => void): CRCNode {
  return Array.from({ length: 40 }, (_, index) => {
    const column = index % 8;
    const row = Math.floor(index / 8);
    return (
      <Rectangle
        key={`tile-${index}`}
        keyboardFocusable={false}
        style={{
          left: 4 + column * 80,
          top: 4 + row * 72,
          width: 72,
          height: 64,
          fill: TILE_COLORS[index % TILE_COLORS.length],
          stroke: '#3f7196',
          strokeWidth: 1,
          cornerRadius: 5,
          cursor: 'pointer',
        }}
        onClick={onTile}
      />
    );
  });
}

function layerClip(width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(LAYER_X + 12, LAYER_Y + 10, width - 24, height - 20);
  return path;
}

export function createThreeInstancingLabScene(
  props: ThreeInstancingLabSceneProps,
): CRCNode {
  const width = props.compact ? SMALL_LAYER_WIDTH : LARGE_LAYER_WIDTH;
  const height = props.compact ? SMALL_LAYER_HEIGHT : LARGE_LAYER_HEIGHT;
  const clip = layerClip(width, height);
  return (
    <FocusManagement>
      <Group>
        {tileField(props.onTile)}
        <Group
          onClickCapture={props.onThreeTargetCapture}
          onClick={props.onThreeTargetBubble}
          style={{
            filter: dropShadow({

              offsetX: 10,
              offsetY: 7,
              blurRadius: 5,
              color: 'rgb(2 8 23 / 82%)',
            }),
          }}
        >
          <Clip style={{ d: clip }}>
            <Group style={{ translateX: LAYER_X, translateY: LAYER_Y }}>
              <ThreeInstancingLayer
                missBehavior={props.state.missBehavior}
                style={{ width, height }}
                onThreeBlocked={props.onThreeBlocked}
                onThreeTarget={props.onThreeTarget}
                onCameraChanged={props.onCameraChanged}
              />
            </Group>
          </Clip>
        </Group>
        <Rectangle
          keyboardFocusable={false}
          style={{
            left: 230,
            top: 48,
            width: 180,
            height: 52,
            fill: '#f8fafc',
            stroke: '#0f172a',
            strokeWidth: 2,
            cornerRadius: 8,
            cursor: 'pointer',
          }}
          onClick={props.onToolbar}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 320,
            top: 69,
            fill: '#0f172a',
            font: '700 12px monospace',
            textAlign: 'center',
          }}
        >
          {`MISS · ${props.state.missBehavior}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 320,
            top: 88,
            fill: '#334155',
            font: '10px monospace',
            textAlign: 'center',
          }}
        >
          {`${props.state.lastResolution} · rev ${props.state.revision}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 16,
            top: 348,
            fill: '#e2e8f0',
            font: '700 11px monospace',
          }}
        >
          {`CRC ${props.state.tileClicks} · THREE ${props.state.threeTargetClicks} · BLOCK ${props.state.blockedThreeInputs} · CAMERA ${props.state.cameraChanges}`}
        </Text>
      </Group>
    </FocusManagement>
  );
}
