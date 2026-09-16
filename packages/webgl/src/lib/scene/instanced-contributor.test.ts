import type {
  CRCBackendFrameInput,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import { describe, expect, test } from 'vitest';
import type {
  CRCWebGLInstancedRecipe,
  CRCWebGLInstancedSubmission,
} from '../../internal.js';
import { createWebGLGeometry } from '../geometry/geometry.js';
import { resolveCamera } from '../math/camera.js';
import {
  closeWebGLSceneComposer,
  createWebGLSceneComposer,
  pushWebGLModelMatrix,
  submitWebGLInstancedSubmission,
  submitWebGLMesh,
} from './composer.js';
import { settleWebGLScene } from './settle.js';

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

const translation = (x: number, y: number, z: number) => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  x, y, z, 1,
]);

const bounds = () => ({
  min: [-1, -1, -1] as [number, number, number],
  max: [1, 1, 1] as [number, number, number],
});

const recipe = (): CRCWebGLInstancedRecipe => Object.freeze({
  key: Object.freeze({}),
  topology: 'points',
  vertexSource: '#version 300 es\nvoid main() { gl_Position = vec4(0.0); }',
  fragmentSource: '#version 300 es\nout vec4 color; void main() { color = vec4(1.0); }',
  verticesPerInstance: 1,
  capacity: 128,
  lookupTables: Object.freeze([]),
});

function submission(
  particleRecipe: CRCWebGLInstancedRecipe,
  overrides: Partial<CRCWebGLInstancedSubmission> = {},
): CRCWebGLInstancedSubmission {
  return {
    kind: 'instanced',
    componentName: 'Particles3D',
    source: {
      fileName: '/app/embers.tsx',
      lineNumber: 12,
      columnNumber: 7,
    },
    localModel: identity(),
    localBounds: bounds(),
    opacity: 0.5,
    material: { type: 'unlit', blend: 'alpha' },
    depthTest: true,
    depthWrite: false,
    sorting: 'oldest-first',
    target: undefined,
    recipe: particleRecipe,
    frameUniforms: new Float32Array([1, 2, 3, 4]),
    ...overrides,
  };
}

function composer() {
  return createWebGLSceneComposer({
    frame,
    camera: resolveCamera(undefined, 100, 100),
    contextGeneration: 4,
  });
}

describe('official instanced WebGL scene contributor', () => {
  test('snapshots one CPU-only declaration under current model ancestry', () => {
    const fakeGl = new Proxy({}, {
      get: () => () => {
        throw new Error('GL must not run during scene composition');
      },
    });
    const scene = createWebGLSceneComposer({
      frame,
      camera: resolveCamera(undefined, 100, 100),
      contextGeneration: 4,
      gl: fakeGl,
    } as never);
    const release = pushWebGLModelMatrix(scene, translation(10, 20, 30));
    const particleRecipe = recipe();
    const localModel = translation(1, 2, 3);
    const localBounds = bounds();
    const frameUniforms = new Float32Array([4, 3, 2, 1]);
    const target = fakeTarget();
    submitWebGLInstancedSubmission(scene, submission(particleRecipe, {
      localModel,
      localBounds,
      frameUniforms,
      target,
      material: { type: 'emissive', blend: 'additive' },
      depthTest: false,
      depthWrite: true,
      sorting: 'youngest-first',
    }));
    release();

    localModel[12] = 999;
    localBounds.min[0] = 999;
    localBounds.max[2] = 999;
    frameUniforms[0] = 999;
    const draft = closeWebGLSceneComposer(scene);

    expect(draft.instanced).toHaveLength(1);
    expect(draft.instanced[0]).toMatchObject({
      kind: 'instanced',
      componentName: 'Particles3D',
      source: {
        fileName: '/app/embers.tsx',
        lineNumber: 12,
        columnNumber: 7,
      },
      localBounds: { min: [-1, -1, -1], max: [1, 1, 1] },
      opacity: 0.5,
      material: { type: 'emissive', blend: 'additive' },
      depthTest: false,
      depthWrite: true,
      sorting: 'youngest-first',
      target,
      recipe: particleRecipe,
      sourceIndex: 0,
    });
    expect(Array.from(draft.instanced[0]!.model)).toEqual(
      Array.from(translation(11, 22, 33)),
    );
    expect(Array.from(draft.instanced[0]!.frameUniforms)).toEqual([4, 3, 2, 1]);
    expect(Object.isFrozen(draft.instanced)).toBe(true);
    expect(Object.isFrozen(draft.instanced[0])).toBe(true);
    expect(Object.isFrozen(draft.instanced[0]!.localBounds)).toBe(true);
    expect(Object.isFrozen(draft.instanced[0]!.localBounds.min)).toBe(true);
    expect(Object.isFrozen(draft.instanced[0]!.material)).toBe(true);
  });

  test('settles visibility, ordinary passes, stable ties, and component bounds', () => {
    const scene = composer();
    const particleRecipe = recipe();
    const triangle = createWebGLGeometry({
      positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
    });
    submitWebGLMesh(scene, {
      componentName: 'Mesh',
      geometry: triangle,
      localModel: identity(),
      color: [1, 1, 1, 0.5],
      lit: false,
    });
    const alphaTarget = fakeTarget();
    submitWebGLInstancedSubmission(scene, submission(particleRecipe, {
      target: alphaTarget,
    }));
    submitWebGLInstancedSubmission(scene, submission(particleRecipe, {
      material: { type: 'emissive', blend: 'additive' },
      opacity: 0.75,
    }));
    submitWebGLInstancedSubmission(scene, submission(particleRecipe, {
      material: { type: 'unlit', blend: 'cutout' },
      opacity: 1,
      depthWrite: true,
    }));
    submitWebGLInstancedSubmission(scene, submission(particleRecipe, {
      localModel: translation(1_000, 0, 0),
      target: fakeTarget(),
    }));
    submitWebGLInstancedSubmission(scene, submission(particleRecipe));

    const settled = settleWebGLScene(scene);

    expect(settled.instanced).toHaveLength(4);
    expect(settled.instanced.map(entry => entry.recipe)).toEqual([
      particleRecipe,
      particleRecipe,
      particleRecipe,
      particleRecipe,
    ]);
    expect(settled.instanced[0]).toMatchObject({
      effectiveOpacity: 0.5,
      pass: 'transparent',
      shading: 'unlit',
    });
    expect(settled.instanced[1]).toMatchObject({
      effectiveOpacity: 0.75,
      pass: 'additive',
      shading: 'emissive',
    });
    expect(settled.instanced[2]).toMatchObject({
      effectiveOpacity: 1,
      pass: 'opaque',
      shading: 'unlit',
    });
    expect(settled.opaque.map(entry => entry.sourceIndex)).toEqual([3]);
    expect(settled.transparent.map(entry => entry.sourceIndex)).toEqual([
      0, 1, 5,
    ]);
    expect(settled.additive.map(entry => entry.sourceIndex)).toEqual([2]);
    expect(settled.pickEntries).toHaveLength(1);
    expect(settled.pickEntries[0]).toMatchObject({
      kind: 'bounds',
      target: alphaTarget,
      sourceOrder: 1,
    });
    expect(settled.pickEntries[0]!.keyboardNavigationPoints).toBeDefined();
  });
});

function fakeTarget(): CRCEventTargetRegistration {
  return { kind: 'target', live: true } as CRCEventTargetRegistration;
}
