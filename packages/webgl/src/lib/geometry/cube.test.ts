import { describe, expect, test } from 'vitest';
import { getWebGLGeometryData } from './geometry.js';
import { getCubeGeometry } from './cube.js';

describe('getCubeGeometry', () => {
  test('returns deterministic indexed unit-cube triangles centered at the origin', () => {
    const geometry = getCubeGeometry();
    const { positions, normals, indices } = getWebGLGeometryData(geometry);

    expect(geometry.vertexCount).toBe(24);
    expect(geometry.triangleCount).toBe(12);
    expect(Array.from(positions)).toEqual([
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      -0.5, 0.5, -0.5,
      -0.5, -0.5, 0.5,
      0.5, -0.5, 0.5,
      0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, -0.5, -0.5,
      -0.5, -0.5, 0.5,
      -0.5, 0.5, 0.5,
      -0.5, 0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, 0.5, -0.5,
      0.5, 0.5, 0.5,
      0.5, -0.5, 0.5,
      -0.5, 0.5, -0.5,
      -0.5, 0.5, 0.5,
      0.5, 0.5, 0.5,
      0.5, 0.5, -0.5,
      -0.5, -0.5, -0.5,
      0.5, -0.5, -0.5,
      0.5, -0.5, 0.5,
      -0.5, -0.5, 0.5,
    ]);
    expect(Array.from(normals ?? [])).toEqual([
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]);
    expect(Array.from(indices ?? [])).toEqual([
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23,
    ]);

    for (let axis = 0; axis < 3; axis += 1) {
      const values = Array.from(positions).filter((_, index) => index % 3 === axis);
      expect(Math.min(...values)).toBe(-0.5);
      expect(Math.max(...values)).toBe(0.5);
    }
  });

  test('reuses the immutable built-in descriptor', () => {
    expect(getCubeGeometry()).toBe(getCubeGeometry());
    expect(Object.isFrozen(getCubeGeometry())).toBe(true);
  });
});
