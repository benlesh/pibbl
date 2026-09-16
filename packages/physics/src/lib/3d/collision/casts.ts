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
import {
  GEOMETRY_EPSILON_3D,
  MAX_GJK_ITERATIONS_3D,
} from "../numeric-policy.js";
import { requireShapeRecord3D } from "../shape-records.js";
import {
  castSphereAgainstBoxAnalytically,
  castSphereAgainstSphereAnalytically,
  raycastSphereAnalytically,
  type AnalyticCastCandidate3D,
} from "./analytic-casts.js";
import { distanceBetweenPreparedShapes3D } from "./pairs.js";
import {
  prepareConvexShape3D,
  supportShape3D,
  type PreparedBox3D,
  type PreparedConvexShape3D,
} from "./support.js";

const CAST_REFINEMENT_ITERATIONS = 64;
const CAST_HIT_TOLERANCE = 1e-7;
const CAST_TIME_TOLERANCE = 1e-12;

type CastCandidate3D = AnalyticCastCandidate3D;

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
  const maxDistance = requireNonnegativeNumber(
    ray.maxDistance,
    "ray.maxDistance",
  );
  const includeInitialOverlap = options?.includeInitialOverlap === true;
  if (prepared.kind === "sphere") {
    const candidate = raycastSphereAnalytically(
      prepared,
      origin,
      sourceDirection,
      maxDistance,
      includeInitialOverlap,
    );
    return candidate === null ? null : publicHit(candidate, true);
  }

  const box = prepared.kind === "box" ? prepared : boundsBoxFor(prepared);
  const scaledX = sourceDirection[0]! / scale;
  const scaledY = sourceDirection[1]! / scale;
  const scaledZ = sourceDirection[2]! / scale;
  const scaledLength = Math.hypot(scaledX, scaledY, scaledZ);
  const direction = [
    scaledX / scaledLength,
    scaledY / scaledLength,
    scaledZ / scaledLength,
  ] as const;
  if (containsPreparedBoxPoint(box, origin)) {
    return includeInitialOverlap
      ? publicHit({
          pointX: origin[0]!,
          pointY: origin[1]!,
          pointZ: origin[2]!,
          normalX: -direction[0],
          normalY: -direction[1],
          normalZ: -direction[2],
          distance: 0,
          timeOfImpact: 0,
        })
      : null;
  }
  if (maxDistance === 0) return null;
  const candidate = raycastBox(box, origin, direction, maxDistance);
  return candidate === null ? null : publicHit(candidate);
}

