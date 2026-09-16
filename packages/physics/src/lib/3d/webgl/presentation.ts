import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLPhysicsPrimitiveFacts,
} from "@crc/webgl/internal";
import type {
  CRCPhysicsPose3D,
  CRCPhysicsQuaternion,
} from "../../../3d-geometry.js";

export interface WebGLBodyPresentationCapture3D {
  readonly initialPose: CRCPhysicsPose3D;
}

export interface WebGLBodyFrame3D {
  readonly authoredPose: CRCPhysicsPose3D;
  readonly authoredLineage: readonly CRCWebGLAuthoredTransform[];
  readonly parentMatrix: Readonly<Float64Array>;
  readonly localMatrix: Readonly<Float64Array>;
  readonly geometryMatrix: Readonly<Float64Array>;
}

/** Captures the rigid authored body pose once; scale remains collider geometry. */
export function captureWebGLBodyPresentation3D(
  facts: CRCWebGLPhysicsPrimitiveFacts,
  componentName: string,
): WebGLBodyPresentationCapture3D {
  const frame = rawBodyFrame(facts, componentName);
  return Object.freeze({ initialPose: frame.authoredPose });
}

/** Resolves the current exact body lineage and optionally enforces pose authority. */
export function resolveWebGLBodyFrame3D(
  capture: WebGLBodyPresentationCapture3D,
  facts: CRCWebGLPhysicsPrimitiveFacts,
  componentName: string,
  enforceDynamicPose: boolean,
): WebGLBodyFrame3D {
  const frame = rawBodyFrame(facts, componentName);
  if (
    enforceDynamicPose &&
    !samePoseRepresentation(frame.authoredPose, capture.initialPose)
  ) {
    throw new Error(
      `${componentName} authored pose changed while an enabled dynamic body owns pose. ` +
      "Use teleportBody3D(), a kinematic body, or disable physics before authored motion.",
    );
  }
  return frame;
}

/**
 * Produces the presentation-only matrix inserted between the authored parent
 * and body-local matrices. Render, pick, and focus therefore consume one model.
 */
export function resolveWebGLDynamicPresentationMatrix3D(
  _capture: WebGLBodyPresentationCapture3D,
  presentedPose: CRCPhysicsPose3D,
  frame: WebGLBodyFrame3D,
  componentName: string,
): Readonly<Float64Array> {
  validatePose(presentedPose, `${componentName} physics presentation pose`);
  if (samePoseRepresentation(presentedPose, frame.authoredPose)) {
    return identityMatrix4();
  }
  const parentInverse = invertMatrix4(frame.parentMatrix);
  const localInverse = invertMatrix4(frame.localMatrix);
  if (parentInverse === undefined || localInverse === undefined) {
    throw new Error(`${componentName} authored transform is noninvertible.`);
  }
  const presentedWorld = multiplyMatrix4(
    matrixFromPose3D(presentedPose),
    frame.geometryMatrix,
  );
  return multiplyMatrix4(
    multiplyMatrix4(parentInverse, presentedWorld),
    localInverse,
  );
}

/**
 * Derives compound collider geometry only from the exact body-prefix and the
 * descendant's forward authored suffix. No world-matrix subtraction is used.
 */
export function resolveWebGLColliderForwardMatrix3D(
  body: WebGLBodyFrame3D,
  collider: CRCWebGLPhysicsPrimitiveFacts,
  componentName: string,
): Readonly<Float64Array> {
  if (collider.authoredParentLineage.length < body.authoredLineage.length) {
    throw exactLineageError(componentName);
  }
  for (let index = 0; index < body.authoredLineage.length; index += 1) {
    if (collider.authoredParentLineage[index] !== body.authoredLineage[index]) {
      throw exactLineageError(componentName);
    }
  }
  let relative: Float64Array = new Float64Array(body.geometryMatrix);
  for (
    let index = body.authoredLineage.length;
    index < collider.authoredParentLineage.length;
    index += 1
  ) {
    relative = multiplyMatrix4(
      relative,
      collider.authoredParentLineage[index]!.matrix,
    );
  }
  return multiplyMatrix4(relative, collider.localTransform.matrix);
}

export function matrixFromPose3D(
  pose: CRCPhysicsPose3D,
): Readonly<Float64Array> {
  validatePose(pose, "3D pose");
  const [x, y, z, w] = pose.orientation;
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
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    pose.position[0], pose.position[1], pose.position[2], 1,
  ]);
}

function rawBodyFrame(
  facts: CRCWebGLPhysicsPrimitiveFacts,
  componentName: string,
): WebGLBodyFrame3D {
  const parentMatrix = composeLineageMatrix3D(facts.authoredParentLineage);
  const localMatrix = copyFiniteMatrix(
    facts.localTransform.matrix,
    `${componentName} authored local transform`,
  );
  const worldMatrix = multiplyMatrix4(parentMatrix, localMatrix);
  const authoredLineage = Object.freeze([
    ...facts.authoredParentLineage,
    facts.localTransform,
  ]);
  const authoredPose = poseFromAuthoredLineage(
    authoredLineage,
    worldMatrix,
    componentName,
  );
  const poseInverse = invertMatrix4(matrixFromPose3D(authoredPose));
  if (poseInverse === undefined) {
    throw new Error(`${componentName} authored rigid pose is noninvertible.`);
  }
  return Object.freeze({
    authoredPose,
    authoredLineage,
    parentMatrix,
    localMatrix,
    geometryMatrix: multiplyMatrix4(poseInverse, worldMatrix),
  });
}

