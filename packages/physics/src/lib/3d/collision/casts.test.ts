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

  it.each([1, 2 ** -1060, Number.MIN_VALUE])(
    "projects sphere-ray normalized time directly at scale %s",
    (scale) => {
      const hit = raycastShape3D(
        sphereShape3D({ radius: scale }),
        pose([scale, scale, 0]),
        {
          origin: [0, 0, 0],
          direction: [scale, scale, 0],
          maxDistance: scale,
        },
      );

      expect(hit).not.toBeNull();
      expect(hit!.timeOfImpact).toBe(0.41421356237309503);
    },
  );

  it("admits an exact sphere-ray distance limit and rejects one ULP below it", () => {
    const shape = sphereShape3D({ radius: 1 });
    const ray = {
      origin: [0, 0, 0],
      direction: [3, 0, 0],
      maxDistance: 1,
    } as const;

    expect(raycastShape3D(shape, pose([2, 0, 0]), ray)?.timeOfImpact).toBe(1);
    expect(raycastShape3D(shape, pose([2, 0, 0]), {
      ...ray,
      maxDistance: nextRepresentableDown(1),
    })).toBeNull();
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

  it("materializes a finite early sphere-ray hit with maximum-finite direction components", () => {
    const hit = raycastShape3D(
      sphereShape3D({ radius: 1e290 }),
      pose([1e300, 1e300, 0]),
      {
        origin: [0, 0, 0],
        direction: [Number.MAX_VALUE, Number.MAX_VALUE, 0],
        maxDistance: 2e300,
      },
    );

    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeGreaterThan(1e300);
    expect(hit!.distance).toBeLessThan(2e300);
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

  it("rejects a large-offset sphere ray with a representable radial miss", () => {
    expect(raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([1e20, 2, 0]),
      { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 2e20 },
    )).toBeNull();
  });

  it("rejects a sphere ray whose rounded hypot hides a positive squared gap", () => {
    expect(raycastShape3D(
      sphereShape3D({ radius: 1.625 }),
      pose([1e20, nextRepresentableUp(0.625), 1.5]),
      { origin: [0, 0, 0], direction: [1, 0, 0], maxDistance: 2e20 },
    )).toBeNull();
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

  it("does not fabricate initial sphere-ray overlap from a rounded hypot equality", () => {
    expect(raycastShape3D(
      sphereShape3D({ radius: 1.625 }),
      pose([nextRepresentableUp(0.625), 1.5, 0]),
      { origin: [0, 0, 0], direction: [-1, 0, 0], maxDistance: 10 },
      { includeInitialOverlap: true },
    )).toBeNull();
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

  it("materializes a finite early sphere sweep when the full translation length overflows", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1e290 }),
      identity,
      [Number.MAX_VALUE, Number.MAX_VALUE, 0],
      sphereShape3D({ radius: 1e290 }),
      pose([1e300, 1e300, 0]),
    );

    expect(hit).not.toBeNull();
    expect(hit!.distance).toBeGreaterThan(1e300);
    expect(hit!.distance).toBeLessThan(2e300);
    expect(Object.values(hit ?? {}).flat().every(Number.isFinite)).toBe(true);
  });

  it("rejects a large-offset sphere sweep with a representable radial miss", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      identity,
      [2e20, 0, 0],
      sphereShape3D({ radius: 1 }),
      pose([1e20, 3, 0]),
    )).toBeNull();
  });

  it("rejects a sphere sweep whose rounded hypot hides a positive squared gap", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 0.625 }),
      identity,
      [2e20, 0, 0],
      sphereShape3D({ radius: 1 }),
      pose([1e20, nextRepresentableUp(0.625), 1.5]),
    )).toBeNull();
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

  it("rejects a large-offset sphere-box sweep with a representable radial miss", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 3, 0]),
      [2e10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([1e10, 0, 0]),
    )).toBeNull();
  });

  it("rejects a representable 1e-12 positive sphere-box tangent gap", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 2 + 1e-12, 0]),
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    )).toBeNull();
  });

  it("rejects a box-vertex sweep whose rounded hypot hides a positive squared gap", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1.625 }),
      pose([0, nextRepresentableUp(1.625), 2.5]),
      [8, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([4, 0, 0]),
    )).toBeNull();
  });

  it("does not fabricate initial sphere-box overlap from a rounded hypot equality", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1.625 }),
      pose([3, nextRepresentableUp(1.625), 2.5]),
      [-8, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([4, 0, 0]),
      { includeInitialOverlap: true },
    )).toBeNull();
  });

  it("keeps the corrected first edge root instead of returning the far-side exit", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 1.5, 0]),
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    );

    expect(hit?.timeOfImpact).toBeCloseTo(0.3133974596215562, 15);
    expect(hit?.distance).toBeCloseTo(3.133974596215562, 14);
    expect(hit?.point).toEqual([4, 1, 0]);
  });

  it("preserves a proven first edge crossing at large translation scale", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 1.5, 0]),
      [2e10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([1e10, 0, 0]),
    );

    expect(hit?.timeOfImpact).toBeCloseTo(0.4999999999066987, 15);
    expect(hit?.distance).toBeCloseTo(9999999998.133974, 5);
    expect(hit?.point).toEqual([9999999999, 1, 0]);
    expect(Object.values(hit ?? {}).flat().every(Number.isFinite)).toBe(true);
  });

  it("preserves an exact box-vertex tangent", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1.625 }),
      pose([0, 1.625, 2.5]),
      [10, 0, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([5, 0, 0]),
    );

    expect(hit?.timeOfImpact).toBe(0.4);
    expect(hit?.distance).toBe(4);
    expect(hit?.point).toEqual([4, 1, 1]);
  });

  it("preserves downscaled exact vertex tangencies across axes and signs", () => {
    const scale = 2 ** -100;
    const cases = [
      {
        from: [0, 1.625 * scale, 2.5 * scale],
        translation: [10 * scale, 0, 0],
        target: [5 * scale, 0, 0],
        normal: [0, 5 / 13, 12 / 13],
      },
      {
        from: [1.625 * scale, -2.5 * scale, 0],
        translation: [0, 0, -10 * scale],
        target: [0, 0, -5 * scale],
        normal: [5 / 13, -12 / 13, 0],
      },
    ] as const;

    for (const fixture of cases) {
      const hit = shapeCastAgainstShape3D(
        sphereShape3D({ radius: 1.625 * scale }),
        pose(fixture.from),
        fixture.translation,
        boxShape3D({ width: 2 * scale, height: 2 * scale, depth: 2 * scale }),
        pose(fixture.target),
      );
      expect(hit?.timeOfImpact).toBe(0.4);
      expect(hit?.distance).toBe(4 * scale);
      expect(hit?.point.every(Number.isFinite)).toBe(true);
      hit?.normal.forEach((value, axis) => {
        expect(value).toBeCloseTo(fixture.normal[axis]!, 15);
      });
    }
  });

  it("preserves downscaled first edge entries across axes and signs", () => {
    const scale = 2 ** -100;
    const cases = [
      {
        from: [0, 1.5 * scale, 0],
        translation: [10 * scale, 0, 0],
        target: [5 * scale, 0, 0],
        normal: [-Math.sqrt(3) / 2, 0.5, 0],
      },
      {
        from: [0, 0, -1.5 * scale],
        translation: [0, -10 * scale, 0],
        target: [0, -5 * scale, 0],
        normal: [0, Math.sqrt(3) / 2, -0.5],
      },
    ] as const;

    for (const fixture of cases) {
      const hit = shapeCastAgainstShape3D(
        sphereShape3D({ radius: scale }),
        pose(fixture.from),
        fixture.translation,
        boxShape3D({ width: 2 * scale, height: 2 * scale, depth: 2 * scale }),
        pose(fixture.target),
      );
      expect(hit?.timeOfImpact).toBeCloseTo(0.3133974596215562, 15);
      expect(hit?.distance).toBeCloseTo(3.133974596215562 * scale, 15);
      expect(hit?.point.every(Number.isFinite)).toBe(true);
      hit?.normal.forEach((value, axis) => {
        expect(value).toBeCloseTo(fixture.normal[axis]!, 15);
      });
    }
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

  it("selects the earlier edge instead of a time-tied invalid far face", () => {
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 1_000_000.999999, 0]),
      [2e12, -2e6, 0],
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      pose([1e12, 0, 0]),
    );

    expect(hit).not.toBeNull();
    expect(hit!.timeOfImpact).toBe(0.499999999999);
    expect(hit!.point).toEqual([999_999_999_999, 1, 0]);
    expect(hit!.normal[0]).toBeLessThan(-0.999999999999);
    expect(hit!.normal[1]).toBeGreaterThan(0);
  });

  it("classifies a non-axis sphere-ray tangent and its adjacent binary64 variants exactly", () => {
    const ray = {
      origin: [0, 0, 0],
      direction: [3, 4, 0],
      maxDistance: 2,
    } as const;
    const tangent = raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([2, 1, 0]),
      ray,
    );

    expect(tangent?.distance).toBe(2);
    expect(tangent?.timeOfImpact).toBe(1);
    expect(tangent?.point[0]).toBeCloseTo(1.2, 15);
    expect(tangent?.point[1]).toBeCloseTo(1.6, 15);
    expect(tangent?.normal[0]).toBeCloseTo(-0.8, 15);
    expect(tangent?.normal[1]).toBeCloseTo(0.6, 15);

    expect(raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([2, nextRepresentableDown(1), 0]),
      ray,
    )).toBeNull();

    const crossing = raycastShape3D(
      sphereShape3D({ radius: 1 }),
      pose([2, nextRepresentableUp(1), 0]),
      ray,
    );
    expect(crossing).not.toBeNull();
    expect(crossing!.distance).toBeLessThan(2);
  });

  it("classifies the exact sphere-box edge tangent and adjacent gaps without tolerance", () => {
    const box = boxShape3D({ width: 2, height: 2, depth: 2 });
    const translation = [10, 0, 0] as const;
    const tangent = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, 2, 0]),
      translation,
      box,
      pose([5, 0, 0]),
    );

    expect(tangent?.timeOfImpact).toBe(0.4);
    expect(tangent?.distance).toBe(4);
    expect(tangent?.point).toEqual([4, 1, 0]);
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, nextRepresentableUp(2), 0]),
      translation,
      box,
      pose([5, 0, 0]),
    )).toBeNull();

    const crossing = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 1 }),
      pose([0, nextRepresentableDown(2), 0]),
      translation,
      box,
      pose([5, 0, 0]),
    );
    expect(crossing).not.toBeNull();
    expect(crossing!.timeOfImpact).toBeLessThan(0.4);
  });

  it("keeps the exact two-radius sum when an initially separated sphere moves away", () => {
    expect(shapeCastAgainstShape3D(
      sphereShape3D({ radius: nextRepresentableUp(1) }),
      identity,
      [-1, 0, 0],
      sphereShape3D({ radius: 2 ** -53 }),
      pose([1.0000000000000004, 0, 0]),
      { includeInitialOverlap: true },
    )).toBeNull();
  });

  it("returns an included true sphere overlap at time zero when casting away", () => {
    const moving = sphereShape3D({ radius: 1 });
    const target = sphereShape3D({ radius: 1 });
    const translation = [-1, 0, 0] as const;
    const targetPose = pose([1, 0, 0]);

    expect(shapeCastAgainstShape3D(
      moving,
      identity,
      translation,
      target,
      targetPose,
    )).toBeNull();
    expect(shapeCastAgainstShape3D(
      moving,
      identity,
      translation,
      target,
      targetPose,
      { includeInitialOverlap: true },
    )).toEqual({
      point: [2, 0, 0],
      normal: [1, 0, 0],
      distance: 0,
      timeOfImpact: 0,
    });
  });

  it("materializes a downscaled initial edge normal without an epsilon fallback", () => {
    const scale = 2 ** -100;
    const hit = shapeCastAgainstShape3D(
      sphereShape3D({ radius: 5 * scale }),
      pose([0, 11 * scale, 12 * scale]),
      [0, 0, 0],
      boxShape3D({ width: 16 * scale, height: 16 * scale, depth: 16 * scale }),
      identity,
      { includeInitialOverlap: true },
    );

    expect(hit?.timeOfImpact).toBe(0);
    expect(hit?.distance).toBe(0);
    expect(hit?.normal).toEqual([0, 0.6, 0.8]);
    expect(hit?.point).toEqual([0, 8 * scale, 8 * scale]);
  });

  it.each([Number.MIN_VALUE, 2 ** -1060])(
    "preserves an exact 3-4-5 edge entry at scale %s",
    (scale) => {
      const hit = shapeCastAgainstShape3D(
        sphereShape3D({ radius: 5 * scale }),
        pose([0, 11 * scale, 12 * scale]),
        [10 * scale, 0, 0],
        boxShape3D({ width: 16 * scale, height: 16 * scale, depth: 16 * scale }),
        pose([12 * scale, 0, 0]),
      );

      expect(hit?.timeOfImpact).toBe(0.4);
      expect(hit?.distance).toBe(4 * scale);
      expect(hit?.point).toEqual([4 * scale, 8 * scale, 8 * scale]);
      expect(hit?.normal).toEqual([0, 0.6, 0.8]);
    },
  );

  it("preserves exact edge entry topology across axes, signs, and power-of-two scales", () => {
    const scales = [2 ** -500, 1, 2 ** 500] as const;
    const cases = [
      {
        from: (scale: number) => [0, 11 * scale, 12 * scale] as const,
        motion: (scale: number) => [10 * scale, 0, 0] as const,
        target: (scale: number) => [12 * scale, 0, 0] as const,
        normal: [0, 0.6, 0.8] as const,
      },
      {
        from: (scale: number) => [-12 * scale, 0, -11 * scale] as const,
        motion: (scale: number) => [0, -10 * scale, 0] as const,
        target: (scale: number) => [0, -12 * scale, 0] as const,
        normal: [-0.8, 0, -0.6] as const,
      },
    ];

    for (const scale of scales) {
      for (const fixture of cases) {
        const hit = shapeCastAgainstShape3D(
          sphereShape3D({ radius: 5 * scale }),
          pose(fixture.from(scale)),
          fixture.motion(scale),
          boxShape3D({ width: 16 * scale, height: 16 * scale, depth: 16 * scale }),
          pose(fixture.target(scale)),
        );
        expect(hit?.timeOfImpact).toBe(0.4);
        expect(hit?.distance).toBe(4 * scale);
        hit?.normal.forEach((value, axis) => {
          expect(value).toBeCloseTo(fixture.normal[axis]!, 15);
        });
        expect(Object.values(hit ?? {}).flat().every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("admits exact cast endpoints and rejects contact beyond the closed interval", () => {
    const sphere = sphereShape3D({ radius: 1 });
    expect(shapeCastAgainstShape3D(
      sphere,
      identity,
      [10, 0, 0],
      sphere,
      pose([12, 0, 0]),
    )?.timeOfImpact).toBe(1);
    expect(shapeCastAgainstShape3D(
      sphere,
      identity,
      [10, 0, 0],
      sphere,
      pose([nextRepresentableUp(12), 0, 0]),
    )).toBeNull();

    const box = boxShape3D({ width: 2, height: 2, depth: 2 });
    expect(shapeCastAgainstShape3D(
      sphere,
      identity,
      [10, 0, 0],
      box,
      pose([12, 0, 0]),
    )?.timeOfImpact).toBe(1);
    expect(shapeCastAgainstShape3D(
      sphere,
      identity,
      [10, 0, 0],
      box,
      pose([nextRepresentableUp(12), 0, 0]),
    )).toBeNull();
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
    expect(included?.normal).toEqual([-1, 0, 0]);

    const onFace = shapeCastAgainstShape3D(
      sphere,
      pose([2, 0, 0]),
      [0, 0, 0],
      box,
      identity,
      { includeInitialOverlap: true },
    );
    expect(onFace?.distance).toBe(0);
    expect(onFace?.timeOfImpact).toBe(0);
    expect(onFace?.normal).toEqual([1, 0, 0]);
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

function nextRepresentableUp(value: number): number {
  const floats = new Float64Array(1);
  const bits = new BigUint64Array(floats.buffer);
  floats[0] = value;
  bits[0] = bits[0]! + 1n;
  return floats[0]!;
}

function nextRepresentableDown(value: number): number {
  const floats = new Float64Array(1);
  const bits = new BigUint64Array(floats.buffer);
  floats[0] = value;
  bits[0] = bits[0]! - 1n;
  return floats[0]!;
}
