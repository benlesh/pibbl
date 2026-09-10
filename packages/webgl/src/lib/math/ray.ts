import type { CRCWebGLVector3 } from '../types.js';

type WritableNumbers = { [index: number]: number };

export function unprojectPoint<T extends WritableNumbers>(
  destination: T,
  inverseProjectionViewMatrix: ArrayLike<number>,
  normalizedX: number,
  normalizedY: number,
  normalizedZ: number,
): T {
  const matrix = inverseProjectionViewMatrix;
  const w =
    matrix[3]! * normalizedX +
    matrix[7]! * normalizedY +
    matrix[11]! * normalizedZ +
    matrix[15]!;
  destination[0] =
    (matrix[0]! * normalizedX +
      matrix[4]! * normalizedY +
      matrix[8]! * normalizedZ +
      matrix[12]!) /
    w;
  destination[1] =
    (matrix[1]! * normalizedX +
      matrix[5]! * normalizedY +
      matrix[9]! * normalizedZ +
      matrix[13]!) /
    w;
  destination[2] =
    (matrix[2]! * normalizedX +
      matrix[6]! * normalizedY +
      matrix[10]! * normalizedZ +
      matrix[14]!) /
    w;
  return destination;
}

export function createRayFromNDC<TOrigin extends WritableNumbers, TDirection extends WritableNumbers>(
  origin: TOrigin,
  direction: TDirection,
  inverseProjectionViewMatrix: ArrayLike<number>,
  normalizedX: number,
  normalizedY: number,
): TOrigin {
  unprojectPoint(origin, inverseProjectionViewMatrix, normalizedX, normalizedY, -1);
  // The exact perspective far point can have homogeneous w = 0 after a valid
  // large far/near ratio is rounded to Float32. Any finite interior clip point
  // defines the same perspective ray without depending on that asymptote.
  unprojectPoint(direction, inverseProjectionViewMatrix, normalizedX, normalizedY, 0);
  const directionX = direction[0]! - origin[0]!;
  const directionY = direction[1]! - origin[1]!;
  const directionZ = direction[2]! - origin[2]!;
  const length = Math.hypot(directionX, directionY, directionZ);
  direction[0] = directionX / length;
  direction[1] = directionY / length;
  direction[2] = directionZ / length;
  return origin;
}

export function intersectRayTriangle(
  origin: CRCWebGLVector3,
  direction: CRCWebGLVector3,
  first: CRCWebGLVector3,
  second: CRCWebGLVector3,
  third: CRCWebGLVector3,
): number | undefined {
  const edge1X = second[0] - first[0];
  const edge1Y = second[1] - first[1];
  const edge1Z = second[2] - first[2];
  const edge2X = third[0] - first[0];
  const edge2Y = third[1] - first[1];
  const edge2Z = third[2] - first[2];
  const crossX = direction[1] * edge2Z - direction[2] * edge2Y;
  const crossY = direction[2] * edge2X - direction[0] * edge2Z;
  const crossZ = direction[0] * edge2Y - direction[1] * edge2X;
  const determinant = edge1X * crossX + edge1Y * crossY + edge1Z * crossZ;
  const normalX = edge1Y * edge2Z - edge1Z * edge2Y;
  const normalY = edge1Z * edge2X - edge1X * edge2Z;
  const normalZ = edge1X * edge2Y - edge1Y * edge2X;
  const comparisonScale = Math.hypot(normalX, normalY, normalZ) *
    Math.hypot(direction[0], direction[1], direction[2]);
  if (
    !Number.isFinite(determinant) ||
    !Number.isFinite(comparisonScale) ||
    comparisonScale === 0 ||
    Math.abs(determinant) <= comparisonScale * 1e-12
  ) {
    return undefined;
  }
  const reciprocal = 1 / determinant;
  const offsetX = origin[0] - first[0];
  const offsetY = origin[1] - first[1];
  const offsetZ = origin[2] - first[2];
  const u = (offsetX * crossX + offsetY * crossY + offsetZ * crossZ) * reciprocal;
  if (u < 0 || u > 1) {
    return undefined;
  }
  const qX = offsetY * edge1Z - offsetZ * edge1Y;
  const qY = offsetZ * edge1X - offsetX * edge1Z;
  const qZ = offsetX * edge1Y - offsetY * edge1X;
  const v = (direction[0] * qX + direction[1] * qY + direction[2] * qZ) * reciprocal;
  if (v < 0 || u + v > 1) {
    return undefined;
  }
  const distance = (edge2X * qX + edge2Y * qY + edge2Z * qZ) * reciprocal;
  return distance >= 0 ? distance : undefined;
}
