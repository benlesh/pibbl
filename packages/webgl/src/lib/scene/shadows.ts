import {
  multiplyMatrix4,
  setLookAtMatrix4,
  setOrthographicMatrix4,
  setPerspectiveMatrix4,
  transformBoundsMatrix4,
} from '../math/matrix4.js';
import type { CRCWebGLShadowQuality, CRCWebGLVector3 } from '../types.js';
import type { SettledWebGLMesh } from './settle.js';
import type {
  SettledDirectionalLight,
  SettledPointLight,
  SettledSpotLight,
  SettledWebGLLight,
  SettledWebGLShadowPlan,
  WebGLWorldBounds,
} from './types.js';

export const WEBGL_SHADOW_PROGRAM_GENERATION = 1;

export interface ResolvedWebGLShadowQuality {
  readonly quality: Exclude<CRCWebGLShadowQuality, false>;
  readonly requestedResolution: number;
  readonly comparisonCount: 1 | 4 | 9;
}

export function resolveWebGLShadowQuality(
  quality: CRCWebGLShadowQuality,
): ResolvedWebGLShadowQuality | undefined {
  if (quality === false) return undefined;
  switch (quality) {
    case 'low':
      return Object.freeze({
        quality,
        requestedResolution: 512,
        comparisonCount: 1,
      });
    case 'medium':
      return Object.freeze({
        quality,
        requestedResolution: 1024,
        comparisonCount: 4,
      });
    case 'high':
      return Object.freeze({
        quality,
        requestedResolution: 2048,
        comparisonCount: 9,
      });
  }
}

export function createWebGLShadowPlans(input: Readonly<{
  meshes: readonly SettledWebGLMesh[];
  lights: readonly SettledWebGLLight[];
  quality: CRCWebGLShadowQuality;
  contextGeneration: number;
}>): readonly SettledWebGLShadowPlan[] {
  const quality = resolveWebGLShadowQuality(input.quality);
  if (!quality) return Object.freeze([]);
  const casters = Object.freeze(input.meshes.filter(mesh => mesh.castShadow));
  const receivers = Object.freeze(input.meshes.filter(mesh => mesh.receiveShadow));
  if (casters.length === 0 || receivers.length === 0) return Object.freeze([]);
  const relevantBounds = unionBounds([...casters, ...receivers]);
  const plans: SettledWebGLShadowPlan[] = [];
  for (let lightIndex = 0; lightIndex < input.lights.length; lightIndex += 1) {
    const light = input.lights[lightIndex]!;
    if ((light.kind !== 'directional' && light.kind !== 'point' &&
      light.kind !== 'spot') ||
      !light.castShadow) continue;
    if (light.kind === 'directional') {
      plans.push(createDirectionalPlan(
        light,
        lightIndex,
        relevantBounds,
        casters,
        receivers,
        quality,
        input.contextGeneration,
      ));
    } else if (light.kind === 'point') {
      plans.push(createPointPlan(
        light,
        lightIndex,
        relevantBounds,
        casters,
        receivers,
        quality,
        input.contextGeneration,
      ));
    } else {
      const plan = createSpotPlan(
        light,
        lightIndex,
        relevantBounds,
        casters,
        receivers,
        quality,
        input.contextGeneration,
      );
      if (plan) plans.push(plan);
    }
  }
  return Object.freeze(plans);
}

export function haveSameWebGLShadowPlan(
  left: SettledWebGLShadowPlan,
  leftResolvedResolution: number,
  right: SettledWebGLShadowPlan,
  rightResolvedResolution: number,
): boolean {
  const hasSameDepthInputs = left.kind === right.kind &&
    left.lightIdentity === right.lightIdentity &&
    left.requestedResolution === right.requestedResolution &&
    leftResolvedResolution === rightResolvedResolution &&
    left.comparisonCount === right.comparisonCount &&
    left.contextGeneration === right.contextGeneration &&
    left.shadowProgramGeneration === right.shadowProgramGeneration &&
    equalShadowProjection(left, right) &&
    equalCasterQueue(left.casters, right.casters);
  if (!hasSameDepthInputs) return false;

  return left.kind === 'point' || left.kind === 'spot' || (
    left.bias === right.bias &&
    equalReceiverQueue(left.receivers, right.receivers)
  );
}

