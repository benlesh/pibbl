import { describe, expect, it } from "vitest";
import { boxShape3D, sphereShape3D } from "../../../3d-geometry.js";
import { IDENTITY_POSE_3D, copyPose3D } from "../math.js";
import { requireShapeRecord3D } from "../shape-records.js";
import {
  prepareConvexShape3D,
  supportMinkowski3D,
  supportShape3D,
} from "./support.js";

describe("convex 3D support maps", () => {
  it("chooses the lower canonical box vertex on exact support ties", () => {
    const box = prepareConvexShape3D(
      requireShapeRecord3D(boxShape3D({ width: 4, height: 2, depth: 6 })),
      IDENTITY_POSE_3D,
    );
    const output = new Float64Array(3);

    expect(supportShape3D(output, box, 1, 0, 0)).toBe(1);
    expect([...output]).toEqual([2, -1, -3]);
    expect(supportShape3D(output, box, 0, 1, 0)).toBe(2);
    expect([...output]).toEqual([-2, 1, -3]);
    expect(supportShape3D(output, box, 0, 0, 1)).toBe(4);
    expect([...output]).toEqual([-2, -1, 3]);
  });

  it("supports rotated boxes and analytic spheres without exposing scratch arrays", () => {
    const rotated = prepareConvexShape3D(
      requireShapeRecord3D(boxShape3D({ width: 4, height: 2, depth: 2 })),
      copyPose3D(
        { position: [3, 0, 0], orientation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
        "pose",
      ),
    );
    const sphere = prepareConvexShape3D(
      requireShapeRecord3D(sphereShape3D({ radius: 1 })),
      IDENTITY_POSE_3D,
    );
    const output = new Float64Array(3);

    supportShape3D(output, rotated, 0, 1, 0);
    expectVectorClose(output, [4, 2, -1]);
    const minkowski = supportMinkowski3D(rotated, sphere, 1, 0, 0);
    expect(minkowski.firstFeature).toBe(0);
    expect(minkowski.secondFeature).toBe(0);
    expect(minkowski.x).toBeCloseTo(5, 12);
  });
});

function expectVectorClose(actual: ArrayLike<number>, expected: readonly number[]): void {
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 12));
}
