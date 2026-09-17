import { getWebGLGeometryData } from '../geometry/geometry.js';
import {
  transformDirectionMatrix4,
  transformOriginMatrix4,
  transformPointMatrix4,
  transformBoundsMatrix4,
} from '../math/matrix4.js';
import type { CRCWebGLGeometry, CRCWebGLVector3 } from '../types.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  projectWebGLBoundsPoints,
  recordBoundsWebGLPick,
  recordGeometryWebGLPick,
  type CRCWebGLPickRecord,
} from '../pick-ledger.js';
import { closeWebGLSceneComposer } from './composer.js';
import {
  createSettledNormalMatrix,
  validateSettledNormalPair,
} from './normals.js';
import type {
  SettledWebGLBackground,
  SettledWebGLLight,
  SettledWebGLShading,
  WebGLBackgroundSubmission,
  WebGLLightSubmission,
  WebGLMeshSubmission,
  WebGLRGBA,
  WebGLSceneComposer,
  SettledWebGLShadowPlan,
  WebGLInstancedSubmission,
  WebGLWorldBounds,
} from './types.js';
import { createWebGLShadowPlans } from './shadows.js';

const MAX_LIGHTS = 8;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface SettledWebGLMesh extends WebGLMeshSubmission {
  readonly shading: SettledWebGLShading;
  readonly viewDepth: number;
  readonly worldBounds: WebGLWorldBounds;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
}

export type SettledWebGLPass = 'opaque' | 'transparent' | 'additive';

export interface SettledWebGLInstanced extends WebGLInstancedSubmission {
  readonly effectiveOpacity: number;
  readonly pass: SettledWebGLPass;
  readonly shading: 'unlit' | 'emissive';
  readonly viewDepth: number;
  readonly worldBounds: WebGLWorldBounds;
}

export type SettledWebGLSceneEntry =
  | SettledWebGLMesh
  | SettledWebGLInstanced;

export interface SettledWebGLScene {
  readonly contextGeneration: number;
  readonly camera: ReturnType<typeof closeWebGLSceneComposer>['camera'];
  readonly logicalViewport: ReturnType<typeof closeWebGLSceneComposer>['logicalViewport'];
  readonly backingViewport: ReturnType<typeof closeWebGLSceneComposer>['backingViewport'];
  readonly density: ReturnType<typeof closeWebGLSceneComposer>['density'];
  readonly timestamp: number;
  readonly meshes: readonly SettledWebGLMesh[];
  readonly instanced: readonly SettledWebGLInstanced[];
  readonly entries: readonly SettledWebGLSceneEntry[];
  readonly lights: readonly SettledWebGLLight[];
  readonly background: SettledWebGLBackground | undefined;
  readonly opaque: readonly SettledWebGLSceneEntry[];
  readonly transparent: readonly SettledWebGLSceneEntry[];
  readonly additive: readonly SettledWebGLInstanced[];
  readonly shadowQuality: ReturnType<typeof closeWebGLSceneComposer>['shadowQuality'];
  readonly shadowPlans: readonly SettledWebGLShadowPlan[];
  readonly pickEntries: readonly CRCWebGLPickRecord[];
}

