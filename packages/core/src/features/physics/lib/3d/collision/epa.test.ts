import { describe, expect, it } from "vitest";
import { boxShape3D } from "../../../3d-geometry.js";
import { IDENTITY_POSE_3D, copyPose3D } from "../math.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { epaConvexShapes3D } from "./epa.js";
import { gjkConvexShapes3D } from "./gjk.js";
import { prepareConvexShape3D } from "./support.js";

describe("bounded 3D EPA", () => {
  it("returns signed penetration and witnesses for overlapping boxes", () => {
    const record = requireShapeRecord3D(boxShape3D({ width: 4, height: 4, depth: 4 }));
    const first = prepareConvexShape3D(record, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      record,
      copyPose3D({ position: [3, 0, 0], orientation: [0, 0, 0, 1] }, "pose"),
    );
    const gjk = gjkConvexShapes3D(first, second, -1, 0, 0);
    expect(gjk.status).toBe("penetrating");
    if (gjk.status !== "penetrating") return;

    const result = epaConvexShapes3D(first, second, gjk.simplex);
    expect(result.status).toBe("penetrating");
    if (result.status === "penetrating") {
      expect(result.separation).toBeCloseTo(-1, 8);
      expect(result.normalX).toBeCloseTo(-1, 8);
      expect(result.firstX).toBeCloseTo(2, 8);
      expect(result.secondX).toBeCloseTo(1, 8);
    }
  });

  it("rejects degenerate simplices and fails closed at the configured bound", () => {
    const shape = prepareConvexShape3D(
      requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 })),
      IDENTITY_POSE_3D,
    );
    expect(epaConvexShapes3D(shape, shape, [])).toEqual({
      status: "failed",
      reason: "invalid-simplex",
    });
    const gjk = gjkConvexShapes3D(shape, shape, 1, 0, 0);
    expect(gjk.status).toBe("penetrating");
    if (gjk.status === "penetrating") {
      expect(epaConvexShapes3D(shape, shape, gjk.simplex, 0)).toEqual({
        status: "failed",
        reason: "iteration-limit",
      });
    }
  });
});
