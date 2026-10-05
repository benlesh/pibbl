import type {
  PibblPhysicsDistance2D,
  PibblPhysicsPose2D,
  PibblPhysicsRay2D,
  PibblPhysicsShape2D,
  PibblPhysicsShapeHit2D,
  PibblPhysicsVector2,
} from '../../../2d-geometry.js';
import {
  copyFiniteVector2,
  requireNonnegativeNumber,
} from '../../shared/validation.js';
import {
  IDENTITY_POSE_2D,
  composePose2D,
  copyPose2D,
  transformPointInto,
  type InternalPose2D,
} from '../math.js';
import { GEOMETRY_EPSILON } from '../numeric-policy.js';
import {
  createShape2D,
  requireShapeRecord2D,
  type CircleLeaf2D,
  type ConvexLeaf2D,
  type ShapeRecord2D,
} from '../shape-records.js';
import { distancePointToSegment2D } from './analytic.js';
import {
  containsPointInShape2D,
  distanceBetweenPreparedShapes2D,
} from './pairs.js';

const CAST_MAX_ITERATIONS = 32;
const CAST_REFINEMENT_ITERATIONS = 64;
const CAST_HIT_TOLERANCE = 1e-7;
const CAST_TIME_TOLERANCE = 1e-12;

interface CastCandidate2D {
  readonly leafKey: readonly [number, number];
  readonly pointX: number;
  readonly pointY: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly distance: number;
  readonly timeOfImpact: number;
}

interface PreparedCastShape2D {
  readonly record: ShapeRecord2D;
  readonly pose: InternalPose2D;
}

/**
 * Casts a ray against one posed shape and returns its first hit or null.
 *
 * @param shape - Shape to intersect. See {@link PibblPhysicsShape2D}.
 * @param publicPose - Target shape pose. See {@link PibblPhysicsPose2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link PibblPhysicsRay2D}.
 * @param options - Whether initial overlap counts as a hit.
 * @returns The first shape hit, or null when there is no hit. See {@link PibblPhysicsShapeHit2D}.
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsRay2D}
 * @see {@link PibblPhysicsShapeHit2D}
 */
export function raycastShape2D(
  shape: PibblPhysicsShape2D,
  publicPose: PibblPhysicsPose2D,
  ray: PibblPhysicsRay2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): PibblPhysicsShapeHit2D | null {
  const prepared = prepareShape(shape, publicPose, 'pose');
  const origin = copyFiniteVector2(ray.origin, 'ray.origin');
  const sourceDirection = copyFiniteVector2(ray.direction, 'ray.direction');
  const directionScale = Math.max(
    Math.abs(sourceDirection[0]),
    Math.abs(sourceDirection[1]),
  );
  if (directionScale === 0) {
    throw new RangeError('ray.direction must be non-zero.');
  }
  const maxDistance = requireNonnegativeNumber(ray.maxDistance, 'ray.maxDistance');
  const scaledDirectionX = sourceDirection[0] / directionScale;
  const scaledDirectionY = sourceDirection[1] / directionScale;
  const scaledDirectionLength = Math.hypot(scaledDirectionX, scaledDirectionY);
  const directionX = scaledDirectionX / scaledDirectionLength;
  const directionY = scaledDirectionY / scaledDirectionLength;
  let selected: CastCandidate2D | null = null;

  for (const leaf of prepared.record.leaves) {
    const leafShape = shapeForLeaf(leaf);
    const initiallyOverlapping = containsPointInShape2D(
      leafShape,
      internalPoseAsPublic(prepared.pose),
      origin,
    );
    let candidate: CastCandidate2D | null;
    if (initiallyOverlapping) {
      candidate = options?.includeInitialOverlap === true
        ? {
            leafKey: [0, leaf.canonicalLeafIndex],
            pointX: origin[0],
            pointY: origin[1],
            normalX: -directionX,
            normalY: -directionY,
            distance: 0,
            timeOfImpact: 0,
          }
        : null;
    } else if (maxDistance === 0) {
      candidate = null;
    } else {
      candidate = raycastLeaf(
        leaf,
        leafShape,
        prepared.pose,
        origin[0],
        origin[1],
        directionX,
        directionY,
        maxDistance,
      );
    }
    if (candidate !== null && isEarlierCandidate(candidate, selected)) {
      selected = candidate;
    }
  }

  return selected === null ? null : publicHit(selected);
}