/** Closes one CPU-only scene draft and derives its immutable render and pick plans. */
export function settleWebGLScene(composer: WebGLSceneComposer): SettledWebGLScene {
  const draft = closeWebGLSceneComposer(composer);
  assertDeclarationCapacity(draft.lights, draft.backgrounds);
  const validatedNormalPairs = new Map<
    CRCWebGLGeometry,
    Readonly<Float32Array>[]
  >();
  const meshes = Object.freeze(draft.meshes.map(mesh => settleMesh(
    mesh,
    draft.camera,
    validatedNormalPairs,
  )));
  const instanced = Object.freeze(draft.instanced.flatMap(submission => {
    const settled = settleInstanced(submission, draft.camera);
    return settled === undefined ? [] : [settled];
  }));
  const entries = Object.freeze([
    ...meshes,
    ...instanced,
  ].sort((left, right) => left.sourceIndex - right.sourceIndex));
  const lights = Object.freeze(draft.lights.map(settleLight));
  const background = draft.backgrounds[0] === undefined ? undefined :
    settleBackground(draft.backgrounds[0]);
  const opaque: SettledWebGLSceneEntry[] = [];
  const transparent: SettledWebGLSceneEntry[] = [];
  const additive: SettledWebGLInstanced[] = [];
  const ledger = createWebGLPickLedger(
    draft.logicalViewport.width,
    draft.logicalViewport.height,
  );

  for (const mesh of meshes) {
    const alpha = settledMeshAlpha(mesh);
    if (alpha === 1) opaque.push(mesh);
    else if (alpha > 0 && alpha < 1) transparent.push(mesh);
    if (mesh.target) {
      recordGeometryWebGLPick(ledger, {
        componentName: mesh.componentName,
        target: mesh.target,
        geometry: mesh.geometry,
        model: mesh.model,
        camera: draft.camera,
        keyboardNavigationBounds: mesh.keyboardNavigationBounds,
        sourceOrder: mesh.sourceIndex,
        depthMode: 'less-equal',
      });
    }
  }
  for (const submission of instanced) {
    if (submission.effectiveOpacity > 0) {
      if (submission.pass === 'opaque') opaque.push(submission);
      else if (submission.pass === 'transparent') transparent.push(submission);
      else additive.push(submission);
    }
    if (submission.target) {
      recordBoundsWebGLPick(ledger, {
        componentName: submission.componentName,
        target: submission.target,
        bounds: localBoundsToMatrixBounds(submission),
        model: submission.model,
        camera: draft.camera,
        sourceOrder: submission.sourceIndex,
        depthMode: 'less-equal',
      });
    }
  }
  opaque.sort((left, right) => left.sourceIndex - right.sourceIndex);
  transparent.sort(
    (left, right) => right.viewDepth - left.viewDepth ||
      left.sourceIndex - right.sourceIndex,
  );
  additive.sort((left, right) => left.sourceIndex - right.sourceIndex);
  const pickEntries = commitWebGLPickLedger(ledger).entries;
  const shadowPlans = createWebGLShadowPlans({
    meshes,
    lights,
    quality: draft.shadowQuality,
    contextGeneration: draft.contextGeneration,
  });
  return Object.freeze({
    contextGeneration: draft.contextGeneration,
    camera: draft.camera,
    logicalViewport: draft.logicalViewport,
    backingViewport: draft.backingViewport,
    density: draft.density,
    timestamp: draft.timestamp,
    meshes,
    instanced,
    entries,
    lights,
    background,
    opaque: Object.freeze(opaque),
    transparent: Object.freeze(transparent),
    additive: Object.freeze(additive),
    shadowQuality: draft.shadowQuality,
    shadowPlans,
    pickEntries,
  });
}

