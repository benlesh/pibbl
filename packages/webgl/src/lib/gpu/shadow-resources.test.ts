import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettledWebGLShadowPlan } from '../scene/types.js';
import { WebGLShadowResourceCache } from './shadow-resources.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLShadowResourceCache', () => {
  it('clamps directional maps to the 2D limit and allocates DEPTH_COMPONENT24 with complete fallbacks', () => {
    const recording = createShadowGL({ maxTextureSize: 768 });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const draws: number[] = [];
    const transaction = cache.beginRender();
    const resource = transaction.useDirectional(plan(), resolution => {
      draws.push(resolution);
    });
    const bindings = transaction.getBindings();
    transaction.commit();

    expect(resource.resolution).toBe(768);
    expect(draws).toEqual([768]);
    expect(recording.createFramebuffer).toHaveBeenCalledOnce();
    expect(recording.checkFramebufferStatus).toHaveBeenCalledOnce();
    expect(recording.texImage2D.mock.calls.filter(
      call => call[0] === recording.gl.TEXTURE_2D && call[3] === 768,
    )).toEqual([
      [
        recording.gl.TEXTURE_2D,
        0,
        recording.gl.DEPTH_COMPONENT24,
        768,
        768,
        0,
        recording.gl.DEPTH_COMPONENT,
        recording.gl.UNSIGNED_INT,
        null,
      ],
    ]);
    expect(recording.texImage2D.mock.calls.filter(
      call => call[0] >= recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X &&
        call[0] < recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X + 6,
    )).toHaveLength(6);
    expect(bindings.fallback2D).toBeDefined();
    expect(bindings.fallbackCube).toBeDefined();
  });

  it('reuses equal resident generations and replaces only depth-affecting changes', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const firstDraw = vi.fn();
    let transaction = cache.beginRender();
    const first = transaction.useDirectional(plan(), firstDraw);
    transaction.commit();

    const hitDraw = vi.fn();
    transaction = cache.beginRender();
    const hit = transaction.useDirectional(plan(), hitDraw);
    transaction.commit();
    expect(hit.texture).toBe(first.texture);
    expect(firstDraw).toHaveBeenCalledOnce();
    expect(hitDraw).not.toHaveBeenCalled();

    const replacementDraw = vi.fn();
    transaction = cache.beginRender();
    const replacement = transaction.useDirectional(
      plan({ projectionViewMatrix: matrix(2) }),
      replacementDraw,
    );
    transaction.commit();
    expect(replacement.texture).not.toBe(first.texture);
    expect(replacementDraw).toHaveBeenCalledOnce();
    expect(recording.deleteTexture).toHaveBeenCalledWith(first.texture);
  });

  it('rolls back a failed candidate while preserving a resident generation', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    const resident = transaction.useDirectional(plan(), () => undefined);
    transaction.commit();

    const failure = new Error('depth draw failed');
    transaction = cache.beginRender();
    expect(() => transaction.useDirectional(
      plan({ projectionViewMatrix: matrix(2) }),
      () => { throw failure; },
    )).toThrow(failure);
    transaction.rollback();

    const retryDraw = vi.fn();
    transaction = cache.beginRender();
    const reused = transaction.useDirectional(plan(), retryDraw);
    transaction.commit();
    expect(reused.texture).toBe(resident.texture);
    expect(retryDraw).not.toHaveBeenCalled();
  });

  it('sweeps omitted lights, abandons context-lost handles, and continues healthy cleanup after deletion errors', () => {
    const cleanupFailure = new Error('texture cleanup failed');
    const recording = createShadowGL({
      deleteTextureErrorAt: 1,
      deleteTextureError: cleanupFailure,
    });
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    transaction.useDirectional(
      plan({ lightIdentity: SECOND_LIGHT }),
      () => undefined,
    );
    transaction.commit();

    transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    transaction.commit();
    expect(reported).toEqual([cleanupFailure]);
    expect(recording.deleteTexture).toHaveBeenCalledTimes(1);

    cache.dispose(false);
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();
    expect(recording.deleteTexture.mock.calls.length).toBeGreaterThanOrEqual(4);

    const lost = createShadowGL();
    const lostCache = new WebGLShadowResourceCache(lost.gl, 8);
    const lostTransaction = lostCache.beginRender();
    lostTransaction.useDirectional(
      plan({ contextGeneration: 8 }),
      () => undefined,
    );
    lostTransaction.commit();
    lostCache.invalidateContext();
    lostCache.dispose(false);
    expect(lost.deleteFramebuffer).not.toHaveBeenCalled();
    expect(lost.deleteTexture).not.toHaveBeenCalled();
  });

  it('rejects incomplete directional framebuffers and releases the candidate texture', () => {
    const recording = createShadowGL({ framebufferComplete: false });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();

    expect(() => transaction.useDirectional(plan(), () => undefined))
      .toThrowError(/directional.*framebuffer.*incomplete/i);
    transaction.rollback();
    expect(recording.deleteTexture).toHaveBeenCalled();
  });

  it('deletes every active candidate handle exactly once on healthy disposal while abandoning context-lost handles', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);

    cache.dispose(false);
    transaction.rollback();
    cache.dispose(false);

    const deleted = recording.deleteTexture.mock.calls.map(call => call[0]);
    expect(deleted).toHaveLength(3);
    expect(new Set(deleted)).toEqual(new Set(recording.textures));
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();

    const lost = createShadowGL();
    const lostCache = new WebGLShadowResourceCache(lost.gl, 8);
    const lostTransaction = lostCache.beginRender();
    lostTransaction.useDirectional(
      plan({ contextGeneration: 8 }),
      () => undefined,
    );

    lostCache.dispose(true);
    lostTransaction.rollback();
    expect(lost.deleteTexture).not.toHaveBeenCalled();
    expect(lost.deleteFramebuffer).not.toHaveBeenCalled();
  });

  it('allocates one clamped DEPTH_COMPONENT24 cube and attaches all six canonical faces', () => {
    const recording = createShadowGL({ maxCubeMapTextureSize: 640 });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const renderedFaces: Array<readonly [number, number]> = [];
    const transaction = cache.beginRender();
    const resource = (transaction as any).usePoint(
      pointPlan(),
      (face: number, resolution: number) => {
        renderedFaces.push([face, resolution]);
      },
    );
    transaction.commit();

    expect(resource.resolution).toBe(640);
    expect(renderedFaces).toEqual([
      [0, 640], [1, 640], [2, 640], [3, 640], [4, 640], [5, 640],
    ]);
    expect(recording.texImage2D.mock.calls.filter(call =>
      call[0] >= recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X &&
      call[0] < recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X + 6 &&
      call[3] === 640,
    )).toEqual(Array.from({ length: 6 }, (_, face) => [
      recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      0,
      recording.gl.DEPTH_COMPONENT24,
      640,
      640,
      0,
      recording.gl.DEPTH_COMPONENT,
      recording.gl.UNSIGNED_INT,
      null,
    ]));
    expect(recording.framebufferTexture2D.mock.calls.slice(-6)).toEqual(
      Array.from({ length: 6 }, (_, face) => [
        recording.gl.FRAMEBUFFER,
        recording.gl.DEPTH_ATTACHMENT,
        recording.gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        resource.texture,
        0,
      ]),
    );
    expect(recording.checkFramebufferStatus).toHaveBeenCalledTimes(6);
  });

  it('reuses equal point cubes, replaces one changed light, and preserves resident data on rollback', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    const initialDraw = vi.fn();
    const initial = (transaction as any).usePoint(pointPlan(), initialDraw);
    transaction.commit();
    expect(initialDraw).toHaveBeenCalledTimes(6);

    transaction = cache.beginRender();
    const hitDraw = vi.fn();
    const hit = (transaction as any).usePoint(pointPlan(), hitDraw);
    transaction.commit();
    expect(hit.texture).toBe(initial.texture);
    expect(hitDraw).not.toHaveBeenCalled();

    transaction = cache.beginRender();
    const replacementDraw = vi.fn();
    const replacement = (transaction as any).usePoint(pointPlan({
      farDistance: 8,
    }), replacementDraw);
    transaction.commit();
    expect(replacement.texture).not.toBe(initial.texture);
    expect(replacementDraw).toHaveBeenCalledTimes(6);
    expect(recording.deleteTexture).toHaveBeenCalledWith(initial.texture);

    transaction = cache.beginRender();
    const failure = new Error('point face failed');
    expect(() => (transaction as any).usePoint(pointPlan({
      farDistance: 12,
    }), (face: number) => {
      if (face === 3) throw failure;
    })).toThrow(failure);
    transaction.rollback();

    transaction = cache.beginRender();
    const retryDraw = vi.fn();
    const reused = (transaction as any).usePoint(pointPlan({
      farDistance: 8,
    }), retryDraw);
    transaction.commit();
    expect(reused.texture).toBe(replacement.texture);
    expect(retryDraw).not.toHaveBeenCalled();
  });

  it('rolls back incomplete and partially allocated point cubes without publishing them', () => {
    const incomplete = createShadowGL({ framebufferIncompleteAt: 4 });
    const incompleteCache = new WebGLShadowResourceCache(incomplete.gl, 7);
    const incompleteTransaction = incompleteCache.beginRender();
    expect(() => (incompleteTransaction as any).usePoint(
      pointPlan(),
      () => undefined,
    )).toThrowError(/point.*face 3.*framebuffer.*incomplete/i);
    incompleteTransaction.rollback();
    expect(incomplete.deleteTexture).toHaveBeenCalled();

    const allocationError = new Error('cube allocation failed');
    const allocation = createShadowGL({
      texImage2DErrorAt: 8,
      texImage2DError: allocationError,
    });
    const allocationCache = new WebGLShadowResourceCache(allocation.gl, 7);
    const allocationTransaction = allocationCache.beginRender();
    expect(() => (allocationTransaction as any).usePoint(
      pointPlan(),
      () => undefined,
    )).toThrow(allocationError);
    allocationTransaction.rollback();
    expect(allocation.deleteTexture).toHaveBeenCalled();
  });

  it('allocates one 2D spot map and reuses only an equal resident projection', () => {
    const recording = createShadowGL({ maxTextureSize: 768 });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    const firstDraw = vi.fn();
    const first = (transaction as any).useSpot(spotPlan(), firstDraw);
    transaction.commit();

    expect(first).toMatchObject({ kind: 'spot', resolution: 768 });
    expect(firstDraw).toHaveBeenCalledExactlyOnceWith(768);
    expect(recording.framebufferTexture2D).toHaveBeenLastCalledWith(
      recording.gl.FRAMEBUFFER,
      recording.gl.DEPTH_ATTACHMENT,
      recording.gl.TEXTURE_2D,
      first.texture,
      0,
    );

    transaction = cache.beginRender();
    const hitDraw = vi.fn();
    const hit = (transaction as any).useSpot(spotPlan(), hitDraw);
    transaction.commit();
    expect(hit.texture).toBe(first.texture);
    expect(hitDraw).not.toHaveBeenCalled();

    transaction = cache.beginRender();
    const replacementDraw = vi.fn();
    const replacement = (transaction as any).useSpot(spotPlan({
      projectionViewMatrix: matrix(9),
    }), replacementDraw);
    transaction.commit();
    expect(replacement.texture).not.toBe(first.texture);
    expect(replacementDraw).toHaveBeenCalledExactlyOnceWith(768);
    expect(recording.deleteTexture).toHaveBeenCalledWith(first.texture);
  });
});