function equalShadowProjection(
  left: SettledWebGLShadowPlan,
  right: SettledWebGLShadowPlan,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'directional' && right.kind === 'directional') {
    return equalNumbers(
      left.projectionViewMatrix,
      right.projectionViewMatrix,
    );
  }
  if (left.kind === 'point' && right.kind === 'point') {
    return left.nearDistance === right.nearDistance &&
      left.farDistance === right.farDistance &&
      equalNumbers(left.lightPosition, right.lightPosition) &&
      equalMatrixQueue(
        left.projectionViewMatrices,
        right.projectionViewMatrices,
      );
  }
  if (left.kind === 'spot' && right.kind === 'spot') {
    return left.nearDistance === right.nearDistance &&
      left.farDistance === right.farDistance &&
      equalNumbers(left.lightPosition, right.lightPosition) &&
      equalNumbers(left.projectionViewMatrix, right.projectionViewMatrix);
  }
  return false;
}

function createDirectionalPlan(
  light: SettledDirectionalLight,
  lightIndex: number,
  bounds: WebGLWorldBounds,
  casters: readonly SettledWebGLMesh[],
  receivers: readonly SettledWebGLMesh[],
  quality: ResolvedWebGLShadowQuality,
  contextGeneration: number,
): SettledWebGLShadowPlan {
  const center: CRCWebGLVector3 = [
    (bounds.minimumX + bounds.maximumX) / 2,
    (bounds.minimumY + bounds.maximumY) / 2,
    (bounds.minimumZ + bounds.maximumZ) / 2,
  ];
  const radius = Math.max(0.5, Math.hypot(
    bounds.maximumX - bounds.minimumX,
    bounds.maximumY - bounds.minimumY,
    bounds.maximumZ - bounds.minimumZ,
  ) / 2);
  const distance = radius * 2 + 1;
  const position: CRCWebGLVector3 = [
    center[0] - light.direction[0] * distance,
    center[1] - light.direction[1] * distance,
    center[2] - light.direction[2] * distance,
  ];
  const up: CRCWebGLVector3 = Math.abs(light.direction[1]) < 0.999 ?
    [0, 1, 0] : [1, 0, 0];
  const view = new Float32Array(16);
  setLookAtMatrix4(view, position, center, up);
  const lightBounds = transformBoundsMatrix4(view, bounds);
  const horizontalPadding = Math.max(
    0.01,
    (lightBounds.maximumX - lightBounds.minimumX) * 0.05,
  );
  const verticalPadding = Math.max(
    0.01,
    (lightBounds.maximumY - lightBounds.minimumY) * 0.05,
  );
  const depthPadding = Math.max(
    0.01,
    (lightBounds.maximumZ - lightBounds.minimumZ) * 0.05,
  );
  const near = Math.max(0.01, -lightBounds.maximumZ - depthPadding);
  const far = Math.max(near + 0.02, -lightBounds.minimumZ + depthPadding);
  const projection = new Float32Array(16);
  setOrthographicMatrix4(
    projection,
    lightBounds.minimumX - horizontalPadding,
    lightBounds.maximumX + horizontalPadding,
    lightBounds.minimumY - verticalPadding,
    lightBounds.maximumY + verticalPadding,
    near,
    far,
  );
  const projectionViewMatrix = new Float32Array(16);
  multiplyMatrix4(projectionViewMatrix, projection, view);
  return Object.freeze({
    kind: 'directional',
    lightIdentity: light.identity,
    lightIndex,
    projectionViewMatrix,
    bias: 0.0015,
    casters,
    receivers,
    requestedResolution: quality.requestedResolution,
    comparisonCount: quality.comparisonCount,
    contextGeneration,
    shadowProgramGeneration: WEBGL_SHADOW_PROGRAM_GENERATION,
  });
}

