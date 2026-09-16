import { describe, expect, it } from "vitest";
import {
  compareExactTimes,
  dyadicFromNumber,
  projectExactTime,
  rationalFromBigInts,
  rationalTime,
  type ExactVector3,
} from "./exact-binary64.js";
import {
  castSphereAgainstBoxAnalytically,
  castSphereAgainstSphereAnalytically,
  materializeAffineVector3,
  proveSphereSweepEvent3D,
  raycastSphereAnalytically,
} from "./analytic-casts.js";
import type { PreparedBox3D, PreparedSphere3D } from "./support.js";

describe("exact private analytic cast events", () => {
  it("proves an exact non-axis tangent before materializing its radial vector", () => {
    const event = proveSphereSweepEvent3D(
      exactVector([-2, -1, 0]),
      exactVector([3, 4, 0]),
      dyadicFromNumber(1),
      rationalFromBigInts(0n, 1n),
      rationalFromBigInts(1n, 1n),
    );

    expect(event?.kind).toBe("tangent");
    expect(compareExactTimes(
      event!.time,
      rationalTime(rationalFromBigInts(2n, 5n)),
    )).toBe(0);
    expect(projectExactTime(event!.time)).toBe(0.4);
    expect(materializeAffineVector3(
      exactVector([-2, -1, 0]),
      exactVector([3, 4, 0]),
      event!.time,
    )).toEqual([-0.8, 0.6, 0]);
  });

  it("uses raw ray direction for proof and physical distance only for projection", () => {
    const hit = raycastSphereAnalytically(
      sphere([2, 1, 0], 1),
      [0, 0, 0],
      [3, 4, 0],
      2,
      false,
    );

    expect(hit).toEqual({
      pointX: 1.2,
      pointY: 1.6,
      pointZ: 0,
      normalX: -0.8,
      normalY: 0.6,
      normalZ: 0,
      distance: 2,
      timeOfImpact: 1,
    });
    expect(raycastSphereAnalytically(
      sphere([2, nextRepresentableDown(1), 0], 1),
      [0, 0, 0],
      [3, 4, 0],
      2,
      false,
    )).toBeNull();
  });

  it("uses an exact two-term sphere radius through initial and entry topology", () => {
    expect(castSphereAgainstSphereAnalytically(
      sphere([0, 0, 0], nextRepresentableUp(1)),
      [-1, 0, 0],
      sphere([1.0000000000000004, 0, 0], 2 ** -53),
      true,
    )).toBeNull();

    const hit = castSphereAgainstSphereAnalytically(
      sphere([0, 0, 0], 1),
      [10, 0, 0],
      sphere([7, 0, 0], 2),
      false,
    );
    expect(hit?.timeOfImpact).toBe(0.4);
    expect(hit?.distance).toBe(4);
    expect(hit?.pointX).toBe(5);
  });

  it("sweeps sphere-box Voronoi cells chronologically rather than racing features", () => {
    const hit = castSphereAgainstBoxAnalytically(
      sphere([0, 1_000_000.999999, 0], 1),
      [2e12, -2e6, 0],
      box([1e12, 0, 0], [1, 1, 1]),
      false,
    );

    expect(hit?.timeOfImpact).toBe(0.499999999999);
    expect(hit?.pointX).toBe(999_999_999_999);
    expect(hit?.pointY).toBe(1);
    expect(hit?.normalX).toBeLessThan(-0.999999999999);
  });

  it("resolves exact edge tangency and one-ULP feature ownership", () => {
    const target = box([5, 0, 0], [1, 1, 1]);
    expect(castSphereAgainstBoxAnalytically(
      sphere([0, 2, 0], 1),
      [10, 0, 0],
      target,
      false,
    )?.timeOfImpact).toBe(0.4);
    expect(castSphereAgainstBoxAnalytically(
      sphere([0, nextRepresentableUp(2), 0], 1),
      [10, 0, 0],
      target,
      false,
    )).toBeNull();
  });

  it("constructs initial closest edge geometry at downscaled magnitudes", () => {
    const scale = 2 ** -100;
    const hit = castSphereAgainstBoxAnalytically(
      sphere([0, 11 * scale, 12 * scale], 5 * scale),
      [0, 0, 0],
      box([0, 0, 0], [8 * scale, 8 * scale, 8 * scale]),
      true,
    );

    expect(hit).toMatchObject({
      pointX: 0,
      pointY: 8 * scale,
      pointZ: 8 * scale,
      normalX: 0,
      normalY: 0.6,
      normalZ: 0.8,
      distance: 0,
      timeOfImpact: 0,
    });
  });

  it.each([Number.MIN_VALUE, 2 ** -1060])(
    "materializes a subnormal exact 3-4-5 edge entry at scale %s",
    (scale) => {
      const hit = castSphereAgainstBoxAnalytically(
        sphere([0, 11 * scale, 12 * scale], 5 * scale),
        [10 * scale, 0, 0],
        box([12 * scale, 0, 0], [8 * scale, 8 * scale, 8 * scale]),
        false,
      );

      expect(hit?.timeOfImpact).toBe(0.4);
      expect(hit?.distance).toBe(4 * scale);
      expect(hit).toMatchObject({
        pointX: 4 * scale,
        pointY: 8 * scale,
        pointZ: 8 * scale,
        normalX: 0,
        normalY: 0.6,
        normalZ: 0.8,
      });
    },
  );

  it("uses exact local affine coordinates for an oriented box", () => {
    const target: PreparedBox3D = {
      kind: "box",
      center: new Float64Array([0, 5, 0]),
      axes: new Float64Array([
        0, 1, 0,
        -1, 0, 0,
        0, 0, 1,
      ]),
      halfExtents: new Float64Array([1, 1, 1]),
    };
    const hit = castSphereAgainstBoxAnalytically(
      sphere([0, 0, 0], 1),
      [0, 10, 0],
      target,
      false,
    );

    expect(hit?.timeOfImpact).toBe(0.3);
    expect(hit?.pointX).toBe(0);
    expect(hit?.pointY).toBe(4);
    expect(hit?.normalX).toBe(0);
    expect(hit?.normalY).toBe(-1);
  });
});

function exactVector(
  value: readonly [number, number, number],
): ExactVector3 {
  return [
    dyadicFromNumber(value[0]),
    dyadicFromNumber(value[1]),
    dyadicFromNumber(value[2]),
  ];
}

function sphere(
  center: readonly [number, number, number],
  radius: number,
): PreparedSphere3D {
  return { kind: "sphere", center: new Float64Array(center), radius };
}

function box(
  center: readonly [number, number, number],
  halfExtents: readonly [number, number, number],
): PreparedBox3D {
  return {
    kind: "box",
    center: new Float64Array(center),
    axes: new Float64Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]),
    halfExtents: new Float64Array(halfExtents),
  };
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
