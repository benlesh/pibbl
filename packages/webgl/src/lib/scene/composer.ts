import { DEFAULT_WEBGL_MATERIAL } from '../components/material.js';
import {
  composeModelMatrix4,
  multiplyMatrix4,
  setIdentityMatrix4,
} from '../math/matrix4.js';
import type { CRCWebGLTransformStyle } from '../types.js';
import type {
  CRCWebGLAuthoredTransform,
  ClosedWebGLSceneDraft,
  CRCWebGLInstancedSubmission,
  CreateWebGLSceneComposerInput,
  SubmitWebGLBackgroundInput,
  SubmitWebGLLightInput,
  SubmitWebGLMeshInput,
  WebGLBackgroundSubmission,
  WebGLInstancedSubmission,
  WebGLLightSubmission,
  WebGLMeshSubmission,
  WebGLSceneComposer,
} from './types.js';
import type { ResolvedWebGLCamera } from '../math/camera.js';

interface MutableComposer extends WebGLSceneComposer {
  readonly modelStack: Float32Array[];
  readonly authoredTransformStack: CRCWebGLAuthoredTransform[];
  readonly meshes: WebGLMeshSubmission[];
  readonly instanced: WebGLInstancedSubmission[];
  readonly lights: WebGLLightSubmission[];
  readonly backgrounds: WebGLBackgroundSubmission[];
  state: 'open' | 'closed';
  nextSourceIndex: number;
}

const transformCache = new WeakMap<
  CRCWebGLTransformStyle,
  Map<number, CRCWebGLAuthoredTransform>
>();

const DEGREES_TO_RADIANS = Math.PI / 180;

const requireOpen = (composer: WebGLSceneComposer): MutableComposer => {
  const value = composer as MutableComposer;
  if (value.state !== 'open') throw new Error('WebGL scene composer is already closed.');
  return value;
};

const snapshotCamera = (camera: ResolvedWebGLCamera): ResolvedWebGLCamera => Object.freeze({
  descriptor: Object.freeze({
    ...camera.descriptor,
    position: Object.freeze([...camera.descriptor.position]) as ResolvedWebGLCamera['descriptor']['position'],
    lookAt: Object.freeze([...camera.descriptor.lookAt]) as ResolvedWebGLCamera['descriptor']['lookAt'],
    up: Object.freeze([...camera.descriptor.up]) as ResolvedWebGLCamera['descriptor']['up'],
  }),
  aspect: camera.aspect,
  viewMatrix: new Float32Array(camera.viewMatrix),
  projectionMatrix: new Float32Array(camera.projectionMatrix),
  projectionViewMatrix: new Float32Array(camera.projectionViewMatrix),
  inverseProjectionViewMatrix: new Float32Array(camera.inverseProjectionViewMatrix),
  viewport: Object.freeze({ ...camera.viewport }),
  generationValues: Object.freeze([...camera.generationValues]),
});

export function createWebGLSceneComposer(
  input: CreateWebGLSceneComposerInput,
): WebGLSceneComposer {
  const logicalViewport = Object.freeze({
    width: input.frame.logicalWidth,
    height: input.frame.logicalHeight,
  });
  const backingViewport = Object.freeze({
    width: input.frame.backingWidth,
    height: input.frame.backingHeight,
  });
  const density = Object.freeze({
    x: backingViewport.width / logicalViewport.width,
    y: backingViewport.height / logicalViewport.height,
  });
  const identity = new Float32Array(16);
  setIdentityMatrix4(identity);
  return {
    contextGeneration: input.contextGeneration,
    camera: snapshotCamera(input.camera),
    logicalViewport,
    backingViewport,
    density,
    timestamp: input.frame.renderTimestamp,
    shadowQuality: input.shadowQuality ?? 'medium',
    meshes: [],
    instanced: [],
    lights: [],
    backgrounds: [],
    modelStack: [identity],
    authoredTransformStack: [],
    state: 'open',
    nextSourceIndex: 0,
  } as MutableComposer;
}

