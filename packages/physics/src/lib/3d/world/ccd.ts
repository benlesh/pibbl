import type {
  CRCPhysicsPose3D,
} from "../../../3d-geometry.js";
import { shapeCastAgainstShape3D } from "../collision/casts.js";
import {
  composePose3D,
  rotateVectorInto,
  type InternalPose3D,
} from "../math.js";
import { MAX_CCD_IMPACTS_PER_TICK_3D } from "../numeric-policy.js";
import { shapeForRecord3D } from "../shape-records.js";
import type { DynamicAabbBroadPhase3D } from "./broad-phase.js";
import { BODY_SLEEPING_3D } from "./solver.js";
import {
  BODY_ENABLED_3D,
  BODY_TYPE_DYNAMIC_3D,
  BODY_TYPE_KINEMATIC_3D,
  BODY_TYPE_MASK_3D,
  COLLIDER_ENABLED_3D,
  COLLIDER_SENSOR_3D,
  type BodyStore3D,
  type ColliderStore3D,
} from "./storage.js";

export const BODY_CCD_3D = 1 << 5;

interface SelectedImpact3D {
  readonly movingCollider: number;
  readonly targetCollider: number;
  readonly targetBody: number;
  readonly targetGeneration: number;
  readonly timeOfImpact: number;
  readonly normalX: number;
  readonly normalY: number;
  readonly normalZ: number;
}

interface CollisionFilterRecord3D {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}

export class BoundedCcd3D {
  impactCount = 0;
  capCount = 0;
  impactColliderIndices: Int32Array;
  candidatePositionX: Float64Array;
  candidatePositionY: Float64Array;
  candidatePositionZ: Float64Array;
  candidateVelocityX: Float64Array;
  candidateVelocityY: Float64Array;
  candidateVelocityZ: Float64Array;

  constructor(initialCapacity = 4) {
    const capacity = normalizedCapacity(initialCapacity);
    this.impactColliderIndices = new Int32Array(capacity);
    this.candidatePositionX = new Float64Array(capacity);
    this.candidatePositionY = new Float64Array(capacity);
    this.candidatePositionZ = new Float64Array(capacity);
    this.candidateVelocityX = new Float64Array(capacity);
    this.candidateVelocityY = new Float64Array(capacity);
    this.candidateVelocityZ = new Float64Array(capacity);
  }

  resolveCandidateBodies(
    bodies: BodyStore3D,
    colliders: ColliderStore3D,
    broadPhase: DynamicAabbBroadPhase3D,
    bodyIndices: Int32Array,
    bodyCount: number,
    previousPositionX: Float64Array,
    previousPositionY: Float64Array,
    previousPositionZ: Float64Array,
    previousOrientationX: Float64Array,
    previousOrientationY: Float64Array,
    previousOrientationZ: Float64Array,
    previousOrientationW: Float64Array,
  ): void {
    void broadPhase;
    this.impactCount = 0;
    this.capCount = 0;
    this.ensureImpactCapacity(
      Math.max(1, bodyCount * MAX_CCD_IMPACTS_PER_TICK_3D),
    );
    this.ensureBodyCapacity(bodies.capacity);
    this.candidatePositionX.set(bodies.positionX);
    this.candidatePositionY.set(bodies.positionY);
    this.candidatePositionZ.set(bodies.positionZ);
    this.candidateVelocityX.set(bodies.linearVelocityX);
    this.candidateVelocityY.set(bodies.linearVelocityY);
    this.candidateVelocityZ.set(bodies.linearVelocityZ);
    for (let offset = 0; offset < bodyCount; offset += 1) {
      const body = bodyIndices[offset]!;
      if (!this.isEligibleBody(bodies, body)) continue;
      this.resolveBody(
        bodies,
        colliders,
        body,
        previousPositionX[body]!,
        previousPositionY[body]!,
        previousPositionZ[body]!,
        previousOrientationX[body]!,
        previousOrientationY[body]!,
        previousOrientationZ[body]!,
        previousOrientationW[body]!,
        previousPositionX,
        previousPositionY,
        previousPositionZ,
        previousOrientationX,
        previousOrientationY,
        previousOrientationZ,
        previousOrientationW,
      );
    }
  }

