import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  contactBetweenShapes3D,
  containsPoint3D,
  distanceBetweenShapes3D,
  ellipsoidShape3D,
  overlapShapes3D,
  sphereShape3D,
  type CRCPhysicsDistance3D,
  type CRCPhysicsPose3D,
  type CRCPhysicsShape3D,
} from "../../../3d-geometry.js";

const identity = { position: [0, 0, 0], orientation: [0, 0, 0, 1] } as const;

describe("standalone 3D sphere and box pairs", () => {
  it("reports exact separated, touching, penetrating, and coincident spheres", () => {
    const first = sphereShape3D({ radius: 2 });
    const second = sphereShape3D({ radius: 3 });
    expect(
      distanceBetweenShapes3D(first, identity, second, pose([7, 0, 0])),
    ).toEqual({
      separation: 2,
      pointOnFirst: [2, 0, 0],
      pointOnSecond: [4, 0, 0],
      normal: [-1, 0, 0],
    });
    expect(
      distanceBetweenShapes3D(first, identity, second, pose([5, 0, 0]))
        .separation,
    ).toBe(0);
    expect(
      distanceBetweenShapes3D(first, identity, second, pose([4, 0, 0]))
        .separation,
    ).toBe(-1);
    expectSymmetric(
      distanceBetweenShapes3D(first, identity, second, identity),
      distanceBetweenShapes3D(second, identity, first, identity),
      "coincident-spheres",
    );
  });

  it("preserves witness and normal symmetry for all Task 3 shape pairs", () => {
    const seed = 0x5eed_3d;
    const sphere = sphereShape3D({ radius: 1.1, center: [0.1, -0.2, 0.3] });
    const box = boxShape3D({
      width: 2.5,
      height: 1.5,
      depth: 2,
      orientation: [0, Math.sin(Math.PI / 18), 0, Math.cos(Math.PI / 18)],
    });
    const shapes: readonly CRCPhysicsShape3D[] = [sphere, box];
    const firstPose = pose(
      [0.2, -0.1, 0.3],
      [Math.sin(Math.PI / 24), 0, 0, Math.cos(Math.PI / 24)],
    );
    const secondPose = pose(
      [1.35, 0.25, -0.15],
      [0, 0, Math.sin(-Math.PI / 20), Math.cos(Math.PI / 20)],
    );

    for (let firstIndex = 0; firstIndex < shapes.length; firstIndex += 1) {
      for (let secondIndex = 0; secondIndex < shapes.length; secondIndex += 1) {
        const message = `seed=${String(seed)} pair=${String(firstIndex)},${String(secondIndex)}`;
        expectSymmetric(
          distanceBetweenShapes3D(
            shapes[firstIndex]!,
            firstPose,
            shapes[secondIndex]!,
            secondPose,
          ),
          distanceBetweenShapes3D(
            shapes[secondIndex]!,
            secondPose,
            shapes[firstIndex]!,
            firstPose,
          ),
          message,
        );
      }
    }
  });

  it("swaps witnesses and normals for one box descriptor at one center with different orientations", () => {
    const box = boxShape3D({ width: 4, height: 2, depth: 1 });
    const firstPose = pose(
      [0, 0, 0],
      [0, 0, Math.sin(Math.PI / 12), Math.cos(Math.PI / 12)],
    );
    const secondPose = pose(
      [0, 0, 0],
      [Math.sin(Math.PI / 10), 0, 0, Math.cos(Math.PI / 10)],
    );

    const forward = distanceBetweenShapes3D(box, firstPose, box, secondPose);
    const reverse = distanceBetweenShapes3D(box, secondPose, box, firstPose);

    expectSymmetricExact(forward, reverse);
  });

  it("does not let earlier collision queries change coincident tie results", () => {
    const untouchedFirst = sphereShape3D({ radius: 1 });
    const untouchedSecond = sphereShape3D({ radius: 1 });
    const historyFirst = sphereShape3D({ radius: 1 });
    const historySecond = sphereShape3D({ radius: 1 });
    const unrelated = sphereShape3D({ radius: 0.5 });
    const baseline = distanceBetweenShapes3D(
      untouchedFirst,
      identity,
      untouchedSecond,
      identity,
    );

    distanceBetweenShapes3D(
      historySecond,
      pose([10, 0, 0]),
      unrelated,
      identity,
    );
    const afterHistory = distanceBetweenShapes3D(
      historyFirst,
      identity,
      historySecond,
      identity,
    );

    expect(afterHistory).toEqual(baseline);
  });

  it("keeps seeded rotated sphere/box distances finite and swap-symmetric", () => {
    const seed = 0x3d_c011;
    let state = seed;
    const random = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
    for (let caseIndex = 0; caseIndex < 64; caseIndex += 1) {
      const first =
        caseIndex % 2 === 0
          ? sphereShape3D({ radius: 0.25 + random() * 1.5 })
          : boxShape3D({
              width: 0.5 + random() * 2,
              height: 0.5 + random() * 2,
              depth: 0.5 + random() * 2,
            });
      const second =
        caseIndex % 3 === 0
          ? sphereShape3D({ radius: 0.25 + random() * 1.5 })
          : boxShape3D({
              width: 0.5 + random() * 2,
              height: 0.5 + random() * 2,
              depth: 0.5 + random() * 2,
            });
      const firstAngle = (random() - 0.5) * Math.PI;
      const secondAngle = (random() - 0.5) * Math.PI;
      const firstPose = pose(
        [(random() - 0.5) * 5, (random() - 0.5) * 5, (random() - 0.5) * 5],
        [0, Math.sin(firstAngle / 2), 0, Math.cos(firstAngle / 2)],
      );
      const secondPose = pose(
        [(random() - 0.5) * 5, (random() - 0.5) * 5, (random() - 0.5) * 5],
        [Math.sin(secondAngle / 2), 0, 0, Math.cos(secondAngle / 2)],
      );
      const message = `seed=${String(seed)} case=${String(caseIndex)}`;
      const forward = distanceBetweenShapes3D(
        first,
        firstPose,
        second,
        secondPose,
      );
      const reverse = distanceBetweenShapes3D(
        second,
        secondPose,
        first,
        firstPose,
      );
      expect(Number.isFinite(forward.separation), message).toBe(true);
      expectSymmetric(forward, reverse, message);
    }
  });

  it("handles aligned and rotated box separation and penetration", () => {
    const box = boxShape3D({ width: 2, height: 2, depth: 2 });
    expect(
      distanceBetweenShapes3D(box, identity, box, pose([5, 0, 0])),
    ).toMatchObject({
      separation: 3,
      pointOnFirst: [1, -1, -1],
      pointOnSecond: [4, -1, -1],
      normal: [-1, 0, 0],
    });
    const rotated = distanceBetweenShapes3D(
      box,
      identity,
      box,
      pose([1.25, 0, 0], [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)]),
    );
    expect(rotated.separation).toBeLessThan(0);
    expect(rotated.normal.every(Number.isFinite)).toBe(true);
  });

  it("keeps large finite separated boxes finite", () => {
    const box = boxShape3D({ width: 2e200, height: 2e200, depth: 2e200 });
    const distance = distanceBetweenShapes3D(
      box,
      identity,
      box,
      pose([5e200, 0, 0]),
    );

    expect(distance.separation / 1e200).toBeCloseTo(3, 12);
    expectLargeVector(distance.pointOnFirst, [1, -1, -1]);
    expectLargeVector(distance.pointOnSecond, [4, -1, -1]);
    expect(distance.normal).toEqual([-1, 0, 0]);
    expect(
      [
        distance.separation,
        ...distance.pointOnFirst,
        ...distance.pointOnSecond,
        ...distance.normal,
      ].every(Number.isFinite),
    ).toBe(true);
  });

  it("is invariant under a common rigid transform", () => {
    const first = boxShape3D({ width: 2, height: 1, depth: 3 });
    const second = sphereShape3D({ radius: 0.75 });
    const baseline = distanceBetweenShapes3D(
      first,
      pose([0.2, -0.1, 0.4]),
      second,
      pose([4, 0.6, -0.2]),
    );
    const rotation = [
      0,
      0,
      Math.sin(Math.PI / 5),
      Math.cos(Math.PI / 5),
    ] as const;
    const moved = distanceBetweenShapes3D(
      first,
      pose(
        rotateAndTranslate([0.2, -0.1, 0.4], [8, -3, 2], rotation),
        rotation,
      ),
      second,
      pose(rotateAndTranslate([4, 0.6, -0.2], [8, -3, 2], rotation), rotation),
    );
    expect(moved.separation).toBeCloseTo(baseline.separation, 8);
  });

  it("includes sphere and rotated-box boundaries in point containment", () => {
    expect(
      containsPoint3D(sphereShape3D({ radius: 1 }), identity, [1, 0, 0]),
    ).toBe(true);
    const box = boxShape3D({ width: 2, height: 4, depth: 2 });
    const quarterTurn = pose([0, 0, 0], [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
    expect(containsPoint3D(box, quarterTurn, [2, 0, 0])).toBe(true);
    expect(containsPoint3D(box, quarterTurn, [2.01, 0, 0])).toBe(false);
  });

  it("does not accept points that only lie inside a smooth shape's AABB", () => {
    const ellipsoid = ellipsoidShape3D({ radii: [2, 1, 1] });
    expect(containsPoint3D(ellipsoid, identity, [1.5, 0.75, 0])).toBe(false);
    expect(containsPoint3D(ellipsoid, identity, [1.5, 0.5, 0])).toBe(true);
  });

  it("treats touching as overlap but preserves a positive sub-epsilon gap", () => {
    const first = sphereShape3D({ radius: 1 });
    const second = sphereShape3D({ radius: 1 });
    expect(overlapShapes3D(first, identity, second, pose([2, 0, 0]))).toBe(
      true,
    );
    expect(
      contactBetweenShapes3D(first, identity, second, pose([2, 0, 0])),
    ).not.toBeNull();
    const gap = pose([2 + 5e-10, 0, 0]);
    expect(
      distanceBetweenShapes3D(first, identity, second, gap).separation,
    ).toBeGreaterThan(0);
    expect(overlapShapes3D(first, identity, second, gap)).toBe(false);
    expect(contactBetweenShapes3D(first, identity, second, gap)).toBeNull();
  });

  it("returns deeply frozen records and validates nominal finite inputs", () => {
    const sphere = sphereShape3D({ radius: 1 });
    const result = distanceBetweenShapes3D(
      sphere,
      identity,
      sphereShape3D({ radius: 1 }),
      pose([3, 0, 0]),
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.pointOnFirst)).toBe(true);
    expect(Object.isFrozen(result.pointOnSecond)).toBe(true);
    expect(Object.isFrozen(result.normal)).toBe(true);
    expect(() => containsPoint3D({} as never, identity, [0, 0, 0])).toThrow(
      "shape must be a CRC physics 3D shape",
    );
    expect(() =>
      distanceBetweenShapes3D(
        sphere,
        pose([Number.NaN, 0, 0]),
        sphere,
        identity,
      ),
    ).toThrow();
  });
});