/**
 * Sweeps a posed shape along a translation against another posed shape and returns a hit or null.
 *
 * @param moving - Shape to sweep. See {@link PibblPhysicsShape2D}.
 * @param publicFrom - Initial pose of the moving shape. See {@link PibblPhysicsPose2D}.
 * @param publicTranslation - Translation vector for the sweep. See {@link PibblPhysicsVector2}.
 * @param target - Stationary shape to test against. See {@link PibblPhysicsShape2D}.
 * @param publicTargetPose - Pose of the stationary shape. See {@link PibblPhysicsPose2D}.
 * @param options - Whether initial overlap counts as a hit.
 * @returns The first sweep hit, or null when there is no hit. See {@link PibblPhysicsShapeHit2D}.
 *
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsShapeHit2D}
 */
export function shapeCastAgainstShape2D(
  moving: PibblPhysicsShape2D,
  publicFrom: PibblPhysicsPose2D,
  publicTranslation: PibblPhysicsVector2,
  target: PibblPhysicsShape2D,
  publicTargetPose: PibblPhysicsPose2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): PibblPhysicsShapeHit2D | null {
  const preparedMoving = prepareShape(moving, publicFrom, 'from');
  const translation = copyFiniteVector2(publicTranslation, 'translation');
  const preparedTarget = prepareShape(target, publicTargetPose, 'targetPose');
  const translationLength = Math.hypot(translation[0], translation[1]);
  if (!Number.isFinite(translationLength)) {
    throw new RangeError('translation magnitude must be finite.');
  }
  let selected: CastCandidate2D | null = null;

  for (const movingLeaf of preparedMoving.record.leaves) {
    const movingLeafShape = shapeForLeaf(movingLeaf);
    for (const targetLeaf of preparedTarget.record.leaves) {
      const targetLeafShape = shapeForLeaf(targetLeaf);
      const leafKey = pairLeafKey(movingLeaf, targetLeaf);
      const candidate = movingLeaf.kind === 'circle' && targetLeaf.kind === 'circle'
        ? castCircleAgainstCircle(
            movingLeaf,
            preparedMoving.pose,
            translation[0],
            translation[1],
            translationLength,
            targetLeaf,
            preparedTarget.pose,
            leafKey,
            options?.includeInitialOverlap === true,
          )
        : conservativelyCastLeafPair(
            movingLeafShape,
            preparedMoving.pose,
            translation[0],
            translation[1],
            translationLength,
            targetLeafShape,
            preparedTarget.pose,
            leafKey,
            options?.includeInitialOverlap === true,
          );
      if (candidate !== null && isEarlierCandidate(candidate, selected)) {
        selected = candidate;
      }
    }
  }

  return selected === null ? null : publicHit(selected);
}

function raycastLeaf(
  leaf: ConvexLeaf2D,
  leafShape: PibblPhysicsShape2D,
  pose: InternalPose2D,
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  maxDistance: number,
): CastCandidate2D | null {
  switch (leaf.kind) {
    case 'circle':
      return raycastCircle(
        leaf,
        pose,
        originX,
        originY,
        directionX,
        directionY,
        maxDistance,
      );
    case 'capsule':
      return raycastCapsule(
        leaf,
        pose,
        originX,
        originY,
        directionX,
        directionY,
        maxDistance,
      );
    case 'segment':
      return raycastSegment(
        leaf,
        pose,
        originX,
        originY,
        directionX,
        directionY,
        maxDistance,
      );
    default: {
      const pointShape = shapeForPoint();
      return conservativelyCastLeafPair(
        pointShape,
        { x: originX, y: originY, rotationRadians: 0 },
        directionX * maxDistance,
        directionY * maxDistance,
        maxDistance,
        leafShape,
        pose,
        [0, leaf.canonicalLeafIndex],
        false,
      );
    }
  }
}

