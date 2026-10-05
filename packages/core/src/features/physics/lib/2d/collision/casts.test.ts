import { describe, expect, it } from 'vitest';
import {
  boxShape2D,
  chainShape2D,
  circleShape2D,
  ellipseShape2D,
  raycastShape2D,
  segmentShape2D,
  shapeCastAgainstShape2D,
  type PibblPhysicsPose2D,
  type PibblPhysicsShape2D,
} from '../../../2d-geometry.js';

const identity = { position: [0, 0], rotationDegrees: 0 } as const;

describe('standalone 2D casts', () => {
  it('normalizes ray directions while reporting logical distance and normalized time', () => {
    const hit = raycastShape2D(
      circleShape2D({ radius: 1 }),
      { position: [5, 0], rotationDegrees: 0 },
      { origin: [0, 0], direction: [10, 0], maxDistance: 10 },
    );

    expect(hit).toEqual({
      point: [4, 0],
      normal: [-1, 0],
      distance: 4,
      timeOfImpact: 0.4,
    });
  });

  it('returns null for ray misses and impacts beyond the finite maximum distance', () => {
    const circle = circleShape2D({ radius: 1 });
    expect(raycastShape2D(
      circle,
      { position: [5, 3], rotationDegrees: 0 },
      { origin: [0, 0], direction: [1, 0], maxDistance: 10 },
    )).toBeNull();
    expect(raycastShape2D(
      circle,
      { position: [5, 0], rotationDegrees: 0 },
      { origin: [0, 0], direction: [1, 0], maxDistance: 3.999 },
    )).toBeNull();
  });

  it('counts tangent rays as hits', () => {
    const hit = raycastShape2D(
      circleShape2D({ radius: 1 }),
      { position: [5, 1], rotationDegrees: 0 },
      { origin: [0, 0], direction: [2, 0], maxDistance: 10 },
    );

    expect(hit?.distance).toBeCloseTo(5, 9);
    expect(hit?.timeOfImpact).toBeCloseTo(0.5, 9);
    expect(hit?.point).toEqual([5, 0]);
    expect(hit?.normal).toEqual([0, -1]);

    const supportMappedTangent = raycastShape2D(
      ellipseShape2D({ radiusX: 2, radiusY: 1 }),
      identity,
      { origin: [-5, 1], direction: [1, 0], maxDistance: 10 },
    );
    expect(supportMappedTangent?.distance).toBeCloseTo(5, 4);
    expect(supportMappedTangent?.timeOfImpact).toBeCloseTo(0.5, 4);
    expect(supportMappedTangent?.normal[0]).toBeCloseTo(0, 4);
    expect(supportMappedTangent?.normal[1]).toBeCloseTo(1, 4);
  });

  it('includes or skips initial ray overlap explicitly', () => {
    const circle = circleShape2D({ radius: 2 });
    const ray = { origin: [0, 0], direction: [3, 0], maxDistance: 8 } as const;

    expect(raycastShape2D(circle, identity, ray)).toBeNull();
    expect(raycastShape2D(circle, identity, ray, { includeInitialOverlap: true })).toEqual({
      point: [0, 0],
      normal: [-1, 0],
      distance: 0,
      timeOfImpact: 0,
    });
  });

  it('hits segments and chooses the earliest chain leaf', () => {
    const segmentHit = raycastShape2D(
      segmentShape2D({ start: [4, -2], end: [4, 2] }),
      identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: 10 },
    );
    expect(segmentHit).toEqual({
      point: [4, 0],
      normal: [-1, 0],
      distance: 4,
      timeOfImpact: 0.4,
    });

    const chainHit = raycastShape2D(
      chainShape2D({ points: [[7, -2], [7, 2], [9, 2], [9, -2]] }),
      identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: 10 },
    );
    expect(chainHit?.point).toEqual([7, 0]);
    expect(chainHit?.distance).toBe(7);
  });

  it('raycasts support-mapped boxes and analytic capsules', () => {
    const boxHit = raycastShape2D(
      boxShape2D({ width: 2, height: 2 }),
      { position: [5, 0], rotationDegrees: 0 },
      { origin: [0, 0], direction: [1, 0], maxDistance: 10 },
    );
    expect(boxHit?.point).toEqual([4, 0]);
    expect(boxHit?.normal).toEqual([-1, 0]);
    expect(boxHit?.timeOfImpact).toBeCloseTo(0.4, 9);

    const capsuleHit = raycastShape2D(
      chainShape2D({ points: [[5, -1], [5, 1]], radius: 1 }),
      identity,
      { origin: [0, 2], direction: [1, 0], maxDistance: 10 },
    );
    expect(capsuleHit?.point[0]).toBeCloseTo(5, 9);
    expect(capsuleHit?.point[1]).toBeCloseTo(2, 9);
    expect(capsuleHit?.normal[0]).toBeCloseTo(0, 9);
    expect(capsuleHit?.normal[1]).toBeCloseTo(1, 9);
  });

  it('breaks equal-time compound leaf ties by canonical leaf identity', () => {
    const hit = raycastShape2D(
      chainShape2D({ points: [[6, 1], [5, 0], [6, -1]] }),
      identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: 10 },
    );

    expect(hit?.point).toEqual([5, 0]);
    expect(hit?.normal[0]).toBeCloseTo(-Math.SQRT1_2, 9);
    expect(hit?.normal[1]).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('casts translating shapes without rotating them', () => {
    const hit = shapeCastAgainstShape2D(
      boxShape2D({ width: 2, height: 2 }),
      { position: [0, 0], rotationDegrees: 45 },
      [10, 0],
      circleShape2D({ radius: 1 }),
      { position: [6, 0], rotationDegrees: 0 },
    );

    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(6 - 1 - Math.SQRT2, 6);
    expect(hit!.timeOfImpact).toBeCloseTo((6 - 1 - Math.SQRT2) / 10, 6);
    expect(hit!.normal[0]).toBeCloseTo(-1, 6);
    expect(hit!.normal[1]).toBeCloseTo(0, 6);
  });

  it('reports tangent translational casts and target-surface witnesses', () => {
    const hit = shapeCastAgainstShape2D(
      circleShape2D({ radius: 1 }),
      { position: [0, 2], rotationDegrees: 0 },
      [10, 0],
      circleShape2D({ radius: 1 }),
      { position: [5, 0], rotationDegrees: 0 },
    );

    expect(hit?.distance).toBeCloseTo(5, 7);
    expect(hit?.timeOfImpact).toBeCloseTo(0.5, 7);
    expect(hit?.point[0]).toBeCloseTo(5, 7);
    expect(hit?.point[1]).toBeCloseTo(1, 7);
    expect(hit?.normal[0]).toBeCloseTo(0, 7);
    expect(hit?.normal[1]).toBeCloseTo(1, 7);
  });

  it('handles zero translation and initial shape overlap explicitly', () => {
    const moving = circleShape2D({ radius: 1 });
    const target = boxShape2D({ width: 4, height: 4 });

    expect(shapeCastAgainstShape2D(
      moving, identity, [0, 0], target, identity,
    )).toBeNull();
    const included = shapeCastAgainstShape2D(
      moving, identity, [0, 0], target, identity,
      { includeInitialOverlap: true },
    );
    expect(included?.distance).toBe(0);
    expect(included?.timeOfImpact).toBe(0);
  });

  it('orients initial-overlap normals against incoming translation', () => {
    const hit = shapeCastAgainstShape2D(
      circleShape2D({ radius: 1 }),
      { position: [0.5, 0], rotationDegrees: 0 },
      [2, 0],
      circleShape2D({ radius: 1 }),
      identity,
      { includeInitialOverlap: true },
    );

    expect(hit?.distance).toBe(0);
    expect(hit?.timeOfImpact).toBe(0);
    expect(hit!.normal[0] * 2).toBeLessThanOrEqual(0);
  });

  it('chooses the earliest target leaf for shape casts against chains', () => {
    const hit = shapeCastAgainstShape2D(
      circleShape2D({ radius: 0.5 }),
      identity,
      [10, 0],
      chainShape2D({ points: [[4, -2], [4, 2], [7, 2], [7, -2]] }),
      identity,
    );

    expect(hit?.distance).toBeCloseTo(3.5, 7);
    expect(hit?.timeOfImpact).toBeCloseTo(0.35, 7);
    expect(hit?.point).toEqual([4, 0]);
    expect(hit?.normal).toEqual([-1, 0]);
  });

  it('returns null when a finite translation cannot reach the target', () => {
    expect(shapeCastAgainstShape2D(
      circleShape2D({ radius: 1 }),
      identity,
      [2, 0],
      segmentShape2D({ start: [5, -1], end: [5, 1] }),
      identity,
    )).toBeNull();
  });

  it('returns deeply frozen hit records independent of mutable inputs', () => {
    const origin: [number, number] = [0, 0];
    const direction: [number, number] = [1, 0];
    const hit = raycastShape2D(
      circleShape2D({ radius: 1 }),
      { position: [5, 0], rotationDegrees: 0 },
      { origin, direction, maxDistance: 10 },
    )!;
    origin[0] = 100;
    direction[0] = -1;

    expect(hit.point).toEqual([4, 0]);
    expect(Object.isFrozen(hit)).toBe(true);
    expect(Object.isFrozen(hit.point)).toBe(true);
    expect(Object.isFrozen(hit.normal)).toBe(true);
  });

  it('validates shapes and finite cast inputs before bounded iteration', () => {
    const circle = circleShape2D({ radius: 1 });
    const malformed = {} as PibblPhysicsShape2D;
    const invalidPose = { position: [0, 0], rotationDegrees: Number.NaN } as PibblPhysicsPose2D;

    expect(() => raycastShape2D(
      malformed, identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: 1 },
    )).toThrow('shape must be a Pibbl physics 2D shape');
    expect(() => raycastShape2D(
      circle, identity,
      { origin: [0, 0], direction: [0, 0], maxDistance: 1 },
    )).toThrow('ray.direction must be non-zero');
    expect(() => raycastShape2D(
      circle, identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: Number.POSITIVE_INFINITY },
    )).toThrow();
    expect(() => raycastShape2D(
      circle, identity,
      { origin: [0, 0], direction: [1, 0], maxDistance: -1 },
    )).toThrow();
    expect(() => shapeCastAgainstShape2D(
      circle, invalidPose, [1, 0], circle, identity,
    )).toThrow();
    expect(() => shapeCastAgainstShape2D(
      circle, identity, [Number.NaN, 0], circle, identity,
    )).toThrow();
  });

  it('terminates difficult no-progress casts without fabricating a hit', () => {
    const result = shapeCastAgainstShape2D(
      ellipseShape2D({ radiusX: 5, radiusY: 0.01, rotationDegrees: 0.001 }),
      identity,
      [1_000_000, 0],
      ellipseShape2D({ radiusX: 5, radiusY: 0.01, rotationDegrees: -0.001 }),
      { position: [0, 100], rotationDegrees: 0 },
    );

    expect(result).toBeNull();
  });
});
