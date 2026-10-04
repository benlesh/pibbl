import { describe, expect, it } from 'vitest';
import {
  boxShape2D,
  ellipseShape2D,
  polygonShape2D,
  roundedBoxShape2D,
} from '../../../2d-geometry.js';
import { IDENTITY_POSE_2D } from '../math.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { supportLeaf2D } from './support.js';

describe('convex 2D support maps', () => {
  it('selects exact extrema for an axis-aligned box in eight directions', () => {
    const leaf = requireShapeRecord2D(boxShape2D({ width: 4, height: 2 })).leaves[0]!;
    const cases = [
      [[1, 0], [2, -1], 1], [[1, 1], [2, 1], 2], [[0, 1], [2, 1], 2],
      [[-1, 1], [-2, 1], 3], [[-1, 0], [-2, -1], 0], [[-1, -1], [-2, -1], 0],
      [[0, -1], [-2, -1], 0], [[1, -1], [2, -1], 1],
    ] as const;

    for (const [[dx, dy], expected, expectedFeature] of cases) {
      const output = new Float64Array(2);
      const feature = supportLeaf2D(output, 0, leaf, IDENTITY_POSE_2D, dx, dy);
      expect([...output]).toEqual(expected);
      expect(feature).toBe(expectedFeature);
    }
  });

  it('uses analytic ellipse extrema in eight directions', () => {
    const leaf = requireShapeRecord2D(ellipseShape2D({ radiusX: 3, radiusY: 2 })).leaves[0]!;
    for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const) {
      const output = new Float64Array(2);
      supportLeaf2D(output, 0, leaf, IDENTITY_POSE_2D, dx, dy);
      const denominator = Math.hypot(3 * dx, 2 * dy);
      expect(output[0]).toBeCloseTo(9 * dx / denominator, 14);
      expect(output[1]).toBeCloseTo(4 * dy / denominator, 14);
    }
  });

  it('selects rounded-box corner extrema in eight directions', () => {
    const leaf = requireShapeRecord2D(roundedBoxShape2D({ width: 6, height: 4, radius: 1 })).leaves[0]!;
    const expected = [[3, -1], [2 + Math.SQRT1_2, 1 + Math.SQRT1_2], [2, 2], [-2 - Math.SQRT1_2, 1 + Math.SQRT1_2], [-3, -1], [-2 - Math.SQRT1_2, -1 - Math.SQRT1_2], [-2, -2], [2 + Math.SQRT1_2, -1 - Math.SQRT1_2]];
    const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
    directions.forEach(([dx, dy], index) => {
      const output = new Float64Array(2);
      supportLeaf2D(output, 0, leaf, IDENTITY_POSE_2D, dx, dy);
      expect(output[0]).toBeCloseTo(expected[index]![0]!, 14);
      expect(output[1]).toBeCloseTo(expected[index]![1]!, 14);
    });
  });

  it('chooses the lower canonical polygon vertex on exact ties', () => {
    const leaf = requireShapeRecord2D(polygonShape2D({
      points: [[-2, -1], [2, -1], [2, 1], [-2, 1]],
    })).leaves[0]!;
    const output = new Float64Array(2);

    expect(supportLeaf2D(output, 0, leaf, IDENTITY_POSE_2D, 1, 0)).toBe(1);
    expect([...output]).toEqual([2, -1]);
    expect(supportLeaf2D(output, 0, leaf, IDENTITY_POSE_2D, 0, 1)).toBe(2);
    expect([...output]).toEqual([2, 1]);
  });
});