function raycastCircle(
  leaf: CircleLeaf2D,
  pose: InternalPose2D,
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  maxDistance: number,
): CastCandidate2D | null {
  const center = new Float64Array(2);
  transformPointInto(center, 0, leaf.center[0]!, leaf.center[1]!, pose);
  const hit = rayCircleDistance(
    originX,
    originY,
    directionX,
    directionY,
    center[0]!,
    center[1]!,
    leaf.radius,
    maxDistance,
  );
  if (hit === null) return null;
  const pointX = originX + directionX * hit;
  const pointY = originY + directionY * hit;
  const normal = unitAgainstMotion(
    pointX - center[0]!,
    pointY - center[1]!,
    directionX,
    directionY,
  );
  return {
    leafKey: [0, leaf.canonicalLeafIndex],
    pointX,
    pointY,
    normalX: normal[0],
    normalY: normal[1],
    distance: hit,
    timeOfImpact: hit / maxDistance,
  };
}

function raycastCapsule(
  leaf: Extract<ConvexLeaf2D, { kind: 'capsule' }>,
  pose: InternalPose2D,
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  maxDistance: number,
): CastCandidate2D | null {
  const endpoints = new Float64Array(4);
  transformPointInto(endpoints, 0, leaf.start[0]!, leaf.start[1]!, pose);
  transformPointInto(endpoints, 2, leaf.end[0]!, leaf.end[1]!, pose);
  const startX = endpoints[0]!;
  const startY = endpoints[1]!;
  const endX = endpoints[2]!;
  const endY = endpoints[3]!;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLength = Math.hypot(segmentX, segmentY);
  if (segmentLength <= GEOMETRY_EPSILON) {
    return raycastCircle(
      { ...leaf, kind: 'circle', center: new Float64Array([leaf.start[0]!, leaf.start[1]!]) },
      pose,
      originX,
      originY,
      directionX,
      directionY,
      maxDistance,
    );
  }

  const tangentX = segmentX / segmentLength;
  const tangentY = segmentY / segmentLength;
  const sideNormalX = -tangentY;
  const sideNormalY = tangentX;
  const relativeX = originX - startX;
  const relativeY = originY - startY;
  const alongOrigin = relativeX * tangentX + relativeY * tangentY;
  const acrossOrigin = relativeX * sideNormalX + relativeY * sideNormalY;
  const alongDirection = directionX * tangentX + directionY * tangentY;
  const acrossDirection = directionX * sideNormalX + directionY * sideNormalY;
  const distances: number[] = [];
  if (Math.abs(acrossDirection) > GEOMETRY_EPSILON) {
    for (const side of [-1, 1] as const) {
      const distance = (side * leaf.radius - acrossOrigin) / acrossDirection;
      const along = alongOrigin + distance * alongDirection;
      if (
        distance >= -CAST_TIME_TOLERANCE &&
        distance <= maxDistance + CAST_TIME_TOLERANCE &&
        along >= -CAST_HIT_TOLERANCE &&
        along <= segmentLength + CAST_HIT_TOLERANCE
      ) {
        distances.push(Math.max(0, distance));
      }
    }
  }
  for (const [centerX, centerY] of [[startX, startY], [endX, endY]] as const) {
    const distance = rayCircleDistance(
      originX,
      originY,
      directionX,
      directionY,
      centerX,
      centerY,
      leaf.radius,
      maxDistance,
    );
    if (distance !== null) distances.push(distance);
  }
  distances.sort((first, second) => first - second);
  for (const distance of distances) {
    const pointX = originX + directionX * distance;
    const pointY = originY + directionY * distance;
    const closest = distancePointToSegment2D(
      pointX,
      pointY,
      startX,
      startY,
      endX,
      endY,
    );
    if (Math.abs(closest.separation - leaf.radius) > CAST_HIT_TOLERANCE * 8) continue;
    const normal = unitAgainstMotion(
      pointX - closest.secondX,
      pointY - closest.secondY,
      directionX,
      directionY,
    );
    if (normal[0] * directionX + normal[1] * directionY > CAST_HIT_TOLERANCE) continue;
    return {
      leafKey: [0, leaf.canonicalLeafIndex],
      pointX,
      pointY,
      normalX: normal[0],
      normalY: normal[1],
      distance,
      timeOfImpact: distance / maxDistance,
    };
  }
  return null;
}

