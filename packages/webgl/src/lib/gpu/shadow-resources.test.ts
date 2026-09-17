import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  SettledWebGLDirectionalShadowPlan,
  SettledWebGLPointShadowPlan,
  SettledWebGLSpotShadowPlan,
} from '../scene/types.js';
import { WebGLShadowResourceCache } from './shadow-resources.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WebGLShadowResourceCache', () => {
  it('stores eight point lights in one 48-layer depth texture array', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();

    for (let lightIndex = 0; lightIndex < 8; lightIndex += 1) {
      transaction.usePoint(pointPlan({
        lightIdentity: Object.freeze({ lightIndex }),
        lightIndex,
      }), () => undefined);
    }
    const bindings = transaction.getBindings();
    transaction.commit();

    expect(recording.textures).toEqual([bindings.texture]);
    expect(recording.createFramebuffer).toHaveBeenCalledOnce();
    expect(recording.texStorage3D).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TEXTURE_2D_ARRAY,
      1,
      recording.gl.DEPTH_COMPONENT24,
      1024,
      1024,
      48,
    );
    expect(recording.framebufferTextureLayer.mock.calls).toEqual(
      Array.from({ length: 48 }, (_, layer) => [
        recording.gl.FRAMEBUFFER,
        recording.gl.DEPTH_ATTACHMENT,
        bindings.texture,
        0,
        layer,
      ]),
    );
  });

  it('creates one complete fallback array without a render target', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();

    const bindings = transaction.getBindings();
    transaction.commit();

    expect(bindings.texture).toBe(recording.textures[0]);
    expect(recording.texStorage3D).toHaveBeenCalledExactlyOnceWith(
      recording.gl.TEXTURE_2D_ARRAY,
      1,
      recording.gl.DEPTH_COMPONENT24,
      1,
      1,
      1,
    );
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
    expect(recording.framebufferTextureLayer).not.toHaveBeenCalled();
  });

  it('clamps one directional view and assigns its stable first layer', () => {
    const recording = createShadowGL({ maxTextureSize: 768 });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    const draw = vi.fn();

    const resource = transaction.useDirectional(plan(), draw);
    const bindings = transaction.getBindings();
    transaction.commit();

    expect(resource).toMatchObject({
      kind: 'directional',
      resolution: 768,
      views: [{ layer: 0, matrix: plan().projectionViewMatrix }],
    });
    expect(draw).toHaveBeenCalledExactlyOnceWith(768);
    expect(recording.texStorage3D).toHaveBeenCalledWith(
      recording.gl.TEXTURE_2D_ARRAY,
      1,
      recording.gl.DEPTH_COMPONENT24,
      768,
      768,
      48,
    );
    expect(recording.framebufferTextureLayer).toHaveBeenCalledExactlyOnceWith(
      recording.gl.FRAMEBUFFER,
      recording.gl.DEPTH_ATTACHMENT,
      bindings.texture,
      0,
      0,
    );
  });

  it('reuses an equal generation and keeps identity layers when its light slot moves', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    const first = transaction.usePoint(pointPlan(), vi.fn());
    const firstBindings = transaction.getBindings();
    transaction.commit();

    const reusedDraw = vi.fn();
    transaction = cache.beginRender();
    const reused = transaction.usePoint(pointPlan({ lightIndex: 7 }), reusedDraw);
    const reusedBindings = transaction.getBindings();
    transaction.commit();

    expect(reusedBindings.texture).toBe(firstBindings.texture);
    expect(reused.views.map(view => view.layer)).toEqual(
      first.views.map(view => view.layer),
    );
    expect(reusedDraw).not.toHaveBeenCalled();
    expect(recording.createTexture).toHaveBeenCalledOnce();
  });

  it('rejects a failed replacement exactly once and preserves the resident generation', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    transaction.usePoint(pointPlan(), () => undefined);
    const resident = transaction.getBindings();
    transaction.commit();

    const failure = new Error('point face failed');
    transaction = cache.beginRender();
    transaction.usePoint(pointPlan({ farDistance: 12 }), face => {
      if (face === 3) throw failure;
    });
    expect(() => transaction.getBindings()).toThrow(failure);
    transaction.rollback();
    const rejected = recording.textures[1]!;
    expect(recording.deleteTexture.mock.calls.filter(
      ([texture]) => texture === rejected,
    )).toHaveLength(1);
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();

    transaction = cache.beginRender();
    const retryDraw = vi.fn();
    transaction.usePoint(pointPlan(), retryDraw);
    const reused = transaction.getBindings();
    transaction.commit();
    expect(reused.texture).toBe(resident.texture);
    expect(retryDraw).not.toHaveBeenCalled();
  });

  it('cleans allocation and framebuffer failures without publishing candidates', () => {
    const allocationError = new Error('array allocation failed');
    const allocation = createShadowGL({
      texStorage3DErrorAt: 1,
      texStorage3DError: allocationError,
    });
    const allocationCache = new WebGLShadowResourceCache(allocation.gl, 7);
    let transaction = allocationCache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    expect(() => transaction.getBindings()).toThrow(allocationError);
    transaction.rollback();
    expect(allocation.deleteTexture).toHaveBeenCalledOnce();
    expect(allocation.deleteFramebuffer).toHaveBeenCalledOnce();

    const incomplete = createShadowGL({ framebufferIncompleteAt: 4 });
    const incompleteCache = new WebGLShadowResourceCache(incomplete.gl, 7);
    transaction = incompleteCache.beginRender();
    transaction.usePoint(pointPlan(), () => undefined);
    expect(() => transaction.getBindings())
      .toThrowError(/point.*layer 3.*framebuffer.*incomplete/i);
    transaction.rollback();
    expect(incomplete.deleteTexture).toHaveBeenCalledOnce();
    expect(incomplete.deleteFramebuffer).toHaveBeenCalledOnce();
  });

  it('uses one layer for a spot and abandons all handles after context loss', () => {
    const recording = createShadowGL({ maxTextureSize: 640 });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    const draw = vi.fn();
    const resource = transaction.useSpot(spotPlan(), draw);
    transaction.getBindings();
    transaction.commit();

    expect(resource.views.map(view => view.layer)).toEqual([0]);
    expect(draw).toHaveBeenCalledExactlyOnceWith(640);
    cache.invalidateContext();
    cache.dispose(false);
    expect(recording.deleteTexture).not.toHaveBeenCalled();
    expect(recording.deleteFramebuffer).not.toHaveBeenCalled();
  });

  it('commits a changed generation before releasing its prior array', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    const firstDraw = vi.fn();
    transaction.useDirectional(plan(), firstDraw);
    const first = transaction.getBindings();
    transaction.commit();

    transaction = cache.beginRender();
    const replacementDraw = vi.fn();
    transaction.useDirectional(
      plan({ projectionViewMatrix: matrix(2) }),
      replacementDraw,
    );
    const replacement = transaction.getBindings();
    expect(recording.deleteTexture).not.toHaveBeenCalled();
    transaction.commit();

    expect(replacement.texture).not.toBe(first.texture);
    expect(firstDraw).toHaveBeenCalledOnce();
    expect(replacementDraw).toHaveBeenCalledOnce();
    expect(recording.deleteTexture).toHaveBeenCalledExactlyOnceWith(
      first.texture,
    );
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();
  });

  it('rerenders only invalid light views in a transactional replacement', () => {
    const secondLight = Object.freeze({});
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(2),
    }), () => undefined);
    transaction.commit();

    const validDraw = vi.fn();
    const invalidDraw = vi.fn();
    transaction = cache.beginRender();
    transaction.useDirectional(plan(), validDraw);
    transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(3),
    }), invalidDraw);
    transaction.commit();

    expect(validDraw).not.toHaveBeenCalled();
    expect(invalidDraw).toHaveBeenCalledOnce();
    expect(recording.blitFramebuffer).toHaveBeenCalledOnce();
  });

  it('retains an identity layer while sweeping an omitted light', () => {
    const secondLight = Object.freeze({});
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    let transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    const retained = transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(2),
    }), () => undefined);
    transaction.commit();
    expect(retained.views[0].layer).toBe(6);

    transaction = cache.beginRender();
    const redraw = vi.fn();
    const swept = transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(2),
    }), redraw);
    transaction.commit();

    expect(swept.views[0].layer).toBe(6);
    expect(redraw).not.toHaveBeenCalled();
    expect(recording.blitFramebuffer).toHaveBeenCalledOnce();
    expect(recording.deleteTexture).toHaveBeenCalledOnce();
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();
  });

  it('assigns one view to directional and spot lights and six consecutive point views', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    const directional = transaction.useDirectional(plan(), () => undefined);
    const point = transaction.usePoint(pointPlan({
      lightIdentity: Object.freeze({ kind: 'point' }),
    }), () => undefined);
    const spot = transaction.useSpot(spotPlan({
      lightIdentity: Object.freeze({ kind: 'spot' }),
    }), () => undefined);
    transaction.commit();

    expect(directional.views.map(view => view.layer)).toEqual([0]);
    expect(point.views.map(view => view.layer)).toEqual([6, 7, 8, 9, 10, 11]);
    expect(spot.views.map(view => view.layer)).toEqual([12]);
  });

  it('deletes an active candidate exactly once on healthy disposal', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    transaction.usePoint(pointPlan(), () => undefined);
    transaction.getBindings();

    cache.dispose(false);
    transaction.rollback();
    cache.dispose(false);

    expect(recording.deleteTexture).toHaveBeenCalledOnce();
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();
  });

  it('continues owned framebuffer cleanup after texture deletion fails', () => {
    const cleanupFailure = new Error('texture cleanup failed');
    const recording = createShadowGL({ deleteTextureError: cleanupFailure });
    const reported: unknown[] = [];
    vi.spyOn(globalThis, 'reportError').mockImplementation(error => {
      reported.push(error);
    });
    const cache = new WebGLShadowResourceCache(recording.gl, 7);
    const transaction = cache.beginRender();
    transaction.useDirectional(plan(), () => undefined);
    transaction.commit();

    cache.dispose(false);

    expect(reported).toEqual([cleanupFailure]);
    expect(recording.deleteTexture).toHaveBeenCalledOnce();
    expect(recording.deleteFramebuffer).toHaveBeenCalledOnce();
  });

  it('rejects another context generation before allocating GL handles', () => {
    const recording = createShadowGL();
    const cache = new WebGLShadowResourceCache(recording.gl, 8);
    const transaction = cache.beginRender();

    expect(() => transaction.useDirectional(plan(), () => undefined))
      .toThrowError(/shadow generation 7.*cache generation 8/i);
    transaction.rollback();
    expect(recording.createTexture).not.toHaveBeenCalled();
    expect(recording.createFramebuffer).not.toHaveBeenCalled();
  });

  it('copies a valid layer between real WebGL2 array generations', () => {
    const gl = new OffscreenCanvas(8, 8).getContext('webgl2');
    expect(gl).not.toBeNull();
    const cache = new WebGLShadowResourceCache(gl!, 7);
    const secondLight = Object.freeze({});
    const clearDepth = () => {
      gl!.viewport(0, 0, 4, 4);
      gl!.clearDepth(1);
      gl!.clear(gl!.DEPTH_BUFFER_BIT);
    };
    let transaction = cache.beginRender();
    transaction.useDirectional(plan({ requestedResolution: 4 }), clearDepth);
    transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(2),
      requestedResolution: 4,
    }), clearDepth);
    transaction.commit();

    transaction = cache.beginRender();
    transaction.useDirectional(plan({ requestedResolution: 4 }), clearDepth);
    transaction.useDirectional(plan({
      lightIdentity: secondLight,
      projectionViewMatrix: matrix(3),
      requestedResolution: 4,
    }), clearDepth);
    transaction.commit();

    expect(gl!.getError()).toBe(gl!.NO_ERROR);
    cache.dispose(false);
  });
});

