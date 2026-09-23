import { describe, expect, it } from 'vitest';
import { readGLB } from './glb.js';
import {
  BIN_CHUNK_TYPE,
  JSON_CHUNK_TYPE,
  makeGLB,
  makeRawGLB,
} from './test-fixtures.js';

describe('GLB 2 container reader', () => {
  it('reads one bounded JSON chunk and one zero-padded BIN chunk', () => {
    const input = makeGLB(
      { asset: { version: '2.0' }, scene: 0 },
      new Uint8Array([1, 2, 3]),
    );
    const result = readGLB(input);

    expect(result.json).toEqual({ asset: { version: '2.0' }, scene: 0 });
    expect(Array.from(result.binaryChunk!)).toEqual([1, 2, 3, 0]);
    expect(result.binaryChunk!.buffer).toBe(input);
  });

  it('skips an aligned unknown chunk without treating it as JSON or BIN', () => {
    const json = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    const result = readGLB(makeRawGLB([
      { type: JSON_CHUNK_TYPE, bytes: json, paddingByte: 0x20 },
      { type: 0x12345678, bytes: new Uint8Array([5, 6, 7, 8]) },
      { type: BIN_CHUNK_TYPE, bytes: new Uint8Array([9, 10, 11, 12]) },
    ]));

    expect(Array.from(result.binaryChunk!)).toEqual([9, 10, 11, 12]);
  });

  it.each([
    ['magic', { magic: 0 }, /GLB header byte 0.*magic/],
    ['version', { version: 1 }, /GLB header version must be 2/],
    ['declared short length', { declaredLength: 12 }, /GLB header declared length 12.*actual/],
    ['declared long length', { declaredLength: 200 }, /GLB header declared length 200.*actual/],
  ])('rejects an invalid %s field', (_name, header, message) => {
    expect(() => readGLB(makeRawGLB([{
      type: JSON_CHUNK_TYPE,
      bytes: new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
      paddingByte: 0x20,
    }], header))).toThrow(message);
  });

  it('rejects a truncated header with byte context', () => {
    expect(() => readGLB(new Uint8Array(11).buffer)).toThrow(
      /GLB header requires 12 bytes.*received 11/,
    );
  });

  it('requires JSON to be first and exactly once, and BIN at most once', () => {
    const json = new TextEncoder().encode('{"asset":{"version":"2.0"}}');
    const bin = new Uint8Array([0, 0, 0, 0]);
    expect(() => readGLB(makeRawGLB([
      { type: BIN_CHUNK_TYPE, bytes: bin },
      { type: JSON_CHUNK_TYPE, bytes: json, paddingByte: 0x20 },
    ]))).toThrow(/GLB chunk 0.*JSON chunk must be first/);
    expect(() => readGLB(makeRawGLB([
      { type: JSON_CHUNK_TYPE, bytes: json, paddingByte: 0x20 },
      { type: JSON_CHUNK_TYPE, bytes: json, paddingByte: 0x20 },
    ]))).toThrow(/GLB chunk 1.*duplicate JSON/);
    expect(() => readGLB(makeRawGLB([
      { type: JSON_CHUNK_TYPE, bytes: json, paddingByte: 0x20 },
      { type: BIN_CHUNK_TYPE, bytes: bin },
      { type: BIN_CHUNK_TYPE, bytes: bin },
    ]))).toThrow(/GLB chunk 2.*duplicate BIN/);
  });

  it('rejects misaligned or out-of-bounds chunks before slicing', () => {
    const misaligned = makeGLB({ asset: { version: '2.0' } });
    new DataView(misaligned).setUint32(12, 3, true);
    expect(() => readGLB(misaligned)).toThrow(/GLB chunk 0 byte 12.*multiple of 4/);

    const tooLong = makeGLB({ asset: { version: '2.0' } });
    new DataView(tooLong).setUint32(12, 0xfffffffC, true);
    expect(() => readGLB(tooLong)).toThrow(/GLB chunk 0 byte 12.*exceeds declared length/);
  });

  it('decodes JSON as fatal UTF-8 and permits only JSON whitespace padding', () => {
    expect(() => readGLB(makeRawGLB([{
      type: JSON_CHUNK_TYPE,
      bytes: new Uint8Array([0xff, 0xff, 0xff, 0xff]),
    }]))).toThrow(/GLB JSON chunk.*UTF-8/);

    const jsonWithNul = new TextEncoder().encode('{"asset":{"version":"2.0"}}\0');
    expect(() => readGLB(makeRawGLB([{
      type: JSON_CHUNK_TYPE,
      bytes: jsonWithNul,
      paddingByte: 0,
    }]))).toThrow(/GLB JSON chunk.*padding.*space/);

    const jsonWithTabPadding = new TextEncoder().encode(
      '{"asset":{"version":"2.0"}}\t',
    );
    expect(() => readGLB(makeRawGLB([{
      type: JSON_CHUNK_TYPE,
      bytes: jsonWithTabPadding,
      paddingByte: 0x20,
    }]))).toThrow(/GLB JSON chunk.*padding.*space/);
  });

  it.each([
    ['invalid JSON', new TextEncoder().encode('{nope'), /GLB JSON chunk.*valid JSON/],
    ['non-object document', new TextEncoder().encode('[]'), /GLB JSON \$ must be an object/],
    [
      'wrong glTF asset version',
      new TextEncoder().encode('{"asset":{"version":"1.0"}}'),
      /GLB JSON \$\.asset\.version must be "2\.0"/,
    ],
  ])('rejects %s', (_name, bytes, message) => {
    expect(() => readGLB(makeRawGLB([{
      type: JSON_CHUNK_TYPE,
      bytes,
      paddingByte: 0x20,
    }]))).toThrow(message);
  });
});