function raycastSegment(
  leaf: Extract<ConvexLeaf2D, { kind: 'segment' }>,
  pose: InternalPose2D,
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  maxDistance: number,
): CastCandidate2D | null {
  const endpoints = new Float64Array(4);
  transformPointInto(endpoints, 0, leaf.start[0]!, leaf.start[1]!, pose);
  transformPointInto(endpoints, 2, leaf.end[0]!, leaf.end[1]!, pose);
  const startX = endpoints[0]!;
  const startY = endpoints[1]!;
  const segmentX = endpoints[2]! - startX;
  const segmentY = endpoints[3]! - startY;
  const relativeX = startX - originX;
  const relativeY = startY - originY;
  const denominator = cross(directionX, directionY, segmentX, segmentY);
  let distance: number;
  if (Math.abs(denominator) > GEOMETRY_EPSILON) {
    distance = cross(relativeX, relativeY, segmentX, segmentY) / denominator;
    const segmentTime = cross(relativeX, relativeY, directionX, directionY) / denominator;
    if (
      distance < -CAST_TIME_TOLERANCE ||
      distance > maxDistance + CAST_TIME_TOLERANCE ||
      segmentTime < -CAST_TIME_TOLERANCE ||
      segmentTime > 1 + CAST_TIME_TOLERANCE
    ) {
      return null;
    }
  } else {
    if (Math.abs(cross(relativeX, relativeY, directionX, directionY)) > GEOMETRY_EPSILON) {
      return null;
    }
    const first = relativeX * directionX + relativeY * directionY;
    const second = first + segmentX * directionX + segmentY * directionY;
    distance = Math.min(first, second);
    if (distance < -CAST_TIME_TOLERANCE) distance = Math.max(first, second);
    if (distance < -CAST_TIME_TOLERANCE || distance > maxDistance + CAST_TIME_TOLERANCE) {
      return null;
    }
  }
  distance = Math.max(0, Math.min(maxDistance, distance));
  const pointX = originX + directionX * distance;
  const pointY = originY + directionY * distance;
  const normal = segmentNormalAgainstMotion(segmentX, segmentY, directionX, directionY);
  return {
    leafKey: [0, leaf.canonicalLeafIndex],
    pointX,
    pointY,
    normalX: normal[0],
    normalY: normal[1],
    distance,
    timeOfImpact: distance / maxDistance,
  };
}

