import { describe, expect, it } from "vitest";
import {
  boundsOfShape3D,
  boxShape3D,
  massProperties3D,
  sphereShape3D,
  transformShape3D,
  type CRCPhysicsAabb3D,
  type CRCPhysicsMatrix3,
} from "../../3d-geometry.js";
import { requireShapeRecord3D } from "./shape-records.js";

const SQRT_HALF = Math.SQRT1_2;

describe("immutable 3D sphere and box factories", () => {
  it("copies caller-owned vectors and quaternions into Float64 records", () => {
    const sphereCenter: [number, number, number] = [1, 2, 3];
    const boxCenter: [number, number, number] = [4, 5, 6];
    const boxOrientation: [number, number, number, number] = [
      0,
      0,
      SQRT_HALF,
      SQRT_HALF,
    ];
    const sphere = sphereShape3D({ radius: 2, center: sphereCenter });
    const box = boxShape3D({
      width: 2,
      height: 4,
      depth: 6,
      center: boxCenter,
      orientation: boxOrientation,
    });

    sphereCenter[0] = 100;
    boxCenter[0] = 100;
    boxOrientation[2] = 0;
    boxOrientation[3] = 1;

    expect(Object.isFrozen(sphere)).toBe(true);
    expect(Object.isFrozen(box)).toBe(true);
    expect(boundsOfShape3D(sphere)).toEqual(bounds([-1, 0, 1], [3, 4, 5]));
    expectBoundsClose(boundsOfShape3D(box), bounds([2, 4, 3], [6, 6, 9]));

    const sphereRecord = requireShapeRecord3D(sphere);
    const boxRecord = requireShapeRecord3D(box);
    expect(sphereRecord.center).toBeInstanceOf(Float64Array);
    expect([...sphereRecord.center]).toEqual([1, 2, 3]);
    expect(boxRecord.center).toBeInstanceOf(Float64Array);
    expect([...boxRecord.center]).toEqual([4, 5, 6]);
    expect(boxRecord.orientation).toBeInstanceOf(Float64Array);
    expectVectorClose(boxRecord.orientation, [0, 0, SQRT_HALF, SQRT_HALF]);
  });

  it("normalizes quaternion sign and removes signed zero deterministically", () => {
    const positive = boxShape3D({
      width: 2,
      height: 2,
      depth: 2,
      orientation: [-0, -0, -2, -2],
    });
    const negative = boxShape3D({
      width: 2,
      height: 2,
      depth: 2,
      orientation: [0, 0, 2, 2],
    });

    const positiveOrientation = requireShapeRecord3D(positive).orientation;
    const negativeOrientation = requireShapeRecord3D(negative).orientation;
    expect([...positiveOrientation]).toEqual([...negativeOrientation]);
    expectVectorClose(positiveOrientation, [0, 0, SQRT_HALF, SQRT_HALF]);
    for (const value of positiveOrientation) {
      expect(Object.is(value, -0)).toBe(false);
    }
  });

  it("normalizes every finite nonzero quaternion without magnitude overflow", () => {
    const shape = boxShape3D({
      width: 1,
      height: 1,
      depth: 1,
      orientation: [Number.MAX_VALUE, 0, 0, Number.MAX_VALUE],
    });

    expectVectorClose(requireShapeRecord3D(shape).orientation, [
      SQRT_HALF,
      0,
      0,
      SQRT_HALF,
    ]);
  });

  it("composes rigid transforms and computes oriented analytic bounds", () => {
    const source = boxShape3D({
      width: 2,
      height: 4,
      depth: 6,
      center: [1, 0, 0],
    });
    const transformed = transformShape3D(source, {
      position: [0, 2, 0],
      orientation: [0, 0, SQRT_HALF, SQRT_HALF],
    });

    expectBoundsClose(
      boundsOfShape3D(transformed),
      bounds([-2, 2, -3], [2, 4, 3]),
    );
    expectBoundsClose(
      boundsOfShape3D(source, {
        position: [0, 2, 0],
        orientation: [0, 0, SQRT_HALF, SQRT_HALF],
      }),
      bounds([-2, 2, -3], [2, 4, 3]),
    );
    expect(() =>
      transformShape3D(source, {
        position: [0, 0, 0],
        orientation: [0, 0, 0, 1],
        scale: [2, 2, 2],
      } as never),
    ).toThrow("transform must not contain scale");
  });

  it("returns deeply frozen analytic sphere mass properties", () => {
    const properties = massProperties3D(
      sphereShape3D({ radius: 2, center: [3, 4, 5] }),
      { density: 3 },
    );
    const volume = (32 * Math.PI) / 3;
    const mass = volume * 3;
    const inertia = (2 * mass * 4) / 5;

    expect(properties.volume).toBeCloseTo(volume, 14);
    expect(properties.centerOfMass).toEqual([3, 4, 5]);
    expect(properties.mass).toBeCloseTo(mass, 14);
    expectMatrixClose(properties.inertiaTensor, [
      inertia,
      0,
      0,
      0,
      inertia,
      0,
      0,
      0,
      inertia,
    ]);
    expect(Object.isFrozen(properties)).toBe(true);
    expect(Object.isFrozen(properties.centerOfMass)).toBe(true);
    expect(Object.isFrozen(properties.inertiaTensor)).toBe(true);
  });

  it("returns the exact 2-by-4-by-6 box known answer at density 3", () => {
    expect(
      massProperties3D(boxShape3D({ width: 2, height: 4, depth: 6 }), {
        density: 3,
      }),
    ).toEqual({
      volume: 48,
      centerOfMass: [0, 0, 0],
      mass: 144,
      inertiaTensor: [624, 0, 0, 0, 480, 0, 0, 0, 240],
    });
  });

  it("rotates a box inertia tensor and center of mass with the shape", () => {
    const transformed = transformShape3D(
      boxShape3D({ width: 2, height: 4, depth: 6, center: [1, 0, 0] }),
      {
        position: [0, 2, 0],
        orientation: [0, 0, SQRT_HALF, SQRT_HALF],
      },
    );
    const properties = massProperties3D(transformed, { density: 3 });

    expectVectorClose(properties.centerOfMass, [0, 3, 0]);
    expectMatrixClose(
      properties.inertiaTensor,
      [480, 0, 0, 0, 624, 0, 0, 0, 240],
    );
  });

  it("rejects foreign shapes, invalid dimensions, nonfinite inputs, and zero quaternions", () => {
    const invalidFactories: readonly (() => unknown)[] = [
      () => sphereShape3D({ radius: 0 }),
      () => sphereShape3D({ radius: Number.NaN }),
      () =>
        sphereShape3D({ radius: 1, center: [0, Number.POSITIVE_INFINITY, 0] }),
      () => boxShape3D({ width: -1, height: 1, depth: 1 }),
      () => boxShape3D({ width: 1, height: Number.NaN, depth: 1 }),
      () =>
        boxShape3D({
          width: 1,
          height: 1,
          depth: 1,
          orientation: [0, 0, 0, 0],
        }),
      () =>
        boxShape3D({
          width: 1,
          height: 1,
          depth: 1,
          orientation: [0, 0, 0, Number.NaN],
        }),
      () => massProperties3D(sphereShape3D({ radius: 1 }), { density: 0 }),
      () => boundsOfShape3D({} as never),
      () =>
        boundsOfShape3D(sphereShape3D({ radius: 1 }), {
          position: [0, 0, Number.NaN],
          orientation: [0, 0, 0, 1],
        }),
    ];

    for (const create of invalidFactories) {
      expect(create).toThrow();
    }
  });
});

function bounds(
  min: readonly [number, number, number],
  max: readonly [number, number, number],
): CRCPhysicsAabb3D {
  return { min, max };
}

function expectBoundsClose(
  actual: CRCPhysicsAabb3D,
  expected: CRCPhysicsAabb3D,
): void {
  expectVectorClose(actual.min, expected.min);
  expectVectorClose(actual.max, expected.max);
  expect(Object.isFrozen(actual)).toBe(true);
  expect(Object.isFrozen(actual.min)).toBe(true);
  expect(Object.isFrozen(actual.max)).toBe(true);
}

function expectVectorClose(
  actual: readonly number[],
  expected: readonly number[],
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    expect(actual[index]).toBeCloseTo(expected[index]!, 12);
    expect(Object.is(actual[index], -0)).toBe(false);
  }
}

function expectMatrixClose(
  actual: CRCPhysicsMatrix3,
  expected: CRCPhysicsMatrix3,
): void {
  expectVectorClose(actual, expected);
}