  private resolveBody(
    bodies: BodyStore3D,
    colliders: ColliderStore3D,
    body: number,
    fromX: number,
    fromY: number,
    fromZ: number,
    orientationX: number,
    orientationY: number,
    orientationZ: number,
    orientationW: number,
    previousPositionX: Float64Array,
    previousPositionY: Float64Array,
    previousPositionZ: Float64Array,
    previousOrientationX: Float64Array,
    previousOrientationY: Float64Array,
    previousOrientationZ: Float64Array,
    previousOrientationW: Float64Array,
  ): void {
    let currentX = fromX;
    let currentY = fromY;
    let currentZ = fromZ;
    let remainingX = this.candidatePositionX[body]! - fromX;
    let remainingY = this.candidatePositionY[body]! - fromY;
    let remainingZ = this.candidatePositionZ[body]! - fromZ;
    let elapsedFraction = 0;
    let remainingFraction = 1;
    let impacts = 0;
    while (
      (remainingX !== 0 || remainingY !== 0 || remainingZ !== 0) &&
      impacts < MAX_CCD_IMPACTS_PER_TICK_3D
    ) {
      const selected = this.findEarliestImpact(
        bodies,
        colliders,
        body,
        currentX,
        currentY,
        currentZ,
        orientationX,
        orientationY,
        orientationZ,
        orientationW,
        remainingX,
        remainingY,
        remainingZ,
        elapsedFraction,
        remainingFraction,
        previousPositionX,
        previousPositionY,
        previousPositionZ,
        previousOrientationX,
        previousOrientationY,
        previousOrientationZ,
        previousOrientationW,
      );
      if (selected === null) {
        currentX += remainingX;
        currentY += remainingY;
        currentZ += remainingZ;
        remainingX = 0;
        remainingY = 0;
        remainingZ = 0;
        break;
      }
      currentX += remainingX * selected.timeOfImpact;
      currentY += remainingY * selected.timeOfImpact;
      currentZ += remainingZ * selected.timeOfImpact;
      const fraction = 1 - selected.timeOfImpact;
      elapsedFraction += remainingFraction * selected.timeOfImpact;
      remainingFraction *= fraction;
      remainingX *= fraction;
      remainingY *= fraction;
      remainingZ *= fraction;
      const targetBody = selected.targetBody;
      const targetRemainingX =
        (this.candidatePositionX[targetBody]! -
          previousPositionX[targetBody]!) *
        remainingFraction;
      const targetRemainingY =
        (this.candidatePositionY[targetBody]! -
          previousPositionY[targetBody]!) *
        remainingFraction;
      const targetRemainingZ =
        (this.candidatePositionZ[targetBody]! -
          previousPositionZ[targetBody]!) *
        remainingFraction;
      const restitution = Math.max(
        colliders.restitutions[selected.movingCollider]!,
        colliders.restitutions[selected.targetCollider]!,
      );
      let relativeRemainingX = remainingX - targetRemainingX;
      let relativeRemainingY = remainingY - targetRemainingY;
      let relativeRemainingZ = remainingZ - targetRemainingZ;
      const remainingNormal =
        relativeRemainingX * selected.normalX +
        relativeRemainingY * selected.normalY +
        relativeRemainingZ * selected.normalZ;
      if (remainingNormal < 0) {
        relativeRemainingX -=
          (1 + restitution) * remainingNormal * selected.normalX;
        relativeRemainingY -=
          (1 + restitution) * remainingNormal * selected.normalY;
        relativeRemainingZ -=
          (1 + restitution) * remainingNormal * selected.normalZ;
      }
      remainingX = relativeRemainingX + targetRemainingX;
      remainingY = relativeRemainingY + targetRemainingY;
      remainingZ = relativeRemainingZ + targetRemainingZ;
      const relativeVelocityX =
        bodies.linearVelocityX[body]! -
        this.targetVelocity(this.candidateVelocityX, bodies, targetBody);
      const relativeVelocityY =
        bodies.linearVelocityY[body]! -
        this.targetVelocity(this.candidateVelocityY, bodies, targetBody);
      const relativeVelocityZ =
        bodies.linearVelocityZ[body]! -
        this.targetVelocity(this.candidateVelocityZ, bodies, targetBody);
      const velocityNormal =
        relativeVelocityX * selected.normalX +
        relativeVelocityY * selected.normalY +
        relativeVelocityZ * selected.normalZ;
      if (velocityNormal < 0) {
        bodies.linearVelocityX[body] =
          relativeVelocityX -
          (1 + restitution) * velocityNormal * selected.normalX +
          this.targetVelocity(this.candidateVelocityX, bodies, targetBody);
        bodies.linearVelocityY[body] =
          relativeVelocityY -
          (1 + restitution) * velocityNormal * selected.normalY +
          this.targetVelocity(this.candidateVelocityY, bodies, targetBody);
        bodies.linearVelocityZ[body] =
          relativeVelocityZ -
          (1 + restitution) * velocityNormal * selected.normalZ +
          this.targetVelocity(this.candidateVelocityZ, bodies, targetBody);
      }
      this.impactColliderIndices[this.impactCount] = selected.targetCollider;
      this.impactCount += 1;
      impacts += 1;
    }
    if (remainingX !== 0 || remainingY !== 0 || remainingZ !== 0) {
      currentX += remainingX;
      currentY += remainingY;
      currentZ += remainingZ;
      if (impacts === MAX_CCD_IMPACTS_PER_TICK_3D) this.capCount += 1;
    }
    bodies.positionX[body] = currentX;
    bodies.positionY[body] = currentY;
    bodies.positionZ[body] = currentZ;
  }