const FIRST_LIGHT = Object.freeze({});
const SECOND_LIGHT = Object.freeze({});

function plan(overrides: Partial<SettledWebGLShadowPlan> = {}): SettledWebGLShadowPlan {
  return {
    kind: 'directional',
    lightIdentity: FIRST_LIGHT,
    lightIndex: 0,
    projectionViewMatrix: matrix(1),
    bias: 0.001,
    casters: [],
    receivers: [],
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
    ...overrides,
  };
}

function pointPlan(overrides: Record<string, unknown> = {}): any {
  return {
    kind: 'point',
    lightIdentity: FIRST_LIGHT,
    lightIndex: 0,
    projectionViewMatrices: Object.freeze(Array.from(
      { length: 6 },
      (_, face) => matrix(face + 1),
    )),
    lightPosition: Object.freeze([1, 2, 3]),
    nearDistance: 0.01,
    farDistance: 10,
    bias: 0.001,
    casters: [],
    receivers: [],
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
    ...overrides,
  };
}

function spotPlan(overrides: Record<string, unknown> = {}): any {
  return {
    kind: 'spot',
    lightIdentity: FIRST_LIGHT,
    lightIndex: 0,
    projectionViewMatrix: matrix(7),
    lightPosition: Object.freeze([1, 2, 3]),
    nearDistance: 0.01,
    farDistance: 10,
    bias: 0.001,
    casters: [],
    receivers: [],
    requestedResolution: 1024,
    comparisonCount: 4,
    contextGeneration: 7,
    shadowProgramGeneration: 1,
    ...overrides,
  };
}

