import { describe, expect, test } from 'vitest';
import {
  composeModelMatrix4,
  invertMatrix4,
  multiplyMatrix4,
  setIdentityMatrix4,
  transformDirectionMatrix4,
  transformOriginMatrix4,
  transformPointMatrix4,
} from './matrix4.js';

const expectMatrixClose = (actual: ArrayLike<number>, expected: readonly number[]) => {
  expect(Array.from(actual)).toHaveLength(expected.length);
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 5));
};

describe('column-major matrix math', () => {
  test('identity and multiplication write into caller-owned destinations', () => {
    const identity = new Float32Array(16);
    const transform = new Float32Array(16);
    const product = new Float32Array(16);
    setIdentityMatrix4(identity);
    composeModelMatrix4(transform, { translateX: 4, scaleY: 2 });

    expect(multiplyMatrix4(product, identity, transform)).toBe(product);
    expectMatrixClose(product, Array.from(transform));
  });

  test('composes T * Rz * Ry * Rx * S and supports negative scale', () => {
    const matrix = new Float32Array(16);
    const transformed = new Float32Array(3);

    composeModelMatrix4(matrix, {
      translateX: 10,
      translateY: 20,
      translateZ: 30,
      rotationXDegrees: 90,
      rotationYDegrees: 90,
      rotationZDegrees: 90,
      scaleX: -2,
      scaleY: 3,
      scaleZ: 4,
    });
    transformPointMatrix4(transformed, matrix, [1, 2, 3]);

    expectMatrixClose(transformed, [22, 26, 32]);
  });

  test.each([
    [{ translateX: Number.NaN }, /translateX must be finite/],
    [{ rotationYDegrees: Number.POSITIVE_INFINITY }, /rotationYDegrees must be finite/],
    [{ scaleZ: 0 }, /scaleZ must be nonzero/],
  ])('rejects invalid transform values %#', (style, message) => {
    expect(() => composeModelMatrix4(new Float32Array(16), style)).toThrow(message);
  });

  test('inverts an affine matrix into a caller-owned destination', () => {
    const matrix = new Float32Array(16);
    const inverse = new Float32Array(16);
    const product = new Float32Array(16);
    composeModelMatrix4(matrix, {
      translateX: 2,
      translateY: -3,
      translateZ: 4,
      rotationXDegrees: 15,
      rotationYDegrees: -25,
      rotationZDegrees: 35,
      scaleX: -2,
      scaleY: 3,
      scaleZ: 0.5,
    });

    expect(invertMatrix4(inverse, matrix)).toBe(inverse);
    multiplyMatrix4(product, matrix, inverse);
    expectMatrixClose(product, [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  });

  test('reports a singular matrix without changing the destination', () => {
    const destination = new Float32Array(16).fill(7);
    const singular = new Float32Array(16);

    expect(invertMatrix4(destination, singular)).toBeUndefined();
    expect(Array.from(destination)).toEqual(new Array<number>(16).fill(7));
  });

  test('transforms affine origins with w = 1 and directions with w = 0', () => {
    const matrix = new Float32Array(16);
    const origin = new Float32Array(3);
    const direction = new Float32Array(3);
    composeModelMatrix4(matrix, {
      translateX: 5,
      translateY: 6,
      translateZ: 7,
      scaleX: 2,
      scaleY: 3,
      scaleZ: 4,
    });

    expect(transformOriginMatrix4(origin, matrix)).toBe(origin);
    expect(transformDirectionMatrix4(direction, matrix, [0, 1, 0])).toBe(
      direction,
    );
    expect(Array.from(origin)).toEqual([5, 6, 7]);
    expect(Array.from(direction)).toEqual([0, 3, 0]);
  });
});
