import { describe, expect, it, vi } from 'vitest';
import {
  getInternalWebGLAssetData,
  releaseInternalWebGLAsset,
} from '../assets/asset.js';
import { getWebGLGeometryData } from '../geometry/geometry.js';
import { getInternalWebGLTextureData } from '../texture/texture.js';
import { decodeGLBAsset, type CRCGLTFDecodePlatform } from './decode.js';
import { makeGLB, staticTriangleFixture } from './test-fixtures.js';

describe('static GLB asset decoder', () => {
  it('compiles selected nodes in preorder with instancing, materials, and bounds', async () => {
    const fixture = staticTriangleFixture();
    const close = vi.fn();
    const decodedInputs: Array<{
      readonly bytes: readonly number[];
      readonly mimeType: string;
    }> = [];
    const decodeImage: CRCGLTFDecodePlatform['decodeImage'] = async (
      bytes,
      mimeType,
    ) => {
      decodedInputs.push({ bytes: Array.from(bytes), mimeType });
      return {
        width: 2,
        height: 3,
        close,
      } as unknown as ImageBitmap;
    };

    const asset = await decodeGLBAsset(
      makeGLB(fixture.document, fixture.binary),
      { decodeImage },
    );
    const data = getInternalWebGLAssetData(asset);

    expect(asset.bounds).toEqual({ min: [-2, 0, 0], max: [11, 3, 0] });
    expect(data.primitives.map(primitive => primitive.sourceOrder))
      .toEqual([0, 1, 2, 3]);
    expect(data.primitives.map(primitive => Array.from(primitive.modelMatrix)))
      .toEqual([
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 2, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 2, 0, 1],
        [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, 0, 1],
        [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -2, 0, 0, 1],
      ]);
    expect(data.primitives[0]!.geometry).toBe(data.primitives[2]!.geometry);
    expect(data.primitives[1]!.geometry).toBe(data.primitives[3]!.geometry);
    expect(data.primitives[0]!.geometry).not.toBe(data.primitives[1]!.geometry);
    expect(getWebGLGeometryData(data.primitives[0]!.geometry)).toMatchObject({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
      tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
      textureCoordinates0: new Float32Array([0, 0, 1, 0, 0, 1]),
      indices: new Uint32Array([0, 1, 2]),
    });
    expect(data.primitives[0]!.material).toMatchObject({
      type: 'pbr-metallic-roughness',
      baseColorFactor: [0.25, 0.5, 0.75, 1],
      metallicFactor: 0.2,
      roughnessFactor: 0.8,
    });
    const texture = data.primitives[0]!.material.baseColorTexture!.texture;
    expect(getInternalWebGLTextureData(texture).sampler).toEqual({
      wrapS: 'clamp-to-edge',
      wrapT: 'mirrored-repeat',
      minFilter: 'linear-mipmap-linear',
      magFilter: 'nearest',
    });
    expect(decodedInputs).toEqual([{
      bytes: [0x89, 0x50, 0x4e, 0x47],
      mimeType: 'image/png',
    }]);
    expect(close).not.toHaveBeenCalled();

    releaseInternalWebGLAsset(asset);
    expect(close).toHaveBeenCalledOnce();
  });

  it('uses the declared default scene, otherwise scene zero', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as Record<string, unknown>;
    document.scenes = [{ nodes: [] }, { nodes: [2] }];
    document.scene = 1;
    const first = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(getInternalWebGLAssetData(first).primitives).toHaveLength(2);
    expect(first.bounds).toEqual({ min: [-2, 0, 0], max: [0, 1, 0] });
    releaseInternalWebGLAsset(first);

    delete document.scene;
    document.scenes = [{ nodes: [2] }];
    const second = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(getInternalWebGLAssetData(second).primitives).toHaveLength(2);
    releaseInternalWebGLAsset(second);
  });

  it('normalizes node quaternions before composing glTF TRS', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.nodes = [{ mesh: 0, rotation: [0, 0, 2, 2] }];
    document.scenes = [{ nodes: [0] }];
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    const matrix = getInternalWebGLAssetData(asset).primitives[0]!.modelMatrix;
    expect(Array.from(matrix).map(value => Math.abs(value) < 1e-6 ? 0 : value))
      .toEqual([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    releaseInternalWebGLAsset(asset);
  });

  it('preserves an authored glTF node matrix without auto fitting', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.nodes = [{
      mesh: 0,
      matrix: [
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 4, 0,
        5, 6, 7, 1,
      ],
    }];
    document.scenes = [{ nodes: [0] }];
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(asset.bounds).toEqual({ min: [5, 6, 7], max: [7, 9, 7] });
    expect(Array.from(getInternalWebGLAssetData(asset).primitives[0]!.modelMatrix))
      .toEqual([
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 4, 0,
        5, 6, 7, 1,
      ]);
    releaseInternalWebGLAsset(asset);
  });

  it.each([
    ['missing scenes', (document: any) => { delete document.scenes; }, /\$\.scenes.*selected scene/],
    ['empty scene', (document: any) => { document.scenes = [{ nodes: [] }]; }, /\$\.scenes\[0\].*renderable/],
    ['node out of bounds', (document: any) => { document.scenes = [{ nodes: [99] }]; }, /\$\.scenes\[0\]\.nodes\[0\].*nodes\[99\]/],
    ['cycle', (document: any) => { document.nodes[1].children = [0]; }, /\$\.nodes\[1\]\.children\[0\].*cycle/],
    ['multiple parents', (document: any) => { document.nodes[2].children = [1]; }, /\$\.nodes\[2\]\.children\[0\].*multiple parents/],
    ['matrix and TRS', (document: any) => { document.nodes[1].matrix = new Array(16).fill(0); }, /\$\.nodes\[1\]\.matrix.*TRS/],
    ['zero quaternion', (document: any) => { document.nodes[1].rotation = [0, 0, 0, 0]; }, /\$\.nodes\[1\]\.rotation.*nonzero quaternion/],
    ['camera node', (document: any) => { document.nodes[1].camera = 0; }, /\$\.nodes\[1\]\.camera.*unsupported/],
    ['skin node', (document: any) => { document.nodes[1].skin = 0; }, /\$\.nodes\[1\]\.skin.*unsupported/],
    ['punctual light node', (document: any) => { document.nodes[1].extensions = { KHR_lights_punctual: { light: 0 } }; }, /\$\.nodes\[1\]\.extensions\.KHR_lights_punctual.*unsupported/],
    ['morph targets', (document: any) => { document.meshes[0].primitives[0].targets = [{}]; }, /\$\.meshes\[0\]\.primitives\[0\]\.targets.*unsupported/],
    ['non-triangles', (document: any) => { document.meshes[0].primitives[0].mode = 5; }, /\$\.meshes\[0\]\.primitives\[0\]\.mode.*TRIANGLES/],
    ['missing POSITION', (document: any) => { delete document.meshes[0].primitives[0].attributes.POSITION; }, /\$\.meshes\[0\]\.primitives\[0\]\.attributes\.POSITION.*required/],
    ['required extension', (document: any) => { document.extensionsRequired = ['KHR_draco_mesh_compression']; }, /\$\.extensionsRequired\[0\].*unsupported.*KHR_draco_mesh_compression/],
    ['animation', (document: any) => { document.animations = [{}]; }, /\$\.animations.*unsupported/],
    ['camera definitions', (document: any) => { document.cameras = [{ type: 'perspective' }]; }, /\$\.cameras.*unsupported/],
  ])('rejects %s', async (_name, mutate, message) => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    mutate(document);
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(message);
  });

  it.each([
    ['external image', (image: any) => { image.uri = 'albedo.png'; delete image.bufferView; }, /\$\.images\[0\]\.uri.*external.*unsupported/],
    ['data URI image', (image: any) => { image.uri = 'data:image/png;base64,AA=='; delete image.bufferView; }, /\$\.images\[0\]\.uri.*external.*unsupported/],
    ['missing MIME type', (image: any) => { delete image.mimeType; }, /\$\.images\[0\]\.mimeType.*image\/png.*image\/jpeg/],
    ['unsupported MIME type', (image: any) => { image.mimeType = 'image/webp'; }, /\$\.images\[0\]\.mimeType.*image\/png.*image\/jpeg/],
    ['UV1 texture', (_image: any, document: any) => { document.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1; }, /baseColorTexture\.texCoord.*0/],
    ['unsupported material property', (_image: any, document: any) => { document.materials[0].normalTexture = { index: 0 }; }, /\$\.materials\[0\]\.normalTexture.*unsupported/],
  ])('rejects %s', async (_name, mutate, message) => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    mutate(document.images[0], document);
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(message);
  });

  it('ignores unknown optional top-level extensions', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.extensionsUsed = ['VENDOR_metadata'];
    document.extensions = { VENDOR_metadata: { label: 'triangle' } };
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(getInternalWebGLAssetData(asset).primitives).toHaveLength(4);
    releaseInternalWebGLAsset(asset);
  });

  it('uses material and sampler defaults when omitted', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    delete document.samplers;
    document.textures[0] = { source: 0 };
    document.materials[0] = {
      pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
    };
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    const material = getInternalWebGLAssetData(asset).primitives[0]!.material;
    expect(material).toMatchObject({
      baseColorFactor: [1, 1, 1, 1],
      metallicFactor: 1,
      roughnessFactor: 1,
    });
    expect(getInternalWebGLTextureData(material.baseColorTexture!.texture).sampler)
      .toEqual({
        wrapS: 'repeat',
        wrapT: 'repeat',
        minFilter: 'linear-mipmap-linear',
        magFilter: 'linear',
      });
    releaseInternalWebGLAsset(asset);
  });

  it('passes buffer-view JPEG bytes to the injected decoder', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.images[0].mimeType = 'image/jpeg';
    const calls: Array<{ bytes: number[]; mimeType: string }> = [];
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      {
        decodeImage: async (bytes, mimeType) => {
          calls.push({ bytes: Array.from(bytes), mimeType });
          return {
            width: 1,
            height: 1,
            close: vi.fn(),
          } as unknown as ImageBitmap;
        },
      },
    );
    expect(calls).toEqual([{
      bytes: [0x89, 0x50, 0x4e, 0x47],
      mimeType: 'image/jpeg',
    }]);
    releaseInternalWebGLAsset(asset);
  });

  it('decodes a shared image once for distinct texture samplers', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.samplers.push({
      wrapS: 10497,
      wrapT: 10497,
      minFilter: 9728,
      magFilter: 9729,
    });
    document.textures.push({ source: 0, sampler: 1 });
    document.materials.push({
      pbrMetallicRoughness: {
        baseColorTexture: { index: 1 },
      },
    });
    document.meshes[0].primitives[1].material = 1;
    const close = vi.fn();
    let decodeCount = 0;
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      {
        decodeImage: async () => {
          decodeCount += 1;
          return {
            width: 1,
            height: 1,
            close,
          } as unknown as ImageBitmap;
        },
      },
    );
    const primitives = getInternalWebGLAssetData(asset).primitives;
    const firstTexture = primitives[0]!.material.baseColorTexture!.texture;
    const secondTexture = primitives[1]!.material.baseColorTexture!.texture;
    expect(decodeCount).toBe(1);
    expect(secondTexture).not.toBe(firstTexture);
    expect(getInternalWebGLTextureData(firstTexture).sampler.minFilter)
      .toBe('linear-mipmap-linear');
    expect(getInternalWebGLTextureData(secondTexture).sampler.minFilter)
      .toBe('nearest');

    releaseInternalWebGLAsset(asset);
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects a textured primitive without UV0 and closes its decoded bitmap', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    delete document.meshes[0].primitives[0].attributes.TEXCOORD_0;
    const close = vi.fn();

    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      {
        decodeImage: async () => ({
          width: 1,
          height: 1,
          close,
        } as unknown as ImageBitmap),
      },
    )).rejects.toThrow(
      /\$\.meshes\[0\]\.primitives\[0\]\.attributes\.TEXCOORD_0.*required.*baseColorTexture/,
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('releases every decoded bitmap once when later geometry creation fails', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    const normals = new Float32Array(fixture.binary.buffer.slice(0));
    normals.fill(0, 9, 18);
    const close = vi.fn();
    let decodeCount = 0;
    const decodeImage: CRCGLTFDecodePlatform['decodeImage'] = async () => {
      decodeCount += 1;
      return {
        width: 1,
        height: 1,
        close,
      } as unknown as ImageBitmap;
    };

    await expect(decodeGLBAsset(
      makeGLB(document, new Uint8Array(normals.buffer)),
      { decodeImage },
    )).rejects.toThrow(/normals\[0\.\.2\].*nonzero/);
    expect(decodeCount).toBe(1);
    expect(close).toHaveBeenCalledOnce();
  });
});

function platform(): CRCGLTFDecodePlatform {
  return {
    decodeImage: async () => ({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap),
  };
}
