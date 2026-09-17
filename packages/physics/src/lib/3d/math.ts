import type {
  CRCPhysicsMatrix3,
  CRCPhysicsPose3D,
  CRCPhysicsQuaternion,
  CRCPhysicsVector3,
} from "../../3d-geometry.js";
import { requireFiniteNumber } from "../shared/validation.js";

export interface InternalPose3D {
  readonly position: Float64Array;
  readonly orientation: Float64Array;
}

const identityPosition = new Float64Array(3);
const identityOrientation = new Float64Array([0, 0, 0, 1]);

export const IDENTITY_POSE_3D: InternalPose3D = Object.freeze({
  position: identityPosition,
  orientation: identityOrientation,
});

export function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}

export function copyFiniteVector3(
  value: CRCPhysicsVector3,
  path: string,
): Float64Array {
  return new Float64Array([
    cleanZero(requireFiniteNumber(value[0], `${path}[0]`)),
    cleanZero(requireFiniteNumber(value[1], `${path}[1]`)),
    cleanZero(requireFiniteNumber(value[2], `${path}[2]`)),
  ]);
}

export function copyCanonicalQuaternion(
  value: CRCPhysicsQuaternion,
  path: string,
): Float64Array {
  const x = requireFiniteNumber(value[0], `${path}[0]`);
  const y = requireFiniteNumber(value[1], `${path}[1]`);
  const z = requireFiniteNumber(value[2], `${path}[2]`);
  const w = requireFiniteNumber(value[3], `${path}[3]`);
  const scale = Math.max(Math.abs(x), Math.abs(y), Math.abs(z), Math.abs(w));
  if (scale === 0) {
    throw new RangeError(`${path} must be a nonzero quaternion.`);
  }
  const scaledX = x / scale;
  const scaledY = y / scale;
  const scaledZ = z / scale;
  const scaledW = w / scale;
  const length = Math.hypot(scaledX, scaledY, scaledZ, scaledW);

  let normalizedX = scaledX / length;
  let normalizedY = scaledY / length;
  let normalizedZ = scaledZ / length;
  let normalizedW = scaledW / length;
  const firstNonzero =
    normalizedW !== 0
      ? normalizedW
      : normalizedX !== 0
        ? normalizedX
        : normalizedY !== 0
          ? normalizedY
          : normalizedZ;
  if (firstNonzero < 0) {
    normalizedX = -normalizedX;
    normalizedY = -normalizedY;
    normalizedZ = -normalizedZ;
    normalizedW = -normalizedW;
  }
  return new Float64Array([
    cleanZero(normalizedX),
    cleanZero(normalizedY),
    cleanZero(normalizedZ),
    cleanZero(normalizedW),
  ]);
}

export function copyPose3D(
  pose: CRCPhysicsPose3D | undefined,
  path: string,
): InternalPose3D {
  if (pose === undefined) {
    return IDENTITY_POSE_3D;
  }
  return Object.freeze({
    position: copyFiniteVector3(pose.position, `${path}.position`),
    orientation: copyCanonicalQuaternion(
      pose.orientation,
      `${path}.orientation`,
    ),
  });
}

/** Returns outer(inner(point)). */
export function composePose3D(
  outer: InternalPose3D,
  inner: InternalPose3D,
): InternalPose3D {
  const rotatedPosition = new Float64Array(3);
  rotateVectorInto(rotatedPosition, inner.position, outer.orientation);
  const orientation = new Float64Array(4);
  multiplyQuaternionsInto(orientation, outer.orientation, inner.orientation);
  return Object.freeze({
    position: new Float64Array([
      cleanZero(outer.position[0]! + rotatedPosition[0]!),
      cleanZero(outer.position[1]! + rotatedPosition[1]!),
      cleanZero(outer.position[2]! + rotatedPosition[2]!),
    ]),
    orientation: canonicalizeNormalizedQuaternion(orientation),
  });
}