  private findEarliestImpact(
    bodies: BodyStore3D,
    colliders: ColliderStore3D,
    body: number,
    fromX: number,
    fromY: number,
    fromZ: number,
    orientationX: number,
    orientationY: number,
    orientationZ: number,
    orientationW: number,
    translationX: number,
    translationY: number,
    translationZ: number,
    elapsedFraction: number,
    remainingFraction: number,
    previousPositionX: Float64Array,
    previousPositionY: Float64Array,
    previousPositionZ: Float64Array,
    previousOrientationX: Float64Array,
    previousOrientationY: Float64Array,
    previousOrientationZ: Float64Array,
    previousOrientationW: Float64Array,
  ): SelectedImpact3D | null {
    let selected: SelectedImpact3D | null = null;
    for (
      let movingCollider = 0;
      movingCollider < colliders.capacity;
      movingCollider += 1
    ) {
      const movingGeneration = colliders.generations[movingCollider]!;
      if (!colliders.has(movingCollider, movingGeneration)) continue;
      if (colliders.bodyIndices[movingCollider] !== body) continue;
      if (
        (colliders.flags[movingCollider]! & COLLIDER_ENABLED_3D) === 0 ||
        (colliders.flags[movingCollider]! & COLLIDER_SENSOR_3D) !== 0
      ) {
        continue;
      }
      const movingRecord = colliders.shapes[movingCollider];
      if (movingRecord === null) continue;
      const movingShape = shapeForRecord3D(movingRecord);
      const fromPose = colliderPoseAtCenter(
        bodies,
        colliders,
        movingCollider,
        fromX,
        fromY,
        fromZ,
        orientationX,
        orientationY,
        orientationZ,
        orientationW,
      );
      for (
        let targetCollider = 0;
        targetCollider < colliders.capacity;
        targetCollider += 1
      ) {
        const targetGeneration = colliders.generations[targetCollider]!;
        if (!colliders.has(targetCollider, targetGeneration)) continue;
        if (targetCollider === movingCollider) continue;
        const targetBody = colliders.bodyIndices[targetCollider]!;
        if (
          targetBody === body ||
          (colliders.flags[targetCollider]! & COLLIDER_ENABLED_3D) === 0 ||
          (colliders.flags[targetCollider]! & COLLIDER_SENSOR_3D) !== 0 ||
          (bodies.flags[targetBody]! & BODY_ENABLED_3D) === 0 ||
          !collisionFiltersAllow3D(
            colliderFilter(colliders, movingCollider),
            colliderFilter(colliders, targetCollider),
          )
        ) {
          continue;
        }
        const targetRecord = colliders.shapes[targetCollider];
        if (targetRecord === null) continue;
        const targetDeltaX =
          this.candidatePositionX[targetBody]! - previousPositionX[targetBody]!;
        const targetDeltaY =
          this.candidatePositionY[targetBody]! - previousPositionY[targetBody]!;
        const targetDeltaZ =
          this.candidatePositionZ[targetBody]! - previousPositionZ[targetBody]!;
        const hit = shapeCastAgainstShape3D(
          movingShape,
          fromPose,
          [
            translationX - targetDeltaX * remainingFraction,
            translationY - targetDeltaY * remainingFraction,
            translationZ - targetDeltaZ * remainingFraction,
          ],
          shapeForRecord3D(targetRecord),
          colliderPoseAtCenter(
            bodies,
            colliders,
            targetCollider,
            previousPositionX[targetBody]! + targetDeltaX * elapsedFraction,
            previousPositionY[targetBody]! + targetDeltaY * elapsedFraction,
            previousPositionZ[targetBody]! + targetDeltaZ * elapsedFraction,
            previousOrientationX[targetBody]!,
            previousOrientationY[targetBody]!,
            previousOrientationZ[targetBody]!,
            previousOrientationW[targetBody]!,
          ),
        );
        if (hit === null) continue;
        if (
          selected === null ||
          hit.timeOfImpact < selected.timeOfImpact ||
          (hit.timeOfImpact === selected.timeOfImpact &&
            (compareColliderIdentity(
              targetCollider,
              targetGeneration,
              selected.targetCollider,
              selected.targetGeneration,
            ) < 0 ||
              (compareColliderIdentity(
                targetCollider,
                targetGeneration,
                selected.targetCollider,
                selected.targetGeneration,
              ) === 0 &&
                movingCollider < selected.movingCollider)))
        ) {
          selected = {
            movingCollider,
            targetCollider,
            targetBody,
            targetGeneration,
            timeOfImpact: hit.timeOfImpact,
            normalX: hit.normal[0],
            normalY: hit.normal[1],
            normalZ: hit.normal[2],
          };
        }
      }
    }
    return selected;
  }

