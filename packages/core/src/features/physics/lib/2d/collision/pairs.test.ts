import { describe, expect, it } from 'vitest';
import {
  arcShape2D,
  boxShape2D,
  capsuleShape2D,
  chainShape2D,
  circleShape2D,
  contactBetweenShapes2D,
  containsPoint2D,
  distanceBetweenShapes2D,
  ellipseShape2D,
  overlapShapes2D,
  polygonShape2D,
  roundedBoxShape2D,
  segmentShape2D,
  wedgeShape2D,
  type PibblPhysicsDistance2D,
  type PibblPhysicsPose2D,
  type PibblPhysicsShape2D,
} from '../../../2d-geometry.js';
import { requireShapeRecord2D } from '../shape-records.js';
import { manifoldBetweenShapeRecords2D } from './pairs.js';

const identity = { position: [0, 0], rotationDegrees: 0 } as const;

describe('standalone 2D collision pairs', () => {
  it('reports exact separated, touching, and penetrating circles', () => {
    const first = circleShape2D({ radius: 2 });
    const second = circleShape2D({ radius: 3 });
    expect(
      distanceBetweenShapes2D(first, identity, second, {
        position: [7, 0],
        rotationDegrees: 0,
      }),
    ).toEqual({
      separation: 2,
      pointOnFirst: [2, 0],
      pointOnSecond: [4, 0],
      normal: [-1, 0],
    });
    expect(
      distanceBetweenShapes2D(first, identity, second, {
        position: [5, 0],
        rotationDegrees: 0,
      }).separation,
    ).toBe(0);
    expect(
      distanceBetweenShapes2D(first, identity, second, {
        position: [4, 0],
        rotationDegrees: 0,
      }).separation,
    ).toBe(-1);
  });

  it('preserves signed-distance symmetry for every Task 4 shape family', () => {
    const shapes: readonly PibblPhysicsShape2D[] = [
      circleShape2D({ radius: 1 }),
      ellipseShape2D({ radiusX: 1.5, radiusY: 0.75, rotationDegrees: 12 }),
      boxShape2D({ width: 2, height: 1 }),
      roundedBoxShape2D({ width: 2, height: 1.5, radius: 0.2 }),
      capsuleShape2D({ start: [-1, 0], end: [1, 0], radius: 0.4 }),
      arcShape2D({
        radius: 1,
        startAngleRadians: 0,
        endAngleRadians: Math.PI / 2,
        thickness: 0.2,
      }),
      wedgeShape2D({
        radius: 1,
        startAngleRadians: 0,
        endAngleRadians: Math.PI / 2,
      }),
      segmentShape2D({ start: [-1, 0], end: [1, 0] }),
      chainShape2D({
        points: [
          [-1, 0],
          [0, 1],
          [1, 0],
        ],
        radius: 0.1,
      }),
      polygonShape2D({
        points: [
          [-1, -1],
          [1, -1],
          [0, 1],
        ],
      }),
    ];
    const probe = circleShape2D({ radius: 0.35 });
    const probePose = { position: [3.25, 0.4], rotationDegrees: -17 } as const;
    for (const [index, shape] of shapes.entries()) {
      const forward = distanceBetweenShapes2D(shape, identity, probe, probePose);
      const reverse = distanceBetweenShapes2D(probe, probePose, shape, identity);
      expectSymmetric(forward, reverse, `family=${String(index)}`);
    }
  });

  it('preserves symmetry across every family pairing in penetrating and near-contact poses', () => {
    const seed = 0x5eed_2d;
    const shapes: readonly PibblPhysicsShape2D[] = [
      circleShape2D({ radius: 1 }),
      ellipseShape2D({ radiusX: 1.2, radiusY: 0.8, rotationDegrees: 7 }),
      boxShape2D({ width: 2, height: 1.5 }),
      roundedBoxShape2D({
        width: 2,
        height: 1.5,
        radius: [0.1, 0.2, 0.3, 0.15],
      }),
      capsuleShape2D({ start: [-0.8, 0], end: [0.8, 0], radius: 0.35 }),
      arcShape2D({
        radius: 1,
        startAngleRadians: 0,
        endAngleRadians: Math.PI,
        thickness: 0.3,
      }),
      wedgeShape2D({
        radius: 1.2,
        startAngleRadians: 0,
        endAngleRadians: (3 * Math.PI) / 4,
      }),
      segmentShape2D({ start: [-1, 0], end: [1, 0] }),
      chainShape2D({
        points: [
          [-1, 0],
          [0, 0.8],
          [1, 0],
        ],
        radius: 0.15,
      }),
      polygonShape2D({
        points: [
          [-1, -0.8],
          [1, -0.8],
          [0.7, 0.7],
          [-0.6, 1],
        ],
      }),
    ];
    const firstPose = { position: [0, 0], rotationDegrees: 13 } as const;
    const secondPose = {
      position: [0.35, -0.2],
      rotationDegrees: -19,
    } as const;
    for (let firstIndex = 0; firstIndex < shapes.length; firstIndex += 1) {
      for (let secondIndex = 0; secondIndex < shapes.length; secondIndex += 1) {
        const message = `seed=${String(seed)} pair=${String(firstIndex)},${String(secondIndex)}`;
        let forward: PibblPhysicsDistance2D;
        let reverse: PibblPhysicsDistance2D;
        try {
          forward = distanceBetweenShapes2D(shapes[firstIndex]!, firstPose, shapes[secondIndex]!, secondPose);
          reverse = distanceBetweenShapes2D(shapes[secondIndex]!, secondPose, shapes[firstIndex]!, firstPose);
        } catch (error) {
          throw new Error(message, { cause: error });
        }
        expectSymmetric(forward, reverse, message);
      }
    }
  });

  it('chooses opposite deterministic normals for swapped coincident centers', () => {
    const first = circleShape2D({ radius: 2 });
    const second = circleShape2D({ radius: 1 });
    const forward = distanceBetweenShapes2D(first, identity, second, identity);
    const reverse = distanceBetweenShapes2D(second, identity, first, identity);
    expect(forward.separation).toBe(-3);
    expectSymmetric(forward, reverse, 'seed=coincident-circles');
  });

  it('handles shallow and deep convex penetration without fabricating separation', () => {
    const first = boxShape2D({ width: 4, height: 4 });
    const second = boxShape2D({ width: 4, height: 4 });
    expect(
      distanceBetweenShapes2D(first, identity, second, {
        position: [3.999, 0],
        rotationDegrees: 0,
      }).separation,
    ).toBeCloseTo(-0.001, 9);
    expect(
      distanceBetweenShapes2D(first, identity, second, {
        position: [0.25, 0.1],
        rotationDegrees: 31,
      }).separation,
    ).toBeLessThan(-2);
  });

  it('is invariant when both inputs are translated and rotated together', () => {
    const first = polygonShape2D({
      points: [
        [-1, -1],
        [2, -1],
        [0, 2],
      ],
    });
    const second = ellipseShape2D({ radiusX: 0.75, radiusY: 1.25 });
    const baseline = distanceBetweenShapes2D(first, { position: [0.2, -0.1], rotationDegrees: 11 }, second, {
      position: [4, 0.6],
      rotationDegrees: -21,
    });
    const rigid = { position: [8, -3], rotationDegrees: 73 } as const;
    const moved = distanceBetweenShapes2D(
      first,
      { position: rotateAndTranslate([0.2, -0.1], rigid), rotationDegrees: 84 },
      second,
      { position: rotateAndTranslate([4, 0.6], rigid), rotationDegrees: 52 },
    );
    expect(moved.separation).toBeCloseTo(baseline.separation, 8);
  });

  it('includes boundaries for solids, segments, chains, and compounds', () => {
    expect(containsPoint2D(circleShape2D({ radius: 1 }), identity, [1, 0])).toBe(true);
    expect(containsPoint2D(ellipseShape2D({ radiusX: 2, radiusY: 1 }), identity, [2, 0])).toBe(true);
    expect(containsPoint2D(boxShape2D({ width: 2, height: 2 }), identity, [1, 1])).toBe(true);
    expect(containsPoint2D(roundedBoxShape2D({ width: 2, height: 2, radius: 0.5 }), identity, [1, 0])).toBe(true);
    expect(containsPoint2D(capsuleShape2D({ start: [-1, 0], end: [1, 0], radius: 0.5 }), identity, [0, 0.5])).toBe(
      true,
    );
    expect(containsPoint2D(segmentShape2D({ start: [-1, 0], end: [1, 0] }), identity, [0, 0])).toBe(true);
    expect(
      containsPoint2D(
        chainShape2D({
          points: [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        }),
        identity,
        [1, 0.5],
      ),
    ).toBe(true);
    expect(
      containsPoint2D(
        wedgeShape2D({
          radius: 2,
          startAngleRadians: 0,
          endAngleRadians: Math.PI / 2,
        }),
        identity,
        [0.25, 0.25],
      ),
    ).toBe(true);
  });

  it('uses stable compound leaf order and returns a real leaf witness', () => {
    const chain = chainShape2D({
      points: [
        [-4, 0],
        [-2, 0],
        [2, 0],
        [4, 0],
      ],
      radius: 0.25,
    });
    const circle = circleShape2D({ radius: 0.5 });
    const result = distanceBetweenShapes2D(chain, identity, circle, {
      position: [2, 2],
      rotationDegrees: 0,
    });
    expect(result.separation).toBeCloseTo(1.25, 9);
    expect(result.pointOnFirst[0]).toBeCloseTo(2, 9);
    expect(result.pointOnSecond[0]).toBeCloseTo(2, 9);
  });

  it('returns null contacts only for separation and treats touching as overlap', () => {
    const first = boxShape2D({ width: 2, height: 2 });
    const second = boxShape2D({ width: 2, height: 2 });
    expect(
      overlapShapes2D(first, identity, second, {
        position: [2, 0],
        rotationDegrees: 0,
      }),
    ).toBe(true);
    expect(
      contactBetweenShapes2D(first, identity, second, {
        position: [2, 0],
        rotationDegrees: 0,
      }),
    ).not.toBeNull();
    expect(
      contactBetweenShapes2D(first, identity, second, {
        position: [3, 0],
        rotationDegrees: 0,
      }),
    ).toBeNull();
  });

  it('does not promote a positive sub-epsilon analytic gap to overlap', () => {
    const first = circleShape2D({ radius: 1 });
    const second = circleShape2D({ radius: 1 });
    const secondPose = {
      position: [2 + 5e-10, 0],
      rotationDegrees: 0,
    } as const;
    expect(distanceBetweenShapes2D(first, identity, second, secondPose).separation).toBeGreaterThan(0);
    expect(overlapShapes2D(first, identity, second, secondPose)).toBe(false);
    expect(contactBetweenShapes2D(first, identity, second, secondPose)).toBeNull();
  });

  it('validates nominal shapes and finite poses before collision work', () => {
    const circle = circleShape2D({ radius: 1 });
    const malformed = {} as PibblPhysicsShape2D;
    const nonfinite = {
      position: [Number.NaN, 0],
      rotationDegrees: 0,
    } as PibblPhysicsPose2D;
    expect(() => containsPoint2D(malformed, identity, [0, 0])).toThrow('shape must be a Pibbl physics 2D shape');
    expect(() => containsPoint2D(circle, identity, [Number.POSITIVE_INFINITY, 0])).toThrow();
    expect(() => distanceBetweenShapes2D(circle, nonfinite, circle, identity)).toThrow();
    expect(() => overlapShapes2D(circle, identity, malformed, identity)).toThrow(
      'shape must be a Pibbl physics 2D shape',
    );
  });

  it('returns deeply frozen copied semantic records', () => {
    const result = distanceBetweenShapes2D(circleShape2D({ radius: 1 }), identity, circleShape2D({ radius: 1 }), {
      position: [3, 0],
      rotationDegrees: 0,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pointOnFirst)).toBe(true);
    expect(Object.isFrozen(result.pointOnSecond)).toBe(true);
    expect(Object.isFrozen(result.normal)).toBe(true);
  });

  it('provides the real private manifold to the world cache without public projection', () => {
    const manifold = manifoldBetweenShapeRecords2D(
      requireShapeRecord2D(boxShape2D({ width: 2, height: 2 })),
      { x: 0, y: 0, rotationRadians: 0 },
      0,
      requireShapeRecord2D(boxShape2D({ width: 2, height: 2 })),
      { x: 1.5, y: 0, rotationRadians: 0 },
      1,
    );

    expect(manifold).not.toBeNull();
    expect(manifold).toMatchObject({
      normalX: -1,
      normalY: 0,
      firstLeaf: 0,
      secondLeaf: 0,
    });
    expect(manifold?.points).toHaveLength(2);
    expect(manifold?.points[0]).toHaveProperty('firstFeature');
    expect(manifold?.points[0]).not.toHaveProperty('pointOnFirst');
    expect(
      manifoldBetweenShapeRecords2D(
        requireShapeRecord2D(circleShape2D({ radius: 1 })),
        { x: 0, y: 0, rotationRadians: 0 },
        0,
        requireShapeRecord2D(circleShape2D({ radius: 1 })),
        { x: 3, y: 0, rotationRadians: 0 },
        1,
      ),
    ).toBeNull();
  });
});

function expectSymmetric(first: PibblPhysicsDistance2D, second: PibblPhysicsDistance2D, seed: string): void {
  expect(second.separation, seed).toBeCloseTo(first.separation, 8);
  expect(second.pointOnFirst[0], seed).toBeCloseTo(first.pointOnSecond[0], 8);
  expect(second.pointOnFirst[1], seed).toBeCloseTo(first.pointOnSecond[1], 8);
  expect(second.pointOnSecond[0], seed).toBeCloseTo(first.pointOnFirst[0], 8);
  expect(second.pointOnSecond[1], seed).toBeCloseTo(first.pointOnFirst[1], 8);
  expect(second.normal[0], seed).toBeCloseTo(-first.normal[0], 8);
  expect(second.normal[1], seed).toBeCloseTo(-first.normal[1], 8);
}

function rotateAndTranslate(point: readonly [number, number], pose: PibblPhysicsPose2D): readonly [number, number] {
  const angle = (pose.rotationDegrees * Math.PI) / 180;
  return [
    pose.position[0] + Math.cos(angle) * point[0] - Math.sin(angle) * point[1],
    pose.position[1] + Math.sin(angle) * point[0] + Math.cos(angle) * point[1],
  ];
}
