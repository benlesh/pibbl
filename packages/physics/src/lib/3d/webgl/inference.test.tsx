import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import { describe, expect, it } from "vitest";
import { requireShapeRecord3D } from "../shape-records.js";
import {
  inferWebGLColliderShape3D,
} from "./inference.js";

describe("WebGL 3D collider inference", () => {
  it("bakes Cube size and signed scale into positive box dimensions", () => {
    const shape = inferWebGLColliderShape3D(
      facts("cube", transform({ scale: [-4, 6, -8] })),
    );

    expect(summary(shape)).toMatchObject({
      kind: "box",
      center: [0, 0, 0],
      halfExtents: [2, 3, 4],
    });
    const record = requireShapeRecord3D(shape);
    if (record.kind !== "box") throw new Error("Expected an inferred box.");
    expect(Math.hypot(...record.orientation)).toBe(1);
  });

  it("infers uniformly scaled Sphere and nonuniform Ellipsoid geometry", () => {
    expect(summary(
      inferWebGLColliderShape3D(
        facts("sphere", transform({ scale: [6, -6, 6] })),
      ),
    )).toEqual({
      kind: "sphere",
      center: [0, 0, 0],
      radius: 3,
    });

    expect(summary(
      inferWebGLColliderShape3D(
        facts("sphere", transform({ scale: [2, 3, 2] })),
      ),
    )).toMatchObject({
      kind: "ellipsoid",
      center: [0, 0, 0],
      radii: [1, 1.5, 1],
    });
  });

  it("retains tiny finite nonuniform Sphere dimensions as an ellipsoid", () => {
    expect(summary(
      inferWebGLColliderShape3D(
        facts("sphere", transform({ scale: [1e-8, 9e-8, 5e-8] })),
      ),
    )).toMatchObject({
      kind: "ellipsoid",
      radii: [5e-9, 4.5e-8, 2.5e-8],
    });
  });

  it("rejects equal-length Sphere columns produced by nested scale and rotation shear", () => {
    const parent = transform({ scale: [1, 2, Math.sqrt(2.5)] });
    const child = transform({ rotationZDegrees: 45 });
    const nested = multiplyMatrix4(parent.matrix, child.matrix);
    expect(columnLengths(nested)[0]).toBeCloseTo(columnLengths(nested)[1]!);
    expect(columnLengths(nested)[1]).toBeCloseTo(columnLengths(nested)[2]!);

    expect(() =>
      inferWebGLColliderShape3D(facts("sphere", child), nested),
    ).toThrow(/shear.*cannot be represented.*sphere/i);
  });

  it("keeps Group3D body-only and requires descendant collider geometry", () => {
    expect(() =>
      inferWebGLColliderShape3D({
        kind: "group",
        localTransform: transform(),
        authoredParentLineage: Object.freeze([]),
      }),
    ).toThrow(/Group3D.*no self geometry.*descendant/i);
  });
});

function facts(
  kind: "cube" | "sphere",
  localTransform: CRCWebGLAuthoredTransform,
): CRCWebGLPhysicsPrimitiveFacts {
  return {
    kind,
    localTransform,
    authoredParentLineage: Object.freeze([]),
    geometry: Object.freeze({}) as never,
    geometrySnapshot: Object.freeze({}) as never,
  };
}

function transform(
  input: Readonly<{
    translation?: readonly [number, number, number];
    scale?: readonly [number, number, number];
    rotationZDegrees?: number;
  }> = {},
): CRCWebGLAuthoredTransform {
  const translation = input.translation ?? [0, 0, 0];
  const scale = input.scale ?? [1, 1, 1];
  const rotationZ = (input.rotationZDegrees ?? 0) * Math.PI / 180;
  const cosine = Math.cos(rotationZ);
  const sine = Math.sin(rotationZ);
  return Object.freeze({
    translation: Object.freeze([...translation]) as never,
    orientation: Object.freeze([
      0,
      0,
      Math.sin(rotationZ / 2),
      Math.cos(rotationZ / 2),
    ] as const),
    scale: Object.freeze([...scale]) as never,
    matrix: Object.freeze([
      cosine * scale[0], sine * scale[0], 0, 0,
      -sine * scale[1], cosine * scale[1], 0, 0,
      0, 0, scale[2], 0,
      translation[0], translation[1], translation[2], 1,
    ]),
  });
}

function multiplyMatrix4(
  left: Readonly<ArrayLike<number>>,
  right: Readonly<ArrayLike<number>>,
): readonly number[] {
  const output = Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        left[row]! * right[column * 4]! +
        left[4 + row]! * right[column * 4 + 1]! +
        left[8 + row]! * right[column * 4 + 2]! +
        left[12 + row]! * right[column * 4 + 3]!;
    }
  }
  return Object.freeze(output);
}

function columnLengths(
  matrix: Readonly<ArrayLike<number>>,
): readonly [number, number, number] {
  return [
    Math.hypot(matrix[0]!, matrix[1]!, matrix[2]!),
    Math.hypot(matrix[4]!, matrix[5]!, matrix[6]!),
    Math.hypot(matrix[8]!, matrix[9]!, matrix[10]!),
  ];
}

function summary(shape: Parameters<typeof requireShapeRecord3D>[0]) {
  const record = requireShapeRecord3D(shape);
  if (record.kind === "sphere") return {
        kind: record.kind,
        center: [...record.center],
        radius: record.radius,
      };
  if (record.kind === "box") return {
        kind: record.kind,
        center: [...record.center],
        halfExtents: [...record.halfExtents],
        orientation: [...record.orientation],
      };
  if (record.kind === "ellipsoid") return {
    kind: record.kind,
    center: [...record.center],
    radii: [...record.radii],
    orientation: [...record.orientation],
  };
  return { kind: record.kind };
}
