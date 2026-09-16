import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  raycastShape3D,
  shapeCastAgainstShape3D,
  sphereShape3D,
  type CRCPhysicsPose3D,
} from "../../../3d-geometry.js";

const identity = { position: [0, 0, 0], orientation: [0, 0, 0, 1] } as const;

describe("standalone 3D rays and translational casts", () => {
  it("normalizes ray direction and reports physical distance and normalized time", () => {
    expect(raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([5, 0, 0]),
      { origin: [0, 0, 0], direction: [10, 0, 0], maxDistance: 10 },
    )).toEqual({
      point: [4, 0, 0],
      normal: [-1, 0, 0],
      distance: 4,
      timeOfImpact: 0.4,
    });
  });

  it("raycasts a sphere with finite values near 1e200", () => {
    const hit = raycastShape3D(
      sphereShape3D({ radius: 1e200 }),
      pose([5e200, 0, 0]),
      { origin: [0, 0, 0], direction: [3e200, 0, 0], maxDistance: 1e201 },
    );

    expect(hit).not.toBeNull();
    expect(hit!.point[0] / 1e200).toBeCloseTo(4, 12);
    expect(hit!.point.slice(1)).toEqual([0, 0]);
    expect(hit!.normal).toEqual([-1, 0, 0]);
    expect(hit!.distance / 1e200).toBeCloseTo(4, 12);
    expect(hit!.timeOfImpact).toBeCloseTo(0.4, 12);
    expect(Object.values(hit ?? {}).flat().every(Number.isFinite)).toBe(true);
  });

  it("does not let an enormous ray limit underflow ordinary sphere geometry", () => {
    const hit = raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([5, 0, 0]),
      { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 1e300 },
    );

    expect(hit?.point).toEqual([4, 0, 0]);
    expect(hit?.distance).toBe(4);
  });

  it("counts tangent sphere rays and raycasts rotated boxes", () => {
    const tangent = raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([5, 1, 0]),
      { origin: [0, 0, 0], direction: [2, 0, 0], maxDistance: 10 },
    );
    expect(tangent?.point).toEqual([5, 0, 0]);
    expect(tangent?.normal).toEqual([0, -1, 0]);
    expect(tangent?.distance).toBeCloseTo(5, 9);

    const boxHit = raycastShape3D(
      boxShape3D({ width: 2, height: 4, depth: 2 }),
      pose([5, 0, 0], [0, 0, Math.SQRT1_2, Math.SQRT1_2]),
      { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 10 },
    );
    expect(boxHit?.point[0]).toBeCloseTo(3, 9);
    expect(boxHit?.normal[0]).toBeCloseTo(-1, 12);
    expect(boxHit?.normal[1]).toBe(0);
    expect(boxHit?.normal[2]).toBe(0);
  });

  it("includes or skips initial ray overlap explicitly", () => {
    const sphere = sphereShape3D({ radius: 2 });
    const ray = { origin: [0, 0, 0], direction: [3, 0, 0], maxDistance: 8 } as const;
    expect(raycastShape3D(sphere, identity, ray)).toBeNull();
    expect(raycastShape3D(sphere, identity, ray, { includeInitialOverlap: true })).toEqual({
      point: [0, 0, 0],
      normal: [-1, 0, 0],
      distance: 0,
      timeOfImpact: 0,
    });
  });

  it("returns the earliest analytic sphere-sphere cast hit", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      identity,
      [10, 0, 0],
      sphereShape3D({ radius: 2 }),
      pose([7, 0, 0]),
    );
    expect(hit).toEqual({
      point: [5, 0, 0],
      normal: [-1, 0, 0],
      distance: 4,
      timeOfImpact: 0.4,
    });
  });

  it("casts spheres with finite values near 1e200", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1e200 }),
      identity,
      [1e201, 0, 0],
      sphereShape3D({ radius: 2e200 }),
      pose([7e200, 0, 0]),
    );

    expect(hit).not.toBeNull();
    expect(hit!.point[0] / 1e200).toBeCloseTo(5, 12);
    expect(hit!.point.slice(1)).toEqual([0, 0]);
    expect(hit!.normal).toEqual([-1, 0, 0]);
    expect(hit!.distance / 1e200).toBeCloseTo(4, 12);
    expect(hit!.timeOfImpact).toBeCloseTo(0.4, 12);
    expect(Object.values(hit ?? {}).flat().every(Number.isFinite)).toBe(true);
  });

  it("casts fixed-orientation boxes and spheres with conservative advancement", () => {
    const hit = shapeCastAgainstShape3D(
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([0, 0, 0], [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)]),
      [10, 0, 0],
      sphereShape3D({ radius: 1 }),
      pose([6, 0, 0]),
    );
    expect(hit).not.toBeNull();
    expect(hit!.timeOfImpact).toBeGreaterThan(0);
    expect(hit!.timeOfImpact).toBeLessThan(1);
    expect(hit!.normal[0]).toBeCloseTo(-1, 6);
  });

  it("casts sphere-box and box-box pairs to their earliest touching time", () => {
    const sphereBox = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      identity,
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    );
    expect(sphereBox?.distance).toBeCloseTo(3, 7);
    expect(sphereBox?.timeOfImpact).toBeCloseTo(0.3, 7);
    expect(sphereBox?.point).toEqual([4, 0, 0]);
    expect(sphereBox?.normal).toEqual([-1, 0, 0]);

    const boxBox = shapeCastAgainstShape3D(
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      identity,
      [10, 0, 0],
      boxShape3D({ width: 2, height: 4, depth: 2 }),
      pose([5, 0, 0]),
    );
    expect(boxBox?.distance).toBeCloseTo(3, 7);
    expect(boxBox?.timeOfImpact).toBeCloseTo(0.3, 7);
    expect(boxBox?.point[0]).toBeCloseTo(4, 7);
    expect(boxBox?.normal).toEqual([-1, 0, 0]);
  });

  it("rejects a positive near-tangent gap below the cast convergence tolerance", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 2.00000005, 0]),
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    );

    expect(hit).toBeNull();
  });

  it("returns the true earliest time for an exact sphere-box tangent", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 2, 0]),
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    );

    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeCloseTo(4, 9);
    expect(hit!.timeOfImpact).toBeCloseTo(0.4, 10);
    expect(hit!.point).toEqual([4, 1, 0]);
  });

  it("handles zero translation and initial overlap deterministically", () => {
    const sphere = sphereShape3D({ radius: 1 });
    const box = boxShape3D({ width: 4, height: 4, depth: 4 });
    expect(shapeCastAgainstShape3D(sphere, identity, [0, 0, 0], box, identity)).toBeNull();
    const included = shapeCastAgainstShape3D(
      sphere,
      identity,
      [0, 0, 0],
      box,
      identity,
      { includeInitialOverlap: true },
    );
    expect(included?.distance).toBe(0);
    expect(included?.timeOfImpact).toBe(0);
    expect(included?.normal.every(Number.isFinite)).toBe(true);
  });

  it("validates finite inputs and returns deeply frozen copied hits", () => {
    const sphere = sphereShape3D({ radius: 1 });
    expect(() => raycastShape3D(
      sphere,
      identity,
      { origin: [0, 0, 0], direction: [0, 0, 0], maxDistance: 1 },
    )).toThrow("ray.direction must be non-zero");
    expect(() => shapeCastAgainstShape3D(
      sphere,
      identity,
      [Number.NaN, 0, 0],
      sphere,
      identity,
    )).toThrow();

    const hit = raycastShape3D(
      sphere,
      pose([5, 0, 0]),
      { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 10 },
    )!;
    expect(Object.isFrozen(hit)).toBe(true);
    expect(Object.isFrozen(hit.point)).toBe(true);
    expect(Object.isFrozen(hit.normal)).toBe(true);
  });

  it("fails closed when a finite translation has an unrepresentable magnitude", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      identity,
      [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
      sphereShape3D({ radius: 1 }),
      pose([10, 0, 0]),
    )).toBeNull();
  });
});

function pose(
  position: readonly [number, number, number],
  orientation: readonly [number, number, number, number] = [0, 0, 0, 1],
): CRCPhysicsPose3D {
  return { position, orientation };
}