function composeLineageMatrix3D(
  lineage: readonly CRCWebGLAuthoredTransform[],
): Float64Array {
  let result = identityMatrix4();
  for (const transform of lineage) {
    result = multiplyMatrix4(
      result,
      copyFiniteMatrix(transform.matrix, "WebGL authored transform"),
    );
  }
  return result;
}

function poseFromAuthoredLineage(
  lineage: readonly CRCWebGLAuthoredTransform[],
  worldMatrix: ArrayLike<number>,
  componentName: string,
): CRCPhysicsPose3D {
  let orientation: CRCPhysicsQuaternion = [0, 0, 0, 1];
  for (const transform of lineage) {
    orientation = multiplyQuaternions(orientation, transform.orientation);
  }
  const pose = Object.freeze({
    position: Object.freeze([
      clean(worldMatrix[12]!),
      clean(worldMatrix[13]!),
      clean(worldMatrix[14]!),
    ] as const),
    orientation,
  });
  validatePose(pose, `${componentName} authored pose`);
  return pose;
}

function multiplyQuaternions(
  left: ArrayLike<number>,
  right: ArrayLike<number>,
): CRCPhysicsQuaternion {
  let x = left[3]! * right[0]! + left[0]! * right[3]! +
    left[1]! * right[2]! - left[2]! * right[1]!;
  let y = left[3]! * right[1]! - left[0]! * right[2]! +
    left[1]! * right[3]! + left[2]! * right[0]!;
  let z = left[3]! * right[2]! + left[0]! * right[1]! -
    left[1]! * right[0]! + left[2]! * right[3]!;
  let w = left[3]! * right[3]! - left[0]! * right[0]! -
    left[1]! * right[1]! - left[2]! * right[2]!;
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

function invertMatrix4(matrix: ArrayLike<number>): Float64Array | undefined {
  const rows = Array.from({ length: 4 }, (_, row) => {
    const values = Array<number>(8).fill(0);
    for (let column = 0; column < 4; column += 1) {
      const value = matrix[column * 4 + row];
      if (!Number.isFinite(value)) return undefined;
      values[column] = value!;
    }
    values[4 + row] = 1;
    return values;
  });
  if (rows.some((row) => row === undefined)) return undefined;
  const augmented = rows as number[][];
  const rowScales = augmented.map((row) =>
    Math.max(...row.slice(0, 4).map(Math.abs)),
  );
  if (rowScales.some((scale) => scale === 0 || !Number.isFinite(scale))) {
    return undefined;
  }

  for (let column = 0; column < 4; column += 1) {
    let pivotRow = column;
    let pivotRatio = -1;
    for (let row = column; row < 4; row += 1) {
      const ratio = Math.abs(augmented[row]![column]!) / rowScales[row]!;
      if (ratio > pivotRatio) {
        pivotRatio = ratio;
        pivotRow = row;
      }
    }
    const pivot = augmented[pivotRow]![column]!;
    if (pivot === 0 || !Number.isFinite(pivot)) return undefined;
    if (pivotRow !== column) {
      [augmented[column], augmented[pivotRow]] = [
        augmented[pivotRow]!,
        augmented[column]!,
      ];
      [rowScales[column], rowScales[pivotRow]] = [
        rowScales[pivotRow]!,
        rowScales[column]!,
      ];
    }

    for (let index = 0; index < 8; index += 1) {
      augmented[column]![index] = augmented[column]![index]! / pivot;
      if (!Number.isFinite(augmented[column]![index])) return undefined;
    }
    for (let row = 0; row < 4; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      if (factor === 0) continue;
      for (let index = 0; index < 8; index += 1) {
        augmented[row]![index] -= factor * augmented[column]![index]!;
        if (!Number.isFinite(augmented[row]![index])) return undefined;
      }
    }
  }

  const output = new Float64Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      output[column * 4 + row] = augmented[row]![4 + column]!;
    }
  }
  return output;
}

function copyFiniteMatrix(
  matrix: Readonly<ArrayLike<number>>,
  label: string,
): Float64Array {
  if (matrix.length !== 16) throw new TypeError(`${label} must contain 16 values.`);
  const copy = new Float64Array(16);
  for (let index = 0; index < 16; index += 1) {
    const value = matrix[index];
    if (!Number.isFinite(value)) {
      throw new TypeError(`${label}[${index}] must be finite.`);
    }
    copy[index] = value!;
  }
  return copy;
}

function identityMatrix4(): Float64Array {
  return new Float64Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function validatePose(pose: CRCPhysicsPose3D, label: string): void {
  if (
    pose.position.some((value) => !Number.isFinite(value)) ||
    pose.orientation.some((value) => !Number.isFinite(value)) ||
    Math.abs(Math.hypot(...pose.orientation) - 1) > 1e-6
  ) {
    throw new TypeError(`${label} must contain a finite unit quaternion pose.`);
  }
}

function samePoseRepresentation(
  left: CRCPhysicsPose3D,
  right: CRCPhysicsPose3D,
): boolean {
  if (!left.position.every((value, index) => value === right.position[index])) {
    return false;
  }
  const direct = left.orientation.every(
    (value, index) => value === right.orientation[index],
  );
  return direct || left.orientation.every(
    (value, index) => value === -right.orientation[index]!,
  );
}

function clean(value: number): number {
  return Math.abs(value) <= 1e-14 ? 0 : value;
}

function exactLineageError(componentName: string): Error {
  return new Error(
    `${componentName} collider does not descend from its body through the exact authored lineage.`,
  );
}
