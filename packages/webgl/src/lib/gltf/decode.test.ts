import { describe, expect, it, vi } from 'vitest';
import {
  getInternalWebGLAssetData,
  releaseInternalWebGLAsset,
} from '../assets/asset.js';
import { getWebGLGeometryData } from '../geometry/geometry.js';
import { getInternalWebGLTextureData } from '../texture/texture.js';
import { resolveCamera } from '../math/camera.js';
import {
  createWebGLSceneComposer,
  submitWebGLMesh,
} from '../scene/composer.js';
import { settleWebGLScene } from '../scene/settle.js';
import { decodeGLBAsset, type CRCGLTFDecodePlatform } from './decode.js';
import {
  concatBytes,
  float32Bytes,
  makeGLB,
  staticTriangleFixture,
  uint16Bytes,
} from './test-fixtures.js';

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
      bytes: [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03,
      ],
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

  it('generates flat normals by expanding indexed vertex streams and settles lit PBR', async () => {
    const fixture = indexedNormalFreeFixture();
    const asset = await decodeGLBAsset(
      makeGLB(fixture.document, fixture.binary),
      platform(),
    );
    const primitive = getInternalWebGLAssetData(asset).primitives[0]!;
    const geometry = getWebGLGeometryData(primitive.geometry);

    expect(Array.from(geometry.positions)).toEqual([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, 1, 1,
    ]);
    expect(Array.from(geometry.normals!)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      1, 0, 0, 1, 0, 0, 1, 0, 0,
    ]);
    expect(Array.from(geometry.textureCoordinates0!)).toEqual([
      0, 0, 1, 0, 0, 1,
      0, 0, 0, 1, 1, 1,
    ]);
    expect(Array.from(geometry.tangents!)).toEqual([
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1,
      1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1,
    ]);
    expect(geometry.indices).toBeUndefined();

    const camera = resolveCamera(undefined, 100, 100);
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
      contextGeneration: 1,
    });
    submitWebGLMesh(composer, {
      componentName: 'DecodedModel',
      geometry: primitive.geometry,
      localModel: new Float32Array(primitive.modelMatrix),
      color: [1, 1, 1, 1],
      lit: true,
      material: primitive.material,
    });
    expect(() => settleWebGLScene(composer)).not.toThrow();
    releaseInternalWebGLAsset(asset);
  });

  it.each([
    [
      'non-affine matrix',
      [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      /\$\.nodes\[0\]\.matrix.*affine/,
    ],
    [
      'non-affine matrix that would round to affine Float32',
      [1, 0, 0, Number.MIN_VALUE, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      /\$\.nodes\[0\]\.matrix.*affine/,
    ],
    [
      'sheared matrix',
      [1, 0, 0, 0, 0.5, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      /\$\.nodes\[0\]\.matrix.*decompose.*without shear/,
    ],
    [
      'singular matrix',
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      /\$\.nodes\[0\]\.matrix.*invertible normal matrix/,
    ],
    [
      'Float32 overflow matrix',
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, Number.MAX_VALUE, 0, 0, 1],
      /\$\.nodes\[0\]\.matrix\[12\].*finite Float32/,
    ],
  ])('rejects an authored %s', async (_name, matrix, message) => {
    const fixture = indexedNormalFreeFixture();
    const document = structuredClone(fixture.document) as any;
    document.nodes[0].matrix = matrix;
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(message);
  });

  it('rejects a composed transform that overflows Float32 at the child path', async () => {
    const fixture = indexedNormalFreeFixture();
    const document = structuredClone(fixture.document) as any;
    document.nodes = [
      { scale: [3e38, 1, 1], children: [1] },
      { mesh: 0, scale: [2, 1, 1] },
    ];
    document.scenes = [{ nodes: [0] }];
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(/\$\.nodes\[1\].*composed.*finite Float32/);
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
    ['required extension', (document: any) => { document.extensionsRequired = ['KHR_draco_mesh_compression']; }, /\$\.extensionsRequired.*unsupported.*KHR_draco_mesh_compression/],
    ['animation', (document: any) => { document.animations = [{}]; }, /\$\.animations.*unsupported/],
  ])('rejects %s', async (_name, mutate, message) => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    mutate(document);
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(message);
  });

  it('permits unused camera definitions while still rejecting selected camera nodes', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.cameras = [{ type: 'perspective' }];
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(getInternalWebGLAssetData(asset).primitives).toHaveLength(4);
    releaseInternalWebGLAsset(asset);
  });

  it('permits extensions and extras metadata inside pbrMetallicRoughness', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    Object.assign(document.materials[0].pbrMetallicRoughness, {
      extensions: { VENDOR_metadata: { label: 'paint' } },
      extras: { author: 'fixture' },
    });
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    expect(getInternalWebGLAssetData(asset).primitives[0]!.material)
      .toMatchObject({ metallicFactor: 0.2, roughnessFactor: 0.8 });
    releaseInternalWebGLAsset(asset);

    const malformed = staticTriangleFixture();
    const malformedDocument = structuredClone(malformed.document) as any;
    malformedDocument.materials[0].pbrMetallicRoughness.extensions = 1;
    await expect(decodeGLBAsset(
      makeGLB(malformedDocument, malformed.binary),
      platform(),
    )).rejects.toThrow(/pbrMetallicRoughness\.extensions.*object/);
  });

  it('aggregates every unsupported required extension in one diagnostic', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.extensionsRequired = [
      'KHR_draco_mesh_compression',
      'EXT_meshopt_compression',
    ];
    await expect(decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    )).rejects.toThrow(
      /\$\.extensionsRequired.*KHR_draco_mesh_compression.*EXT_meshopt_compression/,
    );
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
    const fixture = staticTriangleFixture('jpeg');
    const document = structuredClone(fixture.document) as any;
    const calls: Array<{ bytes: number[]; mimeType: string }> = [];
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      {
        decodeImage: async (bytes, mimeType) => {
          calls.push({ bytes: Array.from(bytes), mimeType });
          return {
            width: 2,
            height: 3,
            close: vi.fn(),
          } as unknown as ImageBitmap;
        },
      },
    );
    expect(calls).toEqual([{
      bytes: [
        0xff, 0xd8,
        0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x03, 0x00, 0x02, 0x00,
      ],
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
            width: 2,
            height: 3,
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

  it('shares identical geometry combinations across distinct meshes', async () => {
    const fixture = staticTriangleFixture();
    const document = structuredClone(fixture.document) as any;
    document.meshes.push(structuredClone(document.meshes[0]));
    document.nodes[2].mesh = 1;
    const asset = await decodeGLBAsset(
      makeGLB(document, fixture.binary),
      platform(),
    );
    const primitives = getInternalWebGLAssetData(asset).primitives;

    expect(primitives[0]!.geometry).toBe(primitives[2]!.geometry);
    expect(primitives[1]!.geometry).toBe(primitives[3]!.geometry);
    releaseInternalWebGLAsset(asset);
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
          width: 2,
          height: 3,
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
        width: 2,
        height: 3,
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

  it('wraps image decoder rejection with the image path and cause', async () => {
    const fixture = staticTriangleFixture();
    const failure = new Error('codec rejected bytes');
    let received: unknown;
    try {
      await decodeGLBAsset(
        makeGLB(fixture.document, fixture.binary),
        { decodeImage: async () => { throw failure; } },
      );
    } catch (error) {
      received = error;
    }
    expect(received).toBeInstanceOf(Error);
    expect((received as Error).message)
      .toMatch(/\$\.images\[0\].*codec rejected bytes/);
    expect((received as Error).cause).toBe(failure);
  });

  it('preflights encoded dimensions before decode and closes invalid decoded dimensions', async () => {
    const fixture = staticTriangleFixture();
    const oversized = fixture.binary.slice();
    new DataView(oversized.buffer).setUint32(168, 16385, false);
    let decodeCount = 0;
    await expect(decodeGLBAsset(
      makeGLB(fixture.document, oversized),
      {
        decodeImage: async () => {
          decodeCount += 1;
          return { width: 2, height: 3, close: vi.fn() } as unknown as ImageBitmap;
        },
      },
    )).rejects.toThrow(/\$\.images\[0\].*encoded width 16385.*limit 16384/);
    expect(decodeCount).toBe(0);

    const close = vi.fn();
    await expect(decodeGLBAsset(
      makeGLB(fixture.document, fixture.binary),
      {
        decodeImage: async () => ({
          width: 2,
          height: 4,
          close,
        } as unknown as ImageBitmap),
      },
    )).rejects.toThrow(/\$\.images\[0\].*decoded dimensions 2x4.*encoded 2x3/);
    expect(close).toHaveBeenCalledOnce();
  });

  it('passes image bytes as a view into the original GLB without copying', async () => {
    const fixture = staticTriangleFixture();
    const input = makeGLB(fixture.document, fixture.binary);
    let sharesInput = false;
    const asset = await decodeGLBAsset(input, {
      decodeImage: async bytes => {
        sharesInput = bytes.buffer === input;
        return {
          width: 2,
          height: 3,
          close: vi.fn(),
        } as unknown as ImageBitmap;
      },
    });
    expect(sharesInput).toBe(true);
    releaseInternalWebGLAsset(asset);
  });

  it('rejects image bufferViews with target or byteStride', async () => {
    const fixture = staticTriangleFixture();
    const targetDocument = structuredClone(fixture.document) as any;
    targetDocument.bufferViews[5].target = 34962;
    await expect(decodeGLBAsset(
      makeGLB(targetDocument, fixture.binary),
      platform(),
    )).rejects.toThrow(/\$\.bufferViews\[5\]\.target.*image data/);

    const strideDocument = structuredClone(fixture.document) as any;
    strideDocument.bufferViews[5].byteStride = 4;
    await expect(decodeGLBAsset(
      makeGLB(strideDocument, fixture.binary),
      platform(),
    )).rejects.toThrow(/\$\.bufferViews\[5\]\.byteStride.*image data/);
  });
});

function platform(): CRCGLTFDecodePlatform {
  return {
    decodeImage: async () => ({
      width: 2,
      height: 3,
      close: vi.fn(),
    } as unknown as ImageBitmap),
  };
}

function indexedNormalFreeFixture(): {
  readonly document: Record<string, unknown>;
  readonly binary: Uint8Array;
} {
  const positions = float32Bytes([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    0, 1, 1,
  ]);
  const tangents = float32Bytes([
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
  ]);
  const textureCoordinates = float32Bytes([
    0, 0,
    1, 0,
    0, 1,
    1, 1,
  ]);
  const indices = uint16Bytes([0, 1, 2, 0, 2, 3]);
  return {
    binary: concatBytes(positions, tangents, textureCoordinates, indices),
    document: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: 156 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 48 },
        { buffer: 0, byteOffset: 48, byteLength: 64 },
        { buffer: 0, byteOffset: 112, byteLength: 32 },
        { buffer: 0, byteOffset: 144, byteLength: 12 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 4, type: 'VEC4' },
        { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
        { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
      ],
      meshes: [{ primitives: [{
        attributes: { POSITION: 0, TANGENT: 1, TEXCOORD_0: 2 },
        indices: 3,
      }] }],
      nodes: [{ mesh: 0, matrix: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ] }],
      scenes: [{ nodes: [0] }],
    },
  };
}