  private isEligibleBody(bodies: BodyStore3D, body: number): boolean {
    return (
      body >= 0 &&
      body < bodies.capacity &&
      (bodies.flags[body]! & BODY_ENABLED_3D) !== 0 &&
      (bodies.flags[body]! & BODY_TYPE_MASK_3D) === BODY_TYPE_DYNAMIC_3D &&
      (bodies.flags[body]! & BODY_CCD_3D) !== 0 &&
      (bodies.flags[body]! & BODY_SLEEPING_3D) === 0 &&
      bodies.inverseMass[body]! > 0
    );
  }

  private ensureImpactCapacity(required: number): void {
    if (required <= this.impactColliderIndices.length) return;
    const result = new Int32Array(normalizedCapacity(required));
    result.set(this.impactColliderIndices);
    this.impactColliderIndices = result;
  }

  private ensureBodyCapacity(required: number): void {
    if (required <= this.candidatePositionX.length) return;
    const capacity = normalizedCapacity(required);
    this.candidatePositionX = growFloat64(this.candidatePositionX, capacity);
    this.candidatePositionY = growFloat64(this.candidatePositionY, capacity);
    this.candidatePositionZ = growFloat64(this.candidatePositionZ, capacity);
    this.candidateVelocityX = growFloat64(this.candidateVelocityX, capacity);
    this.candidateVelocityY = growFloat64(this.candidateVelocityY, capacity);
    this.candidateVelocityZ = growFloat64(this.candidateVelocityZ, capacity);
  }

