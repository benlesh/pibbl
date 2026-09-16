import type {
  CRCPhysicsPose3D,
  CRCPhysicsShape3D,
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

  constructor(initialCapacity = 4) {
    this.impactColliderIndices = new Int32Array(
      normalizedCapacity(initialCapacity),
    );
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
  ): void {
    let currentX = fromX;
    let currentY = fromY;
    let currentZ = fromZ;
    let remainingX = bodies.positionX[body]! - fromX;
    let remainingY = bodies.positionY[body]! - fromY;
    let remainingZ = bodies.positionZ[body]! - fromZ;
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
      remainingX *= fraction;
      remainingY *= fraction;
      remainingZ *= fraction;
      const restitution = Math.max(
        colliders.restitutions[selected.movingCollider]!,
        colliders.restitutions[selected.targetCollider]!,
      );
      const remainingNormal =
        remainingX * selected.normalX +
        remainingY * selected.normalY +
        remainingZ * selected.normalZ;
      if (remainingNormal < 0) {
        remainingX -=
          (1 + restitution) * remainingNormal * selected.normalX;
        remainingY -=
          (1 + restitution) * remainingNormal * selected.normalY;
        remainingZ -=
          (1 + restitution) * remainingNormal * selected.normalZ;
      }
      const velocityNormal =
        bodies.linearVelocityX[body]! * selected.normalX +
        bodies.linearVelocityY[body]! * selected.normalY +
        bodies.linearVelocityZ[body]! * selected.normalZ;
      if (velocityNormal < 0) {
        bodies.linearVelocityX[body] -=
          (1 + restitution) * velocityNormal * selected.normalX;
        bodies.linearVelocityY[body] -=
          (1 + restitution) * velocityNormal * selected.normalY;
        bodies.linearVelocityZ[body] -=
          (1 + restitution) * velocityNormal * selected.normalZ;
      }
      this.impactColliderIndices[this.impactCount] =
        selected.targetCollider;
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
        const hit = shapeCastAgainstShape3D(
          movingShape,
          fromPose,
          [translationX, translationY, translationZ],
          shapeForRecord3D(targetRecord),
          colliderCurrentPose(bodies, colliders, targetCollider),
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
    (firstMask & secondCategory) !== 0 &&
    (secondMask & firstCategory) !== 0
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

function colliderCurrentPose(
  bodies: BodyStore3D,
  colliders: ColliderStore3D,
  collider: number,
): CRCPhysicsPose3D {
  const body = colliders.bodyIndices[collider]!;
  return colliderPoseAtCenter(
    bodies,
    colliders,
    collider,
    bodies.positionX[body]!,
    bodies.positionY[body]!,
    bodies.positionZ[body]!,
    bodies.orientationX[body]!,
    bodies.orientationY[body]!,
    bodies.orientationZ[body]!,
    bodies.orientationW[body]!,
  );
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
