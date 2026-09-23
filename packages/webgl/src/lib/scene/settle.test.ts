import { describe, expect, test } from 'vitest';
import type { CRCBackendFrameInput, CRCEventTargetRegistration } from '@crc/core/internal';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveWebGLPBRMetallicRoughnessMaterial } from '../components/material.js';
import { createInternalWebGLTexture } from '../texture/texture.js';
import { resolveCamera } from '../math/camera.js';
import {
  createWebGLSceneComposer,
  pushWebGLModelMatrix,
  submitWebGLBackground,
  submitWebGLLight,
  submitWebGLMesh,
} from './composer.js';
import { settleWebGLScene } from './settle.js';
import type { WebGLSceneComposer } from './types.js';

const frame = {
  canvas: {} as HTMLCanvasElement,
  logicalWidth: 100,
  logicalHeight: 100,
  backingWidth: 200,
  backingHeight: 200,
  renderTimestamp: 123.5,
} as CRCBackendFrameInput;

const identity = () => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);
const translatedZ = (z: number) => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, z, 1,
]);
const geometry = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
});
const geometryWithoutNormals = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
});

describe('settled WebGL scene', () => {
  test('classifies final alpha, sorts transparent bounds centers, and derives shared pick data', () => {
    const camera = resolveCamera(undefined, 100, 100);
    const composer = createWebGLSceneComposer({ frame, camera, contextGeneration: 7 });
    const opaqueFirst = fakeTarget();
    const opaqueSecond = fakeTarget();
    const transparentFar = fakeTarget();
    const transparentTieFirst = fakeTarget();
    const transparentTieLater = fakeTarget();
    const transparentZero = fakeTarget();
    const explicitBounds = { x: 1, y: 2, width: 3, height: 4 };
    const models = [identity(), translatedZ(1), translatedZ(-3), translatedZ(-2), translatedZ(-2), translatedZ(2)];
    const colors = [1, 1, 0.75, 0.25, 0.25, 0] as const;
    const targets = [opaqueFirst, opaqueSecond, transparentFar, transparentTieFirst, transparentTieLater, transparentZero];
    for (let index = 0; index < models.length; index += 1) {
      submitWebGLMesh(composer, {
        componentName: `Mesh${index}`,
        geometry,
        localModel: models[index]!,
        color: [1, 0.5, 0.25, colors[index]!] as const,
        target: targets[index]!,
        keyboardNavigationBounds: index === 1 ? explicitBounds : undefined,
      });
    }

    models.forEach(model => { model[14] = 99; });
    explicitBounds.x = 99;
    mutateCallerOwnedMatrix(camera.projectionMatrix, 0, 99);
    const settled = settleWebGLScene(composer);

    expect(settled.meshes.map(mesh => mesh.sourceIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(settled.opaque.map(mesh => mesh.sourceIndex)).toEqual([0, 1]);
    expect(settled.transparent.map(mesh => mesh.sourceIndex)).toEqual([2, 3, 4]);
    expect(settled.transparent.map(mesh => mesh.viewDepth)).toEqual([8, 7, 7]);
    expect(settled.pickEntries).toHaveLength(6);
    expect(settled.pickEntries.map(entry => entry.sourceOrder)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(settled.pickEntries.every(entry => entry.kind === 'geometry' && entry.depthMode === 'less-equal')).toBe(true);
    expect(settled.pickEntries.map(entry =>
      entry.kind === 'geometry' ? entry.geometry : undefined,
    )).toEqual([geometry, geometry, geometry, geometry, geometry, geometry]);
    expect(settled.pickEntries.map(entry => Array.from(entry.model)[14])).toEqual([0, 1, -3, -2, -2, 2]);
    expect(settled.camera.projectionMatrix[0]).not.toBe(99);
    expect(settled.pickEntries[1]!.keyboardNavigationBounds).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(settled.pickEntries[0]!.keyboardNavigationPoints).toBeDefined();
    expect(Object.isFrozen(settled)).toBe(true);
    expect(Object.isFrozen(settled.meshes)).toBe(true);
    expect(Object.isFrozen(settled.opaque)).toBe(true);
    expect(Object.isFrozen(settled.transparent)).toBe(true);
    expect(Object.isFrozen(settled.pickEntries)).toBe(true);
  });

  test('requires normals for default-lit meshes with component and JSX diagnostics', () => {
    const composer = createComposer();
    submitWebGLMesh(composer, {
      componentName: 'CustomSurface',
      source: {
        fileName: '/app/lighting-scene.tsx',
        lineNumber: 12,
        columnNumber: 7,
      },
      geometry: geometryWithoutNormals,
      localModel: identity(),
      color: [1, 1, 1, 1],
    });

    expect(() => settleWebGLScene(composer)).toThrow(
      'CustomSurface lit geometry requires normals. ' +
      'JSX source: /app/lighting-scene.tsx:12:7.',
    );
  });

  test('accepts singular unlit models but rejects singular lit normal matrices', () => {
    const singular = new Float32Array(16);
    singular[5] = 1;
    singular[10] = 1;
    singular[15] = 1;
    const lit = createComposer();
    submitWebGLMesh(lit, {
      componentName: 'LitSurface',
      geometry,
      localModel: singular,
      color: [1, 1, 1, 1],
    });
    expect(() => settleWebGLScene(lit)).toThrow(
      'LitSurface lit normal matrix must be invertible',
    );

    const unlit = createComposer();
    submitWebGLMesh(unlit, {
      componentName: 'UnlitSurface',
      geometry: geometryWithoutNormals,
      localModel: singular,
      color: [1, 1, 1, 1],
      lit: false,
    });
    expect(() => settleWebGLScene(unlit)).not.toThrow();
  });

  test('rejects lit normal pairings that lose a required Float32 direction', () => {
    const extreme = new Float32Array([
      Math.fround(3e38), 0, 0, 0,
      0, Math.fround(1e-45), 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const xNormalGeometry = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
      normals: [1, 0, 0, 1, 0, 0, 1, 0, 0],
    });
    const composer = createComposer();
    submitWebGLMesh(composer, {
      componentName: 'ExtremeSurface',
      geometry: xNormalGeometry,
      localModel: extreme,
      color: [1, 1, 1, 1],
    });

    expect(() => settleWebGLScene(composer)).toThrow(
      'ExtremeSurface lit normal matrix must transform every geometry normal',
    );
  });

  test('settles unlit display color and linear lit base and emissive values', () => {
    const composer = createComposer();
    submitWebGLMesh(composer, {
      componentName: 'UnlitFastPath',
      geometry: geometryWithoutNormals,
      localModel: identity(),
      color: [0.5, 0.25, 1, 0.4],
      lit: false,
    });
    submitWebGLMesh(composer, {
      componentName: 'UnlitEmission',
      geometry: geometryWithoutNormals,
      localModel: identity(),
      color: [0.5, 0.25, 1, 0.4],
      lit: false,
      material: {
        type: 'lambert',
        emissiveColor: [0.5, 0.25, 1, 0.5],
        emissiveIntensity: 2,
      },
    });
    submitWebGLMesh(composer, {
      componentName: 'LambertSurface',
      geometry,
      localModel: identity(),
      color: [0.5, 0.25, 1, 0.4],
      material: {
        type: 'lambert',
        emissiveColor: [0.5, 0.25, 1, 0.5],
        emissiveIntensity: 2,
      },
    });

    const settled = settleWebGLScene(composer);
    expect(settled.meshes[0]!.shading).toEqual({
      kind: 'unlit',
      displayBaseColor: [0.5, 0.25, 1, 0.4],
      linearEmissive: [0, 0, 0],
    });
    expect(settled.meshes[1]!.shading).toEqual({
      kind: 'unlit',
      displayBaseColor: [0.5, 0.25, 1, 0.4],
      linearEmissive: [
        0.21404114048223255,
        0.05087608817155679,
        1,
      ],
    });
    expect(settled.meshes[2]!.shading).toMatchObject({
      kind: 'lambert',
      linearBaseColor: [
        0.21404114048223255,
        0.05087608817155679,
        1,
        0.4,
      ],
      linearEmissive: [
        0.21404114048223255,
        0.05087608817155679,
        1,
      ],
    });
    expect('normalMatrix' in settled.meshes[0]!.shading).toBe(false);
    expect(Array.from(
      settled.meshes[2]!.shading.kind === 'lambert' ?
        settled.meshes[2]!.shading.normalMatrix : [],
    )).toEqual([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
    const unlitShading = settled.meshes[0]!.shading;
    if (unlitShading.kind !== 'unlit') {
      throw new Error('Expected the first mesh to use unlit shading.');
    }
    expect(Object.isFrozen(unlitShading)).toBe(true);
    expect(Object.isFrozen(unlitShading.displayBaseColor)).toBe(true);
    expect(Object.isFrozen(unlitShading.linearEmissive)).toBe(true);
  });

  test('settles PBR factors in linear space and classifies factor alpha', () => {
    const composer = createComposer();
    const material = resolveWebGLPBRMetallicRoughnessMaterial(
      'ImportedSurface',
      {
        type: 'pbr-metallic-roughness',
        baseColorFactor: [0.25, 0.5, 0.75, 0.5],
        metallicFactor: 0.2,
        roughnessFactor: 0.6,
      },
    );
    submitWebGLMesh(composer, {
      componentName: 'ImportedSurface',
      geometry,
      localModel: identity(),
      color: [0.5, 0.25, 1, 0.5] as const,
      material,
    });

    const settled = settleWebGLScene(composer);

    expect(settled.meshes[0]!.shading).toMatchObject({
      kind: 'pbr-metallic-roughness',
      linearBaseColorFactor: [
        0.21404114048223255 * 0.25,
        0.05087608817155679 * 0.5,
        0.75,
        0.25,
      ],
      metallicFactor: 0.2,
      roughnessFactor: 0.6,
    });
    expect(settled.opaque).toHaveLength(0);
    expect(settled.transparent).toEqual([settled.meshes[0]]);
  });

  test('keeps a textured PBR surface opaque when factor and tint alpha are one', () => {
    const producer = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close() {},
    } as unknown as ImageBitmap);
    const material = resolveWebGLPBRMetallicRoughnessMaterial(
      'ImportedSurface',
      {
        type: 'pbr-metallic-roughness',
        baseColorTexture: {
          texture: producer.texture,
          textureCoordinate: 0,
        },
      },
    );
    const composer = createComposer();
    submitWebGLMesh(composer, {
      componentName: 'ImportedSurface',
      geometry,
      localModel: identity(),
      color: [1, 1, 1, 1] as const,
      material,
    });

    const settled = settleWebGLScene(composer);
    expect(settled.opaque).toEqual([settled.meshes[0]]);
    expect(settled.transparent).toHaveLength(0);
    producer.release();
  });

  test('settles ordered world-space light poses without scaling optical fields', () => {
    const composer = createComposer();
    submitWebGLLight(composer, {
      kind: 'ambient',
      componentName: 'AmbientLight',
      color: [0.5, 0.25, 1, 0.5],
      intensity: 0.25,
    });
    submitWebGLLight(composer, {
      kind: 'hemisphere',
      componentName: 'HemisphereLight',
      localModel: identity(),
      skyColor: [1, 1, 1, 1],
      groundColor: [0, 0, 0, 1],
      intensity: 0.5,
    });
    submitWebGLLight(composer, {
      kind: 'directional',
      componentName: 'DirectionalLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 1,
    });
    submitWebGLLight(composer, {
      kind: 'point',
      componentName: 'PointLight',
      localModel: translation(3, 4, 2),
      color: [1, 1, 1, 1],
      intensity: 2,
      range: 12,
    });
    submitWebGLLight(composer, {
      kind: 'spot',
      componentName: 'SpotLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 3,
      range: undefined,
      innerConeAngleDegrees: 0,
      outerConeAngleDegrees: 45,
    });

    const settled = settleWebGLScene(composer);
    expect(settled.lights).toMatchObject([
      {
        kind: 'ambient',
        linearColor: [
          0.10702057024111628,
          0.025438044085778395,
          0.5,
        ],
        intensity: 0.25,
      },
      { kind: 'hemisphere', axis: [0, 1, 0], intensity: 0.5 },
      { kind: 'directional', direction: [0, 0, -1], intensity: 1 },
      {
        kind: 'point',
        position: [3, 4, 2],
        range: 12,
        intensity: 2,
      },
      {
        kind: 'spot',
        position: [0, 0, 0],
        direction: [0, 0, -1],
        range: undefined,
        innerConeCosine: 1,
        outerConeCosine: Math.SQRT1_2,
        intensity: 3,
      },
    ]);
    const ambientLight = settled.lights[0]!;
    if (ambientLight.kind !== 'ambient') {
      throw new Error('Expected the first settled light to be ambient.');
    }
    expect(Object.isFrozen(settled.lights)).toBe(true);
    expect(Object.isFrozen(ambientLight)).toBe(true);
    expect(Object.isFrozen(ambientLight.linearColor)).toBe(true);
  });

  test.each(['point', 'spot'] as const)(
    'rejects %s ranges that underflow to the omitted-range Float32 sentinel',
    kind => {
      const composer = createComposer();
      const common = {
        componentName: kind === 'point' ? 'PointLight' : 'SpotLight',
        localModel: identity(),
        color: [1, 1, 1, 1] as const,
        intensity: 1,
        range: Number.MIN_VALUE,
        castShadow: false,
      };
      if (kind === 'point') {
        submitWebGLLight(composer, { ...common, kind });
      } else {
        submitWebGLLight(composer, {
          ...common,
          kind,
          innerConeAngleDegrees: 0,
          outerConeAngleDegrees: 45,
        });
      }

      expect(() => settleWebGLScene(composer)).toThrowError(
        new RegExp(
          `${common.componentName}.*range.*finite.*positive.*Float32`,
          'i',
        ),
      );
    },
  );

  test('accepts the smallest positive Float32 range and preserves omitted range', () => {
    const smallestPositiveFloat32 = Math.fround(1e-45);
    const composer = createComposer();
    submitWebGLLight(composer, {
      kind: 'point',
      componentName: 'PointLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 1,
      range: smallestPositiveFloat32,
      castShadow: false,
    });
    submitWebGLLight(composer, {
      kind: 'spot',
      componentName: 'SpotLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 1,
      range: smallestPositiveFloat32,
      innerConeAngleDegrees: 0,
      outerConeAngleDegrees: 45,
      castShadow: false,
    });
    submitWebGLLight(composer, {
      kind: 'point',
      componentName: 'UnboundedPointLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 1,
      range: undefined,
      castShadow: false,
    });

    expect(settleWebGLScene(composer).lights.map(light =>
      'range' in light ? light.range : null)).toEqual([
      smallestPositiveFloat32,
      smallestPositiveFloat32,
      undefined,
    ]);
  });

  test('composes group scale into light pose but not intensity, range, or cone', () => {
    const composer = createComposer();
    const release = pushWebGLModelMatrix(composer, scale(2, 3, 4));
    submitWebGLLight(composer, {
      kind: 'point',
      componentName: 'PointLight',
      localModel: translation(3, 4, 2),
      color: [1, 1, 1, 1],
      intensity: 2,
      range: 12,
    });
    submitWebGLLight(composer, {
      kind: 'spot',
      componentName: 'SpotLight',
      localModel: identity(),
      color: [1, 1, 1, 1],
      intensity: 3,
      range: 10,
      innerConeAngleDegrees: 15,
      outerConeAngleDegrees: 30,
    });
    release();

    const settled = settleWebGLScene(composer);
    expect(settled.lights[0]).toMatchObject({
      kind: 'point',
      position: [6, 12, 8],
      intensity: 2,
      range: 12,
    });
    expect(settled.lights[1]).toMatchObject({
      kind: 'spot',
      direction: [0, 0, -1],
      intensity: 3,
      range: 10,
      innerConeCosine: Math.cos(15 * Math.PI / 180),
      outerConeCosine: Math.cos(30 * Math.PI / 180),
    });
  });

  test('accepts eight lights, counts zero intensity, and rejects the ninth', () => {
    const accepted = createComposer();
    submitAmbientLights(accepted, 8);
    expect(settleWebGLScene(accepted).lights).toHaveLength(8);

    const rejected = createComposer();
    submitAmbientLights(rejected, 9);
    expect(() => settleWebGLScene(rejected)).toThrow(
      'WebGLLayer supports at most 8 light declarations',
    );
  });

  test('accepts one immutable background and rejects a second with JSX diagnostics', () => {
    const accepted = createComposer();
    const color = [0.1, 0.2, 0.3, 0.4] as [number, number, number, number];
    submitWebGLBackground(accepted, {
      componentName: 'WebGLBackground',
      color,
    });
    color[0] = 1;
    const settled = settleWebGLScene(accepted);
    expect(settled.background).toEqual({
      kind: 'background',
      color: [0.1, 0.2, 0.3, 0.4],
    });
    expect(Object.isFrozen(settled.background)).toBe(true);
    expect(Object.isFrozen(settled.background!.color)).toBe(true);

    const rejected = createComposer();
    submitWebGLBackground(rejected, {
      componentName: 'FirstBackground',
      color: [0, 0, 0, 1],
    });
    submitWebGLBackground(rejected, {
      componentName: 'SecondBackground',
      source: {
        fileName: '/app/backgrounds.tsx',
        lineNumber: 8,
        columnNumber: 5,
      },
      color: [1, 1, 1, 1],
    });
    expect(() => settleWebGLScene(rejected)).toThrow(
      'WebGLLayer supports at most one WebGLBackground declaration; ' +
      'the second is SecondBackground. ' +
      'JSX source: /app/backgrounds.tsx:8:5.',
    );
  });
});

function createComposer(): WebGLSceneComposer {
  return createWebGLSceneComposer({
    frame,
    camera: resolveCamera(undefined, 100, 100),
    contextGeneration: 7,
  });
}

function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function scale(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

function submitAmbientLights(
  composer: WebGLSceneComposer,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    submitWebGLLight(composer, {
      kind: 'ambient',
      componentName: `AmbientLight${index}`,
      ...(index === 8 ? {
        source: {
          fileName: '/app/lights.tsx',
          lineNumber: 18,
          columnNumber: 9,
        },
      } : {}),
      color: [1, 1, 1, 1],
      intensity: index === 0 ? 0 : 1,
    });
  }
}

function fakeTarget(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}

function mutateCallerOwnedMatrix(
  matrix: Readonly<Float32Array>,
  index: number,
  value: number,
): void {
  (matrix as Float32Array)[index] = value;
}
