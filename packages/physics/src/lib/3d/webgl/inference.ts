import type { CRCWebGLPhysicsPrimitiveFacts } from "@crc/webgl/internal";
import type {
  CRCPhysicsQuaternion,
  CRCPhysicsShape3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import {
  boxShape3D,
  capsuleShape3D,
  coneShape3D,
  convexHullShape3D,
  cylinderShape3D,
  ellipsoidShape3D,
  sphereShape3D,
  triangleMeshShape3D,
} from "../../../3d-geometry.js";
import { requireShapeRecord3D } from "../shape-records.js";

const ORTHOGONAL_EPSILON = 1e-7;
const UNIFORM_EPSILON = 1e-7;

/** Infers one supported WebGL primitive and bakes its finite affine scale. */
export function inferWebGLColliderShape3D(
  facts: CRCWebGLPhysicsPrimitiveFacts,
  transform: Readonly<ArrayLike<number>> = facts.localTransform.matrix,
  bodyMode: "static" | "moving" = "static",
): CRCPhysicsShape3D {
  switch (facts.kind) {
    case "cube":
      return bakeWebGLShapeTransform3D(
        boxShape3D({ width: 1, height: 1, depth: 1 }),
        transform,
        "Cube",
      );
    case "sphere":
      return bakeWebGLShapeTransform3D(
        sphereShape3D({ radius: 0.5 }),
        transform,
        "Sphere",
      );
    case "group":
      throw new Error(
        "Group3D has no self geometry; attach collider3D() to physical descendants.",
      );
    case "mesh":
      return bakeWebGLShapeTransform3D(
        bodyMode === "moving"
          ? convexHullShape3D({
              points: pointsFromPositions(facts.geometrySnapshot.positions),
            })
          : triangleMeshShape3D({
              positions: facts.geometrySnapshot.positions,
              indices: facts.geometrySnapshot.indices,
            }),
        transform,
        "Mesh",
      );
  }
}

/** Bakes a rigid-plus-scale WebGL transform into the supported 3D shape. */
export function bakeWebGLShapeTransform3D(
  shape: CRCPhysicsShape3D,
  transform: Readonly<ArrayLike<number>>,
  componentName: string,
): CRCPhysicsShape3D {
  requireFiniteAffineMatrix(transform, `${componentName} collider transform`);
  const source = requireShapeRecord3D(shape);
  const localPose = matrixFromPose(
    source.localPose.position,
    source.localPose.orientation,
  );
  const posed = multiplyMatrix4(transform, localPose);

  if (source.kind === "sphere") {
    const center = transformPoint(posed, source.center);
    const scales = columnLengths(posed);
    const axes = normalizedColumns(posed, scales);
    validateOrthogonalAxes(axes, componentName);
    canonicalizeReflectedBoxAxes(axes);
    return sameScale(scales[0], scales[1]) && sameScale(scales[0], scales[2])
      ? sphereShape3D({ radius: source.radius * scales[0], center })
      : ellipsoidShape3D({
          radii: [
            source.radius * scales[0],
            source.radius * scales[1],
            source.radius * scales[2],
          ],
          center,
          orientation: quaternionFromAxes(axes),
        });
  }

  if (source.kind === "triangleMesh")
    return transformedTriangleMesh(source.positions, source.indices, posed);
  if (source.kind === "heightfield")
    return transformedTriangleMesh(
      source.triangles,
      Uint32Array.from(
        { length: source.triangles.length / 3 },
        (_, index) => index,
      ),
      posed,
    );
  if (source.kind === "convexHull") {
    return convexHullShape3D({
      points: transformedPoints(source.vertices, posed),
    });
  }
  if (source.kind === "capsule") {
    const scales = columnLengths(posed);
    validateOrthogonalAxes(normalizedColumns(posed, scales), componentName);
    if (!sameScale(scales[0], scales[1]) || !sameScale(scales[0], scales[2])) {
      throw new Error(
        `${componentName} capsule collider requires uniform authored scale.`,
      );
    }
    return capsuleShape3D({
      start: transformPoint(posed, source.start),
      end: transformPoint(posed, source.end),
      radius: source.radius * scales[0],
    });
  }

  if (
    source.kind === "ellipsoid" ||
    source.kind === "cylinder" ||
    source.kind === "cone"
  ) {
    const centered = multiplyMatrix4(
      posed,
      matrixFromPose(source.center, source.orientation),
    );
    const scales = columnLengths(centered);
    const axes = normalizedColumns(centered, scales);
    validateOrthogonalAxes(axes, componentName);
    canonicalizeReflectedBoxAxes(axes);
    const center = Object.freeze([
      clean(centered[12]!),
      clean(centered[13]!),
      clean(centered[14]!),
    ]) as CRCPhysicsVector3;
    const orientation = quaternionFromAxes(axes);
    if (source.kind === "ellipsoid") {
      return ellipsoidShape3D({
        radii: [
          source.radii[0]! * scales[0],
          source.radii[1]! * scales[1],
          source.radii[2]! * scales[2],
        ],
        center,
        orientation,
      });
    }
    if (!sameScale(scales[0], scales[2])) {
      throw new Error(
        `${componentName} ${source.kind} collider requires equal radial authored scale.`,
      );
    }
    const input = {
      radius: source.radius * scales[0],
      halfHeight: source.halfHeight * scales[1],
      center,
      orientation,
    };
    return source.kind === "cylinder"
      ? cylinderShape3D(input)
      : coneShape3D(input);
  }

  if (source.kind !== "box") throw new Error("Unsupported 3D shape record.");

  const centered = multiplyMatrix4(
    posed,
    matrixFromPose(source.center, source.orientation),
  );
  const scales = columnLengths(centered);
  const axes = normalizedColumns(centered, scales);
  validateOrthogonalAxes(axes, componentName);
  canonicalizeReflectedBoxAxes(axes);
  return boxShape3D({
    width: source.halfExtents[0]! * 2 * scales[0],
    height: source.halfExtents[1]! * 2 * scales[1],
    depth: source.halfExtents[2]! * 2 * scales[2],
    center: Object.freeze([
      clean(centered[12]!),
      clean(centered[13]!),
      clean(centered[14]!),
    ]) as CRCPhysicsVector3,
    orientation: quaternionFromAxes(axes),
  });
}

function transformedTriangleMesh(
  sourcePositions: ArrayLike<number>,
  sourceIndices: ArrayLike<number>,
  matrix: ArrayLike<number>,
): CRCPhysicsShape3D {
  const positions = transformedPositionArray(sourcePositions, matrix);
  const indices = Uint32Array.from(sourceIndices);
  if (linearDeterminant(matrix) < 0) {
    for (let offset = 0; offset < indices.length; offset += 3) {
      [indices[offset + 1], indices[offset + 2]] = [
        indices[offset + 2]!,
        indices[offset + 1]!,
      ];
    }
  }
  return triangleMeshShape3D({ positions, indices });
}

function transformedPositionArray(
  positions: ArrayLike<number>,
  matrix: ArrayLike<number>,
): Float64Array {
  const output = new Float64Array(positions.length);
  for (let index = 0; index < output.length; index += 3) {
    const point = transformPoint(matrix, [
      positions[index]!,
      positions[index + 1]!,
      positions[index + 2]!,
    ]);
    output[index] = point[0];
    output[index + 1] = point[1];
    output[index + 2] = point[2];
  }
  return output;
}

function transformedPoints(
  positions: ArrayLike<number>,
  matrix: ArrayLike<number>,
): readonly CRCPhysicsVector3[] {
  return pointsFromPositions(transformedPositionArray(positions, matrix));
}

function pointsFromPositions(
  positions: ArrayLike<number>,
): readonly CRCPhysicsVector3[] {
  const points: CRCPhysicsVector3[] = [];
  for (let index = 0; index < positions.length; index += 3) {
    points.push(
      Object.freeze([
        positions[index]!,
        positions[index + 1]!,
        positions[index + 2]!,
      ]),
    );
  }
  return Object.freeze(points);
}

function linearDeterminant(matrix: ArrayLike<number>): number {
  return (
    matrix[0]! * (matrix[5]! * matrix[10]! - matrix[9]! * matrix[6]!) -
    matrix[4]! * (matrix[1]! * matrix[10]! - matrix[9]! * matrix[2]!) +
    matrix[8]! * (matrix[1]! * matrix[6]! - matrix[5]! * matrix[2]!)
  );
}

function requireFiniteAffineMatrix(
  matrix: Readonly<ArrayLike<number>>,
  label: string,
): void {
  if (matrix.length !== 16) {
    throw new TypeError(`${label} must contain 16 values.`);
  }
  for (let index = 0; index < 16; index += 1) {
    if (!Number.isFinite(matrix[index])) {
      throw new TypeError(`${label}[${index}] must be finite.`);
    }
  }
  if (
    !close(matrix[3]!, 0, ORTHOGONAL_EPSILON) ||
    !close(matrix[7]!, 0, ORTHOGONAL_EPSILON) ||
    !close(matrix[11]!, 0, ORTHOGONAL_EPSILON) ||
    !close(matrix[15]!, 1, ORTHOGONAL_EPSILON)
  ) {
    throw new Error(`${label} must be affine.`);
  }
}

function matrixFromPose(
  position: ArrayLike<number>,
  orientation: ArrayLike<number>,
): Float64Array {
  const x = orientation[0]!;
  const y = orientation[1]!;
  const z = orientation[2]!;
  const w = orientation[3]!;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;
  return new Float64Array([
    1 - (yy + zz),
    xy + wz,
    xz - wy,
    0,
    xy - wz,
    1 - (xx + zz),
    yz + wx,
    0,
    xz + wy,
    yz - wx,
    1 - (xx + yy),
    0,
    position[0]!,
    position[1]!,
    position[2]!,
    1,
  ]);
}

function multiplyMatrix4(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): Float64Array {
  const output = new Float64Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        left[row]! * right[column * 4]! +
        left[4 + row]! * right[column * 4 + 1]! +
        left[8 + row]! * right[column * 4 + 2]! +
        left[12 + row]! * right[column * 4 + 3]!;
    }
  }
  return output;
}

