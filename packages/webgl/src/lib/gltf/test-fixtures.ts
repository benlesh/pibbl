const encoder = new TextEncoder();

export interface TestGLBChunk {
  readonly type: number;
  readonly bytes: Uint8Array;
  readonly paddingByte?: number;
}

export const JSON_CHUNK_TYPE = 0x4e4f534a;
export const BIN_CHUNK_TYPE = 0x004e4942;

export function makeGLB(
  json: unknown,
  binary?: Uint8Array,
): ArrayBuffer {
  const jsonBytes = encoder.encode(JSON.stringify(json));
  const chunks: TestGLBChunk[] = [{
    type: JSON_CHUNK_TYPE,
    bytes: jsonBytes,
    paddingByte: 0x20,
  }];
  if (binary !== undefined) {
    chunks.push({ type: BIN_CHUNK_TYPE, bytes: binary, paddingByte: 0 });
  }
  return makeRawGLB(chunks);
}

export function makeRawGLB(
  chunks: readonly TestGLBChunk[],
  header: Readonly<{
    magic?: number;
    version?: number;
    declaredLength?: number;
  }> = {},
): ArrayBuffer {
  const padded = chunks.map(chunk => ({
    ...chunk,
    paddedLength: (chunk.bytes.byteLength + 3) & ~3,
  }));
  const actualLength = 12 + padded.reduce(
    (sum, chunk) => sum + 8 + chunk.paddedLength,
    0,
  );
  const bytes = new Uint8Array(actualLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, header.magic ?? 0x46546c67, true);
  view.setUint32(4, header.version ?? 2, true);
  view.setUint32(8, header.declaredLength ?? actualLength, true);
  let offset = 12;
  for (const chunk of padded) {
    view.setUint32(offset, chunk.paddedLength, true);
    view.setUint32(offset + 4, chunk.type, true);
    bytes.set(chunk.bytes, offset + 8);
    bytes.fill(
      chunk.paddingByte ?? 0,
      offset + 8 + chunk.bytes.byteLength,
      offset + 8 + chunk.paddedLength,
    );
    offset += 8 + chunk.paddedLength;
  }
  return bytes.buffer;
}

export function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

export function float32Bytes(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return bytes;
}

export function uint16Bytes(values: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return bytes;
}

export function staticTriangleFixture(imageKind: 'png' | 'jpeg' = 'png'): {
  readonly document: Record<string, unknown>;
  readonly binary: Uint8Array;
} {
  const positions = float32Bytes([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const normals = float32Bytes([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const tangents = float32Bytes([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
  const textureCoordinates = float32Bytes([0, 0, 1, 0, 0, 1]);
  const indices = uint16Bytes([0, 1, 2]);
  const indexPadding = new Uint8Array(2);
  const image = imageKind === 'png' ? new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03,
  ]) : new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x08, 0x08, 0x00, 0x03, 0x00, 0x02, 0x00,
  ]);
  const binary = concatBytes(
    positions,
    normals,
    tangents,
    textureCoordinates,
    indices,
    indexPadding,
    image,
  );
  return {
    binary,
    document: {
      asset: { version: '2.0' },
      buffers: [{ byteLength: 152 + image.byteLength }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 36 },
        { buffer: 0, byteOffset: 72, byteLength: 48 },
        { buffer: 0, byteOffset: 120, byteLength: 24 },
        { buffer: 0, byteOffset: 144, byteLength: 6 },
        { buffer: 0, byteOffset: 152, byteLength: image.byteLength },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
        { bufferView: 3, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 4, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      images: [{
        bufferView: 5,
        mimeType: imageKind === 'png' ? 'image/png' : 'image/jpeg',
      }],
      samplers: [{ wrapS: 33071, wrapT: 33648, minFilter: 9987, magFilter: 9728 }],
      textures: [{ source: 0, sampler: 0 }],
      materials: [{
        pbrMetallicRoughness: {
          baseColorFactor: [0.25, 0.5, 0.75, 1],
          baseColorTexture: { index: 0 },
          metallicFactor: 0.2,
          roughnessFactor: 0.8,
        },
      }],
      meshes: [{
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 },
            indices: 4,
            material: 0,
          },
          { attributes: { POSITION: 0, TEXCOORD_0: 3 }, material: 0 },
        ],
      }],
      nodes: [
        { translation: [10, 0, 0], children: [1] },
        { mesh: 0, translation: [0, 2, 0] },
        { mesh: 0, translation: [-2, 0, 0], scale: [2, 1, 1] },
      ],
      scenes: [{ nodes: [0, 2] }],
    },
  };
}
