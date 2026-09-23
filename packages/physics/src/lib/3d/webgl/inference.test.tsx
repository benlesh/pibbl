import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import { describe, expect, it } from "vitest";
import { requireShapeRecord3D } from "../shape-records.js";
import {
  bakeWebGLShapeTransform3D,
  inferWebGLColliderShape3D,
} from "./inference.js";
import {
  capsuleShape3D,
  coneShape3D,
  convexHullShape3D,
  cylinderShape3D,
  ellipsoidShape3D,
  heightfieldShape3D,
  triangleMeshShape3D,
} from "../../../3d-geometry.js";

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
    expect(
      summary(
        inferWebGLColliderShape3D(
          facts("sphere", transform({ scale: [6, -6, 6] })),
        ),
      ),
    ).toEqual({
      kind: "sphere",
      center: [0, 0, 0],
      radius: 3,
    });

    expect(
      summary(
        inferWebGLColliderShape3D(
          facts("sphere", transform({ scale: [2, 3, 2] })),
        ),
      ),
    ).toMatchObject({
      kind: "ellipsoid",
      center: [0, 0, 0],
      radii: [1, 1.5, 1],
    });
  });

  it("retains tiny finite nonuniform Sphere dimensions as an ellipsoid", () => {
    expect(
      summary(
        inferWebGLColliderShape3D(
          facts("sphere", transform({ scale: [1e-8, 9e-8, 5e-8] })),
        ),
      ),
    ).toMatchObject({
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

  it("infers exact static Mesh triangles and canonical moving Mesh hulls", () => {
    const mesh = meshFacts(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
    );

    expect(
      summary(
        inferWebGLColliderShape3D(mesh, mesh.localTransform.matrix, "static"),
      ),
    ).toMatchObject({ kind: "triangleMesh", positions: 12, triangles: 4 });
    const dynamic = requireShapeRecord3D(
      inferWebGLColliderShape3D(mesh, mesh.localTransform.matrix, "moving"),
    );
    expect(dynamic).toMatchObject({ kind: "convexHull" });
    if (dynamic.kind !== "convexHull") throw new Error("Expected a hull.");
    expect(dynamic.vertices).toHaveLength(12);
    expect(dynamic.faces).toHaveLength(12);
  });

  it("bakes signed affine transforms into hulls, meshes, and heightfields", () => {
    const affine = transform({
      translation: [7, -3, 2],
      scale: [-2, 3, 4],
      rotationZDegrees: 90,
    }).matrix;
    const hull = requireShapeRecord3D(
      bakeWebGLShapeTransform3D(
        convexHullShape3D({
          points: [
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        }),
        affine,
        "ConvexHull3D",
      ),
    );
    expect(hull.kind).toBe("convexHull");
    expect([...hull.vertices]).toContain(7);

    const mesh = requireShapeRecord3D(
      bakeWebGLShapeTransform3D(
        triangleMeshShape3D({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] }),
        affine,
        "Mesh",
      ),
    );
    expect(mesh).toMatchObject({ kind: "triangleMesh" });
    if (mesh.kind !== "triangleMesh") throw new Error("Expected a mesh.");
    expect([...mesh.positions]).toEqual([7, -3, 2, 7, -5, 2, 4, -3, 2]);

    const heightfield = requireShapeRecord3D(
      bakeWebGLShapeTransform3D(
        heightfieldShape3D({ rows: 2, columns: 2, heights: [0, 1, 2, 3] }),
        affine,
        "Heightfield3D",
      ),
    );
    expect(heightfield.kind).toBe("triangleMesh");
  });

  it("bakes compatible scale and mirroring into every analytic family", () => {
    const ellipsoid = requireShapeRecord3D(
      bakeWebGLShapeTransform3D(
        ellipsoidShape3D({ radii: [1, 2, 3], center: [1, 0, 0] }),
        transform({ translation: [5, 6, 7], scale: [-2, 3, 4] }).matrix,
        "Ellipsoid3D",
      ),
    );
    expect(ellipsoid).toMatchObject({
      kind: "ellipsoid",
      center: new Float64Array([3, 6, 7]),
      radii: new Float64Array([2, 6, 12]),
    });

    const capsule = requireShapeRecord3D(
      bakeWebGLShapeTransform3D(
        capsuleShape3D({ start: [0, -1, 0], end: [0, 1, 0], radius: 0.5 }),
        transform({ translation: [1, 2, 3], scale: [-2, -2, -2] }).matrix,
        "Capsule3D",
      ),
    );
    expect(capsule).toMatchObject({
      kind: "capsule",
      start: new Float64Array([1, 4, 3]),
      end: new Float64Array([1, 0, 3]),
      radius: 1,
    });

    for (const [name, shape] of [
      ["Cylinder3D", cylinderShape3D({ radius: 2, halfHeight: 1 })],
      ["Cone3D", coneShape3D({ radius: 2, halfHeight: 1 })],
    ] as const) {
      const record = requireShapeRecord3D(
        bakeWebGLShapeTransform3D(
          shape,
          transform({ translation: [1, 2, 3], scale: [2, -3, 2] }).matrix,
          name,
        ),
      );
      expect(record).toMatchObject({
        center: new Float64Array([1, 2, 3]),
        radius: 4,
        halfHeight: 3,
      });
    }
  });

  it("rejects analytic affine transforms that cannot preserve the source family", () => {
    expect(() =>
      bakeWebGLShapeTransform3D(
        capsuleShape3D({ start: [0, -1, 0], end: [0, 1, 0], radius: 0.5 }),
        transform({ scale: [1, 2, 1] }).matrix,
        "Capsule3D",
      ),
    ).toThrow(/capsule.*uniform.*scale/i);
    expect(() =>
      bakeWebGLShapeTransform3D(
        coneShape3D({ radius: 1, halfHeight: 1 }),
        transform({ scale: [1, 2, 3] }).matrix,
        "Cone3D",
      ),
    ).toThrow(/cone.*equal radial.*scale/i);
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

function meshFacts(
  positions: readonly number[],
  indices: readonly number[],
): CRCWebGLPhysicsPrimitiveFacts {
  return {
    kind: "mesh",
    localTransform: transform(),
    authoredParentLineage: Object.freeze([]),
    geometry: Object.freeze({}) as never,
    geometrySnapshot: Object.freeze({
      positions: Object.freeze([...positions]),
      indices: Object.freeze([...indices]),
      bounds: Object.freeze({
        minimumX: 0,
        minimumY: 0,
        minimumZ: 0,
        maximumX: 1,
        maximumY: 1,
        maximumZ: 1,
      }),
    }),
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
  const rotationZ = ((input.rotationZDegrees ?? 0) * Math.PI) / 180;
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
      cosine * scale[0],
      sine * scale[0],
      0,
      0,
      -sine * scale[1],
      cosine * scale[1],
      0,
      0,
      0,
      0,
      scale[2],
      0,
      translation[0],
      translation[1],
      translation[2],
      1,
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
  if (record.kind === "sphere")
    return {
      kind: record.kind,
      center: [...record.center],
      radius: record.radius,
    };
  if (record.kind === "box")
    return {
      kind: record.kind,
      center: [...record.center],
      halfExtents: [...record.halfExtents],
      orientation: [...record.orientation],
    };
  if (record.kind === "ellipsoid")
    return {
      kind: record.kind,
      center: [...record.center],
      radii: [...record.radii],
      orientation: [...record.orientation],
    };
  if (record.kind === "triangleMesh")
    return {
      kind: record.kind,
      positions: record.positions.length,
      triangles: record.triangles.length / 9,
    };
  return { kind: record.kind };
}