function castCircleAgainstCircle(
  moving: CircleLeaf2D,
  movingPose: InternalPose2D,
  translationX: number,
  translationY: number,
  translationLength: number,
  target: CircleLeaf2D,
  targetPose: InternalPose2D,
  leafKey: readonly [number, number],
  includeInitialOverlap: boolean,
): CastCandidate2D | null {
  const centers = new Float64Array(4);
  transformPointInto(centers, 0, moving.center[0]!, moving.center[1]!, movingPose);
  transformPointInto(centers, 2, target.center[0]!, target.center[1]!, targetPose);
  const relativeX = centers[0]! - centers[2]!;
  const relativeY = centers[1]! - centers[3]!;
  const radius = moving.radius + target.radius;
  if (relativeX * relativeX + relativeY * relativeY <= radius * radius) {
    if (!includeInitialOverlap) return null;
    const normal = unitAgainstMotion(relativeX, relativeY, translationX, translationY);
    return {
      leafKey,
      pointX: centers[2]! + normal[0] * target.radius,
      pointY: centers[3]! + normal[1] * target.radius,
      normalX: normal[0],
      normalY: normal[1],
      distance: 0,
      timeOfImpact: 0,
    };
  }
  if (translationLength === 0) return null;
  const a = translationX * translationX + translationY * translationY;
  const b = 2 * (relativeX * translationX + relativeY * translationY);
  const c = relativeX * relativeX + relativeY * relativeY - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -GEOMETRY_EPSILON) return null;
  const time = (-b - Math.sqrt(Math.max(0, discriminant))) / (2 * a);
  if (time < -CAST_TIME_TOLERANCE || time > 1 + CAST_TIME_TOLERANCE) return null;
  const timeOfImpact = Math.max(0, Math.min(1, time));
  const movingX = centers[0]! + translationX * timeOfImpact;
  const movingY = centers[1]! + translationY * timeOfImpact;
  const normal = unitAgainstMotion(
    movingX - centers[2]!,
    movingY - centers[3]!,
    translationX,
    translationY,
  );
  return {
    leafKey,
    pointX: centers[2]! + normal[0] * target.radius,
    pointY: centers[3]! + normal[1] * target.radius,
    normalX: normal[0],
    normalY: normal[1],
    distance: translationLength * timeOfImpact,
    timeOfImpact,
  };
}

function conservativelyCastLeafPair(
  moving: PibblPhysicsShape2D,
  from: InternalPose2D,
  translationX: number,
  translationY: number,
  translationLength: number,
  target: PibblPhysicsShape2D,
  targetPose: InternalPose2D,
  leafKey: readonly [number, number],
  includeInitialOverlap: boolean,
): CastCandidate2D | null {
  let time = 0;
  for (let iteration = 0; iteration < CAST_MAX_ITERATIONS; iteration += 1) {
    const movingPose = {
      x: from.x + translationX * time,
      y: from.y + translationY * time,
      rotationRadians: from.rotationRadians,
    };
    const distance = samplePairDistance(moving, movingPose, target, targetPose);
    if (distance === null) return null;
    if (distance.separation <= (time === 0 ? 0 : CAST_HIT_TOLERANCE)) {
      if (time === 0 && !includeInitialOverlap) return null;
      const normal = unitAgainstMotion(
        distance.normal[0],
        distance.normal[1],
        translationX,
        translationY,
      );
      return {
        leafKey,
        pointX: distance.pointOnSecond[0],
        pointY: distance.pointOnSecond[1],
        normalX: normal[0],
        normalY: normal[1],
        distance: translationLength * time,
        timeOfImpact: time,
      };
    }
    if (translationLength === 0) return null;
    const closingSpeed = -(
      distance.normal[0] * translationX +
      distance.normal[1] * translationY
    );
    if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) break;
    const step = distance.separation / closingSpeed;
    if (!Number.isFinite(step) || step <= CAST_TIME_TOLERANCE) break;
    const nextTime = time + step;
    if (!Number.isFinite(nextTime)) return null;
    if (nextTime <= time) break;
    if (nextTime > 1 + CAST_TIME_TOLERANCE) break;
    time = Math.min(1, nextTime);
  }
  return refineBoundedTangent(
    moving,
    from,
    translationX,
    translationY,
    translationLength,
    target,
    targetPose,
    leafKey,
  );
}