function settleInstanced(
  submission: WebGLInstancedSubmission,
  camera: ReturnType<typeof closeWebGLSceneComposer>['camera'],
): SettledWebGLInstanced | undefined {
  validateInstancedSubmission(submission);
  const localBounds = localBoundsToMatrixBounds(submission);
  const projected = projectWebGLBoundsPoints(
    localBounds,
    submission.model,
    camera,
    camera.viewport,
  );
  if (projected === undefined) return undefined;
  const center = Object.freeze([
    (localBounds.minimumX + localBounds.maximumX) / 2,
    (localBounds.minimumY + localBounds.maximumY) / 2,
    (localBounds.minimumZ + localBounds.maximumZ) / 2,
  ]) as CRCWebGLVector3;
  const world = new Float32Array(3);
  const view = new Float32Array(3);
  transformPointMatrix4(world, submission.model, center);
  transformPointMatrix4(
    view,
    camera.viewMatrix,
    world as unknown as CRCWebGLVector3,
  );
  const viewDepth = -view[2]!;
  if (!Number.isFinite(viewDepth)) {
    throw new RangeError(withSource(
      `${submission.componentName} bounds produce a non-finite view depth.`,
      submission.source,
    ));
  }
  return Object.freeze({
    ...submission,
    model: new Float32Array(submission.model),
    localBounds: Object.freeze({
      min: Object.freeze([...submission.localBounds.min]) as
        readonly [number, number, number],
      max: Object.freeze([...submission.localBounds.max]) as
        readonly [number, number, number],
    }),
    material: Object.freeze({ ...submission.material }),
    frameUniforms: new Float32Array(submission.frameUniforms),
    effectiveOpacity: submission.opacity,
    pass: submission.material.blend === 'cutout' ? 'opaque' :
      submission.material.blend === 'additive' ? 'additive' : 'transparent',
    shading: submission.material.type,
    viewDepth,
    worldBounds: transformBoundsMatrix4(submission.model, localBounds),
  });
}

function settleMesh(
  mesh: WebGLMeshSubmission,
  camera: ReturnType<typeof closeWebGLSceneComposer>['camera'],
  validatedNormalPairs: Map<CRCWebGLGeometry, Readonly<Float32Array>[]>,
): SettledWebGLMesh {
  validateMeshSubmission(mesh);
  const { bounds, normals } = getWebGLGeometryData(mesh.geometry);
  const shading = settleShading(mesh, normals, validatedNormalPairs);
  const center = [
    (bounds.minimumX + bounds.maximumX) / 2,
    (bounds.minimumY + bounds.maximumY) / 2,
    (bounds.minimumZ + bounds.maximumZ) / 2,
  ] as const;
  const world = new Float32Array(3);
  const view = new Float32Array(3);
  transformPointMatrix4(world, mesh.model, center);
  transformPointMatrix4(
    view,
    camera.viewMatrix,
    world as unknown as CRCWebGLVector3,
  );
  const viewDepth = -view[2]!;
  if (!Number.isFinite(viewDepth)) {
    throw new RangeError(withSource(
      `${mesh.componentName} geometry bounds produce a non-finite view depth.`,
      mesh.source,
    ));
  }
  const alpha = settledShadingAlpha(shading);
  return Object.freeze({
    ...mesh,
    model: new Float32Array(mesh.model),
    color: copyRGBA(mesh.color),
    shading,
    viewDepth,
    worldBounds: transformBoundsMatrix4(mesh.model, bounds),
    castShadow: alpha > 0 && (mesh.castShadow ?? alpha === 1),
    receiveShadow: alpha > 0 && mesh.lit &&
      (mesh.receiveShadow ?? true),
  });
}

function settledMeshAlpha(mesh: SettledWebGLMesh): number {
  return settledShadingAlpha(mesh.shading);
}

function settledShadingAlpha(shading: SettledWebGLShading): number {
  return shading.kind === 'pbr-metallic-roughness' ?
    shading.linearBaseColorFactor[3] :
    shading.kind === 'lambert' ? shading.linearBaseColor[3] :
      shading.displayBaseColor[3];
}

