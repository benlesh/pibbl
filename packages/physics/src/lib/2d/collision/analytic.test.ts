import { describe, expect, it } from 'vitest';
import {
  distanceCircleToCircle2D,
  distancePointToCapsule2D,
  distancePointToCircle2D,
  distancePointToSegment2D,
} from './analytic.js';

describe('analytic 2D collision distances', () => {
  it('returns exact circle-circle witnesses and a second-to-first normal', () => {
    expect(distanceCircleToCircle2D(0, 0, 2, 7, 0, 3)).toEqual({
      separation: 2,
      firstX: 2,
      firstY: 0,
      secondX: 4,
      secondY: 0,
      normalX: -1,
      normalY: 0,
    });
  });

  it('includes the point-circle boundary and reports penetration inside it', () => {
    expect(distancePointToCircle2D(3, 0, 0, 0, 3)).toEqual({
      separation: 0,
      firstX: 3,
      firstY: 0,
      secondX: 3,
      secondY: 0,
      normalX: 1,
      normalY: 0,
    });
    expect(distancePointToCircle2D(1, 0, 0, 0, 3).separation).toBe(-2);
  });

  it('uses the closest capsule spine point for point distance', () => {
    expect(distancePointToCapsule2D(2, 3, 0, 0, 4, 0, 1)).toEqual({
      separation: 2,
      firstX: 2,
      firstY: 3,
      secondX: 2,
      secondY: 1,
      normalX: 0,
      normalY: 1,
    });
  });

  it('clamps segment-point witnesses to the finite segment', () => {
    expect(distancePointToSegment2D(5, 2, 0, 0, 3, 0)).toEqual({
      separation: Math.sqrt(8),
      firstX: 5,
      firstY: 2,
      secondX: 3,
      secondY: 0,
      normalX: 1 / Math.sqrt(2),
      normalY: 1 / Math.sqrt(2),
    });
  });
});