function transformPoint(
  matrix: ArrayLike<number>,
  point: ArrayLike<number>,
): CRCPhysicsVector3 {
  return Object.freeze([
    clean(
      matrix[0]! * point[0]! +
        matrix[4]! * point[1]! +
        matrix[8]! * point[2]! +
        matrix[12]!,
    ),
    clean(
      matrix[1]! * point[0]! +
        matrix[5]! * point[1]! +
        matrix[9]! * point[2]! +
        matrix[13]!,
    ),
    clean(
      matrix[2]! * point[0]! +
        matrix[6]! * point[1]! +
        matrix[10]! * point[2]! +
        matrix[14]!,
    ),
  ]);
}

function columnLengths(matrix: ArrayLike<number>): [number, number, number] {
  const lengths: [number, number, number] = [
    Math.hypot(matrix[0]!, matrix[1]!, matrix[2]!),
    Math.hypot(matrix[4]!, matrix[5]!, matrix[6]!),
    Math.hypot(matrix[8]!, matrix[9]!, matrix[10]!),
  ];
  if (lengths.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("WebGL collider scale must be finite and nonzero.");
  }
  return lengths;
}

function normalizedColumns(
  matrix: ArrayLike<number>,
  lengths: readonly [number, number, number],
): [number[], number[], number[]] {
  return [
    [matrix[0]! / lengths[0], matrix[1]! / lengths[0], matrix[2]! / lengths[0]],
    [matrix[4]! / lengths[1], matrix[5]! / lengths[1], matrix[6]! / lengths[1]],
    [
      matrix[8]! / lengths[2],
      matrix[9]! / lengths[2],
      matrix[10]! / lengths[2],
    ],
  ];
}

