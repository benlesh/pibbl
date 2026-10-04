import { describe, expect, it } from "vitest";
import { boxShape3D } from "../../../3d-geometry.js";
import { IDENTITY_POSE_3D, copyPose3D } from "../math.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { gjkConvexShapes3D } from "./gjk.js";
import { prepareConvexShape3D } from "./support.js";

describe("bounded 3D GJK", () => {
  it("returns closest witnesses for separated boxes", () => {
    const shape = requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 }));
    const first = prepareConvexShape3D(shape, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      shape,
      copyPose3D({ position: [5, 0, 0], orientation: [0, 0, 0, 1] }, "pose"),
    );
    const result = gjkConvexShapes3D(first, second, -1, 0, 0);

    expect(result.status).toBe("separated");
    if (result.status === "separated") {
      expect(result.separation).toBeCloseTo(3, 9);
      expect(result.firstX).toBeCloseTo(1, 9);
      expect(result.secondX).toBeCloseTo(4, 9);
      expect(result.normalX).toBe(-1);
    }
  });

  it("keeps a triangle-simplex projection separated from the origin", () => {
    const shape = requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 }));
    const first = prepareConvexShape3D(shape, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      shape,
      copyPose3D(
        {
          position: [0.28111914498731494, 2.4972858203109354, 0.33252886962145567],
          orientation: [
            0.26386396590805306,
            -0.3142384240218575,
            0.6519357209262081,
            0.6376596554149858,
          ],
        },
        "pose",
      ),
    );
    const result = gjkConvexShapes3D(first, second, 0.28111914498731494, 2.4972858203109354, 0.33252886962145567);

    expect(result.status).toBe("separated");
    if (result.status === "separated") expect(result.separation).toBeGreaterThan(0.07);
  });

  it("returns a tetrahedron for overlapping rotated boxes", () => {
    const shape = requireShapeRecord3D(boxShape3D({ width: 4, height: 4, depth: 4 }));
    const first = prepareConvexShape3D(shape, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      shape,
      copyPose3D(
        { position: [1, 0.25, 0], orientation: [0, Math.sin(Math.PI / 16), 0, Math.cos(Math.PI / 16)] },
        "pose",
      ),
    );
    const result = gjkConvexShapes3D(first, second, -1, -0.25, 0);

    expect(result.status).toBe("penetrating");
    if (result.status === "penetrating") expect(result.simplex).toHaveLength(4);
  });

  it("fails closed at an explicit zero iteration cap", () => {
    const shape = prepareConvexShape3D(
      requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 })),
      IDENTITY_POSE_3D,
    );
    expect(gjkConvexShapes3D(shape, shape, 1, 0, 0, 0)).toEqual({
      status: "failed",
      reason: "iteration-limit",
    });
  });
});