function createSpotPlan(
  light: SettledSpotLight,
  lightIndex: number,
  bounds: WebGLWorldBounds,
  casters: readonly SettledWebGLMesh[],
  receivers: readonly SettledWebGLMesh[],
  quality: ResolvedWebGLShadowQuality,
  contextGeneration: number,
): SettledWebGLShadowPlan | undefined {
  const farDistance = light.range ?? derivePointFarDistance(
    light.position,
    bounds,
  );
  const target: CRCWebGLVector3 = [
    light.position[0] + light.direction[0],
    light.position[1] + light.direction[1],
    light.position[2] + light.direction[2],
  ];
  const up: CRCWebGLVector3 = Math.abs(light.direction[1]) < 0.999 ?
    [0, 1, 0] : [1, 0, 0];
  const view = new Float32Array(16);
  setLookAtMatrix4(view, light.position, target, up);
  const relevant = analyzeSpotRelevantBounds(
    view,
    light.position,
    [...casters, ...receivers],
  );
  if (!relevant.hasForwardBounds ||
    relevant.minimumRadialDistance >= farDistance) return undefined;
  const nearDistance = relevant.straddlesLightPlane ? Number.MIN_VALUE :
    relevant.nearestForwardDistance / 2;
  const projection = new Float32Array(16);
  const fieldOfViewRadians = Math.max(
    0.001,
    Math.acos(light.outerConeCosine) * 2,
  );
  setPerspectiveMatrix4(
    projection,
    fieldOfViewRadians,
    1,
    nearDistance,
    farDistance,
  );
  const projectionViewMatrix = new Float32Array(16);
  multiplyMatrix4(projectionViewMatrix, projection, view);
  const closestRelevantDepth = Math.min(
    farDistance,
    relevant.minimumRadialDistance,
  );
  const farthestRelevantDepth = Math.min(
    farDistance,
    relevant.maximumRadialDistance,
  );
  const radialDepthSpan = (
    farthestRelevantDepth - closestRelevantDepth
  ) / farDistance;
  const bias = Math.max(
    4 / 0xffffff,
    radialDepthSpan / (quality.requestedResolution * 4),
  );
  return Object.freeze({
    kind: 'spot',
    lightIdentity: light.identity,
    lightIndex,
    projectionViewMatrix,
    lightPosition: Object.freeze([
      light.position[0],
      light.position[1],
      light.position[2],
    ] as const),
    nearDistance,
    farDistance,
    bias,
    casters,
    receivers,
    requestedResolution: quality.requestedResolution,
    comparisonCount: quality.comparisonCount,
    contextGeneration,
    shadowProgramGeneration: WEBGL_SHADOW_PROGRAM_GENERATION,
  });
}

function analyzeSpotRelevantBounds(
  view: Readonly<Float32Array>,
  lightPosition: CRCWebGLVector3,
  meshes: readonly SettledWebGLMesh[],
): Readonly<{
  hasForwardBounds: boolean;
  straddlesLightPlane: boolean;
  nearestForwardDistance: number;
  minimumRadialDistance: number;
  maximumRadialDistance: number;
}> {
  let hasForwardBounds = false;
  let straddlesLightPlane = false;
  let nearestForwardDistance = Number.POSITIVE_INFINITY;
  let minimumRadialDistance = Number.POSITIVE_INFINITY;
  let maximumRadialDistance = 0;
  const visited = new Set<object>();
  for (const mesh of meshes) {
    if (visited.has(mesh.identity)) continue;
    visited.add(mesh.identity);
    const lightBounds = transformBoundsMatrix4(view, mesh.worldBounds);
    if (lightBounds.minimumZ >= 0) continue;
    hasForwardBounds = true;
    if (lightBounds.maximumZ >= 0) {
      straddlesLightPlane = true;
    } else {
      nearestForwardDistance = Math.min(
        nearestForwardDistance,
        -lightBounds.maximumZ,
      );
    }
    minimumRadialDistance = Math.min(
      minimumRadialDistance,
      minimumDistanceToBounds(lightPosition, mesh.worldBounds),
    );
    maximumRadialDistance = Math.max(
      maximumRadialDistance,
      maximumDistanceToBounds(lightPosition, mesh.worldBounds),
    );
  }
  return Object.freeze({
    hasForwardBounds,
    straddlesLightPlane,
    nearestForwardDistance,
    minimumRadialDistance,
    maximumRadialDistance,
  });
}

function minimumDistanceToBounds(
  position: CRCWebGLVector3,
  bounds: WebGLWorldBounds,
): number {
  const x = position[0] < bounds.minimumX ? bounds.minimumX - position[0] :
    position[0] > bounds.maximumX ? position[0] - bounds.maximumX : 0;
  const y = position[1] < bounds.minimumY ? bounds.minimumY - position[1] :
    position[1] > bounds.maximumY ? position[1] - bounds.maximumY : 0;
  const z = position[2] < bounds.minimumZ ? bounds.minimumZ - position[2] :
    position[2] > bounds.maximumZ ? position[2] - bounds.maximumZ : 0;
  return Math.hypot(x, y, z);
}

function maximumDistanceToBounds(
  position: CRCWebGLVector3,
  bounds: WebGLWorldBounds,
): number {
  let maximumDistance = 0;
  for (const x of [bounds.minimumX, bounds.maximumX]) {
    for (const y of [bounds.minimumY, bounds.maximumY]) {
      for (const z of [bounds.minimumZ, bounds.maximumZ]) {
        maximumDistance = Math.max(maximumDistance, Math.hypot(
          x - position[0],
          y - position[1],
          z - position[2],
        ));
      }
    }
  }
  return maximumDistance;
}