function settleShading(
  mesh: WebGLMeshSubmission,
  normals: Float32Array | undefined,
  validatedNormalPairs: Map<CRCWebGLGeometry, Readonly<Float32Array>[]>,
): SettledWebGLShading {
  if (mesh.material.type === 'pbr-metallic-roughness') {
    if (!mesh.lit) {
      throw new TypeError(withSource(
        `${mesh.componentName} imported metallic-roughness material must be lit.`,
        mesh.source,
      ));
    }
    const normalMatrix = settleMeshNormalMatrix(
      mesh,
      normals,
      validatedNormalPairs,
    );
    return Object.freeze({
      kind: 'pbr-metallic-roughness',
      linearBaseColorFactor: Object.freeze([
        decodeSRGB(mesh.color[0]) * mesh.material.baseColorFactor[0],
        decodeSRGB(mesh.color[1]) * mesh.material.baseColorFactor[1],
        decodeSRGB(mesh.color[2]) * mesh.material.baseColorFactor[2],
        mesh.color[3] * mesh.material.baseColorFactor[3],
      ]) as WebGLRGBA,
      ...(mesh.material.baseColorTexture === undefined ? {} : {
        baseColorTexture: mesh.material.baseColorTexture,
      }),
      metallicFactor: mesh.material.metallicFactor,
      roughnessFactor: mesh.material.roughnessFactor,
      normalMatrix,
    });
  }
  const linearEmissive = linearContribution(
    mesh,
    'style.material.emissiveColor',
    mesh.material.emissiveColor,
    mesh.material.emissiveIntensity,
  );
  if (!mesh.lit) {
    return Object.freeze({
      kind: 'unlit',
      displayBaseColor: copyRGBA(mesh.color),
      linearEmissive,
    });
  }
  const normalMatrix = settleMeshNormalMatrix(
    mesh,
    normals,
    validatedNormalPairs,
  );
  return Object.freeze({
    kind: 'lambert',
    linearBaseColor: Object.freeze([
      decodeSRGB(mesh.color[0]),
      decodeSRGB(mesh.color[1]),
      decodeSRGB(mesh.color[2]),
      mesh.color[3],
    ]) as WebGLRGBA,
    linearEmissive,
    normalMatrix,
  });
}

function settleMeshNormalMatrix(
  mesh: WebGLMeshSubmission,
  normals: Float32Array | undefined,
  validatedNormalPairs: Map<CRCWebGLGeometry, Readonly<Float32Array>[]>,
): Float32Array {
  if (normals === undefined) {
    throw new TypeError(withSource(
      `${mesh.componentName} lit geometry requires normals.`,
      mesh.source,
    ));
  }
  let normalMatrix: Float32Array;
  try {
    normalMatrix = createSettledNormalMatrix(mesh.model);
  } catch (error) {
    throw withMeshNormalDiagnostic(mesh, error);
  }
  try {
    validateDistinctNormalPair(
      mesh.geometry,
      normals,
      normalMatrix,
      validatedNormalPairs,
    );
  } catch (error) {
    throw withMeshNormalDiagnostic(mesh, error);
  }
  return normalMatrix;
}

function settleLight(light: WebGLLightSubmission): SettledWebGLLight {
  const intensity = settleNonnegativeFloat32(
    light,
    'style.intensity',
    light.intensity,
  );
  switch (light.kind) {
    case 'ambient':
      return Object.freeze({
        kind: 'ambient',
        linearColor: linearContribution(light, 'style.color', light.color, 1),
        intensity,
      });
    case 'hemisphere':
      return Object.freeze({
        kind: 'hemisphere',
        linearSkyColor: linearContribution(
          light,
          'style.skyColor',
          light.skyColor,
          1,
        ),
        linearGroundColor: linearContribution(
          light,
          'style.groundColor',
          light.groundColor,
          1,
        ),
        intensity,
        axis: settleDirection(light, [0, 1, 0], 'axis'),
      });
    case 'directional':
      return Object.freeze({
        kind: 'directional',
        linearColor: linearContribution(light, 'style.color', light.color, 1),
        intensity,
        direction: settleDirection(light, [0, 0, -1], 'direction'),
        identity: light.identity,
        castShadow: light.castShadow,
      });
    case 'point':
      return Object.freeze({
        kind: 'point',
        linearColor: linearContribution(light, 'style.color', light.color, 1),
        intensity,
        position: settlePosition(light),
        range: settleRange(light),
        identity: light.identity,
        castShadow: light.castShadow,
      });
    case 'spot': {
      const innerConeAngleDegrees = settleConeAngle(
        light,
        'innerConeAngleDegrees',
        light.innerConeAngleDegrees,
      );
      const outerConeAngleDegrees = settleConeAngle(
        light,
        'outerConeAngleDegrees',
        light.outerConeAngleDegrees,
      );
      if (innerConeAngleDegrees > outerConeAngleDegrees) {
        throw new RangeError(withSource(
          `${light.componentName} style.innerConeAngleDegrees must not ` +
          'exceed style.outerConeAngleDegrees.',
          light.source,
        ));
      }
      return Object.freeze({
        kind: 'spot',
        linearColor: linearContribution(light, 'style.color', light.color, 1),
        intensity,
        position: settlePosition(light),
        direction: settleDirection(light, [0, 0, -1], 'direction'),
        range: settleRange(light),
        innerConeCosine: Math.cos(
          innerConeAngleDegrees * DEGREES_TO_RADIANS,
        ),
        outerConeCosine: Math.cos(
          outerConeAngleDegrees * DEGREES_TO_RADIANS,
        ),
        identity: light.identity,
        castShadow: light.castShadow,
      });
    }
  }
}