function validateOrthogonalAxes(
  axes: readonly (readonly number[])[],
  componentName: string,
): void {
  for (const [left, right] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const) {
    const dot =
      axes[left]![0]! * axes[right]![0]! +
      axes[left]![1]! * axes[right]![1]! +
      axes[left]![2]! * axes[right]![2]!;
    if (Math.abs(dot) > ORTHOGONAL_EPSILON) {
      throw new Error(
        `${componentName} collider transform contains shear that cannot be represented by a box or sphere shape.`,
      );
    }
  }
}

function canonicalizeReflectedBoxAxes(
  axes: [number[], number[], number[]],
): void {
  const crossX = axes[0]![1]! * axes[1]![2]! - axes[0]![2]! * axes[1]![1]!;
  const crossY = axes[0]![2]! * axes[1]![0]! - axes[0]![0]! * axes[1]![2]!;
  const crossZ = axes[0]![0]! * axes[1]![1]! - axes[0]![1]! * axes[1]![0]!;
  const determinant =
    crossX * axes[2]![0]! + crossY * axes[2]![1]! + crossZ * axes[2]![2]!;
  if (determinant < 0) {
    axes[0]![0] = -axes[0]![0]!;
    axes[0]![1] = -axes[0]![1]!;
    axes[0]![2] = -axes[0]![2]!;
  }
}

function quaternionFromAxes(
  axes: readonly (readonly number[])[],
): CRCPhysicsQuaternion {
  const m00 = axes[0]![0]!;
  const m01 = axes[1]![0]!;
  const m02 = axes[2]![0]!;
  const m10 = axes[0]![1]!;
  const m11 = axes[1]![1]!;
  const m12 = axes[2]![1]!;
  const m20 = axes[0]![2]!;
  const m21 = axes[1]![2]!;
  const m22 = axes[2]![2]!;
  let x: number;
  let y: number;
  let z: number;
  let w: number;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const scale = Math.sqrt(trace + 1) * 2;
    w = scale / 4;
    x = (m21 - m12) / scale;
    y = (m02 - m20) / scale;
    z = (m10 - m01) / scale;
  } else if (m00 > m11 && m00 > m22) {
    const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / scale;
    x = scale / 4;
    y = (m01 + m10) / scale;
    z = (m02 + m20) / scale;
  } else if (m11 > m22) {
    const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / scale;
    x = (m01 + m10) / scale;
    y = scale / 4;
    z = (m12 + m21) / scale;
  } else {
    const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / scale;
    x = (m02 + m20) / scale;
    y = (m12 + m21) / scale;
    z = scale / 4;
  }
  const length = Math.hypot(x, y, z, w);
  x /= length;
  y /= length;
  z /= length;
  w /= length;
  const first = [w, x, y, z].find((value) => Math.abs(value) > 1e-15) ?? 1;
  if (first < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  return Object.freeze([clean(x), clean(y), clean(z), clean(w)]);
}

function close(left: number, right: number, epsilon: number): boolean {
  return (
    Math.abs(left - right) <=
    epsilon * Math.max(1, Math.abs(left), Math.abs(right))
  );
}

function sameScale(left: number, right: number): boolean {
  return (
    Math.abs(left - right) <=
    UNIFORM_EPSILON * Math.max(Math.abs(left), Math.abs(right))
  );
}

function clean(value: number): number {
  return Math.abs(value) <= 1e-14 ? 0 : value;
}