function boundsBoxFor(shape: PreparedConvexShape3D): PreparedBox3D {
  const point = new Float64Array(3);
  const extents = new Float64Array(3);
  const center = new Float64Array(3);
  for (let axis = 0; axis < 3; axis += 1) {
    const direction = [0, 0, 0];
    direction[axis] = 1;
    supportShape3D(point, shape, direction[0]!, direction[1]!, direction[2]!);
    const maximum = point[axis]!;
    supportShape3D(point, shape, -direction[0]!, -direction[1]!, -direction[2]!);
    const minimum = point[axis]!;
    center[axis] = (minimum + maximum) / 2;
    extents[axis] = Math.max((maximum - minimum) / 2, GEOMETRY_EPSILON_3D);
  }
  return {
    kind: "box",
    center,
    axes: new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    halfExtents: extents,
  };
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
  const movingPrepared = prepareConvexShape3D(movingRecord, from);
  const targetPrepared = prepareConvexShape3D(targetRecord, targetPose);
  const includeInitialOverlap = options?.includeInitialOverlap === true;
  const exactAnalytic = movingPrepared.kind === "sphere" &&
    (targetPrepared.kind === "sphere" || targetPrepared.kind === "box");
  let candidate: CastCandidate3D | null;
  if (movingPrepared.kind === "sphere" && targetPrepared.kind === "sphere") {
    candidate = castSphereAgainstSphereAnalytically(
      movingPrepared,
      translation,
      targetPrepared,
      includeInitialOverlap,
    );
  } else if (movingPrepared.kind === "sphere" && targetPrepared.kind === "box") {
    candidate = castSphereAgainstBoxAnalytically(
      movingPrepared,
      translation,
      targetPrepared,
      includeInitialOverlap,
    );
  } else {
    const translationLength = Math.hypot(
      translation[0]!,
      translation[1]!,
      translation[2]!,
    );
    if (!Number.isFinite(translationLength)) return null;
    candidate = conservativelyCast(
      moving,
      from,
      translation,
      translationLength,
      target,
      targetPose,
      includeInitialOverlap,
    );
  }
  return candidate === null ? null : publicHit(candidate, exactAnalytic);
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
      (Math.abs(near - minimum) <= CAST_TIME_TOLERANCE &&
        face < selectedFace)
    ) {
      minimum = near;
      selectedFace = face;
    }
    maximum = Math.min(maximum, far);
    if (minimum > maximum + CAST_TIME_TOLERANCE) return null;
  }
  if (
    minimum < -CAST_TIME_TOLERANCE ||
    minimum > maxDistance + CAST_TIME_TOLERANCE
  ) return null;
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
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance,
    timeOfImpact: distance / maxDistance,
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
  let separatedTime = 0;
  for (
    let iteration = 0;
    iteration < MAX_GJK_ITERATIONS_3D;
    iteration += 1
  ) {
    const distance = sampleTranslatedDistance(
      moving,
      from,
      translation,
      time,
      target,
      targetPose,
    );
    if (distance === null) return null;
    if (distance.separation <= 0) {
      if (time === 0 && !includeInitialOverlap) return null;
      if (time === 0) {
        const normal = unitAgainstMotion(
          distance.normal[0],
          distance.normal[1],
          distance.normal[2],
          translation,
        );
        return candidateFromDistance(
          distance,
          normal,
          translationLength,
          time,
        );
      }
      return refineCrossing(
        moving,
        from,
        translation,
        translationLength,
        target,
        targetPose,
        separatedTime,
        time,
        distance,
      );
    }
    if (translationLength === 0) return null;
    if (distance.separation <= CAST_HIT_TOLERANCE) break;
    const closingSpeed = -(
      distance.normal[0] * translation[0]! +
      distance.normal[1] * translation[1]! +
      distance.normal[2] * translation[2]!
    );
    if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) break;
    const step = distance.separation / closingSpeed;
    if (!Number.isFinite(step) || step <= CAST_TIME_TOLERANCE) break;
    const nextTime = time + step;
    if (
      !Number.isFinite(nextTime) ||
      nextTime <= time ||
      nextTime > 1 + CAST_TIME_TOLERANCE
    ) break;
    separatedTime = time;
    time = Math.min(1, nextTime);
  }
  return refineBoundedTangent(
    moving,
    from,
    translation,
    translationLength,
    target,
    targetPose,
  );
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
  let tangent = sampleTranslatedDistance(
    moving,
    from,
    translation,
    tangentTime,
    target,
    targetPose,
  );
  if (tangent === null) return null;
  for (
    let iteration = 0;
    iteration < CAST_REFINEMENT_ITERATIONS;
    iteration += 1
  ) {
    const middleTime = (minimumTime + maximumTime) / 2;
    const middle = sampleTranslatedDistance(
      moving,
      from,
      translation,
      middleTime,
      target,
      targetPose,
    );
    if (middle === null) return null;
    if (
      middle.separation < tangent.separation ||
      (middle.separation === tangent.separation && middleTime < tangentTime)
    ) {
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
  if (tangent.separation > GEOMETRY_EPSILON_3D) return null;
  let impactTime = tangentTime;
  if (tangent.separation < -GEOMETRY_EPSILON_3D) {
    let separatedTime = 0;
    for (
      let iteration = 0;
      iteration < CAST_REFINEMENT_ITERATIONS;
      iteration += 1
    ) {
      const middleTime = (separatedTime + impactTime) / 2;
      const middle = sampleTranslatedDistance(
        moving,
        from,
        translation,
        middleTime,
        target,
        targetPose,
      );
      if (middle === null) return null;
      if (middle.separation <= 0) {
        impactTime = middleTime;
        tangent = middle;
      } else {
        separatedTime = middleTime;
      }
    }
  }
  const normal = unitAgainstMotion(
    tangent.normal[0],
    tangent.normal[1],
    tangent.normal[2],
    translation,
  );
  return candidateFromDistance(
    tangent,
    normal,
    translationLength,
    impactTime,
  );
}

function refineCrossing(
  moving: CRCPhysicsShape3D,
  from: InternalPose3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: CRCPhysicsShape3D,
  targetPose: InternalPose3D,
  initialSeparatedTime: number,
  initialImpactTime: number,
  initialImpact: ReturnType<typeof distanceBetweenPreparedShapes3D>,
): CastCandidate3D | null {
  let separatedTime = initialSeparatedTime;
  let impactTime = initialImpactTime;
  let impact = initialImpact;
  for (
    let iteration = 0;
    iteration < CAST_REFINEMENT_ITERATIONS;
    iteration += 1
  ) {
    const middleTime = (separatedTime + impactTime) / 2;
    const middle = sampleTranslatedDistance(
      moving,
      from,
      translation,
      middleTime,
      target,
      targetPose,
    );
    if (middle === null) return null;
    if (middle.separation <= 0) {
      impactTime = middleTime;
      impact = middle;
    } else {
      separatedTime = middleTime;
    }
  }
  const normal = unitAgainstMotion(
    impact.normal[0],
    impact.normal[1],
    impact.normal[2],
    translation,
  );
  return candidateFromDistance(
    impact,
    normal,
    translationLength,
    impactTime,
  );
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
    normalX: normal[0],
    normalY: normal[1],
    normalZ: normal[2],
    distance: translationLength * timeOfImpact,
    timeOfImpact,
  };
}