function pose(
  position: readonly [number, number, number],
  orientation: readonly [number, number, number, number] = [0, 0, 0, 1],
): CRCPhysicsPose3D {
  return { position, orientation };
}

function expectSymmetric(
  first: CRCPhysicsDistance3D,
  second: CRCPhysicsDistance3D,
  seed: string,
): void {
  expect(second.separation, seed).toBeCloseTo(first.separation, 8);
  for (let axis = 0; axis < 3; axis += 1) {
    expect(second.pointOnFirst[axis], seed).toBeCloseTo(
      first.pointOnSecond[axis]!,
      8,
    );
    expect(second.pointOnSecond[axis], seed).toBeCloseTo(
      first.pointOnFirst[axis]!,
      8,
    );
    expect(second.normal[axis], seed).toBeCloseTo(-first.normal[axis]!, 8);
  }
}

function expectSymmetricExact(
  first: CRCPhysicsDistance3D,
  second: CRCPhysicsDistance3D,
): void {
  expect(second.separation).toBe(first.separation);
  expect(second.pointOnFirst).toEqual(first.pointOnSecond);
  expect(second.pointOnSecond).toEqual(first.pointOnFirst);
  expect(second.normal).toEqual(
    first.normal.map((value) => (value === 0 ? 0 : -value)),
  );
}

function expectLargeVector(
  actual: readonly number[],
  expectedUnits: readonly number[],
): void {
  expectedUnits.forEach((value, axis) => {
    expect(actual[axis]! / 1e200).toBeCloseTo(value, 12);
  });
}

function rotateAndTranslate(
  point: readonly [number, number, number],
  translation: readonly [number, number, number],
  quaternion: readonly [number, number, number, number],
): readonly [number, number, number] {
  const [x, y, z] = point;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    translation[0] + x + qw * tx + qy * tz - qz * ty,
    translation[1] + y + qw * ty + qz * tx - qx * tz,
    translation[2] + z + qw * tz + qx * ty - qy * tx,
  ];
}
