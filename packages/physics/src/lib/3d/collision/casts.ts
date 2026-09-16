import type {
  CRCPhysicsPose3D,
  CRCPhysicsRay3D,
  CRCPhysicsShape3D,
  CRCPhysicsShapeHit3D,
  CRCPhysicsVector3,
} from "../../../3d-geometry.js";
import { requireNonnegativeNumber } from "../../shared/validation.js";
import {
  cleanZero,
  copyFiniteVector3,
  copyPose3D,
  type InternalPose3D,
} from "../math.js";
import { GEOMETRY_EPSILON_3D, MAX_GJK_ITERATIONS_3D } from "../numeric-policy.js";
import { requireShapeRecord3D } from "../shape-records.js";
import { distanceBetweenPreparedShapes3D } from "./pairs.js";
import { freezeCollisionVector3 } from "./manifold.js";
import {
  prepareConvexShape3D,
  type PreparedBox3D,
  type PreparedConvexShape3D,
  type PreparedSphere3D,
} from "./support.js";

const CAST_REFINEMENT_ITERATIONS = 64;
const CAST_HIT_TOLERANCE = 1e-7;
const CAST_TIME_TOLERANCE = 1e-12;

interface CastCandidate3D {
  readonly pointX: number;
  readonly pointY: number;
  readonly pointZ: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
  readonly distance: number;
  readonly timeOfImpact: number;
}