function prepareShape(
  shape: CRCPhysicsShape3D,
  publicPose: CRCPhysicsPose3D,
  path: string,
): PreparedConvexShape3D {
  return prepareConvexShape3D(
    requireShapeRecord3D(shape),
    copyPose3D(publicPose, path),
  );
}

function containsPreparedBoxPoint(
  shape: PreparedBox3D,
  point: ArrayLike<number>,
): boolean {
  const dx = point[0]! - shape.center[0]!;
  const dy = point[1]! - shape.center[1]!;
  const dz = point[2]! - shape.center[2]!;
  for (let axis = 0; axis < 3; axis += 1) {
    const local =
      dx * shape.axes[axis * 3]! +
      dy * shape.axes[axis * 3 + 1]! +
      dz * shape.axes[axis * 3 + 2]!;
    if (
      Math.abs(local) >
      shape.halfExtents[axis]! + GEOMETRY_EPSILON_3D
    ) return false;
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
  if (Number.isFinite(length) && length > 0) {
    const unit = [x / length, y / length, z / length] as const;
    return dot(unit, motion) > 0
      ? [-unit[0], -unit[1], -unit[2]]
      : unit;
  }
  const motionLength = Math.hypot(motion[0]!, motion[1]!, motion[2]!);
  return Number.isFinite(motionLength) && motionLength > 0
    ? [
        -motion[0]! / motionLength,
        -motion[1]! / motionLength,
        -motion[2]! / motionLength,
      ]
    : [1, 0, 0];
}

function internalPoseAsPublic(pose: InternalPose3D): CRCPhysicsPose3D {
  return {
    position: [pose.position[0]!, pose.position[1]!, pose.position[2]!],
    orientation: [
      pose.orientation[0]!,
      pose.orientation[1]!,
      pose.orientation[2]!,
      pose.orientation[3]!,
    ],
  };
}

function isFiniteDistance(
  distance: ReturnType<typeof distanceBetweenPreparedShapes3D>,
): boolean {
  return [
    distance.separation,
    ...distance.pointOnFirst,
    ...distance.pointOnSecond,
    ...distance.normal,
  ].every(Number.isFinite);
}

function publicHit(
  candidate: CastCandidate3D,
  preserveExactScale = false,
): CRCPhysicsShapeHit3D | null {
  if (![
    candidate.pointX,
    candidate.pointY,
    candidate.pointZ,
    candidate.normalX,
    candidate.normalY,
    candidate.normalZ,
    candidate.distance,
    candidate.timeOfImpact,
  ].every(Number.isFinite)) return null;
  return Object.freeze({
    point: freezeCastVector3(
      candidate.pointX,
      candidate.pointY,
      candidate.pointZ,
      preserveExactScale,
    ),
    normal: freezeCastVector3(
      candidate.normalX,
      candidate.normalY,
      candidate.normalZ,
      preserveExactScale,
    ),
    distance: cleanZero(candidate.distance),
    timeOfImpact: cleanZero(candidate.timeOfImpact),
  });
}

function freezeCastVector3(
  x: number,
  y: number,
  z: number,
  preserveExactScale: boolean,
): CRCPhysicsVector3 {
  const clean = preserveExactScale
    ? cleanZero
    : (value: number): number =>
        Math.abs(value) <= Number.EPSILON ? 0 : value;
  return Object.freeze([clean(x), clean(y), clean(z)] as const);
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! +
    first[1]! * second[1]! +
    first[2]! * second[2]!;
}
