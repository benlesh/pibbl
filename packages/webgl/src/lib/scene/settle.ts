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
  recordGeometryWebGLPick,
  type CRCWebGLGeometryPickRecord,
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

export interface SettledWebGLScene {
  readonly contextGeneration: number;
  readonly camera: ReturnType<typeof closeWebGLSceneComposer>['camera'];
  readonly logicalViewport: ReturnType<typeof closeWebGLSceneComposer>['logicalViewport'];
  readonly backingViewport: ReturnType<typeof closeWebGLSceneComposer>['backingViewport'];
  readonly density: ReturnType<typeof closeWebGLSceneComposer>['density'];
  readonly timestamp: number;
  readonly meshes: readonly SettledWebGLMesh[];
  readonly lights: readonly SettledWebGLLight[];
  readonly background: SettledWebGLBackground | undefined;
  readonly opaque: readonly SettledWebGLMesh[];
  readonly transparent: readonly SettledWebGLMesh[];
  readonly shadowQuality: ReturnType<typeof closeWebGLSceneComposer>['shadowQuality'];
  readonly shadowPlans: readonly SettledWebGLShadowPlan[];
  readonly pickEntries: readonly CRCWebGLGeometryPickRecord[];
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
  const lights = Object.freeze(draft.lights.map(settleLight));
  const background = draft.backgrounds[0] === undefined ? undefined :
    settleBackground(draft.backgrounds[0]);
  const opaque: SettledWebGLMesh[] = [];
  const transparent: SettledWebGLMesh[] = [];
  const ledger = createWebGLPickLedger(
    draft.logicalViewport.width,
    draft.logicalViewport.height,
  );

  for (const mesh of meshes) {
    if (mesh.color[3] === 1) opaque.push(mesh);
    else if (mesh.color[3]! > 0 && mesh.color[3]! < 1) transparent.push(mesh);
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
  transparent.sort(
    (left, right) => right.viewDepth - left.viewDepth ||
      left.sourceIndex - right.sourceIndex,
  );
  const pickEntries = commitWebGLPickLedger(ledger).entries as
    readonly CRCWebGLGeometryPickRecord[];
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
    lights,
    background,
    opaque: Object.freeze(opaque),
    transparent: Object.freeze(transparent),
    shadowQuality: draft.shadowQuality,
    shadowPlans,
    pickEntries,
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
  return Object.freeze({
    ...mesh,
    model: new Float32Array(mesh.model),
    color: copyRGBA(mesh.color),
    shading,
    viewDepth,
    worldBounds: transformBoundsMatrix4(mesh.model, bounds),
    castShadow: mesh.color[3] > 0 && (mesh.castShadow ?? mesh.color[3] === 1),
    receiveShadow: mesh.color[3] > 0 && mesh.lit &&
      (mesh.receiveShadow ?? true),
  });
}

function settleShading(
  mesh: WebGLMeshSubmission,
  normals: Float32Array | undefined,
  validatedNormalPairs: Map<CRCWebGLGeometry, Readonly<Float32Array>[]>,
): SettledWebGLShading {
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
  if (mesh.material.type !== 'lambert') {
    throw new TypeError(withSource(
      `${mesh.componentName} style.material.type must be "lambert".`,
      mesh.source,
    ));
  }
  settleNonnegativeFloat32(
    mesh,
    'style.material.emissiveIntensity',
    mesh.material.emissiveIntensity,
  );
  validateRGBA(mesh, 'style.color', mesh.color);
  validateRGBA(
    mesh,
    'style.material.emissiveColor',
    mesh.material.emissiveColor,
  );
  if (!mesh.model.every(Number.isFinite)) {
    throw new RangeError(withSource(
      `${mesh.componentName} model matrix must contain only finite Float32 values.`,
      mesh.source,
    ));
  }
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
