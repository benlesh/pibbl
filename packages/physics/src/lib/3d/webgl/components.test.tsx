import { getWebGLGeometrySnapshot } from "@crc/webgl/internal";
import { describe, expect, it } from "vitest";
import {
  convexHullShape3D,
  ellipsoidShape3D,
  heightfieldShape3D,
} from "../../../3d-geometry.js";
import {
  bindPhysicsAttachmentShape3D,
  dynamicBody3D,
  requirePhysicsAttachment3DDescriptor,
} from "../runtime/descriptors.js";
import { physicsGeometryForShape3DForTest } from "./components.js";

describe("deterministic physics 3D render geometry", () => {
  it("reuses identity-cached geometry and consumes canonical faces and cells", () => {
    const hull = convexHullShape3D({
      points: [
        [-1, -1, -1],
        [1, -1, -1],
        [-1, 1, -1],
        [1, 1, -1],
        [-1, -1, 1],
        [1, -1, 1],
        [-1, 1, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
    });
    const first = physicsGeometryForShape3DForTest(hull);
    expect(physicsGeometryForShape3DForTest(hull)).toBe(first);
    expect(getWebGLGeometrySnapshot(first).positions).toHaveLength(12 * 9);

    const heightfield = heightfieldShape3D({
      rows: 2,
      columns: 2,
      heights: [0, 0, 0, 1],
    });
    expect(
      getWebGLGeometrySnapshot(physicsGeometryForShape3DForTest(heightfield))
        .positions,
    ).toHaveLength(2 * 9);
  });

  it("binds default self physics to the exact shape with stable identity", () => {
    const attachment = dynamicBody3D({ mass: 1 });
    const shape = ellipsoidShape3D({ radii: [2, 1, 1] });
    const first = bindPhysicsAttachmentShape3D(attachment, shape);
    expect(bindPhysicsAttachmentShape3D(attachment, shape)).toBe(first);
    const descriptor = requirePhysicsAttachment3DDescriptor(first);
    expect(descriptor.kind).toBe("body");
    if (descriptor.kind !== "body" || descriptor.options.collider === false)
      return;
    expect(descriptor.options.collider.shape).toBe(shape);
  });
});
