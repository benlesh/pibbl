import { describe, expect, it } from "vitest";
import { boxShape3D } from "../../../3d-geometry.js";
import { IDENTITY_POSE_3D, copyPose3D } from "../math.js";
import { requireShapeRecord3D } from "../shape-records.js";
import {
  collideConvexShapes3D,
  manifoldResultBetweenShapeRecords3D,
} from "./pairs.js";
import { prepareConvexShape3D } from "./support.js";

describe("private 3D narrow-phase diagnostics", () => {
  it("preserves a GJK iteration-limit identity", () => {
    const record = requireShapeRecord3D(boxShape3D({ width: 2, height: 2, depth: 2 }));
    const first = prepareConvexShape3D(record, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      record,
      copyPose3D({ position: [5, 0, 0], orientation: [0, 0, 0, 1] }, "pose"),
    );

    expect(collideConvexShapes3D(first, second, [-1, 0, 0], { gjk: 0 })).toEqual({
      status: "failed",
      reason: "gjk",
    });
  });

  it("preserves an EPA iteration-limit identity", () => {
    const record = requireShapeRecord3D(boxShape3D({ width: 4, height: 4, depth: 4 }));
    const first = prepareConvexShape3D(record, IDENTITY_POSE_3D);
    const second = prepareConvexShape3D(
      record,
      copyPose3D({ position: [3, 0, 0], orientation: [0, 0, 0, 1] }, "pose"),
    );

    expect(collideConvexShapes3D(first, second, [-1, 0, 0], { epa: 0 })).toEqual({
      status: "failed",
      reason: "epa",
    });
  });

  it("carries GJK and EPA failure identities through the manifold seam", () => {
    const record = requireShapeRecord3D(boxShape3D({ width: 4, height: 4, depth: 4 }));
    const separatedPose = copyPose3D(
      { position: [8, 0, 0], orientation: [0, 0, 0, 1] },
      "pose",
    );
    const penetratingPose = copyPose3D(
      { position: [3, 0, 0], orientation: [0, 0, 0, 1] },
      "pose",
    );

    expect(manifoldResultBetweenShapeRecords3D(
      record,
      IDENTITY_POSE_3D,
      0,
      record,
      separatedPose,
      1,
      { gjk: 0 },
    )).toEqual({ status: "failed", reason: "gjk" });
    expect(manifoldResultBetweenShapeRecords3D(
      record,
      IDENTITY_POSE_3D,
      0,
      record,
      penetratingPose,
      1,
      { epa: 0 },
    )).toEqual({ status: "failed", reason: "epa" });
  });
});
