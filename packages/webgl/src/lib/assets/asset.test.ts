import { describe, expect, it, vi } from 'vitest';
import { createWebGLGeometry } from '../geometry/geometry.js';
import {
  createInternalWebGLTexture,
  getInternalWebGLTextureData,
} from '../texture/texture.js';
import {
  acquireInternalWebGLAsset,
  createInternalWebGLAsset,
  getInternalWebGLAssetData,
  releaseInternalWebGLAsset,
} from './asset.js';

describe('opaque WebGL assets', () => {
  it('publishes copied immutable primitive order and public bounds', () => {
    const geometry = triangle();
    const matrix = translation(2, 3, 4);
    const bounds = {
      min: [-1, -2, -3] as [number, number, number],
      max: [4, 5, 6] as [number, number, number],
    };
    const primitives = [{
      geometry,
      material: material(),
      modelMatrix: matrix,
      sourceOrder: 7,
    }];

    const asset = createInternalWebGLAsset({ primitives, bounds }, []);
    matrix[12] = 99;
    bounds.min[0] = 99;
    primitives[0]!.sourceOrder = 99;
    const data = getInternalWebGLAssetData(asset);

    expect(asset).toEqual({
      bounds: { min: [-1, -2, -3], max: [4, 5, 6] },
    });
    expect('primitives' in asset).toBe(false);
    expect(data.primitives).toHaveLength(1);
    expect(data.primitives[0]).toMatchObject({ geometry, sourceOrder: 7 });
    expect(Array.from(data.primitives[0]!.modelMatrix)).toEqual(
      Array.from(translation(2, 3, 4)),
    );
    expect(Object.isFrozen(asset)).toBe(true);
    expect(Object.isFrozen(asset.bounds)).toBe(true);
    expect(Object.isFrozen(asset.bounds.min)).toBe(true);
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.primitives)).toBe(true);
    expect(Object.isFrozen(data.primitives[0])).toBe(true);

    releaseInternalWebGLAsset(asset);
  });

  it('retains each unique texture dependency until the final asset lease', () => {
    const close = vi.fn();
    const textureProducer = createInternalWebGLTexture({
      width: 2,
      height: 2,
      close,
    } as unknown as ImageBitmap);
    const asset = createInternalWebGLAsset({
      primitives: [{
        geometry: triangle(),
        material: material(textureProducer.texture),
        modelMatrix: translation(0, 0, 0),
        sourceOrder: 0,
      }],
      bounds: { min: [0, 0, 0], max: [1, 1, 0] },
    }, [textureProducer.texture, textureProducer.texture]);
    const releaseFirstConsumer = acquireInternalWebGLAsset(asset);
    const releaseSecondConsumer = acquireInternalWebGLAsset(asset);

    textureProducer.release();
    releaseInternalWebGLAsset(asset);
    releaseFirstConsumer();
    releaseFirstConsumer();

    expect(close).not.toHaveBeenCalled();
    expect(getInternalWebGLTextureData(textureProducer.texture).bitmap)
      .toBeDefined();
    expect(getInternalWebGLAssetData(asset).primitives).toHaveLength(1);

    releaseSecondConsumer();
    expect(close).toHaveBeenCalledOnce();
    expect(() => getInternalWebGLAssetData(asset))
      .toThrow('WebGL asset descriptor is invalid or released.');
  });

  it('rolls back previously acquired dependencies when publication fails', () => {
    const firstClose = vi.fn();
    const first = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: firstClose,
    } as unknown as ImageBitmap);
    const expired = createInternalWebGLTexture({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);
    expired.release();

    expect(() => createInternalWebGLAsset({
      primitives: [],
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    }, [first.texture, expired.texture])).toThrow(
      'WebGL texture descriptor is invalid or released.',
    );

    first.release();
    expect(firstClose).toHaveBeenCalledOnce();
  });
});

function triangle() {
  return createWebGLGeometry({
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
  });
}

function material(texture?: ReturnType<typeof createInternalWebGLTexture>['texture']) {
  return {
    type: 'pbr-metallic-roughness' as const,
    baseColorFactor: [0.5, 0.75, 1, 0.8] as const,
    ...(texture === undefined ? {} : {
      baseColorTexture: { texture, textureCoordinate: 0 as const },
    }),
    metallicFactor: 0.25,
    roughnessFactor: 0.75,
  };
}

function translation(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}
