import { describe, expect, it } from 'vitest';
import { decodeGLTFAccessor } from './accessor.js';
import { GLTFDecodeBudget } from './budget.js';
import { readGLB } from './glb.js';
import {
  concatBytes,
  float32Bytes,
  makeGLB,
  uint16Bytes,
} from './test-fixtures.js';

describe('bounded glTF accessor decoding', () => {
  it('deinterleaves fresh finite POSITION values', () => {
    const binary = float32Bytes([
      1, 2, 3, 99,
      4, 5, 6, 99,
      7, 8, 9, 99,
    ]);
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 48 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48, byteStride: 16 }],
      accessors: [{
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
      }],
    }, binary));

    const first = decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION');
    const second = decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION');
    expect(first).toEqual(new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(first).not.toBe(second);
  });

  it('reuses one cached logical accessor and charges its bytes once in a decode', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 36 }],
      bufferViews: [{ buffer: 0, byteLength: 36 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    }, float32Bytes([0, 0, 0, 1, 0, 0, 0, 1, 0])));
    const budget = new GLTFDecodeBudget();
    const context = { budget, cache: new Map() };
    const first = decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      'POSITION',
      context,
    );
    const second = decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      'NORMAL',
      context,
    );

    expect(second).toBe(first);
    expect(budget.numericAttributeBytes).toBe(36);
  });

  it('normalizes signed NORMAL and unsigned TEXCOORD_0 integers exactly', () => {
    const binary = concatBytes(
      new Uint8Array([0x80, 0, 0x7f, 0, 0xc0, 0x40, 0, 0]),
      new Uint8Array([0, 255, 0, 0, 128, 64, 0, 0]),
    );
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 16 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 8, byteStride: 4 },
        { buffer: 0, byteOffset: 8, byteLength: 8, byteStride: 4 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5120, normalized: true, count: 2, type: 'VEC3' },
        { bufferView: 1, componentType: 5121, normalized: true, count: 2, type: 'VEC2' },
      ],
    }, binary));

    expect(Array.from(decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      'NORMAL',
    ))).toEqual([
      -1,
      0,
      1,
      Math.fround(-64 / 127),
      Math.fround(64 / 127),
      0,
    ]);
    expect(Array.from(decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      1,
      'TEXCOORD_0',
    ))).toEqual([0, 1, Math.fround(128 / 255), Math.fround(64 / 255)]);
  });

  it('decodes unsigned scalar indices into a fresh Uint32Array', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 6 }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 6 }],
      accessors: [{ bufferView: 0, componentType: 5123, count: 3, type: 'SCALAR' }],
    }, uint16Bytes([2, 0, 1])));

    expect(decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'indices'))
      .toEqual(new Uint32Array([2, 0, 1]));
  });

  it.each([
    [
      'normalized SHORT normals',
      new Uint8Array([0x00, 0x80, 0xff, 0x7f, 0x00, 0x00, 0x00, 0x00]),
      { componentType: 5122, normalized: true, count: 1, type: 'VEC3' },
      'NORMAL',
      [-1, 1, 0],
    ],
    [
      'normalized UNSIGNED_SHORT texture coordinates',
      new Uint8Array([0x00, 0x00, 0xff, 0xff]),
      { componentType: 5123, normalized: true, count: 1, type: 'VEC2' },
      'TEXCOORD_0',
      [0, 1],
    ],
    [
      'UNSIGNED_BYTE indices',
      new Uint8Array([2, 1, 0]),
      { componentType: 5121, count: 3, type: 'SCALAR' },
      'indices',
      [2, 1, 0],
    ],
    [
      'UNSIGNED_INT indices',
      new Uint8Array([2, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
      { componentType: 5125, count: 3, type: 'SCALAR' },
      'indices',
      [2, 1, 0],
    ],
    [
      'FLOAT tangents',
      float32Bytes([1, 0, 0, -1]),
      { componentType: 5126, count: 1, type: 'VEC4' },
      'TANGENT',
      [1, 0, 0, -1],
    ],
  ])('decodes %s', (_name, source, accessor, usage, expected) => {
    const byteStride = _name === 'normalized SHORT normals' ? 8 : undefined;
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: source.byteLength }],
      bufferViews: [{
        buffer: 0,
        byteLength: source.byteLength,
        ...(byteStride === undefined ? {} : { byteStride }),
      }],
      accessors: [{ bufferView: 0, ...accessor }],
    }, source));
    expect(Array.from(decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      usage as 'NORMAL',
    ))).toEqual(expected);
  });

  it.each([
    [
      'missing BIN',
      { buffers: [{ byteLength: 12 }], bufferViews: [{ buffer: 0, byteLength: 12 }] },
      undefined,
      /\$\.buffers\[0\].*requires a GLB BIN chunk/,
    ],
    [
      'external buffer',
      {
        buffers: [{ byteLength: 12, uri: 'mesh.bin' }],
        bufferViews: [{ buffer: 0, byteLength: 12 }],
      },
      new Uint8Array(12),
      /\$\.buffers\[0\]\.uri.*external buffers are unsupported/,
    ],
    [
      'buffer overflow',
      { buffers: [{ byteLength: Number.MAX_VALUE }], bufferViews: [{ buffer: 0, byteLength: 12 }] },
      new Uint8Array(12),
      /\$\.buffers\[0\]\.byteLength.*safe integer/,
    ],
    [
      'view out of bounds',
      {
        buffers: [{ byteLength: 12 }],
        bufferViews: [{ buffer: 0, byteOffset: 8, byteLength: 8 }],
      },
      new Uint8Array(12),
      /\$\.bufferViews\[0\].*exceeds.*buffer/,
    ],
    [
      'view wrong buffer',
      { buffers: [{ byteLength: 12 }], bufferViews: [{ buffer: 1, byteLength: 12 }] },
      new Uint8Array(12),
      /\$\.bufferViews\[0\]\.buffer.*only buffer 0/,
    ],
  ])('rejects %s with its document path', (_name, fields, binary, message) => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      ...fields,
      accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    }, binary));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(message);
  });

  it.each([
    [
      'sparse data',
      { sparse: { count: 1 } },
      'POSITION',
      /\$\.accessors\[0\]\.sparse.*unsupported/,
    ],
    [
      'wrong POSITION arity',
      { type: 'VEC2' },
      'POSITION',
      /\$\.accessors\[0\]\.type.*VEC3/,
    ],
    [
      'wrong index arity',
      { type: 'VEC3', componentType: 5123 },
      'indices',
      /\$\.accessors\[0\]\.type.*SCALAR/,
    ],
    [
      'signed indices',
      { type: 'SCALAR', componentType: 5122 },
      'indices',
      /\$\.accessors\[0\]\.componentType.*unsigned/,
    ],
    [
      'integer POSITION',
      { componentType: 5123 },
      'POSITION',
      /\$\.accessors\[0\]\.componentType.*FLOAT/,
    ],
    [
      'unnormalized integer NORMAL',
      { componentType: 5120 },
      'NORMAL',
      /\$\.accessors\[0\]\.normalized.*true/,
    ],
    [
      'normalized FLOAT',
      { normalized: true },
      'POSITION',
      /\$\.accessors\[0\]\.normalized.*FLOAT/,
    ],
    [
      'misaligned accessor offset',
      { byteOffset: 2 },
      'POSITION',
      /\$\.accessors\[0\]\.byteOffset.*aligned/,
    ],
  ])('rejects %s', (_name, accessorPatch, usage, message) => {
    const accessor = {
      bufferView: 0,
      componentType: 5126,
      count: 1,
      type: 'VEC3',
      ...accessorPatch,
    };
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 16 }],
      bufferViews: [{ buffer: 0, byteLength: 16 }],
      accessors: [accessor],
    }, new Uint8Array(16)));
    expect(() => decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      usage as 'POSITION',
    )).toThrow(message);
  });

  it.each([
    [8, /\$\.bufferViews\[0\]\.byteStride.*element size 12/],
    [14, /\$\.bufferViews\[0\]\.byteStride.*component size 4/],
    [256, /\$\.bufferViews\[0\]\.byteStride.*between 4 and 252/],
  ])('rejects invalid byteStride %s', (byteStride, message) => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 16 }],
      bufferViews: [{ buffer: 0, byteLength: 16, byteStride }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    }, new Uint8Array(16)));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(message);
  });

  it('rejects an accessor range outside its view with checked arithmetic context', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 16 }],
      bufferViews: [{ buffer: 0, byteLength: 16 }],
      accessors: [{
        bufferView: 0,
        byteOffset: 8,
        componentType: 5126,
        count: 1,
        type: 'VEC3',
      }],
    }, new Uint8Array(16)));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(/\$\.accessors\[0\].*requires bytes 8\.\.20.*bufferViews\[0\]/);
  });

  it('requires buffer-view and accessor offsets to be independently aligned', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 20 }],
      bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 16 }],
      accessors: [{
        bufferView: 0,
        byteOffset: 2,
        componentType: 5126,
        count: 1,
        type: 'VEC3',
      }],
    }, new Uint8Array(20)));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(/\$\.bufferViews\[0\]\.byteOffset.*aligned.*4-byte/);
  });

  it('requires vertex byteStride to be a multiple of four bytes', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12, byteStride: 6 }],
      accessors: [{
        bufferView: 0,
        componentType: 5121,
        normalized: true,
        count: 2,
        type: 'VEC2',
      }],
    }, new Uint8Array(12)));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'TEXCOORD_0'))
      .toThrow(/\$\.bufferViews\[0\]\.byteStride.*multiple of 4/);
  });

  it('requires each vertex accessor start and tight stride to be four-byte aligned', () => {
    const misalignedStart = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 8 }],
      bufferViews: [{ buffer: 0, byteOffset: 2, byteLength: 4 }],
      accessors: [{
        bufferView: 0,
        componentType: 5121,
        normalized: true,
        count: 2,
        type: 'VEC2',
      }],
    }, new Uint8Array(8)));
    expect(() => decodeGLTFAccessor(
      misalignedStart.json,
      misalignedStart.binaryChunk,
      0,
      'TEXCOORD_0',
    )).toThrow(/\$\.accessors\[0\].*vertex start.*4-byte aligned/);

    const tightThreeBytes = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 8 }],
      bufferViews: [{ buffer: 0, byteLength: 6 }],
      accessors: [{
        bufferView: 0,
        componentType: 5120,
        normalized: true,
        count: 2,
        type: 'VEC3',
      }],
    }, new Uint8Array(8)));
    expect(() => decodeGLTFAccessor(
      tightThreeBytes.json,
      tightThreeBytes.binaryChunk,
      0,
      'NORMAL',
    )).toThrow(/\$\.accessors\[0\].*effective stride 3.*4-byte aligned/);
  });

  it('permits disjoint tight accessor ranges to share one bufferView', () => {
    const binary = concatBytes(
      float32Bytes([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      float32Bytes([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    );
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 72 }],
      bufferViews: [{ buffer: 0, byteLength: 72 }],
      accessors: [
        { bufferView: 0, byteOffset: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 0, byteOffset: 36, componentType: 5126, count: 3, type: 'VEC3' },
      ],
    }, binary));

    expect(Array.from(decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      0,
      'POSITION',
    ))).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(Array.from(decodeGLTFAccessor(
      glb.json,
      glb.binaryChunk,
      1,
      'NORMAL',
    ))).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it('rejects zero accessor counts and nonzero BIN padding', () => {
    const zero = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 0, type: 'VEC3' }],
    }, new Uint8Array(12)));
    expect(() => decodeGLTFAccessor(zero.json, zero.binaryChunk, 0, 'POSITION'))
      .toThrow(/\$\.accessors\[0\]\.count.*positive/);

    const paddedBytes = new Uint8Array(14);
    paddedBytes[13] = 0xff;
    const padded = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 13 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    }, paddedBytes));
    expect(() => decodeGLTFAccessor(
      padded.json,
      padded.binaryChunk,
      0,
      'POSITION',
    )).toThrow(/GLB BIN chunk padding byte 13.*zero/);
  });

  it('rejects checked accessor arithmetic overflow before allocation', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [{
        bufferView: 0,
        componentType: 5126,
        count: Number.MAX_SAFE_INTEGER,
        type: 'VEC3',
      }],
    }, new Uint8Array(12)));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(/\$\.accessors\[0\].*overflows safe integer arithmetic/);
  });

  it('rejects non-finite decoded float data with accessor context', () => {
    const glb = readGLB(makeGLB({
      asset: { version: '2.0' },
      buffers: [{ byteLength: 12 }],
      bufferViews: [{ buffer: 0, byteLength: 12 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 1, type: 'VEC3' }],
    }, float32Bytes([0, Number.NaN, 1])));
    expect(() => decodeGLTFAccessor(glb.json, glb.binaryChunk, 0, 'POSITION'))
      .toThrow(/\$\.accessors\[0\].*component 1.*finite/);
  });
});
