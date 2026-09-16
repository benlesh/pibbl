import { describe, expect, test } from 'vitest';
import { composeModelMatrix4 } from '../math/matrix4.js';
import {
  createSettledNormalMatrix,
  validateSettledNormalPair,
} from './normals.js';

const model = (scaleX: number, scaleY: number, scaleZ: number) => {
  const matrix = new Float32Array(16);
  composeModelMatrix4(matrix, { scaleX, scaleY, scaleZ });
  return matrix;
};

describe('settled WebGL normal transforms', () => {
  test('extracts a scale-normalized identity inverse transpose', () => {
    expect(Array.from(createSettledNormalMatrix(model(1, 1, 1)))).toEqual([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  });

  test('removes uniform scale magnitude before Float32 conversion', () => {
    expect(Array.from(createSettledNormalMatrix(model(4, 4, 4)))).toEqual([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  });

  test('preserves nonuniform inverse-transpose ratios', () => {
    expect(Array.from(createSettledNormalMatrix(model(2, 1, 4)))).toEqual([
      0.5, 0, 0,
      0, 1, 0,
      0, 0, 0.25,
    ]);
  });

  test('preserves negative-scale normal orientation', () => {
    expect(Array.from(createSettledNormalMatrix(model(-2, 1, 4)))).toEqual([
      -0.5, 0, 0,
      0, 1, 0,
      0, 0, 0.25,
    ]);
  });

  test('rejects singular and non-finite linear transforms', () => {
    const singular = model(1, 1, 1);
    singular[0] = 0;
    const nonFinite = model(1, 1, 1);
    nonFinite[5] = Number.POSITIVE_INFINITY;

    expect(() => createSettledNormalMatrix(singular)).toThrow(
      'lit normal matrix must be invertible',
    );
    expect(() => createSettledNormalMatrix(nonFinite)).toThrow(
      'lit normal matrix must be finite',
    );
  });

  test('rejects a pair whose required direction underflows after Float32 conversion', () => {
    const extreme = model(
      Math.fround(3e38),
      Math.fround(1e-45),
      1,
    );
    const normalMatrix = createSettledNormalMatrix(extreme);

    expect(normalMatrix[0]).toBe(0);
    expect(() => validateSettledNormalPair(
      new Float32Array([1, 0, 0]),
      normalMatrix,
    )).toThrow('lit normal matrix must transform every geometry normal');
  });

  test('uses shader-ordered Float32 products and additions during pair validation', () => {
    const cancellationMatrix = new Float32Array([
      1, 0, 0,
      1e-8, 0, 0,
      -1, 0, 0,
    ]);

    expect(() => validateSettledNormalPair(
      new Float32Array([1, 1, 1]),
      cancellationMatrix,
    )).toThrow('lit normal matrix must transform every geometry normal');
  });
});