const FIRST_LIGHT = Object.freeze({});

function plan(
  overrides: Partial<SettledWebGLDirectionalShadowPlan> = {},
): SettledWebGLDirectionalShadowPlan {
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

function pointPlan(
  overrides: Partial<SettledWebGLPointShadowPlan> = {},
): SettledWebGLPointShadowPlan {
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

function spotPlan(
  overrides: Partial<SettledWebGLSpotShadowPlan> = {},
): SettledWebGLSpotShadowPlan {
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
  readonly framebufferIncompleteAt?: number;
  readonly texStorage3DErrorAt?: number;
  readonly texStorage3DError?: Error;
  readonly deleteTextureError?: Error;
} = {}) {
  const textures: object[] = [];
  let framebufferStatusCount = 0;
  let texStorage3DCount = 0;
  const gl = {
    MAX_TEXTURE_SIZE: 1,
    FRAMEBUFFER: 3,
    READ_FRAMEBUFFER: 31,
    DRAW_FRAMEBUFFER: 32,
    FRAMEBUFFER_COMPLETE: 4,
    DEPTH_ATTACHMENT: 5,
    TEXTURE_2D_ARRAY: 8,
    DEPTH_COMPONENT24: 20,
    TEXTURE_MIN_FILTER: 23,
    TEXTURE_MAG_FILTER: 24,
    TEXTURE_WRAP_S: 25,
    TEXTURE_WRAP_T: 26,
    TEXTURE_WRAP_R: 27,
    NEAREST: 28,
    CLAMP_TO_EDGE: 29,
    NONE: 30,
    getParameter: vi.fn(() => options.maxTextureSize ?? 4096),
    createFramebuffer: vi.fn(() => ({ kind: 'framebuffer' })),
    deleteFramebuffer: vi.fn(),
    bindFramebuffer: vi.fn(),
    checkFramebufferStatus: vi.fn(() => {
      framebufferStatusCount += 1;
      return framebufferStatusCount === options.framebufferIncompleteAt ?
        999 : 4;
    }),
    framebufferTextureLayer: vi.fn(),
    blitFramebuffer: vi.fn(),
    drawBuffers: vi.fn(),
    readBuffer: vi.fn(),
    createTexture: vi.fn(() => {
      const texture = { kind: 'texture', id: textures.length + 1 };
      textures.push(texture);
      return texture;
    }),
    deleteTexture: vi.fn(() => {
      if (options.deleteTextureError) throw options.deleteTextureError;
    }),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texStorage3D: vi.fn(() => {
      texStorage3DCount += 1;
      if (texStorage3DCount === options.texStorage3DErrorAt) {
        throw options.texStorage3DError;
      }
    }),
  } as unknown as WebGL2RenderingContext;
  return {
    gl,
    textures,
    createFramebuffer: vi.mocked(gl.createFramebuffer),
    deleteFramebuffer: vi.mocked(gl.deleteFramebuffer),
    framebufferTextureLayer: vi.mocked(gl.framebufferTextureLayer),
    blitFramebuffer: vi.mocked(gl.blitFramebuffer),
    createTexture: vi.mocked(gl.createTexture),
    deleteTexture: vi.mocked(gl.deleteTexture),
    texStorage3D: vi.mocked(gl.texStorage3D),
  };
}