export function multiplyQuaternionsInto(
  output: Float64Array,
  first: ArrayLike<number>,
  second: ArrayLike<number>,
): void {
  const ax = first[0]!;
  const ay = first[1]!;
  const az = first[2]!;
  const aw = first[3]!;
  const bx = second[0]!;
  const by = second[1]!;
  const bz = second[2]!;
  const bw = second[3]!;
  output[0] = aw * bx + ax * bw + ay * bz - az * by;
  output[1] = aw * by - ax * bz + ay * bw + az * bx;
  output[2] = aw * bz + ax * by - ay * bx + az * bw;
  output[3] = aw * bw - ax * bx - ay * by - az * bz;
}

export function rotateVectorInto(
  output: Float64Array,
  vector: ArrayLike<number>,
  quaternion: ArrayLike<number>,
): void {
  const x = vector[0]!;
  const y = vector[1]!;
  const z = vector[2]!;
  const qx = quaternion[0]!;
  const qy = quaternion[1]!;
  const qz = quaternion[2]!;
  const qw = quaternion[3]!;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  output[0] = cleanZero(x + qw * tx + qy * tz - qz * ty);
  output[1] = cleanZero(y + qw * ty + qz * tx - qx * tz);
  output[2] = cleanZero(z + qw * tz + qx * ty - qy * tx);
}

export function transformPointInto(
  output: Float64Array,
  point: ArrayLike<number>,
  pose: InternalPose3D,
): void {
  rotateVectorInto(output, point, pose.orientation);
  output[0] = cleanZero(output[0]! + pose.position[0]!);
  output[1] = cleanZero(output[1]! + pose.position[1]!);
  output[2] = cleanZero(output[2]! + pose.position[2]!);
}

export function rotationMatrixInto(
  output: Float64Array,
  quaternion: ArrayLike<number>,
): void {
  const x = quaternion[0]!;
  const y = quaternion[1]!;
  const z = quaternion[2]!;
  const w = quaternion[3]!;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  const ww = w * w;
  output[0] = cleanZero(ww + xx - yy - zz);
  output[1] = cleanZero(2 * (xy - wz));
  output[2] = cleanZero(2 * (xz + wy));
  output[3] = cleanZero(2 * (xy + wz));
  output[4] = cleanZero(ww - xx + yy - zz);
  output[5] = cleanZero(2 * (yz - wx));
  output[6] = cleanZero(2 * (xz - wy));
  output[7] = cleanZero(2 * (yz + wx));
  output[8] = cleanZero(ww - xx - yy + zz);
}

export function rotateDiagonalTensor(
  diagonalX: number,
  diagonalY: number,
  diagonalZ: number,
  orientation: ArrayLike<number>,
): CRCPhysicsMatrix3 {
  const rotation = new Float64Array(9);
  rotationMatrixInto(rotation, orientation);
  const result = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = cleanZero(
        rotation[row * 3]! * diagonalX * rotation[column * 3]! +
          rotation[row * 3 + 1]! * diagonalY * rotation[column * 3 + 1]! +
          rotation[row * 3 + 2]! * diagonalZ * rotation[column * 3 + 2]!,
      );
    }
  }
  return Object.freeze(result) as unknown as CRCPhysicsMatrix3;
}

export function freezeVector3(
  x: number,
  y: number,
  z: number,
): CRCPhysicsVector3 {
  return Object.freeze([cleanZero(x), cleanZero(y), cleanZero(z)] as const);
}

function canonicalizeNormalizedQuaternion(source: Float64Array): Float64Array {
  const length = Math.hypot(source[0]!, source[1]!, source[2]!, source[3]!);
  let x = source[0]! / length;
  let y = source[1]! / length;
  let z = source[2]! / length;
  let w = source[3]! / length;
  const firstNonzero = w !== 0 ? w : x !== 0 ? x : y !== 0 ? y : z;
  if (firstNonzero < 0) {
    x = -x;
    y = -y;
    z = -z;
    w = -w;
  }
  return new Float64Array([
    cleanZero(x),
    cleanZero(y),
    cleanZero(z),
    cleanZero(w),
  ]);
}