const POINT_SHADOW_FACES = Object.freeze([
  Object.freeze({ direction: [1, 0, 0] as const, up: [0, -1, 0] as const }),
  Object.freeze({ direction: [-1, 0, 0] as const, up: [0, -1, 0] as const }),
  Object.freeze({ direction: [0, 1, 0] as const, up: [0, 0, 1] as const }),
  Object.freeze({ direction: [0, -1, 0] as const, up: [0, 0, -1] as const }),
  Object.freeze({ direction: [0, 0, 1] as const, up: [0, -1, 0] as const }),
  Object.freeze({ direction: [0, 0, -1] as const, up: [0, -1, 0] as const }),
]);

function createPointPlan(
  light: SettledPointLight,
  lightIndex: number,
  bounds: WebGLWorldBounds,
  casters: readonly SettledWebGLMesh[],
  receivers: readonly SettledWebGLMesh[],
  quality: ResolvedWebGLShadowQuality,
  contextGeneration: number,
): SettledWebGLShadowPlan {
  const farDistance = light.range ?? derivePointFarDistance(
    light.position,
    bounds,
  );
  const nearDistance = Math.min(0.01, farDistance / 2);
  const projection = new Float32Array(16);
  setPerspectiveMatrix4(projection, Math.PI / 2, 1, nearDistance, farDistance);
  const projectionViewMatrices = Object.freeze(POINT_SHADOW_FACES.map(face => {
    const target: CRCWebGLVector3 = [
      light.position[0] + face.direction[0],
      light.position[1] + face.direction[1],
      light.position[2] + face.direction[2],
    ];
    const view = new Float32Array(16);
    setLookAtMatrix4(view, light.position, target, face.up);
    const projectionView = new Float32Array(16);
    multiplyMatrix4(projectionView, projection, view);
    return projectionView as Readonly<Float32Array>;
  }));
  return Object.freeze({
    kind: 'point',
    lightIdentity: light.identity,
    lightIndex,
    projectionViewMatrices,
    lightPosition: Object.freeze([
      light.position[0],
      light.position[1],
      light.position[2],
    ] as const),
    nearDistance,
    farDistance,
    bias: 0.0015,
    casters,
    receivers,
    requestedResolution: quality.requestedResolution,
    comparisonCount: quality.comparisonCount,
    contextGeneration,
    shadowProgramGeneration: WEBGL_SHADOW_PROGRAM_GENERATION,
  });
}

function derivePointFarDistance(
  position: CRCWebGLVector3,
  bounds: WebGLWorldBounds,
): number {
  return Math.max(0.02, maximumDistanceToBounds(position, bounds) * 1.05);
}

function unionBounds(meshes: readonly SettledWebGLMesh[]): WebGLWorldBounds {
  let bounds = meshes[0]!.worldBounds;
  for (const mesh of meshes.slice(1)) {
    const next = mesh.worldBounds;
    bounds = Object.freeze({
      minimumX: Math.min(bounds.minimumX, next.minimumX),
      minimumY: Math.min(bounds.minimumY, next.minimumY),
      minimumZ: Math.min(bounds.minimumZ, next.minimumZ),
      maximumX: Math.max(bounds.maximumX, next.maximumX),
      maximumY: Math.max(bounds.maximumY, next.maximumY),
      maximumZ: Math.max(bounds.maximumZ, next.maximumZ),
    });
  }
  return bounds;
}

function equalCasterQueue(
  left: readonly SettledWebGLMesh[],
  right: readonly SettledWebGLMesh[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.identity !== b.identity || a.geometry !== b.geometry ||
      alphaClass(a.color[3]) !== alphaClass(b.color[3]) ||
      a.castShadow !== b.castShadow ||
      !equalNumbers(a.model, b.model) ||
      !equalBounds(a.worldBounds, b.worldBounds)) return false;
  }
  return true;
}

function equalReceiverQueue(
  left: readonly SettledWebGLMesh[],
  right: readonly SettledWebGLMesh[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (a.receiveShadow !== b.receiveShadow ||
      !equalBounds(a.worldBounds, b.worldBounds)) return false;
  }
  return true;
}

function alphaClass(alpha: number): 0 | 1 | 2 {
  return alpha === 0 ? 0 : alpha === 1 ? 2 : 1;
}

function equalBounds(left: WebGLWorldBounds, right: WebGLWorldBounds): boolean {
  return left.minimumX === right.minimumX &&
    left.minimumY === right.minimumY &&
    left.minimumZ === right.minimumZ &&
    left.maximumX === right.maximumX &&
    left.maximumY === right.maximumY &&
    left.maximumZ === right.maximumZ;
}

function equalNumbers(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function equalMatrixQueue(
  left: readonly ArrayLike<number>[],
  right: readonly ArrayLike<number>[],
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!equalNumbers(left[index]!, right[index]!)) return false;
  }
  return true;
}