function settleBackground(
  background: WebGLBackgroundSubmission,
): SettledWebGLBackground {
  validateRGBA(background, 'style.color', background.color);
  return Object.freeze({
    kind: 'background',
    color: copyRGBA(background.color),
  });
}

function settlePosition(
  light: Extract<WebGLLightSubmission, { readonly model: Readonly<Float32Array> }>,
): CRCWebGLVector3 {
  const position = new Float32Array(3);
  transformOriginMatrix4(position, light.model);
  if (!position.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${light.componentName} transformed position must be finite.`,
      light.source,
    ));
  }
  return freezeVector(position[0]!, position[1]!, position[2]!);
}

function settleDirection(
  light: Extract<WebGLLightSubmission, { readonly model: Readonly<Float32Array> }>,
  local: CRCWebGLVector3,
  field: 'axis' | 'direction',
): CRCWebGLVector3 {
  const transformed = new Float32Array(3);
  transformDirectionMatrix4(transformed, light.model, local);
  if (!transformed.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${light.componentName} transformed ${field} must be finite and nonzero.`,
      light.source,
    ));
  }
  const maximumComponent = Math.max(
    Math.abs(transformed[0]!),
    Math.abs(transformed[1]!),
    Math.abs(transformed[2]!),
  );
  if (!Number.isFinite(maximumComponent) || maximumComponent === 0) {
    throw new RangeError(withSource(
      `${light.componentName} transformed ${field} must be finite and nonzero.`,
      light.source,
    ));
  }
  const scaledX = transformed[0]! / maximumComponent;
  const scaledY = transformed[1]! / maximumComponent;
  const scaledZ = transformed[2]! / maximumComponent;
  const length = Math.hypot(scaledX, scaledY, scaledZ);
  const x = Math.fround(scaledX / length);
  const y = Math.fround(scaledY / length);
  const z = Math.fround(scaledZ / length);
  if (!Number.isFinite(length) || length === 0 ||
    !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
    (x === 0 && y === 0 && z === 0)) {
    throw new RangeError(withSource(
      `${light.componentName} transformed ${field} must be finite and nonzero.`,
      light.source,
    ));
  }
  return freezeVector(x, y, z);
}

function settleRange(
  light: Extract<
    WebGLLightSubmission,
    { readonly kind: 'point' | 'spot' }
  >,
): number | undefined {
  if (light.range === undefined) return undefined;
  if (!Number.isFinite(light.range)) {
    throw new TypeError(withSource(
      `${light.componentName} style.range must be finite.`,
      light.source,
    ));
  }
  if (light.range <= 0) {
    throw new RangeError(withSource(
      `${light.componentName} style.range must be positive.`,
      light.source,
    ));
  }
  const float32Range = Math.fround(light.range);
  if (!Number.isFinite(float32Range) || float32Range <= 0) {
    throw new RangeError(withSource(
      `${light.componentName} style.range must be representable as a ` +
      'finite, positive Float32.',
      light.source,
    ));
  }
  return light.range;
}

