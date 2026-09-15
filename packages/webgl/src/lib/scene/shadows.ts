import {
  multiplyMatrix4,
  setLookAtMatrix4,
  setOrthographicMatrix4,
  transformBoundsMatrix4,
} from '../math/matrix4.js';
import type { CRCWebGLShadowQuality, CRCWebGLVector3 } from '../types.js';
import type { SettledWebGLMesh } from './settle.js';
import type {
  SettledDirectionalLight,
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

export function createDirectionalShadowPlans(input: Readonly<{
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
    if (light.kind !== 'directional' || !light.castShadow) continue;
    plans.push(createDirectionalPlan(
      light,
      lightIndex,
      relevantBounds,
      casters,
      receivers,
      quality,
      input.contextGeneration,
    ));
  }
  return Object.freeze(plans);
}

export function haveSameDirectionalShadowPlan(
  left: SettledWebGLShadowPlan,
  leftResolvedResolution: number,
  right: SettledWebGLShadowPlan,
  rightResolvedResolution: number,
): boolean {
  return left.kind === right.kind &&
    left.lightIdentity === right.lightIdentity &&
    left.lightIndex === right.lightIndex &&
    left.requestedResolution === right.requestedResolution &&
    leftResolvedResolution === rightResolvedResolution &&
    left.comparisonCount === right.comparisonCount &&
    left.bias === right.bias &&
    left.contextGeneration === right.contextGeneration &&
    left.shadowProgramGeneration === right.shadowProgramGeneration &&
    equalNumbers(left.projectionViewMatrix, right.projectionViewMatrix) &&
    equalCasterQueue(left.casters, right.casters) &&
    equalReceiverQueue(left.receivers, right.receivers);
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