export function submitWebGLLight(
  composer: WebGLSceneComposer,
  input: SubmitWebGLLightInput,
): void {
  const value = requireOpen(composer);
  const common = {
    componentName: input.componentName,
    source: input.source,
    intensity: input.intensity,
  };
  switch (input.kind) {
    case 'ambient':
      value.lights.push(Object.freeze({
        ...common,
        kind: 'ambient' as const,
        color: snapshotColor(input.color),
      }));
      return;
    case 'hemisphere':
      value.lights.push(Object.freeze({
        ...common,
        kind: 'hemisphere' as const,
        skyColor: snapshotColor(input.skyColor),
        groundColor: snapshotColor(input.groundColor),
        model: composeLightModel(value, input.localModel),
      }));
      return;
    case 'directional':
      value.lights.push(Object.freeze({
        ...common,
        kind: 'directional' as const,
        identity: input.identity ?? Object.freeze({}),
        castShadow: input.castShadow ?? true,
        color: snapshotColor(input.color),
        model: composeLightModel(value, input.localModel),
      }));
      return;
    case 'point':
      value.lights.push(Object.freeze({
        ...common,
        kind: 'point' as const,
        identity: input.identity ?? Object.freeze({}),
        castShadow: input.castShadow ?? true,
        color: snapshotColor(input.color),
        range: input.range,
        model: composeLightModel(value, input.localModel),
      }));
      return;
    case 'spot':
      value.lights.push(Object.freeze({
        ...common,
        kind: 'spot' as const,
        identity: input.identity ?? Object.freeze({}),
        castShadow: input.castShadow ?? true,
        color: snapshotColor(input.color),
        range: input.range,
        innerConeAngleDegrees: input.innerConeAngleDegrees,
        outerConeAngleDegrees: input.outerConeAngleDegrees,
        model: composeLightModel(value, input.localModel),
      }));
  }
}

export function submitWebGLBackground(
  composer: WebGLSceneComposer,
  input: SubmitWebGLBackgroundInput,
): void {
  const value = requireOpen(composer);
  value.backgrounds.push(Object.freeze({
    kind: 'background',
    componentName: input.componentName,
    source: input.source,
    color: snapshotColor(input.color),
  }));
}

/** Resolves one authored WebGL T * Rz * Ry * Rx * S transform record. */
export function resolveWebGLTransform(
  style: Readonly<CRCWebGLTransformStyle>,
  uniformScale = 1,
): CRCWebGLAuthoredTransform {
  if (!Number.isFinite(uniformScale) || uniformScale === 0) {
    throw new RangeError('WebGL transform uniform scale must be finite and nonzero.');
  }
  let byUniformScale = transformCache.get(style);
  const cached = byUniformScale?.get(uniformScale);
  if (cached) return cached;

  const translation = Object.freeze([
    resolveTransformNumber(style, 'translateX', 0),
    resolveTransformNumber(style, 'translateY', 0),
    resolveTransformNumber(style, 'translateZ', 0),
  ]) as CRCWebGLAuthoredTransform['translation'];
  const scale = Object.freeze([
    resolveTransformNumber(style, 'scaleX', 1) * uniformScale,
    resolveTransformNumber(style, 'scaleY', 1) * uniformScale,
    resolveTransformNumber(style, 'scaleZ', 1) * uniformScale,
  ]) as CRCWebGLAuthoredTransform['scale'];
  for (const [index, value] of scale.entries()) {
    if (!Number.isFinite(value) || value === 0) {
      const field = ['scaleX', 'scaleY', 'scaleZ'][index]!;
      throw new RangeError(`WebGL transform.${field} must resolve to a finite nonzero value.`);
    }
  }
  const rotationX = resolveTransformNumber(style, 'rotationXDegrees', 0);
  const rotationY = resolveTransformNumber(style, 'rotationYDegrees', 0);
  const rotationZ = resolveTransformNumber(style, 'rotationZDegrees', 0);
  const orientation = quaternionFromEulerDegrees(
    rotationX,
    rotationY,
    rotationZ,
  );
  const effectiveStyle = {
    translateX: translation[0],
    translateY: translation[1],
    translateZ: translation[2],
    rotationXDegrees: rotationX,
    rotationYDegrees: rotationY,
    rotationZDegrees: rotationZ,
    scaleX: scale[0],
    scaleY: scale[1],
    scaleZ: scale[2],
  };
  const mutableMatrix = new Float32Array(16);
  composeModelMatrix4(mutableMatrix, effectiveStyle);
  const resolved = Object.freeze({
    translation,
    orientation,
    scale,
    matrix: Object.freeze(Array.from(mutableMatrix)),
  });
  byUniformScale ??= new Map();
  byUniformScale.set(uniformScale, resolved);
  transformCache.set(style, byUniformScale);
  return resolved;
}