function settleConeAngle(
  light: Extract<WebGLLightSubmission, { readonly kind: 'spot' }>,
  field: 'innerConeAngleDegrees' | 'outerConeAngleDegrees',
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(withSource(
      `${light.componentName} style.${field} must be finite.`,
      light.source,
    ));
  }
  if (value < 0 || value > 90) {
    throw new RangeError(withSource(
      `${light.componentName} style.${field} must be between 0 and 90 degrees.`,
      light.source,
    ));
  }
  return value;
}

function settleNonnegativeFloat32(
  declaration: Pick<WebGLLightSubmission, 'componentName' | 'source'>,
  field: string,
  value: number,
): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(withSource(
      `${declaration.componentName} ${field} must be finite.`,
      declaration.source,
    ));
  }
  if (value < 0) {
    throw new RangeError(withSource(
      `${declaration.componentName} ${field} must be nonnegative.`,
      declaration.source,
    ));
  }
  if (!Number.isFinite(Math.fround(value))) {
    throw new RangeError(withSource(
      `${declaration.componentName} ${field} must be representable as a finite Float32.`,
      declaration.source,
    ));
  }
  return value;
}

function linearContribution(
  declaration: Pick<
    WebGLMeshSubmission | WebGLLightSubmission,
    'componentName' | 'source'
  >,
  field: string,
  color: WebGLRGBA,
  intensity: number,
): CRCWebGLVector3 {
  validateRGBA(declaration, field, color);
  if (!Number.isFinite(intensity) || intensity < 0 ||
    !Number.isFinite(Math.fround(intensity))) {
    throw new RangeError(withSource(
      `${declaration.componentName} ${field} contribution must be finite and nonnegative.`,
      declaration.source,
    ));
  }
  const contribution = color[3] * intensity;
  if (contribution === 0 ||
    (color[0] === 0 && color[1] === 0 && color[2] === 0)) {
    return freezeVector(0, 0, 0);
  }
  const red = decodeSRGB(color[0]) * contribution;
  const green = decodeSRGB(color[1]) * contribution;
  const blue = decodeSRGB(color[2]) * contribution;
  if (!Number.isFinite(red) || !Number.isFinite(green) ||
    !Number.isFinite(blue) ||
    !Number.isFinite(Math.fround(red)) ||
    !Number.isFinite(Math.fround(green)) ||
    !Number.isFinite(Math.fround(blue))) {
    throw new RangeError(withSource(
      `${declaration.componentName} ${field} contribution must be ` +
      'representable as finite Float32 values.',
      declaration.source,
    ));
  }
  return freezeVector(red, green, blue);
}

function decodeSRGB(value: number): number {
  return value <= 0.04045 ? value / 12.92 :
    ((value + 0.055) / 1.055) ** 2.4;
}