function matrix(seed: number): Float32Array {
  const value = new Float32Array(16);
  value[0] = seed;
  value[5] = 1;
  value[10] = 1;
  value[15] = 1;
  return value;
}

function createShadowGL(options: {
  readonly maxTextureSize?: number;
  readonly maxCubeMapTextureSize?: number;
  readonly framebufferComplete?: boolean;
  readonly framebufferIncompleteAt?: number;
  readonly texImage2DErrorAt?: number;
  readonly texImage2DError?: Error;
  readonly deleteTextureErrorAt?: number;
  readonly deleteTextureError?: Error;
} = {}) {
  const textures: object[] = [];
  let deleteTextureCount = 0;
  let framebufferStatusCount = 0;
  let texImage2DCount = 0;
  const gl = {
    MAX_TEXTURE_SIZE: 1,
    MAX_CUBE_MAP_TEXTURE_SIZE: 2,
    FRAMEBUFFER: 3,
    FRAMEBUFFER_COMPLETE: 4,
    DEPTH_ATTACHMENT: 5,
    TEXTURE_2D: 6,
    TEXTURE_CUBE_MAP: 7,
    TEXTURE_CUBE_MAP_POSITIVE_X: 10,
    DEPTH_COMPONENT24: 20,
    DEPTH_COMPONENT: 21,
    UNSIGNED_INT: 22,
    TEXTURE_MIN_FILTER: 23,
    TEXTURE_MAG_FILTER: 24,
    TEXTURE_WRAP_S: 25,
    TEXTURE_WRAP_T: 26,
    TEXTURE_WRAP_R: 27,
    NEAREST: 28,
    CLAMP_TO_EDGE: 29,
    NONE: 30,
    getParameter: vi.fn((parameter: number) => parameter === 1 ?
      (options.maxTextureSize ?? 4096) :
      (options.maxCubeMapTextureSize ?? 4096)),
    createFramebuffer: vi.fn(() => ({ kind: 'framebuffer' })),
    deleteFramebuffer: vi.fn(),
    bindFramebuffer: vi.fn(),
    checkFramebufferStatus: vi.fn(() => {
      framebufferStatusCount += 1;
      return options.framebufferComplete === false ||
        framebufferStatusCount === options.framebufferIncompleteAt ? 999 : 4;
    }),
    framebufferTexture2D: vi.fn(),
    drawBuffers: vi.fn(),
    readBuffer: vi.fn(),
    createTexture: vi.fn(() => {
      const texture = { kind: 'texture', id: textures.length + 1 };
      textures.push(texture);
      return texture;
    }),
    deleteTexture: vi.fn(() => {
      deleteTextureCount += 1;
      if (deleteTextureCount === options.deleteTextureErrorAt) {
        throw options.deleteTextureError;
      }
    }),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(() => {
      texImage2DCount += 1;
      if (texImage2DCount === options.texImage2DErrorAt) {
        throw options.texImage2DError;
      }
    }),
    isContextLost: vi.fn(() => false),
  } as unknown as WebGL2RenderingContext;
  return {
    gl,
    textures,
    getParameter: vi.mocked(gl.getParameter),
    createFramebuffer: vi.mocked(gl.createFramebuffer),
    deleteFramebuffer: vi.mocked(gl.deleteFramebuffer),
    checkFramebufferStatus: vi.mocked(gl.checkFramebufferStatus),
    framebufferTexture2D: vi.mocked(gl.framebufferTexture2D),
    texImage2D: vi.mocked(gl.texImage2D),
    deleteTexture: vi.mocked(gl.deleteTexture),
  };
}
