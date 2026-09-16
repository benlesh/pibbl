import { describe, expect, it } from "vitest";
import {
  boxShape3D,
  contactBetweenShapes3D,
  sphereShape3D,
} from "../../../3d-geometry.js";

const identity = { position: [0, 0, 0], orientation: [0, 0, 0, 1] } as const;

describe("stable public 3D contact manifolds", () => {
  it("retains four penetration-sorted points for parallel box faces", () => {
    const contact = contactBetweenShapes3D(
      boxShape3D({ width: 4, height: 4, depth: 4 }),
      identity,
      boxShape3D({ width: 4, height: 2, depth: 2 }),
      { position: [3, 0, 0], orientation: [0, 0, 0, 1] },
    );

    expect(contact?.normal).toEqual([-1, 0, 0]);
    expect(contact?.points).toHaveLength(4);
    for (const point of contact?.points ?? []) {
      expect(point.separation).toBeCloseTo(-1, 9);
      expect(point.pointOnFirst[0]).toBeCloseTo(2, 9);
      expect(point.pointOnSecond[0]).toBeCloseTo(1, 9);
    }
    expect(Object.isFrozen(contact)).toBe(true);
    expect(Object.isFrozen(contact?.points)).toBe(true);
    expect(Object.isFrozen(contact?.points[0]?.pointOnFirst)).toBe(true);
  });

  it("uses exactly one point for every sphere contact and hides feature identities", () => {
    const contact = contactBetweenShapes3D(
      sphereShape3D({ radius: 1 }),
      identity,
      boxShape3D({ width: 2, height: 2, depth: 2 }),
      { position: [1.5, 0, 0], orientation: [0, 0, 0, 1] },
    );

    expect(contact?.points).toHaveLength(1);
    expect(Object.keys(contact ?? {})).toEqual(["normal", "points"]);
    expect(Object.keys(contact?.points[0] ?? {})).toEqual([
      "pointOnFirst",
      "pointOnSecond",
      "separation",
    ]);
  });

  it("preserves point order while swapping every box witness and reversing the normal", () => {
    const first = boxShape3D({ width: 4, height: 4, depth: 4 });
    const second = boxShape3D({ width: 4, height: 2, depth: 2 });
    const secondPose = { position: [3, 0, 0], orientation: [0, 0, 0, 1] } as const;
    const forward = contactBetweenShapes3D(first, identity, second, secondPose)!;
    const reverse = contactBetweenShapes3D(second, secondPose, first, identity)!;

    reverse.normal.forEach((value, axis) => {
      expect(value).toBeCloseTo(-forward.normal[axis]!, 12);
    });
    expect(reverse.points).toHaveLength(forward.points.length);
    forward.points.forEach((point, index) => {
      expect(reverse.points[index]?.pointOnFirst).toEqual(point.pointOnSecond);
      expect(reverse.points[index]?.pointOnSecond).toEqual(point.pointOnFirst);
      expect(reverse.points[index]?.separation).toBe(point.separation);
    });
  });
});