function validateMeshSubmission(mesh: WebGLMeshSubmission): void {
  if (typeof mesh.lit !== 'boolean') {
    throw new TypeError(withSource(
      `${mesh.componentName} style.lit must be a boolean.`,
      mesh.source,
    ));
  }
  if (mesh.material.type === 'lambert') {
    settleNonnegativeFloat32(
      mesh,
      'style.material.emissiveIntensity',
      mesh.material.emissiveIntensity,
    );
    validateRGBA(
      mesh,
      'style.material.emissiveColor',
      mesh.material.emissiveColor,
    );
  } else {
    validateRGBA(
      mesh,
      'material.baseColorFactor',
      mesh.material.baseColorFactor,
    );
    validateUnitMaterialFactor(mesh, 'metallicFactor', mesh.material.metallicFactor);
    validateUnitMaterialFactor(mesh, 'roughnessFactor', mesh.material.roughnessFactor);
  }
  validateRGBA(mesh, 'style.color', mesh.color);
  if (!mesh.model.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${mesh.componentName} model matrix must contain only finite Float32 values.`,
      mesh.source,
    ));
  }
}

function validateUnitMaterialFactor(
  mesh: WebGLMeshSubmission,
  field: 'metallicFactor' | 'roughnessFactor',
  value: number,
): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(withSource(
      `${mesh.componentName} material.${field} must be finite and between 0 and 1.`,
      mesh.source,
    ));
  }
}

function validateInstancedSubmission(
  submission: WebGLInstancedSubmission,
): void {
  if (submission.model.length !== 16 ||
    !submission.model.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${submission.componentName} model matrix must contain sixteen finite ` +
      'Float32 values.',
      submission.source,
    ));
  }
  const bounds = localBoundsToMatrixBounds(submission);
  for (const value of Object.values(bounds)) {
    if (!Number.isFinite(value)) {
      throw new RangeError(withSource(
        `${submission.componentName} local bounds must be finite.`,
        submission.source,
      ));
    }
  }
  if (bounds.minimumX > bounds.maximumX ||
    bounds.minimumY > bounds.maximumY ||
    bounds.minimumZ > bounds.maximumZ) {
    throw new RangeError(withSource(
      `${submission.componentName} local bounds minimum must not exceed maximum.`,
      submission.source,
    ));
  }
  if (!Number.isFinite(submission.opacity) ||
    submission.opacity < 0 || submission.opacity > 1) {
    throw new RangeError(withSource(
      `${submission.componentName} opacity must be finite and between 0 and 1.`,
      submission.source,
    ));
  }
  if (submission.material.type !== 'unlit' &&
    submission.material.type !== 'emissive') {
    throw new TypeError(withSource(
      `${submission.componentName} material type must be "unlit" or "emissive".`,
      submission.source,
    ));
  }
  if (submission.material.blend !== 'alpha' &&
    submission.material.blend !== 'additive' &&
    submission.material.blend !== 'cutout') {
    throw new TypeError(withSource(
      `${submission.componentName} material blend must be "alpha", ` +
      '"additive", or "cutout".',
      submission.source,
    ));
  }
  if (typeof submission.depthTest !== 'boolean' ||
    typeof submission.depthWrite !== 'boolean') {
    throw new TypeError(withSource(
      `${submission.componentName} depthTest and depthWrite must be booleans.`,
      submission.source,
    ));
  }
  if (submission.sorting !== 'none' &&
    submission.sorting !== 'oldest-first' &&
    submission.sorting !== 'youngest-first') {
    throw new TypeError(withSource(
      `${submission.componentName} sorting is not supported.`,
      submission.source,
    ));
  }
  if (!submission.frameUniforms.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${submission.componentName} frame uniforms must be finite Float32 values.`,
      submission.source,
    ));
  }
  validateInstancedRecipe(submission);
}

function validateInstancedRecipe(submission: WebGLInstancedSubmission): void {
  const { recipe } = submission;
  if (recipe.key === null ||
    (typeof recipe.key !== 'object' && typeof recipe.key !== 'function')) {
    throw new TypeError(withSource(
      `${submission.componentName} instanced recipe key must be an object.`,
      submission.source,
    ));
  }
  if (recipe.topology !== 'points' && recipe.topology !== 'triangles') {
    throw new TypeError(withSource(
      `${submission.componentName} instanced recipe topology is unsupported.`,
      submission.source,
    ));
  }
  if (recipe.vertexSource.length === 0 || recipe.fragmentSource.length === 0) {
    throw new TypeError(withSource(
      `${submission.componentName} instanced shader sources must be nonempty.`,
      submission.source,
    ));
  }
  if (!Number.isInteger(recipe.verticesPerInstance) ||
    recipe.verticesPerInstance <= 0 ||
    !Number.isInteger(recipe.capacity) || recipe.capacity <= 0) {
    throw new RangeError(withSource(
      `${submission.componentName} instanced recipe counts must be positive integers.`,
      submission.source,
    ));
  }
  if (recipe.staticVertexData !== undefined &&
    !recipe.staticVertexData.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${submission.componentName} static vertex data must be finite.`,
      submission.source,
    ));
  }
  for (const table of recipe.lookupTables) {
    if (!Number.isInteger(table.width) || table.width <= 0 ||
      !Number.isInteger(table.height) || table.height <= 0 ||
      ![1, 2, 3, 4].includes(table.channels) ||
      table.data.length !== table.width * table.height * table.channels ||
      !table.data.every(Number.isFinite)) {
      throw new RangeError(withSource(
        `${submission.componentName} lookup table dimensions and data must agree.`,
        submission.source,
      ));
    }
  }
}

