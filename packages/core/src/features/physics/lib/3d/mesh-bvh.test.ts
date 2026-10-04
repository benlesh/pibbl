import { describe, expect, it } from "vitest";
import {
  buildMeshTriangles3D,
  buildHeightfieldTriangles3D,
} from "./mesh-bvh.js";

describe("immutable 3D mesh triangles and BVH", () => {
  it("omits degenerate leaves while retaining stable source triangle ids", () => {
    const data = buildMeshTriangles3D(
      new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0]),
      new Uint32Array([0, 1, 2, 0, 1, 3]),
    );
    expect([...data.sourceTriangleIds]).toEqual([0]);
    expect(data.triangles).toHaveLength(9);
    expect(data.bvh.triangle[0]).toBe(0);
  });

  it("emits fixed heightfield diagonals in row-major source order", () => {
    const data = buildHeightfieldTriangles3D(
      2,
      2,
      new Float64Array([0, 0, 0, 1]),
      1,
      1,
      1,
      new Float64Array(3),
    );
    expect([...data.sourceTriangleIds]).toEqual([0, 1]);
    expect([...data.triangles]).toEqual([
      0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1,
    ]);
  });
});
