import { describe, expect, it } from 'vitest';
import { boxShape2D, ellipseShape2D } from '../../../2d-geometry.js';
import { IDENTITY_POSE_2D, copyPose2D } from '../math.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { gjkConvexLeaves2D } from './gjk.js';

describe('bounded 2D GJK', () => {
  it('returns closest witnesses for separated support-mapped leaves', () => {
    const first = requireShapeRecord2D(boxShape2D({ width: 2, height: 2 })).leaves[0]!;
    const second = requireShapeRecord2D(ellipseShape2D({ radiusX: 1, radiusY: 2 })).leaves[0]!;
    const result = gjkConvexLeaves2D(
      first,
      IDENTITY_POSE_2D,
      second,
      copyPose2D({ position: [5, 0], rotationDegrees: 0 }, 'pose'),
      -1,
      0,
    );

    expect(result.status).toBe('separated');
    if (result.status === 'separated') {
      expect(result.separation).toBeCloseTo(3, 9);
      expect(result.firstX).toBeCloseTo(1, 9);
      expect(result.secondX).toBeCloseTo(4, 9);
    }
  });

  it('returns a bounded simplex for overlapping convex leaves', () => {
    const first = requireShapeRecord2D(boxShape2D({ width: 4, height: 4 })).leaves[0]!;
    const second = requireShapeRecord2D(boxShape2D({ width: 4, height: 4 })).leaves[0]!;
    const result = gjkConvexLeaves2D(
      first,
      IDENTITY_POSE_2D,
      second,
      copyPose2D({ position: [1, 0], rotationDegrees: 15 }, 'pose'),
      -1,
      0,
    );

    expect(result.status).toBe('penetrating');
    if (result.status === 'penetrating') {
      expect(result.simplex).toHaveLength(3);
    }
  });
});