function localBoundsToMatrixBounds(
  submission: Pick<WebGLInstancedSubmission, 'localBounds'>,
): WebGLWorldBounds {
  return Object.freeze({
    minimumX: submission.localBounds.min[0],
    minimumY: submission.localBounds.min[1],
    minimumZ: submission.localBounds.min[2],
    maximumX: submission.localBounds.max[0],
    maximumY: submission.localBounds.max[1],
    maximumZ: submission.localBounds.max[2],
  });
}

function validateRGBA(
  declaration: Pick<
    WebGLMeshSubmission | WebGLLightSubmission | WebGLBackgroundSubmission,
    'componentName' | 'source'
  >,
  field: string,
  color: WebGLRGBA,
): void {
  if (color.length !== 4 || color.some(value =>
    !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError(withSource(
      `${declaration.componentName} ${field} must resolve to four finite ` +
      'color components between 0 and 1.',
      declaration.source,
    ));
  }
}

function validateDistinctNormalPair(
  geometry: CRCWebGLGeometry,
  normals: Float32Array,
  normalMatrix: Readonly<Float32Array>,
  validated: Map<CRCWebGLGeometry, Readonly<Float32Array>[]>,
): void {
  const matrices = validated.get(geometry);
  if (matrices?.some(matrix => equalNormalMatrices(matrix, normalMatrix))) {
    return;
  }
  validateSettledNormalPair(normals, normalMatrix);
  if (matrices) matrices.push(normalMatrix);
  else validated.set(geometry, [normalMatrix]);
}

function equalNormalMatrices(
  left: Readonly<Float32Array>,
  right: Readonly<Float32Array>,
): boolean {
  for (let index = 0; index < 9; index += 1) {
    if (!Object.is(left[index], right[index])) return false;
  }
  return true;
}

function withMeshNormalDiagnostic(
  mesh: WebGLMeshSubmission,
  error: unknown,
): Error {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostic = withSource(`${mesh.componentName} ${message}`, mesh.source);
  return error instanceof TypeError ? new TypeError(diagnostic) :
    new RangeError(diagnostic);
}

function assertDeclarationCapacity(
  lights: readonly WebGLLightSubmission[],
  backgrounds: readonly WebGLBackgroundSubmission[],
): void {
  if (lights.length > MAX_LIGHTS) {
    const ninth = lights[MAX_LIGHTS]!;
    throw new RangeError(withSource(
      `WebGLLayer supports at most ${MAX_LIGHTS} light declarations; ` +
      `the ninth is ${ninth.componentName}.`,
      ninth.source,
    ));
  }
  if (backgrounds.length > 1) {
    const second = backgrounds[1]!;
    throw new RangeError(withSource(
      'WebGLLayer supports at most one WebGLBackground declaration; ' +
      `the second is ${second.componentName}.`,
      second.source,
    ));
  }
}

function copyRGBA(color: WebGLRGBA): WebGLRGBA {
  return Object.freeze([...color]) as WebGLRGBA;
}

function freezeVector(x: number, y: number, z: number): CRCWebGLVector3 {
  return Object.freeze([x, y, z]) as CRCWebGLVector3;
}

function withSource(
  message: string,
  source: WebGLMeshSubmission['source'],
): string {
  return source ?
    `${message} JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` :
    message;
}
