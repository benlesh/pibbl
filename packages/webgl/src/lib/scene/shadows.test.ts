import { describe, expect, it } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import { composeModelMatrix4 } from '../math/matrix4.js';
import {
  createWebGLSceneComposer,
  submitWebGLLight,
  submitWebGLMesh,
} from './composer.js';
import {
  haveSameDirectionalShadowPlan,
  resolveWebGLShadowQuality,
} from './shadows.js';
import { settleWebGLScene } from './settle.js';

const geometry = createWebGLGeometry({
  positions: [
    -1, -1, -1, 1, -1, -1, -1, 1, -1,
    1, -1, -1, 1, 1, -1, -1, 1, -1,
    -1, -1, 1, 1, -1, 1, -1, 1, 1,
    1, -1, 1, 1, 1, 1, -1, 1, 1,
  ],
  normals: [
    0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, 1, 0, 0, 1, 0, 0, 1,
  ],
});

describe('directional shadow planning', () => {
  it.each([
    ['low', 512, 1],
    ['medium', 1024, 4],
    ['high', 2048, 9],
  ] as const)('maps %s to its exact requested resolution and comparison count', (
    quality,
    requestedResolution,
    comparisonCount,
  ) => {
    expect(resolveWebGLShadowQuality(quality)).toEqual({
      quality,
      requestedResolution,
      comparisonCount,
    });
  });

  it('keeps disabled quality free of shadow plans', () => {
    expect(resolveWebGLShadowQuality(false)).toBeUndefined();
    expect(settleScene({ shadowQuality: false }).shadowPlans).toEqual([]);
  });

  it('fits transformed eight-corner world bounds and the Group3D directional pose', () => {
    const scene = settleScene({
      lightTransform: {
        rotationXDegrees: -35,
        rotationYDegrees: 45,
      },
      meshTransform: {
        translateX: 4,
        translateY: 2,
        translateZ: -3,
        rotationYDegrees: 45,
        scaleX: 2,
        scaleY: 3,
        scaleZ: 4,
      },
    });

    expect(scene.meshes[0]!.worldBounds).toMatchObject({
      minimumX: expect.closeTo(-0.2426407, 5),
      maximumX: expect.closeTo(8.2426407, 5),
      minimumY: -1,
      maximumY: 5,
      minimumZ: expect.closeTo(-7.2426407, 5),
      maximumZ: expect.closeTo(1.2426407, 5),
    });
    expect(scene.lights[0]).toMatchObject({
      kind: 'directional',
      direction: [
        expect.closeTo(-0.5792279, 5),
        expect.closeTo(-0.5735764, 5),
        expect.closeTo(-0.5792279, 5),
      ],
    });
    expect(scene.shadowPlans).toHaveLength(1);
    expect(scene.shadowPlans[0]).toMatchObject({
      kind: 'directional',
      lightIndex: 0,
      requestedResolution: 1024,
      comparisonCount: 4,
      casters: [scene.meshes[0]],
    });
    expect(Array.from(scene.shadowPlans[0]!.projectionViewMatrix))
      .toHaveLength(16);
    expect(Array.from(scene.shadowPlans[0]!.projectionViewMatrix)
      .every(Number.isFinite)).toBe(true);
  });

  it('derives cast and receive defaults from alpha and lit while honoring explicit overrides', () => {
    const opaqueLit = settleScene({ alpha: 1 }).meshes[0]!;
    expect(opaqueLit).toMatchObject({ castShadow: true, receiveShadow: true });
    const transparentLit = settleScene({ alpha: 0.5 }).meshes[0]!;
    expect(transparentLit).toMatchObject({ castShadow: false, receiveShadow: true });
    const transparentExplicit = settleScene({
      alpha: 0.5,
      castShadow: true,
      receiveShadow: false,
    }).meshes[0]!;
    expect(transparentExplicit).toMatchObject({
      castShadow: true,
      receiveShadow: false,
    });
    const opaqueUnlit = settleScene({ alpha: 1, lit: false }).meshes[0]!;
    expect(opaqueUnlit).toMatchObject({ castShadow: true, receiveShadow: false });
    const invisible = settleScene({
      alpha: 0,
      castShadow: true,
      receiveShadow: true,
    }).meshes[0]!;
    expect(invisible).toMatchObject({ castShadow: false, receiveShadow: false });
  });

  it('excludes presentation camera and light color but includes depth-affecting semantics in equality', () => {
    const first = settleScene().shadowPlans[0]!;
    const orbit = settleScene({ cameraPosition: [8, 6, 9] }).shadowPlans[0]!;
    const recolored = settleScene({ lightColor: [0.2, 0.4, 0.8, 1] })
      .shadowPlans[0]!;
    const movedCaster = settleScene({ meshTransform: { translateX: 1 } })
      .shadowPlans[0]!;
    const movedLight = settleScene({
      lightTransform: { rotationYDegrees: 15 },
    }).shadowPlans[0]!;

    expect(haveSameDirectionalShadowPlan(first, 1024, orbit, 1024)).toBe(true);
    expect(haveSameDirectionalShadowPlan(first, 1024, recolored, 1024)).toBe(
      true,
    );
    expect(haveSameDirectionalShadowPlan(first, 1024, movedCaster, 1024)).toBe(
      false,
    );
    expect(haveSameDirectionalShadowPlan(first, 1024, movedLight, 1024)).toBe(
      false,
    );
    expect(haveSameDirectionalShadowPlan(first, 1024, first, 512)).toBe(false);
  });

  it('keeps receiver remount identity out of the depth key when its derived extent is unchanged', () => {
    const first = settleScene({ meshIdentity: Object.freeze({}) })
      .shadowPlans[0]!;
    const remounted = settleScene({ meshIdentity: Object.freeze({}) })
      .shadowPlans[0]!;

    expect(haveSameDirectionalShadowPlan(first, 1024, remounted, 1024))
      .toBe(false);
    const receiverOnlyFirst = receiverOnlyPlan(first);
    const receiverOnlyRemounted = receiverOnlyPlan(remounted);
    expect(haveSameDirectionalShadowPlan(
      receiverOnlyFirst,
      1024,
      receiverOnlyRemounted,
      1024,
    )).toBe(true);
  });

  it('leaves pick/focus and color queues unchanged when directional shadows participate', () => {
    const without = settleScene({ shadowQuality: false });
    const withShadows = settleScene({ shadowQuality: 'medium' });

    expect(withShadows.opaque.map(mesh => mesh.sourceIndex)).toEqual(
      without.opaque.map(mesh => mesh.sourceIndex),
    );
    expect(withShadows.transparent.map(mesh => mesh.sourceIndex)).toEqual(
      without.transparent.map(mesh => mesh.sourceIndex),
    );
    expect(withShadows.pickEntries).toEqual(without.pickEntries);
  });
});

