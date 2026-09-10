import { describe, expect, test } from 'vitest';
import { resolveCamera } from './camera.js';
import { createRayFromNDC, intersectRayTriangle, unprojectPoint } from './ray.js';

const expectVectorClose = (actual: ArrayLike<number>, expected: readonly number[]) => {
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 5));
};

describe('CPU ray math', () => {
  test('creates a center-screen ray toward negative Z', () => {
    const camera = resolveCamera(undefined, 800, 400);
    const origin = new Float32Array(3);
    const direction = new Float32Array(3);

    createRayFromNDC(origin, direction, camera.inverseProjectionViewMatrix, 0, 0);

    expectVectorClose(origin, [0, 0, 4.9]);
    expectVectorClose(direction, [0, 0, -1]);
  });

  test('unprojects a corner of the default camera near plane', () => {
    const camera = resolveCamera(undefined, 800, 400);
    const point = new Float32Array(3);

    unprojectPoint(point, camera.inverseProjectionViewMatrix, -1, 1, -1);

    expectVectorClose(point, [-0.09326153, 0.04663077, 4.9]);
  });

  test('returns Möller–Trumbore triangle distances and misses', () => {
    const distance = intersectRayTriangle(
      [0, 0, 5],
      [0, 0, -1],
      [-1, -1, 0],
      [1, -1, 0],
      [0, 1, 0],
    );
    const behind = intersectRayTriangle(
      [0, 0, -1],
      [0, 0, -1],
      [-1, -1, 0],
      [1, -1, 0],
      [0, 1, 0],
    );
    const outside = intersectRayTriangle(
      [2, 2, 5],
      [0, 0, -1],
      [-1, -1, 0],
      [1, -1, 0],
      [0, 1, 0],
    );

    expect(distance).toBeCloseTo(5, 6);
    expect(behind).toBeUndefined();
    expect(outside).toBeUndefined();
  });
});
