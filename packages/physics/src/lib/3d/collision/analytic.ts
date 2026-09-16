import { GEOMETRY_EPSILON_3D } from "../numeric-policy.js";

export interface AnalyticDistance3D {
  readonly separation: number;
  readonly first: readonly [number, number, number];
  readonly second: readonly [number, number, number];
  readonly normal: readonly [number, number, number];
  readonly firstFeature: number;
  readonly secondFeature: number;
}

export function distanceSphereToSphere3D(
  firstCenter: ArrayLike<number>,
  firstRadius: number,
  secondCenter: ArrayLike<number>,
  secondRadius: number,
  fallbackNormal: ArrayLike<number>,
): AnalyticDistance3D {
  const dx = firstCenter[0]! - secondCenter[0]!;
  const dy = firstCenter[1]! - secondCenter[1]!;
  const dz = firstCenter[2]! - secondCenter[2]!;
  const distance = Math.hypot(dx, dy, dz);
  const normal = unitOrFallback(dx, dy, dz, fallbackNormal);
  return {
    separation: distance - firstRadius - secondRadius,
    first: [
      firstCenter[0]! - normal[0] * firstRadius,
      firstCenter[1]! - normal[1] * firstRadius,
      firstCenter[2]! - normal[2] * firstRadius,
    ],
    second: [
      secondCenter[0]! + normal[0] * secondRadius,
      secondCenter[1]! + normal[1] * secondRadius,
      secondCenter[2]! + normal[2] * secondRadius,
    ],
    normal,
    firstFeature: 0,
    secondFeature: 0,
  };
}

export function distancePointToSphere3D(
  point: ArrayLike<number>,
  center: ArrayLike<number>,
  radius: number,
  fallbackNormal: ArrayLike<number>,
): AnalyticDistance3D {
  const dx = point[0]! - center[0]!;
  const dy = point[1]! - center[1]!;
  const dz = point[2]! - center[2]!;
  const distance = Math.hypot(dx, dy, dz);
  const normal = unitOrFallback(dx, dy, dz, fallbackNormal);
  return {
    separation: distance - radius,
    first: [point[0]!, point[1]!, point[2]!],
    second: [
      center[0]! + normal[0] * radius,
      center[1]! + normal[1] * radius,
      center[2]! + normal[2] * radius,
    ],
    normal,
    firstFeature: 0,
    secondFeature: 0,
  };
}

export function distancePointToBox3D(
  point: ArrayLike<number>,
  center: ArrayLike<number>,
  axes: ArrayLike<number>,
  halfExtents: ArrayLike<number>,
): AnalyticDistance3D {
  const offsetX = point[0]! - center[0]!;
  const offsetY = point[1]! - center[1]!;
  const offsetZ = point[2]! - center[2]!;
  const local = [
    offsetX * axes[0]! + offsetY * axes[1]! + offsetZ * axes[2]!,
    offsetX * axes[3]! + offsetY * axes[4]! + offsetZ * axes[5]!,
    offsetX * axes[6]! + offsetY * axes[7]! + offsetZ * axes[8]!,
  ] as const;
  const clamped = [
    clamp(local[0], -halfExtents[0]!, halfExtents[0]!),
    clamp(local[1], -halfExtents[1]!, halfExtents[1]!),
    clamp(local[2], -halfExtents[2]!, halfExtents[2]!),
  ];
  const outside =
    Math.abs(local[0]) > halfExtents[0]! ||
    Math.abs(local[1]) > halfExtents[1]! ||
    Math.abs(local[2]) > halfExtents[2]!;

  if (outside) {
    const second = localToWorld(center, axes, clamped);
    const dx = point[0]! - second[0];
    const dy = point[1]! - second[1];
    const dz = point[2]! - second[2];
    const distance = Math.hypot(dx, dy, dz);
    const normal = unitOrFallback(dx, dy, dz, [1, 0, 0]);
    return {
      separation: distance,
      first: [point[0]!, point[1]!, point[2]!],
      second,
      normal,
      firstFeature: 0,
      secondFeature: vertexFeature(clamped, halfExtents),
    };
  }

  let selectedFeature = 0;
  let selectedDepth = local[0] + halfExtents[0]!;
  const depths = [
    selectedDepth,
    halfExtents[0]! - local[0],
    local[1] + halfExtents[1]!,
    halfExtents[1]! - local[1],
    local[2] + halfExtents[2]!,
    halfExtents[2]! - local[2],
  ];
  for (let feature = 1; feature < depths.length; feature += 1) {
    if (depths[feature]! < selectedDepth - GEOMETRY_EPSILON_3D) {
      selectedFeature = feature;
      selectedDepth = depths[feature]!;
    }
  }
  const axis = Math.floor(selectedFeature / 2);
  const sign = (selectedFeature & 1) === 0 ? -1 : 1;
  clamped[0] = local[0];
  clamped[1] = local[1];
  clamped[2] = local[2];
  clamped[axis] = sign * halfExtents[axis]!;
  const second = localToWorld(center, axes, clamped);
  const normal = [
    cleanZero(sign * axes[axis * 3]!),
    cleanZero(sign * axes[axis * 3 + 1]!),
    cleanZero(sign * axes[axis * 3 + 2]!),
  ] as const;
  return {
    separation: -selectedDepth,
    first: [point[0]!, point[1]!, point[2]!],
    second,
    normal,
    firstFeature: 0,
    secondFeature: selectedFeature,
  };
}

export function distanceSphereToBox3D(
  sphereCenter: ArrayLike<number>,
  radius: number,
  boxCenter: ArrayLike<number>,
  boxAxes: ArrayLike<number>,
  halfExtents: ArrayLike<number>,
): AnalyticDistance3D {
  const point = distancePointToBox3D(sphereCenter, boxCenter, boxAxes, halfExtents);
  return {
    separation: point.separation - radius,
    first: [
      sphereCenter[0]! - point.normal[0] * radius,
      sphereCenter[1]! - point.normal[1] * radius,
      sphereCenter[2]! - point.normal[2] * radius,
    ],
    second: point.second,
    normal: point.normal,
    firstFeature: 0,
    secondFeature: point.secondFeature,
  };
}

function localToWorld(
  center: ArrayLike<number>,
  axes: ArrayLike<number>,
  local: ArrayLike<number>,
): [number, number, number] {
  return [
    center[0]! + axes[0]! * local[0]! + axes[3]! * local[1]! + axes[6]! * local[2]!,
    center[1]! + axes[1]! * local[0]! + axes[4]! * local[1]! + axes[7]! * local[2]!,
    center[2]! + axes[2]! * local[0]! + axes[5]! * local[1]! + axes[8]! * local[2]!,
  ];
}

function vertexFeature(local: ArrayLike<number>, halfExtents: ArrayLike<number>): number {
  return (local[0]! >= halfExtents[0]! ? 1 : 0) |
    (local[1]! >= halfExtents[1]! ? 2 : 0) |
    (local[2]! >= halfExtents[2]! ? 4 : 0);
}

function unitOrFallback(
  x: number,
  y: number,
  z: number,
  fallback: ArrayLike<number>,
): readonly [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (length > GEOMETRY_EPSILON_3D) return [x / length, y / length, z / length];
  const fallbackLength = Math.hypot(fallback[0]!, fallback[1]!, fallback[2]!);
  return fallbackLength > GEOMETRY_EPSILON_3D
    ? [fallback[0]! / fallbackLength, fallback[1]! / fallbackLength, fallback[2]! / fallbackLength]
    : [1, 0, 0];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function cleanZero(value: number): number {
  return value === 0 ? 0 : value;
}