function settleScene(options: {
  readonly shadowQuality?: false | 'low' | 'medium' | 'high';
  readonly alpha?: number;
  readonly lit?: boolean;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly cameraPosition?: readonly [number, number, number];
  readonly lightColor?: readonly [number, number, number, number];
  readonly lightTransform?: Parameters<typeof composeModelMatrix4>[1];
  readonly meshTransform?: Parameters<typeof composeModelMatrix4>[1];
  readonly meshIdentity?: object;
} = {}) {
  const camera = resolveCamera({
    type: 'perspective',
    position: options.cameraPosition ?? [5, 4, 8],
    lookAt: [0, 0, 0],
    up: [0, 1, 0],
    fieldOfViewDegrees: 50,
    near: 0.1,
    far: 100,
  }, 100, 100);
  const composer = createWebGLSceneComposer({
    frame: {
      canvas: {} as HTMLCanvasElement,
      logicalWidth: 100,
      logicalHeight: 100,
      backingWidth: 100,
      backingHeight: 100,
      renderTimestamp: 1,
    },
    camera,
    contextGeneration: 7,
    shadowQuality: options.shadowQuality ?? 'medium',
  } as any);
  const lightModel = new Float32Array(16);
  composeModelMatrix4(lightModel, options.lightTransform);
  submitWebGLLight(composer, {
    kind: 'directional',
    identity: DIRECT_LIGHT_IDENTITY,
    componentName: 'DirectionalLight',
    localModel: lightModel,
    color: options.lightColor ?? [1, 1, 1, 1],
    intensity: 1,
    castShadow: true,
  } as any);
  const meshModel = new Float32Array(16);
  composeModelMatrix4(meshModel, options.meshTransform);
  submitWebGLMesh(composer, {
    identity: options.meshIdentity ?? MESH_IDENTITY,
    componentName: 'Mesh',
    geometry,
    localModel: meshModel,
    color: [1, 1, 1, options.alpha ?? 1],
    lit: options.lit ?? true,
    castShadow: options.castShadow,
    receiveShadow: options.receiveShadow,
  } as any);
  return settleWebGLScene(composer);
}

const DIRECT_LIGHT_IDENTITY = Object.freeze({});
const MESH_IDENTITY = Object.freeze({});

function receiverOnlyPlan(
  plan: ReturnType<typeof settleScene>['shadowPlans'][number],
): typeof plan {
  return Object.freeze({ ...plan, casters: Object.freeze([]) });
}
