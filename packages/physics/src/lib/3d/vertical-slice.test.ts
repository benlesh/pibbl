import {
  boxShape3D,
  capsuleShape3D,
  coneShape3D,
  contactBetweenShapes3D,
  convexHullShape3D,
  cylinderShape3D,
  ellipsoidShape3D,
  heightfieldShape3D,
  overlapShapes3D,
  raycastShape3D,
  sphereShape3D,
  triangleMeshShape3D,
} from "../../3d-geometry.js";
import { describe, expect, it } from "vitest";

const identity = {
  position: [0, 0, 0] as const,
  orientation: [0, 0, 0, 1] as const,
};

describe("3D shape vocabulary vertical slice", () => {
  it("creates copied convex and concave shapes and routes representative contacts and queries", () => {
    const points = [
      [-1, -1, -1],
      [1, -1, -1],
      [0, 1, 0],
      [0, -1, 1],
    ] as const;
    const positions = [-3, 0, -3, 3, 0, -3, 3, 0, 3, -3, 0, 3];
    const heights = [0, 0, 0, 0.5, 0, 0];
    const shapes = [
      ellipsoidShape3D({ radii: [1.1, 0.7, 0.8] }),
      capsuleShape3D({ start: [0, -0.8, 0], end: [0, 0.8, 0], radius: 0.35 }),
      cylinderShape3D({ radius: 0.7, halfHeight: 0.8 }),
      coneShape3D({ radius: 0.8, halfHeight: 0.9 }),
      convexHullShape3D({ points }),
      triangleMeshShape3D({ positions, indices: [0, 2, 1, 0, 3, 2] }),
      heightfieldShape3D({ rows: 2, columns: 3, heights }),
    ];
    positions[1] = 99;
    heights[0] = 99;
    expect(shapes.every(Object.isFrozen)).toBe(true);

    const box = boxShape3D({ width: 2, height: 2, depth: 2 });
    expect(
      contactBetweenShapes3D(shapes[0]!, identity, box, identity),
    ).not.toBeNull();
    expect(
      overlapShapes3D(
        sphereShape3D({ radius: 0.5 }),
        { ...identity, position: [0, 0.35, 0] },
        shapes[5]!,
        identity,
      ),
    ).toBe(true);
    expect(
      raycastShape3D(shapes[6]!, identity, {
        origin: [1, 3, 0],
        direction: [0, -1, 0],
        maxDistance: 8,
      }),
    ).not.toBeNull();
  });
});