export function pushWebGLAuthoredTransform(
  composer: WebGLSceneComposer,
  transform: CRCWebGLAuthoredTransform,
): () => void {
  const value = requireOpen(composer);
  const popModel = pushWebGLModelMatrix(value, transform.matrix);
  value.authoredTransformStack.push(transform);
  let active = true;
  return () => {
    if (!active) return;
    if (value.authoredTransformStack.at(-1) !== transform) {
      throw new Error(
        'Group3D authored transform scopes must be released in traversal order.',
      );
    }
    popModel();
    active = false;
    value.authoredTransformStack.pop();
  };
}

export function pushWebGLModelMatrix(
  composer: WebGLSceneComposer,
  local: Readonly<ArrayLike<number>>,
): () => void {
  const value = requireOpen(composer);
  const composed = new Float32Array(16);
  multiplyMatrix4(composed, value.modelStack.at(-1)!, local);
  value.modelStack.push(composed);
  let active = true;
  return () => {
    if (!active) return;
    if (value.modelStack.at(-1) !== composed) {
      throw new Error('Group3D model scopes must be released in traversal order.');
    }
    active = false;
    value.modelStack.pop();
  };
}

export function submitWebGLMesh(
  composer: WebGLSceneComposer,
  input: SubmitWebGLMeshInput,
): void {
  const value = requireOpen(composer);
  const material = input.material ?? DEFAULT_WEBGL_MATERIAL;
  const model = new Float32Array(16);
  multiplyMatrix4(model, value.modelStack.at(-1)!, input.localModel);
  value.meshes.push(Object.freeze({
    kind: 'mesh' as const,
    componentName: input.componentName,
    source: input.source,
    geometry: input.geometry,
    identity: input.identity ?? Object.freeze({}),
    model,
    color: Object.freeze([...input.color]) as unknown as WebGLMeshSubmission['color'],
    lit: input.lit ?? true,
    castShadow: input.castShadow,
    receiveShadow: input.receiveShadow,
    material: Object.freeze({
      type: material.type,
      emissiveColor: Object.freeze([...material.emissiveColor]) as WebGLMeshSubmission['material']['emissiveColor'],
      emissiveIntensity: material.emissiveIntensity,
    }),
    sourceIndex: value.nextSourceIndex++,
    target: input.target,
    keyboardNavigationBounds: input.keyboardNavigationBounds === undefined ?
      undefined : Object.freeze({ ...input.keyboardNavigationBounds }),
  }));
}

/** Snapshots one official instanced declaration without touching WebGL. */
export function submitWebGLInstancedSubmission(
  composer: WebGLSceneComposer,
  input: CRCWebGLInstancedSubmission,
): void {
  const value = requireOpen(composer);
  const model = new Float32Array(16);
  multiplyMatrix4(model, value.modelStack.at(-1)!, input.localModel);
  value.instanced.push(Object.freeze({
    kind: 'instanced' as const,
    componentName: input.componentName,
    source: input.source === undefined ? undefined : Object.freeze({
      ...input.source,
    }),
    model,
    localBounds: snapshotBounds(input.localBounds),
    opacity: input.opacity,
    material: Object.freeze({ ...input.material }),
    depthTest: input.depthTest,
    depthWrite: input.depthWrite,
    sorting: input.sorting,
    target: input.target,
    recipe: input.recipe,
    frameUniforms: new Float32Array(input.frameUniforms),
    sourceIndex: value.nextSourceIndex++,
  }));
}

