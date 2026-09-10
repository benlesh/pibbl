import { describe, expect, test } from 'vitest';
import { getWebGLGeometryData } from './geometry.js';
import { getSphereGeometry } from './sphere.js';

describe('getSphereGeometry', () => {
  test('returns a deterministic indexed radius-0.5 UV sphere', () => {
    const geometry = getSphereGeometry();
    const { positions, indices } = getWebGLGeometryData(geometry);

    expect(geometry.vertexCount).toBe(561);
    expect(geometry.triangleCount).toBe(1024);
    expect(indices?.length).toBe(3072);
    expect(Array.from(indices?.slice(0, 12) ?? [])).toEqual([
      0, 33, 1, 33, 34, 1,
      1, 34, 2, 34, 35, 2,
    ]);
    expect(Array.from(indices?.slice(-12) ?? [])).toEqual([
      525, 558, 526, 558, 559, 526,
      526, 559, 527, 559, 560, 527,
    ]);

    for (let index = 0; index < positions.length; index += 3) {
      const radius = Math.hypot(
        positions[index]!,
        positions[index + 1]!,
        positions[index + 2]!,
      );
      expect(radius).toBeCloseTo(0.5, 6);
    }
  });

  test('reuses the immutable built-in descriptor', () => {
    expect(getSphereGeometry()).toBe(getSphereGeometry());
    expect(Object.isFrozen(getSphereGeometry())).toBe(true);
  });
});