  private targetVelocity(
    velocities: Float64Array,
    bodies: BodyStore3D,
    body: number,
  ): number {
    const type = bodies.flags[body]! & BODY_TYPE_MASK_3D;
    return type === BODY_TYPE_DYNAMIC_3D || type === BODY_TYPE_KINEMATIC_3D
      ? velocities[body]!
      : 0;
  }
}

export function collisionFiltersAllow3D(
  first: CollisionFilterRecord3D,
  second: CollisionFilterRecord3D,
): boolean {
  const firstGroup = integerBits(first.group ?? 0);
  const secondGroup = integerBits(second.group ?? 0);
  if (firstGroup !== 0 && firstGroup === secondGroup) return firstGroup > 0;
  const firstCategory = unsignedBits(first.category ?? 1);
  const secondCategory = unsignedBits(second.category ?? 1);
  const firstMask = unsignedBits(first.mask ?? 0xffff_ffff);
  const secondMask = unsignedBits(second.mask ?? 0xffff_ffff);
  return (
    (firstMask & secondCategory) !== 0 && (secondMask & firstCategory) !== 0
  );
}

function colliderFilter(
  colliders: ColliderStore3D,
  collider: number,
): CollisionFilterRecord3D {
  return {
    category: colliders.collisionCategories[collider]!,
    mask: colliders.collisionMasks[collider]!,
    group: colliders.collisionGroup[collider]!,
  };
}

function colliderPoseAtCenter(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  collider: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  orientationX: number,
  orientationY: number,
  orientationZ: number,
  orientationW: number,
): CRCPhysicsPose3D {
  const orientation = new Float64Array([
    orientationX,
    orientationY,
    orientationZ,
    orientationW,
  ]);
  const body = colliders.bodyIndices[collider]!;
  const centerOffset = new Float64Array(3);
  rotateVectorInto(
    centerOffset,
    [
      bodies.localCenterX[body]!,
      bodies.localCenterY[body]!,
      bodies.localCenterZ[body]!,
    ],
    orientation,
  );
  const bodyPose: InternalPose3D = {
    position: new Float64Array([
      centerX - centerOffset[0]!,
      centerY - centerOffset[1]!,
      centerZ - centerOffset[2]!,
    ]),
    orientation,
  };
  const pose = composePose3D(bodyPose, {
    position: new Float64Array([
      colliders.localPositionX[collider]!,
      colliders.localPositionY[collider]!,
      colliders.localPositionZ[collider]!,
    ]),
    orientation: new Float64Array([
      colliders.localOrientationX[collider]!,
      colliders.localOrientationY[collider]!,
      colliders.localOrientationZ[collider]!,
      colliders.localOrientationW[collider]!,
    ]),
  });
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

function compareColliderIdentity(
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  return firstIndex - secondIndex || firstGeneration - secondGeneration;
}

function unsignedBits(value: number): number {
  return Number.isFinite(value) ? value >>> 0 : 0;
}

function integerBits(value: number): number {
  return Number.isFinite(value) ? value | 0 : 0;
}

function normalizedCapacity(required: number): number {
  if (!Number.isInteger(required) || required < 1) {
    throw new RangeError("capacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < required) capacity *= 2;
  return capacity;
}

function growFloat64(source: Float64Array, capacity: number): Float64Array {
  const result = new Float64Array(capacity);
  result.set(source);
  return result;
}
