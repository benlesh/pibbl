import { describe, expect, it } from 'vitest';
import {
  GLTFDecodeBudget,
  GLTF_DECODE_LIMITS,
  assertEncodedImageByteLength,
  assertGLBByteLength,
  assertImageDimensions,
} from './budget.js';

describe('static GLB decode budgets', () => {
  it('enforces the GLB and per-image encoded byte ceilings without allocating them', () => {
    expect(() => assertGLBByteLength(GLTF_DECODE_LIMITS.glbBytes + 1))
      .toThrow(/GLB byteLength 268435457.*limit 268435456/);
    expect(() => assertEncodedImageByteLength(
      GLTF_DECODE_LIMITS.encodedImageBytes + 1,
      '$.images[2]',
    )).toThrow(/\$\.images\[2\].*encoded byteLength 67108865.*limit 67108864/);
  });

  it('uses checked cumulative numeric, instance, vertex, and pixel accounting', () => {
    const budget = new GLTFDecodeBudget();
    budget.reserveNumericAttributeBytes(
      GLTF_DECODE_LIMITS.numericAttributeBytes,
      '$.accessors[0]',
    );
    expect(() => budget.reserveNumericAttributeBytes(1, '$.accessors[1]'))
      .toThrow(/\$\.accessors\[1\].*numeric attribute bytes.*536870912/);

    budget.reserveSelectedPrimitiveInstances(
      GLTF_DECODE_LIMITS.selectedPrimitiveInstances,
      '$.scenes[0]',
    );
    expect(() => budget.reserveSelectedPrimitiveInstances(1, '$.nodes[9]'))
      .toThrow(/\$\.nodes\[9\].*primitive instances.*100000/);

    budget.reserveUniqueDecodedVertices(
      GLTF_DECODE_LIMITS.uniqueDecodedVertices,
      '$.meshes[0].primitives[0]',
    );
    expect(() => budget.reserveUniqueDecodedVertices(
      1,
      '$.meshes[1].primitives[0]',
    )).toThrow(/\$\.meshes\[1\].*unique decoded vertices.*20000000/);

    budget.reserveNormalValidationVertices(
      GLTF_DECODE_LIMITS.normalValidationVertices,
      '$.nodes[0] rendering $.meshes[0].primitives[0]',
    );
    expect(() => budget.reserveNormalValidationVertices(
      1,
      '$.nodes[1] rendering $.meshes[0].primitives[0]',
    )).toThrow(/\$\.nodes\[1\].*normal validation vertices.*50000000/);

    budget.reserveDecodedImagePixels(8192, 8192, '$.images[0]');
    expect(() => budget.reserveDecodedImagePixels(1, 1, '$.images[1]'))
      .toThrow(/\$\.images\[1\].*decoded image pixels.*67108864/);
  });

  it('enforces positive bounded image dimensions', () => {
    expect(() => assertImageDimensions(0, 1, '$.images[0]', 'encoded'))
      .toThrow(/\$\.images\[0\].*encoded width.*positive/);
    expect(() => assertImageDimensions(16385, 1, '$.images[0]', 'encoded'))
      .toThrow(/\$\.images\[0\].*encoded width 16385.*limit 16384/);
    expect(() => assertImageDimensions(1, 16385, '$.images[0]', 'decoded'))
      .toThrow(/\$\.images\[0\].*decoded height 16385.*limit 16384/);
  });
});
