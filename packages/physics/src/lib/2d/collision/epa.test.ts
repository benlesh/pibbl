import { describe, expect, it } from 'vitest';
import { boxShape2D, ellipseShape2D, roundedBoxShape2D } from '../../../2d-geometry.js';
import { IDENTITY_POSE_2D, copyPose2D } from '../math.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { epaConvexLeaves2D } from './epa.js';
import { gjkConvexLeaves2D } from './gjk.js';

describe('bounded 2D EPA', () => {
  it('returns signed penetration and witnesses for overlapping boxes', () => {
    const first = requireShapeRecord2D(boxShape2D({ width: 4, height: 4 })).leaves[0]!;
    const second = requireShapeRecord2D(boxShape2D({ width: 4, height: 4 })).leaves[0]!;
    const secondPose = copyPose2D({ position: [3, 0], rotationDegrees: 0 }, 'pose');
    const gjk = gjkConvexLeaves2D(first, IDENTITY_POSE_2D, second, secondPose, -1, 0);
    expect(gjk.status).toBe('penetrating');
    if (gjk.status !== 'penetrating') return;

    const result = epaConvexLeaves2D(first, IDENTITY_POSE_2D, second, secondPose, gjk.simplex);
    expect(result.status).toBe('penetrating');
    if (result.status === 'penetrating') {
      expect(result.separation).toBeCloseTo(-1, 9);
      expect(result.normalX).toBe(-1);
      expect(result.normalY).toBe(0);
      expect(result.firstX).toBeCloseTo(2, 9);
      expect(result.secondX).toBeCloseTo(1, 9);
    }
  });

  it('converges for smooth asymmetric support maps within the fixed bound', () => {
    const first = requireShapeRecord2D(ellipseShape2D({
      radiusX: 1.2,
      radiusY: 0.8,
      rotationDegrees: 7,
    })).leaves[0]!;
    const second = requireShapeRecord2D(roundedBoxShape2D({
      width: 2,
      height: 1.5,
      radius: [0.1, 0.2, 0.3, 0.15],
    })).leaves[0]!;
    const firstPose = copyPose2D({ position: [0, 0], rotationDegrees: 13 }, 'firstPose');
    const secondPose = copyPose2D({ position: [0.35, -0.2], rotationDegrees: -19 }, 'secondPose');
    const gjk = gjkConvexLeaves2D(first, firstPose, second, secondPose, -0.35, 0.2);
    expect(gjk.status).toBe('penetrating');
    if (gjk.status !== 'penetrating') return;

    expect(epaConvexLeaves2D(first, firstPose, second, secondPose, gjk.simplex)).toMatchObject({
      status: 'penetrating',
    });
  });
});