export function raycastShape3D(
  shape: CRCPhysicsShape3D,
  publicPose: CRCPhysicsPose3D,
  ray: CRCPhysicsRay3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null {
  const prepared = prepareShape(shape, publicPose, "pose");
  const origin = copyFiniteVector3(ray.origin, "ray.origin");
  const sourceDirection = copyFiniteVector3(ray.direction, "ray.direction");
  const scale = Math.max(
    Math.abs(sourceDirection[0]!),
    Math.abs(sourceDirection[1]!),
    Math.abs(sourceDirection[2]!),
  );
  if (scale === 0) throw new RangeError("ray.direction must be non-zero.");
  const scaledX = sourceDirection[0]! / scale;
  const scaledY = sourceDirection[1]! / scale;
  const scaledZ = sourceDirection[2]! / scale;
  const scaledLength = Math.hypot(scaledX, scaledY, scaledZ);
  const direction = [
    scaledX / scaledLength,
    scaledY / scaledLength,
    scaledZ / scaledLength,
  ] as const;
  const maxDistance = requireNonnegativeNumber(ray.maxDistance, "ray.maxDistance");
  if (containsPreparedPoint(prepared, origin)) {
    return options?.includeInitialOverlap === true
      ? publicHit({
          pointX: origin[0]!, pointY: origin[1]!, pointZ: origin[2]!,
          normalX: -direction[0], normalY: -direction[1], normalZ: -direction[2],
          distance: 0,
          timeOfImpact: 0,
        })
      : null;
  }
  if (maxDistance === 0) return null;
  const candidate = prepared.kind === "sphere"
    ? raycastSphere(prepared, origin, direction, maxDistance)
    : raycastBox(prepared, origin, direction, maxDistance);
  return candidate === null ? null : publicHit(candidate);
}

export function shapeCastAgainstShape3D(
  moving: CRCPhysicsShape3D,
  publicFrom: CRCPhysicsPose3D,
  publicTranslation: CRCPhysicsVector3,
  target: CRCPhysicsShape3D,
  publicTargetPose: CRCPhysicsPose3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null {
  const from = copyPose3D(publicFrom, "from");
  const translation = copyFiniteVector3(publicTranslation, "translation");
  const targetPose = copyPose3D(publicTargetPose, "targetPose");
  const movingRecord = requireShapeRecord3D(moving);
  const targetRecord = requireShapeRecord3D(target);
  const translationLength = Math.hypot(translation[0]!, translation[1]!, translation[2]!);
  if (!Number.isFinite(translationLength)) {
    throw new RangeError("translation magnitude must be finite.");
  }
  const movingPrepared = prepareConvexShape3D(movingRecord, from);
  const targetPrepared = prepareConvexShape3D(targetRecord, targetPose);
  const includeInitialOverlap = options?.includeInitialOverlap === true;
  const candidate = movingPrepared.kind === "sphere" && targetPrepared.kind === "sphere"
    ? castSphereAgainstSphere(
        movingPrepared,
        translation,
        translationLength,
        targetPrepared,
        includeInitialOverlap,
      )
    : conservativelyCast(
        moving,
        from,
        translation,
        translationLength,
        target,
        targetPose,
        includeInitialOverlap,
      );
  return candidate === null ? null : publicHit(candidate);
}

function raycastSphere(
  sphere: PreparedSphere3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const relativeX = origin[0]! - sphere.center[0]!;
  const relativeY = origin[1]! - sphere.center[1]!;
  const relativeZ = origin[2]! - sphere.center[2]!;
  const projection = relativeX * direction[0]! + relativeY * direction[1]! + relativeZ * direction[2]!;
  const discriminant = projection * projection -
    (relativeX * relativeX + relativeY * relativeY + relativeZ * relativeZ - sphere.radius ** 2);
  if (discriminant < -GEOMETRY_EPSILON_3D) return null;
  const distance = -projection - Math.sqrt(Math.max(0, discriminant));
  if (distance < -CAST_TIME_TOLERANCE || distance > maxDistance + CAST_TIME_TOLERANCE) return null;
  const boundedDistance = Math.max(0, Math.min(maxDistance, distance));
  const pointX = origin[0]! + direction[0]! * boundedDistance;
  const pointY = origin[1]! + direction[1]! * boundedDistance;
  const pointZ = origin[2]! + direction[2]! * boundedDistance;
  const normal = unitAgainstMotion(
    pointX - sphere.center[0]!,
    pointY - sphere.center[1]!,
    pointZ - sphere.center[2]!,
    direction,
  );
  return {
    pointX, pointY, pointZ,
    normalX: normal[0], normalY: normal[1], normalZ: normal[2],
    distance: boundedDistance,
    timeOfImpact: boundedDistance / maxDistance,
  };
}

function raycastBox(
  box: PreparedBox3D,
  origin: ArrayLike<number>,
  direction: ArrayLike<number>,
  maxDistance: number,
): CastCandidate3D | null {
  const offsetX = origin[0]! - box.center[0]!;
  const offsetY = origin[1]! - box.center[1]!;
  const offsetZ = origin[2]! - box.center[2]!;
  let minimum = 0;
  let maximum = maxDistance;
  let selectedFace = Number.POSITIVE_INFINITY;
  for (let axis = 0; axis < 3; axis += 1) {
    const originLocal =
      offsetX * box.axes[axis * 3]! +
      offsetY * box.axes[axis * 3 + 1]! +
      offsetZ * box.axes[axis * 3 + 2]!;
    const directionLocal =
      direction[0]! * box.axes[axis * 3]! +
      direction[1]! * box.axes[axis * 3 + 1]! +
      direction[2]! * box.axes[axis * 3 + 2]!;
    if (Math.abs(directionLocal) <= GEOMETRY_EPSILON_3D) {
      if (Math.abs(originLocal) > box.halfExtents[axis]!) return null;
      continue;
    }
    let near = (-box.halfExtents[axis]! - originLocal) / directionLocal;
    let far = (box.halfExtents[axis]! - originLocal) / directionLocal;
    let nearSign = -1;
    if (near > far) {
      [near, far] = [far, near];
      nearSign = 1;
    }
    const face = axis * 2 + (nearSign > 0 ? 1 : 0);
    if (
      near > minimum + CAST_TIME_TOLERANCE ||
      (Math.abs(near - minimum) <= CAST_TIME_TOLERANCE && face < selectedFace)
    ) {
      minimum = near;
      selectedFace = face;
    }
    maximum = Math.min(maximum, far);
    if (minimum > maximum + CAST_TIME_TOLERANCE) return null;
  }
  if (minimum < -CAST_TIME_TOLERANCE || minimum > maxDistance + CAST_TIME_TOLERANCE) return null;
  const distance = Math.max(0, Math.min(maxDistance, minimum));
  const axis = Math.floor(selectedFace / 2);
  const sign = (selectedFace & 1) === 0 ? -1 : 1;
  const normal = [
    sign * box.axes[axis * 3]!,
    sign * box.axes[axis * 3 + 1]!,
    sign * box.axes[axis * 3 + 2]!,
  ] as const;
  return {
    pointX: origin[0]! + direction[0]! * distance,
    pointY: origin[1]! + direction[1]! * distance,
    pointZ: origin[2]! + direction[2]! * distance,
    normalX: normal[0], normalY: normal[1], normalZ: normal[2],
    distance,
    timeOfImpact: distance / maxDistance,
  };
}

function castSphereAgainstSphere(
  moving: PreparedSphere3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: PreparedSphere3D,
  includeInitialOverlap: boolean,
): CastCandidate3D | null {
  const relativeX = moving.center[0]! - target.center[0]!;
  const relativeY = moving.center[1]! - target.center[1]!;
  const relativeZ = moving.center[2]! - target.center[2]!;
  const radius = moving.radius + target.radius;
  if (relativeX ** 2 + relativeY ** 2 + relativeZ ** 2 <= radius ** 2) {
    if (!includeInitialOverlap) return null;
    const normal = unitAgainstMotion(relativeX, relativeY, relativeZ, translation);
    return {
      pointX: target.center[0]! + normal[0] * target.radius,
      pointY: target.center[1]! + normal[1] * target.radius,
      pointZ: target.center[2]! + normal[2] * target.radius,
      normalX: normal[0], normalY: normal[1], normalZ: normal[2],
      distance: 0,
      timeOfImpact: 0,
    };
  }
  if (translationLength === 0) return null;
  const a = translationLength ** 2;
  const b = 2 * (relativeX * translation[0]! + relativeY * translation[1]! + relativeZ * translation[2]!);
  const c = relativeX ** 2 + relativeY ** 2 + relativeZ ** 2 - radius ** 2;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -GEOMETRY_EPSILON_3D) return null;
  const time = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  if (time < -CAST_TIME_TOLERANCE || time > 1 + CAST_TIME_TOLERANCE) return null;
  const timeOfImpact = Math.max(0, Math.min(1, time));
  const movingX = moving.center[0]! + translation[0]! * timeOfImpact;
  const movingY = moving.center[1]! + translation[1]! * timeOfImpact;
  const movingZ = moving.center[2]! + translation[2]! * timeOfImpact;
  const normal = unitAgainstMotion(
    movingX - target.center[0]!,
    movingY - target.center[1]!,
    movingZ - target.center[2]!,
    translation,
  );
  return {
    pointX: target.center[0]! + normal[0] * target.radius,
    pointY: target.center[1]! + normal[1] * target.radius,
    pointZ: target.center[2]! + normal[2] * target.radius,
    normalX: normal[0], normalY: normal[1], normalZ: normal[2],
    distance: translationLength * timeOfImpact,
    timeOfImpact,
  };
}

function conservativelyCast(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
  includeInitialOverlap: boolean,
): CastCandidate3D | null {
  let time = 0;
  for (let iteration = 0; iteration < MAX_GJK_ITERATIONS_3D; iteration += 1) {
    const distance = sampleTranslatedDistance(moving, from, translation, time, target, targetPose);
    if (distance === null) return null;
    if (distance.separation <= (time === 0 ? 0 : CAST_HIT_TOLERANCE)) {
      if (time === 0 && !includeInitialOverlap) return null;
      const normal = unitAgainstMotion(distance.normal[0], distance.normal[1], distance.normal[2], translation);
      return candidateFromDistance(distance, normal, translationLength, time);
    }
    if (translationLength === 0) return null;
    const closingSpeed = -(
      distance.normal[0] * translation[0]! +
      distance.normal[1] * translation[1]! +
      distance.normal[2] * translation[2]!
    );
    if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) break;
    const step = distance.separation / closingSpeed;
    if (!Number.isFinite(step) || step <= CAST_TIME_TOLERANCE) break;
    const nextTime = time + step;
    if (!Number.isFinite(nextTime) || nextTime <= time || nextTime > 1 + CAST_TIME_TOLERANCE) break;
    time = Math.min(1, nextTime);
  }
  return refineBoundedTangent(moving, from, translation, translationLength, target, targetPose);
}

