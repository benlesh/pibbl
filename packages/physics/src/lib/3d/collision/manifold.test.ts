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

  it("emits one stable closest-edge point for a rotated edge-edge contact", () => {
    const first = boxShape3D({ width: 4, height: 0.8, depth: 0.8 });
    const second = boxShape3D({ width: 4, height: 0.8, depth: 0.8 });
    const secondPose = {
      position: [0.9326463451143354, 0.8658053576946259, 0.3712205656338483],
      orientation: [
        -0.2930362787804211,
        0.06142761015161281,
        0.8653775884709862,
        -0.40184327467524616,
      ],
    } as const;
    const forward = contactBetweenShapes3D(first, identity, second, secondPose)!;
    const reverse = contactBetweenShapes3D(second, secondPose, first, identity)!;

    expect(forward.points).toHaveLength(1);
    expect(reverse.points).toHaveLength(1);
    expectPointSeparationsMatchNormal(forward);
    expectPointSeparationsMatchNormal(reverse);
    expect(reverse.normal).toEqual(forward.normal.map((value) => value === 0 ? 0 : -value));
    expect(reverse.points[0]?.pointOnFirst).toEqual(forward.points[0]?.pointOnSecond);
    expect(reverse.points[0]?.pointOnSecond).toEqual(forward.points[0]?.pointOnFirst);
    expect(reverse.points[0]?.separation).toBe(forward.points[0]?.separation);
  });

  it("never projects non-finite values from an unrepresentable large manifold", () => {
    const first = boxShape3D({ width: 4e200, height: 0.8e200, depth: 0.8e200 });
    const second = boxShape3D({ width: 4e200, height: 0.8e200, depth: 0.8e200 });
    const contact = contactBetweenShapes3D(
      first,
      identity,
      second,
      {
        position: [
          0.9326463451143354 * 1e200,
          0.8658053576946259 * 1e200,
          0.3712205656338483 * 1e200,
        ],
        orientation: [
          -0.2930362787804211,
          0.06142761015161281,
          0.8653775884709862,
          -0.40184327467524616,
        ],
      },
    );

    if (contact === null) return;
    expect([
      ...contact.normal,
      ...contact.points.flatMap((point) => [
        ...point.pointOnFirst,
        ...point.pointOnSecond,
        point.separation,
      ]),
    ].every(Number.isFinite)).toBe(true);
  });
});

function expectPointSeparationsMatchNormal(
  contact: NonNullable<ReturnType<typeof contactBetweenShapes3D>>,
): void {
  for (const point of contact.points) {
    const dx = point.pointOnFirst[0] - point.pointOnSecond[0];
    const dy = point.pointOnFirst[1] - point.pointOnSecond[1];
    const dz = point.pointOnFirst[2] - point.pointOnSecond[2];
    expect(
      dx * contact.normal[0] + dy * contact.normal[1] + dz * contact.normal[2],
    ).toBeCloseTo(point.separation, 10);
  }
}
