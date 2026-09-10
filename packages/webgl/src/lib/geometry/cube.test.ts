import { describe, expect, test } from 'vitest';
import { getWebGLGeometryData } from './geometry.js';
import { getCubeGeometry } from './cube.js';

describe('getCubeGeometry', () => {
  test('returns deterministic indexed unit-cube triangles centered at the origin', () => {
    const geometry = getCubeGeometry();
    const { positions, indices } = getWebGLGeometryData(geometry);

    expect(geometry.vertexCount).toBe(8);
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
    ]);
    expect(Array.from(indices ?? [])).toEqual([
      0, 2, 1, 0, 3, 2,
      4, 5, 6, 4, 6, 7,
      0, 4, 7, 0, 7, 3,
      1, 2, 6, 1, 6, 5,
      3, 7, 6, 3, 6, 2,
      0, 1, 5, 0, 5, 4,
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