function refineBoundedTangent(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
): CastCandidate3D | null {
  let minimumTime = 0;
  let maximumTime = 1;
  let tangentTime = 0;
  let tangent = sampleTranslatedDistance(moving, from, translation, tangentTime, target, targetPose);
  if (tangent === null) return null;
  for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
    const middleTime = (minimumTime + maximumTime) / 2;
    const middle = sampleTranslatedDistance(moving, from, translation, middleTime, target, targetPose);
    if (middle === null) return null;
    if (middle.separation < tangent.separation) {
      tangentTime = middleTime;
      tangent = middle;
    }
    const derivative =
      middle.normal[0] * translation[0]! +
      middle.normal[1] * translation[1]! +
      middle.normal[2] * translation[2]!;
    if (!Number.isFinite(derivative)) return null;
    if (derivative < 0) minimumTime = middleTime;
    else maximumTime = middleTime;
  }
  if (tangent.separation > CAST_HIT_TOLERANCE) return null;
  let impactTime = tangentTime;
  if (tangent.separation < 0) {
    let separatedTime = 0;
    for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
      const middleTime = (separatedTime + impactTime) / 2;
      const middle = sampleTranslatedDistance(moving, from, translation, middleTime, target, targetPose);
      if (middle === null) return null;
      if (middle.separation <= CAST_HIT_TOLERANCE) {
        impactTime = middleTime;
        tangent = middle;
      } else {
        separatedTime = middleTime;
      }
    }
  }
  const normal = unitAgainstMotion(tangent.normal[0], tangent.normal[1], tangent.normal[2], translation);
  return candidateFromDistance(tangent, normal, translationLength, impactTime);
}

