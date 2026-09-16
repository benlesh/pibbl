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
import { distanceSphereToBox3D } from "./analytic.js";
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
  if (!Number.isFinite(translationLength)) return null;
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
    : movingPrepared.kind === "sphere" && targetPrepared.kind === "box"
      ? castSphereAgainstBox(
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

function castSphereAgainstBox(
  moving: PreparedSphere3D,
  translation: ArrayLike<number>,
  translationLength: number,
  target: PreparedBox3D,
  includeInitialOverlap: boolean,
): CastCandidate3D | null {
  const initial = distanceSphereToBox3D(
    moving.center,
    moving.radius,
    target.center,
    target.axes,
    target.halfExtents,
  );
  if (initial.separation <= 0) {
    if (!includeInitialOverlap) return null;
    const normal = unitAgainstMotion(
      initial.normal[0],
      initial.normal[1],
      initial.normal[2],
      translation,
    );
    return {
      pointX: initial.second[0],
      pointY: initial.second[1],
      pointZ: initial.second[2],
      normalX: normal[0],
      normalY: normal[1],
      normalZ: normal[2],
      distance: 0,
      timeOfImpact: 0,
    };
  }
  if (translationLength === 0) return null;
  const offset = [
    moving.center[0]! - target.center[0]!,
    moving.center[1]! - target.center[1]!,
    moving.center[2]! - target.center[2]!,
  ] as const;
  const localOrigin = [0, 1, 2].map((axis) =>
    offset[0] * target.axes[axis * 3]! +
    offset[1] * target.axes[axis * 3 + 1]! +
    offset[2] * target.axes[axis * 3 + 2]!,
  );
  const localTranslation = [0, 1, 2].map((axis) =>
    translation[0]! * target.axes[axis * 3]! +
    translation[1]! * target.axes[axis * 3 + 1]! +
    translation[2]! * target.axes[axis * 3 + 2]!,
  );
  if (![...localOrigin, ...localTranslation].every(Number.isFinite)) return null;

  let selected: CastCandidate3D | null = null;
  let selectedFeature = Number.POSITIVE_INFINITY;
  const consider = (
    time: number,
    localPoint: readonly [number, number, number],
    localNormal: readonly [number, number, number],
    feature: number,
  ): void => {
    if (time < -CAST_TIME_TOLERANCE || time > 1 + CAST_TIME_TOLERANCE) return;
    const boundedTime = Math.max(0, Math.min(1, time));
    const center = localPositionAt(localOrigin, localTranslation, boundedTime);
    if (!sphereTouchesLocalBoxBoundary(center, target.halfExtents, moving.radius)) return;
    if (
      selected !== null &&
      (boundedTime > selected.timeOfImpact + CAST_TIME_TOLERANCE ||
        (Math.abs(boundedTime - selected.timeOfImpact) <= CAST_TIME_TOLERANCE &&
          feature >= selectedFeature))
    ) return;
    const point = boxLocalPointToWorld(target, localPoint);
    const normal = boxLocalVectorToWorld(target, localNormal);
    selected = {
      pointX: point[0],
      pointY: point[1],
      pointZ: point[2],
      normalX: normal[0],
      normalY: normal[1],
      normalZ: normal[2],
      distance: translationLength * boundedTime,
      timeOfImpact: boundedTime,
    };
    selectedFeature = feature;
  };

  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(localTranslation[axis]!) <= GEOMETRY_EPSILON_3D) continue;
    for (const sign of [-1, 1] as const) {
      const time = (
        sign * (target.halfExtents[axis]! + moving.radius) - localOrigin[axis]!
      ) / localTranslation[axis]!;
      const center = localPositionAt(localOrigin, localTranslation, time);
      const otherAxes = [0, 1, 2].filter((candidate) => candidate !== axis);
      if (otherAxes.some((other) => Math.abs(center[other]!) > target.halfExtents[other]!)) continue;
      const point = [...center] as [number, number, number];
      const normal = [0, 0, 0] as [number, number, number];
      point[axis] = sign * target.halfExtents[axis]!;
      normal[axis] = sign;
      consider(time, point, normal, axis * 2 + (sign > 0 ? 1 : 0));
    }
  }

  let edgeFeature = 6;
  for (let edgeAxis = 0; edgeAxis < 3; edgeAxis += 1) {
    const fixedAxes = [0, 1, 2].filter((axis) => axis !== edgeAxis);
    for (const firstSign of [-1, 1] as const) {
      for (const secondSign of [-1, 1] as const) {
        const firstAxis = fixedAxes[0]!;
        const secondAxis = fixedAxes[1]!;
        const firstOffset = localOrigin[firstAxis]! - firstSign * target.halfExtents[firstAxis]!;
        const secondOffset = localOrigin[secondAxis]! - secondSign * target.halfExtents[secondAxis]!;
        const roots = scaledSweepRoots(
          [firstOffset, secondOffset],
          [localTranslation[firstAxis]!, localTranslation[secondAxis]!],
          moving.radius,
        );
        for (const time of roots ?? []) {
          const center = localPositionAt(localOrigin, localTranslation, time);
          if (Math.abs(center[edgeAxis]!) > target.halfExtents[edgeAxis]!) continue;
          const normal = [0, 0, 0] as [number, number, number];
          const firstDelta = center[firstAxis]! - firstSign * target.halfExtents[firstAxis]!;
          const secondDelta = center[secondAxis]! - secondSign * target.halfExtents[secondAxis]!;
          if (
            firstDelta * firstSign < -GEOMETRY_EPSILON_3D ||
            secondDelta * secondSign < -GEOMETRY_EPSILON_3D
          ) continue;
          const length = Math.hypot(firstDelta, secondDelta);
          if (
            length <= GEOMETRY_EPSILON_3D ||
            !isSphereBoundaryDistance(length, moving.radius)
          ) continue;
          normal[firstAxis] = firstDelta / length;
          normal[secondAxis] = secondDelta / length;
          const point = [...center] as [number, number, number];
          point[firstAxis] = firstSign * target.halfExtents[firstAxis]!;
          point[secondAxis] = secondSign * target.halfExtents[secondAxis]!;
          consider(time, point, normal, edgeFeature);
          break;
        }
        edgeFeature += 1;
      }
    }
  }

  for (let vertex = 0; vertex < 8; vertex += 1) {
    const point = [
      (vertex & 1) === 0 ? -target.halfExtents[0]! : target.halfExtents[0]!,
      (vertex & 2) === 0 ? -target.halfExtents[1]! : target.halfExtents[1]!,
      (vertex & 4) === 0 ? -target.halfExtents[2]! : target.halfExtents[2]!,
    ] as const;
    const roots = scaledSweepRoots(
      [
        localOrigin[0]! - point[0],
        localOrigin[1]! - point[1],
        localOrigin[2]! - point[2],
      ],
      localTranslation,
      moving.radius,
    );
    for (const time of roots ?? []) {
      const center = localPositionAt(localOrigin, localTranslation, time);
      const dx = center[0]! - point[0];
      const dy = center[1]! - point[1];
      const dz = center[2]! - point[2];
      if (
        dx * ((vertex & 1) === 0 ? -1 : 1) < -GEOMETRY_EPSILON_3D ||
        dy * ((vertex & 2) === 0 ? -1 : 1) < -GEOMETRY_EPSILON_3D ||
        dz * ((vertex & 4) === 0 ? -1 : 1) < -GEOMETRY_EPSILON_3D
      ) continue;
      const length = Math.hypot(dx, dy, dz);
      if (
        length <= GEOMETRY_EPSILON_3D ||
        !isSphereBoundaryDistance(length, moving.radius)
      ) continue;
      consider(time, point, [dx / length, dy / length, dz / length], 18 + vertex);
      break;
    }
  }
  return selected;
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
  const roots = scaledSweepRoots(
    [relativeX, relativeY, relativeZ],
    [direction[0]!, direction[1]!, direction[2]!],
    sphere.radius,
  );
  if (roots === null) return null;
  const distance = roots.find((root) =>
    root >= -CAST_TIME_TOLERANCE && root <= maxDistance + CAST_TIME_TOLERANCE,
  );
  if (distance === undefined) return null;
  const boundedDistance = validateSphereSweepEntry(
    [relativeX, relativeY, relativeZ],
    [direction[0]!, direction[1]!, direction[2]!],
    sphere.radius,
    Math.max(0, Math.min(maxDistance, distance)),
  );
  if (boundedDistance === null || boundedDistance > maxDistance) return null;
  const hitOffset = [
    relativeX + direction[0]! * boundedDistance,
    relativeY + direction[1]! * boundedDistance,
    relativeZ + direction[2]! * boundedDistance,
  ] as const;
  const pointX = origin[0]! + direction[0]! * boundedDistance;
  const pointY = origin[1]! + direction[1]! * boundedDistance;
  const pointZ = origin[2]! + direction[2]! * boundedDistance;
  const normal = unitAgainstMotion(
    hitOffset[0],
    hitOffset[1],
    hitOffset[2],
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
  const initialDistance = Math.hypot(relativeX, relativeY, relativeZ);
  if (!Number.isFinite(initialDistance)) return null;
  if (initialDistance <= radius) {
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
  const roots = scaledSweepRoots(
    [relativeX, relativeY, relativeZ],
    [translation[0]!, translation[1]!, translation[2]!],
    radius,
  );
  if (roots === null) return null;
  const time = roots.find((root) => root >= -CAST_TIME_TOLERANCE);
  if (time === undefined) return null;
  if (time < -CAST_TIME_TOLERANCE || time > 1 + CAST_TIME_TOLERANCE) return null;
  const timeOfImpact = validateSphereSweepEntry(
    [relativeX, relativeY, relativeZ],
    [translation[0]!, translation[1]!, translation[2]!],
    radius,
    Math.max(0, Math.min(1, time)),
  );
  if (timeOfImpact === null || timeOfImpact > 1) return null;
  const impactOffset = [
    relativeX + translation[0]! * timeOfImpact,
    relativeY + translation[1]! * timeOfImpact,
    relativeZ + translation[2]! * timeOfImpact,
  ] as const;
  const normal = unitAgainstMotion(
    impactOffset[0],
    impactOffset[1],
    impactOffset[2],
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
  let separatedTime = 0;
  for (let iteration = 0; iteration < MAX_GJK_ITERATIONS_3D; iteration += 1) {
    const distance = sampleTranslatedDistance(moving, from, translation, time, target, targetPose);
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
        return candidateFromDistance(distance, normal, translationLength, time);
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
    if (!Number.isFinite(nextTime) || nextTime <= time || nextTime > 1 + CAST_TIME_TOLERANCE) break;
    separatedTime = time;
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
    for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
      const middleTime = (separatedTime + impactTime) / 2;
      const middle = sampleTranslatedDistance(moving, from, translation, middleTime, target, targetPose);
      if (middle === null) return null;
      if (middle.separation <= 0) {
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
  for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
    const middleTime = (separatedTime + impactTime) / 2;
    const middle = sampleTranslatedDistance(moving, from, translation, middleTime, target, targetPose);
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
  return candidateFromDistance(impact, normal, translationLength, impactTime);
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

function publicHit(candidate: CastCandidate3D): CRCPhysicsShapeHit3D | null {
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
    point: freezeCollisionVector3(candidate.pointX, candidate.pointY, candidate.pointZ),
    normal: freezeCollisionVector3(candidate.normalX, candidate.normalY, candidate.normalZ),
    distance: cleanZero(candidate.distance),
    timeOfImpact: cleanZero(candidate.timeOfImpact),
  });
}

function localPositionAt(
  origin: ArrayLike<number>,
  translation: ArrayLike<number>,
  time: number,
): [number, number, number] {
  return [
    origin[0]! + translation[0]! * time,
    origin[1]! + translation[1]! * time,
    origin[2]! + translation[2]! * time,
  ];
}

function boxLocalPointToWorld(
  box: PreparedBox3D,
  point: ArrayLike<number>,
): readonly [number, number, number] {
  return [
    box.center[0]! + box.axes[0]! * point[0]! + box.axes[3]! * point[1]! + box.axes[6]! * point[2]!,
    box.center[1]! + box.axes[1]! * point[0]! + box.axes[4]! * point[1]! + box.axes[7]! * point[2]!,
    box.center[2]! + box.axes[2]! * point[0]! + box.axes[5]! * point[1]! + box.axes[8]! * point[2]!,
  ];
}

function boxLocalVectorToWorld(
  box: PreparedBox3D,
  vector: ArrayLike<number>,
): readonly [number, number, number] {
  return [
    box.axes[0]! * vector[0]! + box.axes[3]! * vector[1]! + box.axes[6]! * vector[2]!,
    box.axes[1]! * vector[0]! + box.axes[4]! * vector[1]! + box.axes[7]! * vector[2]!,
    box.axes[2]! * vector[0]! + box.axes[5]! * vector[1]! + box.axes[8]! * vector[2]!,
  ];
}

function scaledSweepRoots(
  offset: readonly number[],
  translation: readonly number[],
  radius: number,
): readonly [number, number] | null {
  const scale = Math.max(...offset.map(Math.abs), ...translation.map(Math.abs), radius);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const scaledOffset: number[] = [];
  const scaledTranslation: number[] = [];
  for (let index = 0; index < offset.length; index += 1) {
    scaledOffset.push(offset[index]! / scale);
    scaledTranslation.push(translation[index]! / scale);
  }
  const translationLength = Math.hypot(...scaledTranslation);
  if (!Number.isFinite(translationLength) || translationLength === 0) return null;
  const direction = scaledTranslation.map((value) => value / translationLength);
  const closestDistance = -compensatedDot(scaledOffset, direction);
  const perpendicular = scaledOffset.map((value, index) =>
    value + direction[index]! * closestDistance,
  );
  const perpendicularDistance = Math.hypot(...perpendicular);
  const scaledRadius = radius / scale;
  if (
    !Number.isFinite(closestDistance) ||
    !Number.isFinite(perpendicularDistance) ||
    perpendicularDistance > scaledRadius
  ) return null;
  const halfChord = Math.sqrt(
    (scaledRadius - perpendicularDistance) * (scaledRadius + perpendicularDistance),
  );
  const first = (closestDistance - halfChord) / translationLength;
  const second = (closestDistance + halfChord) / translationLength;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return first <= second ? [first, second] : [second, first];
}

function compensatedDot(first: readonly number[], second: readonly number[]): number {
  let sum = 0;
  let correction = 0;
  for (let index = 0; index < first.length; index += 1) {
    const adjusted = first[index]! * second[index]! - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}

function sphereTouchesLocalBoxBoundary(
  center: ArrayLike<number>,
  halfExtents: ArrayLike<number>,
  radius: number,
): boolean {
  const outsideX = Math.max(0, Math.abs(center[0]!) - halfExtents[0]!);
  const outsideY = Math.max(0, Math.abs(center[1]!) - halfExtents[1]!);
  const outsideZ = Math.max(0, Math.abs(center[2]!) - halfExtents[2]!);
  return isSphereBoundaryDistance(Math.hypot(outsideX, outsideY, outsideZ), radius);
}

function isSphereBoundaryDistance(distance: number, radius: number): boolean {
  if (!Number.isFinite(distance) || distance > radius) return false;
  const tolerance = Math.max(
    GEOMETRY_EPSILON_3D,
    Number.EPSILON * 16 * Math.max(distance, radius),
  );
  return radius - distance <= tolerance;
}

function validateSphereSweepEntry(
  offset: readonly number[],
  translation: readonly number[],
  radius: number,
  candidate: number,
): number | null {
  let time = candidate;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const point = offset.map((value, index) => value + translation[index]! * time);
    const distance = Math.hypot(...point);
    if (isSphereBoundaryDistance(distance, radius)) return time;
    if (!Number.isFinite(distance) || distance < radius) return null;
    time = nextRepresentableUp(time);
  }
  return null;
}

function nextRepresentableUp(value: number): number {
  if (value === Number.POSITIVE_INFINITY) return value;
  if (Object.is(value, -0) || value === 0) return Number.MIN_VALUE;
  const floats = new Float64Array(1);
  const bits = new BigUint64Array(floats.buffer);
  floats[0] = value;
  bits[0] = bits[0]! + (value > 0 ? 1n : -1n);
  return floats[0]!;
}

function dot(first: ArrayLike<number>, second: ArrayLike<number>): number {
  return first[0]! * second[0]! + first[1]! * second[1]! + first[2]! * second[2]!;
}
