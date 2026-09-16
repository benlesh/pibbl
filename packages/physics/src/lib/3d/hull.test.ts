import { describe, expect, it } from "vitest";
import { buildCanonicalHull3D } from "./hull.js";

describe("canonical convex hull construction", () => {
  it("accepts a valid millimeter-scale tetrahedron", () => {
    const hull = buildCanonicalHull3D([
      [0, 0, 0],
      [1e-3, 0, 0],
      [0, 1e-3, 0],
      [0, 0, 1e-3],
    ]);
    expect(hull.vertices).toHaveLength(12);
    expect(hull.faces).toHaveLength(12);
  });

  it("drops interior points and is invariant to input permutation and duplicates", () => {
    const corners = [
      [-1, -1, -1],
      [1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [-1, 1, 1],
      [1, 1, 1],
    ] as const;
    const first = buildCanonicalHull3D([...corners, [0, 0, 0], corners[0]]);
    const second = buildCanonicalHull3D([
      corners[7],
      corners[3],
      corners[5],
      corners[1],
      [0, 0, 0],
      corners[6],
      corners[2],
      corners[4],
      corners[0],
    ]);

    expect([...first.vertices]).toEqual([...second.vertices]);
    expect([...first.faces]).toEqual([...second.faces]);
    expect(first.vertices).toHaveLength(24);
    expect(first.faces).toHaveLength(36);
  });
});