export function closeWebGLSceneComposer(
  composer: WebGLSceneComposer,
): ClosedWebGLSceneDraft {
  const value = requireOpen(composer);
  if (value.modelStack.length !== 1) {
    throw new Error('Cannot close WebGL scene composer with an unbalanced model stack.');
  }
  if (value.authoredTransformStack.length !== 0) {
    throw new Error(
      'Cannot close WebGL scene composer with an unbalanced authored transform stack.',
    );
  }
  value.state = 'closed';
  const draft = Object.freeze({
    contextGeneration: value.contextGeneration,
    camera: value.camera,
    logicalViewport: value.logicalViewport,
    backingViewport: value.backingViewport,
    density: value.density,
    timestamp: value.timestamp,
    shadowQuality: value.shadowQuality,
    meshes: Object.freeze(value.meshes.slice()),
    instanced: Object.freeze(value.instanced.slice()),
    lights: Object.freeze(value.lights.slice()),
    backgrounds: Object.freeze(value.backgrounds.slice()),
  });
  return draft;
}

function snapshotBounds(
  bounds: CRCWebGLInstancedSubmission['localBounds'],
): WebGLInstancedSubmission['localBounds'] {
  return Object.freeze({
    min: Object.freeze([...bounds.min]) as readonly [number, number, number],
    max: Object.freeze([...bounds.max]) as readonly [number, number, number],
  });
}

function snapshotColor(color: WebGLMeshSubmission['color']): WebGLMeshSubmission['color'] {
  return Object.freeze([...color]) as unknown as WebGLMeshSubmission['color'];
}

function composeLightModel(
  composer: MutableComposer,
  localModel: Readonly<Float32Array>,
): Readonly<Float32Array> {
  const model = new Float32Array(16);
  multiplyMatrix4(model, composer.modelStack.at(-1)!, localModel);
  return model;
}

export function discardWebGLSceneComposer(composer: WebGLSceneComposer): void {
  requireOpen(composer).state = 'closed';
}

function resolveTransformNumber(
  style: Readonly<CRCWebGLTransformStyle>,
  field: keyof CRCWebGLTransformStyle,
  fallback: number,
): number {
  const value = style[field] ?? fallback;
  if (!Number.isFinite(value)) {
    throw new TypeError(`WebGL transform.${field} must be finite.`);
  }
  if (field.startsWith('scale') && value === 0) {
    throw new RangeError(`WebGL transform.${field} must be nonzero.`);
  }
  return value;
}

function quaternionFromEulerDegrees(
  rotationX: number,
  rotationY: number,
  rotationZ: number,
): CRCWebGLAuthoredTransform['orientation'] {
  const halfX = rotationX * DEGREES_TO_RADIANS / 2;
  const halfY = rotationY * DEGREES_TO_RADIANS / 2;
  const halfZ = rotationZ * DEGREES_TO_RADIANS / 2;
  const sinX = Math.sin(halfX);
  const cosX = Math.cos(halfX);
  const sinY = Math.sin(halfY);
  const cosY = Math.cos(halfY);
  const sinZ = Math.sin(halfZ);
  const cosZ = Math.cos(halfZ);
  let x = sinX * cosY * cosZ - cosX * sinY * sinZ;
  let y = cosX * sinY * cosZ + sinX * cosY * sinZ;
  let z = cosX * cosY * sinZ - sinX * sinY * cosZ;
  let w = cosX * cosY * cosZ + sinX * sinY * sinZ;
  const length = Math.hypot(x, y, z, w);
  x /= length;
  y /= length;
  z /= length;
  w /= length;
  const firstSignificant = [w, x, y, z].find(value => value !== 0) ?? 1;
  if (firstSignificant < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  return Object.freeze([x, y, z, w]);
}