function refineBoundedTangent(
  moving: PibblPhysicsShape2D,
  from: InternalPose2D,
  translationX: number,
  translationY: number,
  translationLength: number,
  target: PibblPhysicsShape2D,
  targetPose: InternalPose2D,
  leafKey: readonly [number, number],
): CastCandidate2D | null {
  let minimumTime = 0;
  let maximumTime = 1;
  let tangentTime = 0;
  let tangent = sampleTranslatedDistance(
    moving,
    from,
    translationX,
    translationY,
    tangentTime,
    target,
    targetPose,
  );
  if (tangent === null) return null;
  for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
    const middleTime = (minimumTime + maximumTime) / 2;
    const middle = sampleTranslatedDistance(
      moving,
      from,
      translationX,
      translationY,
      middleTime,
      target,
      targetPose,
    );
    if (middle === null) return null;
    if (middle.separation < tangent.separation) {
      tangentTime = middleTime;
      tangent = middle;
    }
    const derivative =
      middle.normal[0] * translationX + middle.normal[1] * translationY;
    if (!Number.isFinite(derivative)) return null;
    if (derivative < 0) {
      minimumTime = middleTime;
    } else {
      maximumTime = middleTime;
    }
  }
  if (tangent.separation > CAST_HIT_TOLERANCE) return null;

  let impactTime = tangentTime;
  if (tangent.separation < 0) {
    let separatedTime = 0;
    for (let iteration = 0; iteration < CAST_REFINEMENT_ITERATIONS; iteration += 1) {
      const middleTime = (separatedTime + impactTime) / 2;
      const middle = sampleTranslatedDistance(
        moving,
        from,
        translationX,
        translationY,
        middleTime,
        target,
        targetPose,
      );
      if (middle === null) return null;
      if (middle.separation <= CAST_HIT_TOLERANCE) {
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
    translationX,
    translationY,
  );
  return {
    leafKey,
    pointX: tangent.pointOnSecond[0],
    pointY: tangent.pointOnSecond[1],
    normalX: normal[0],
    normalY: normal[1],
    distance: translationLength * impactTime,
    timeOfImpact: impactTime,
  };
}

function sampleTranslatedDistance(
  moving: PibblPhysicsShape2D,
  from: InternalPose2D,
  translationX: number,
  translationY: number,
  time: number,
  target: PibblPhysicsShape2D,
  targetPose: InternalPose2D,
): PibblPhysicsDistance2D | null {
  return samplePairDistance(
    moving,
    {
      x: from.x + translationX * time,
      y: from.y + translationY * time,
      rotationRadians: from.rotationRadians,
    },
    target,
    targetPose,
  );
}

function samplePairDistance(
  moving: PibblPhysicsShape2D,
  movingPose: InternalPose2D,
  target: PibblPhysicsShape2D,
  targetPose: InternalPose2D,
): PibblPhysicsDistance2D | null {
  try {
    const distance = distanceBetweenPreparedShapes2D(
      moving,
      internalPoseAsPublic(movingPose),
      target,
      internalPoseAsPublic(targetPose),
    );
    return isFiniteDistance(distance) ? distance : null;
  } catch {
    return null;
  }
}

function prepareShape(
  shape: PibblPhysicsShape2D,
  publicPose: PibblPhysicsPose2D,
  posePath: string,
): PreparedCastShape2D {
  const record = requireShapeRecord2D(shape);
  const pose = composePose2D(copyPose2D(publicPose, posePath), record.localPose);
  return { record, pose };
}

function shapeForLeaf(leaf: ConvexLeaf2D): PibblPhysicsShape2D {
  return createShape2D({
    leaves: Object.freeze([leaf]),
    localPose: IDENTITY_POSE_2D,
    localBounds: new Float64Array(4),
    area: 0,
    centroidX: 0,
    centroidY: 0,
    unitInertia: 0,
  });
}

function shapeForPoint(): PibblPhysicsShape2D {
  return shapeForLeaf(Object.freeze({
    kind: 'segment',
    start: new Float64Array(2),
    end: new Float64Array(2),
    canonicalLeafIndex: 0,
  }));
}

function rayCircleDistance(
  originX: number,
  originY: number,
  directionX: number,
  directionY: number,
  centerX: number,
  centerY: number,
  radius: number,
  maxDistance: number,
): number | null {
  const relativeX = originX - centerX;
  const relativeY = originY - centerY;
  const projection = relativeX * directionX + relativeY * directionY;
  const discriminant = projection * projection -
    (relativeX * relativeX + relativeY * relativeY - radius * radius);
  if (discriminant < -GEOMETRY_EPSILON) return null;
  const distance = -projection - Math.sqrt(Math.max(0, discriminant));
  if (distance < -CAST_TIME_TOLERANCE || distance > maxDistance + CAST_TIME_TOLERANCE) {
    return null;
  }
  return Math.max(0, Math.min(maxDistance, distance));
}

function unitAgainstMotion(
  x: number,
  y: number,
  motionX: number,
  motionY: number,
): readonly [number, number] {
  const length = Math.hypot(x, y);
  if (length > GEOMETRY_EPSILON) {
    const unitX = x / length;
    const unitY = y / length;
    return unitX * motionX + unitY * motionY > 0
      ? [-unitX, -unitY]
      : [unitX, unitY];
  }
  const motionLength = Math.hypot(motionX, motionY);
  return motionLength > 0
    ? [-motionX / motionLength, -motionY / motionLength]
    : [1, 0];
}

function segmentNormalAgainstMotion(
  segmentX: number,
  segmentY: number,
  motionX: number,
  motionY: number,
): readonly [number, number] {
  const length = Math.hypot(segmentX, segmentY);
  if (length <= GEOMETRY_EPSILON) {
    return unitAgainstMotion(0, 0, motionX, motionY);
  }
  let normalX = -segmentY / length;
  let normalY = segmentX / length;
  if (normalX * motionX + normalY * motionY > 0) {
    normalX = -normalX;
    normalY = -normalY;
  }
  return [normalX, normalY];
}

function internalPoseAsPublic(pose: InternalPose2D): PibblPhysicsPose2D {
  return {
    position: [pose.x, pose.y],
    rotationDegrees: pose.rotationRadians * 180 / Math.PI,
  };
}

function pairLeafKey(
  first: ConvexLeaf2D,
  second: ConvexLeaf2D,
): readonly [number, number] {
  return [first.canonicalLeafIndex, second.canonicalLeafIndex];
}

function isEarlierCandidate(
  candidate: CastCandidate2D,
  selected: CastCandidate2D | null,
): boolean {
  if (selected === null) return true;
  const timeDifference = candidate.timeOfImpact - selected.timeOfImpact;
  return Math.abs(timeDifference) > CAST_TIME_TOLERANCE
    ? timeDifference < 0
    : candidate.leafKey[0] < selected.leafKey[0] ||
        (candidate.leafKey[0] === selected.leafKey[0] &&
          candidate.leafKey[1] < selected.leafKey[1]);
}

function isFiniteDistance(distance: Readonly<{
  separation: number;
  pointOnFirst: PibblPhysicsVector2;
  pointOnSecond: PibblPhysicsVector2;
  normal: PibblPhysicsVector2;
}>): boolean {
  return Number.isFinite(distance.separation) &&
    Number.isFinite(distance.pointOnFirst[0]) &&
    Number.isFinite(distance.pointOnFirst[1]) &&
    Number.isFinite(distance.pointOnSecond[0]) &&
    Number.isFinite(distance.pointOnSecond[1]) &&
    Number.isFinite(distance.normal[0]) &&
    Number.isFinite(distance.normal[1]);
}

function publicHit(candidate: CastCandidate2D): PibblPhysicsShapeHit2D {
  return Object.freeze({
    point: freezeVector(candidate.pointX, candidate.pointY),
    normal: freezeVector(candidate.normalX, candidate.normalY),
    distance: cleanZero(candidate.distance),
    timeOfImpact: cleanZero(candidate.timeOfImpact),
  });
}

function freezeVector(x: number, y: number): PibblPhysicsVector2 {
  return Object.freeze([cleanZero(x), cleanZero(y)] as const);
}

function cleanZero(value: number): number {
  return Object.is(value, -0) || Math.abs(value) <= Number.EPSILON ? 0 : value;
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}