function sampleTranslatedDistance(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  time: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
): ReturnType<typeof distanceBetweenPreparedShapes3D> | null {
  try {
    const distance = distanceBetweenPreparedShapes3D(
      moving,
      internalPoseAsPublic({
        position: new Float64Array([
          from.position[0]! + translation[0]! * time,
          from.position[1]! + translation[1]! * time,
          from.position[2]! + translation[2]! * time,
        ]),
        orientation: from.orientation,
      }),
      target,
      internalPoseAsPublic(targetPose),
    );
    return isFiniteDistance(distance) ? distance : null;
  } catch {
    return null;
  }
}

function candidateFromDistance(
  distance: ReturnType<typeof distanceBetweenPreparedShapes3D>,
  normal: readonly [number, number, number],
  translationLength: number,
  timeOfImpact: number,
): CastCandidate3D {
  return {
    pointX: distance.pointOnSecond[0],
    pointY: distance.pointOnSecond[1],
    pointZ: distance.pointOnSecond[2],
    normalX: normal[0], normalY: normal[1], normalZ: normal[2],
    distance: translationLength * timeOfImpact,
    timeOfImpact,
  };
}

function prepareShape(
  shape: CRCPhysicsShape3D,
  publicPose: CRCPhysicsPose3D,
  path: string,
): PreparedConvexShape3D {
  return prepareConvexShape3D(requireShapeRecord3D(shape), copyPose3D(publicPose, path));
}

function containsPreparedPoint(shape: PreparedConvexShape3D, point: ArrayLike<number>): boolean {
  if (shape.kind === "sphere") {
    return Math.hypot(
      point[0]! - shape.center[0]!,
      point[1]! - shape.center[1]!,
      point[2]! - shape.center[2]!,
    ) <= shape.radius + GEOMETRY_EPSILON_3D;
  }
  const dx = point[0]! - shape.center[0]!;
  const dy = point[1]! - shape.center[1]!;
  const dz = point[2]! - shape.center[2]!;
  for (let axis = 0; axis < 3; axis += 1) {
    const local = dx * shape.axes[axis * 3]! + dy * shape.axes[axis * 3 + 1]! + dz * shape.axes[axis * 3 + 2]!;
    if (Math.abs(local) > shape.halfExtents[axis]! + GEOMETRY_EPSILON_3D) return false;
  }
  return true;
}

function unitAgainstMotion(
  x: number,
  y: number,
  z: number,
  motion: ArrayLike<number>,
): readonly [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (length > GEOMETRY_EPSILON_3D) {
    const unit = [x / length, y / length, z / length] as const;
    return dot(unit, motion) > 0 ? [-unit[0], -unit[1], -unit[2]] : unit;
  }
  const motionLength = Math.hypot(motion[0]!, motion[1]!, motion[2]!);
  return motionLength > GEOMETRY_EPSILON_3D
    ? [-motion[0]! / motionLength, -motion[1]! / motionLength, -motion[2]! / motionLength]
    : [1, 0, 0];
}

function internalPoseAsPublic(pose: InternalPose3D): CRCPhysicsPose3D {
  return {
    position: [pose.position[0]!, pose.position[1]!, pose.position[2]!],
    orientation: [
      pose.orientation[0]!, pose.orientation[1]!, pose.orientation[2]!, pose.orientation[3]!,
    ],
  };
}

function isFiniteDistance(distance: ReturnType<typeof distanceBetweenPreparedShapes3D>): boolean {
  return [
    distance.separation,
    ...distance.pointOnFirst,
    ...distance.pointOnSecond,
    ...distance.normal,
  ].every(Number.isFinite);
}

function publicHit(candidate: CastCandidate3D): CRCPhysicsShapeHit3D {
  return Object.freeze({
    point: freezeCollisionVector3(candidate.pointX, candidate.pointY, candidate.pointZ),
    normal: freezeCollisionVector3(candidate.normalX, candidate.normalY, candidate.normalZ),
    distance: cleanZero(candidate.distance),
    timeOfImpact: cleanZero(candidate.timeOfImpact),
  });
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!;
}
