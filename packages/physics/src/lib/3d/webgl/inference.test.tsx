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

  it("infers a uniformly scaled Sphere and defers nonuniform ellipsoids", () => {
    expect(summary(
      inferWebGLColliderShape3D(
        facts("sphere", transform({ scale: [6, -6, 6] })),
      ),
    )).toEqual({
      kind: "sphere",
      center: [0, 0, 0],
      radius: 3,
    });

    expect(() =>
      inferWebGLColliderShape3D(
        facts("sphere", transform({ scale: [2, 3, 2] })),
      ),
    ).toThrow(/nonuniform Sphere.*ellipsoid/i);
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
  }> = {},
): CRCWebGLAuthoredTransform {
  const translation = input.translation ?? [0, 0, 0];
  const scale = input.scale ?? [1, 1, 1];
  return Object.freeze({
    translation: Object.freeze([...translation]) as never,
    orientation: Object.freeze([0, 0, 0, 1] as const),
    scale: Object.freeze([...scale]) as never,
    matrix: Object.freeze([
      scale[0], 0, 0, 0,
      0, scale[1], 0, 0,
      0, 0, scale[2], 0,
      translation[0], translation[1], translation[2], 1,
    ]),
  });
}

function summary(shape: Parameters<typeof requireShapeRecord3D>[0]) {
  const record = requireShapeRecord3D(shape);
  return record.kind === "sphere"
    ? {
        kind: record.kind,
        center: [...record.center],
        radius: record.radius,
      }
    : {
        kind: record.kind,
        center: [...record.center],
        halfExtents: [...record.halfExtents],
        orientation: [...record.orientation],
      };
}
