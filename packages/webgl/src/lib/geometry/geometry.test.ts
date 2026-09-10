import { describe, expect, test } from 'vitest';
import { createWebGLGeometry } from '@crc/webgl';
import { getWebGLGeometryData } from './geometry.js';

describe('createWebGLGeometry', () => {
  test('copies indexed triangle data into a frozen opaque descriptor', () => {
    const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0];
    const indices = [0, 1, 2];

    const geometry = createWebGLGeometry({ positions, indices });
    positions[0] = 99;
    indices[0] = 2;

    expect(geometry.vertexCount).toBe(3);
    expect(geometry.triangleCount).toBe(1);
    expect(Object.isFrozen(geometry)).toBe(true);
    expect('positions' in geometry).toBe(false);
    expect('indices' in geometry).toBe(false);
    expect(getWebGLGeometryData(geometry)).toEqual({
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint32Array([0, 1, 2]),
    });
  });

  test('accepts non-indexed triangles and derives their counts', () => {
    const geometry = createWebGLGeometry({
      positions: new Float64Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
        1, 0, 1,
        0, 1, 1,
      ]),
    });

    expect(geometry.vertexCount).toBe(6);
    expect(geometry.triangleCount).toBe(2);
    expect(getWebGLGeometryData(geometry).indices).toBeUndefined();
  });

  test.each([
    [{ positions: [] }, /createWebGLGeometry positions must be nonempty/],
    [{ positions: [0, 0] }, /createWebGLGeometry positions length must be divisible by 3/],
    [{ positions: [0, 0, Number.NaN] }, /createWebGLGeometry positions\[2\] must be finite/],
    [
      { positions: [Number.MAX_VALUE, 0, 0], indices: [0, 0, 0] },
      /createWebGLGeometry positions\[0\] must be representable as a finite Float32/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0] },
      /createWebGLGeometry non-indexed vertex count must be divisible by 3/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1] },
      /createWebGLGeometry indices length must be divisible by 3/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1.5, 2] },
      /createWebGLGeometry indices\[1\] must be a nonnegative integer/,
    ],
    [
      { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 3] },
      /createWebGLGeometry indices\[2\] must be less than vertexCount 3/,
    ],
  ])('rejects malformed triangle input %#', (input, message) => {
    expect(() => createWebGLGeometry(input)).toThrow(message);
  });
});
