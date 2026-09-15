import {
  boundsOfShape2D,
  shapeCastAgainstShape2D,
  type CRCPhysicsPose2D,
  type CRCPhysicsShape2D,
} from "../../../2d-geometry.js";
import { createShape2D, type ShapeRecord2D } from "../shape-records.js";
import { MAX_CCD_IMPACTS_PER_TICK, RADIANS_TO_DEGREES } from "../numeric-policy.js";
import { DynamicAabbBroadPhase2D } from "./broad-phase.js";
import { COLLIDER_SENSOR_2D } from "./contact-cache.js";
import { BODY_TYPE_DYNAMIC_2D } from "./integrator.js";
import { BODY_SLEEPING_2D } from "./solver.js";
import type { BodyStore2D, ColliderStore2D } from "./storage.js";

export const BODY_CCD_2D = 1 << 5;

interface SelectedImpact2D {
  readonly movingCollider: number;
  readonly targetCollider: number;
  readonly timeOfImpact: number;
  readonly normalX: number;
  readonly normalY: number;
}

interface CollisionFilterRecord2D {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}

export class BoundedCcd2D {
  impactCount = 0;
  capCount = 0;
  impactColliderIndices: Int32Array;

  private candidateProxies: Int32Array;
  private readonly shapeShells = new WeakMap<ShapeRecord2D, CRCPhysicsShape2D>();

  constructor(initialCapacity = 4) {
    const capacity = normalizedCapacity(initialCapacity);
    this.candidateProxies = new Int32Array(capacity);
    this.impactColliderIndices = new Int32Array(capacity);
  }

  resolveCandidateBodies(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    broadPhase: DynamicAabbBroadPhase2D,
    bodyIndices: Int32Array,
    bodyCount: number,
    previousPositionX: Float64Array,
    previousPositionY: Float64Array,
    previousRotationRadians: Float64Array,
  ): void {
    this.impactCount = 0;
    this.capCount = 0;
    this.ensureCandidateCapacity(broadPhase.proxyCapacity);
    this.ensureImpactCapacity(Math.max(1, bodyCount * MAX_CCD_IMPACTS_PER_TICK));
    for (let offset = 0; offset < bodyCount; offset += 1) {
      const body = bodyIndices[offset]!;
      if (!this.isEligibleBody(bodies, body)) continue;
      this.resolveBody(
        bodies,
        colliders,
        broadPhase,
        body,
        previousPositionX[body]!,
        previousPositionY[body]!,
        previousRotationRadians[body]!,
      );
    }
  }

  private resolveBody(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    broadPhase: DynamicAabbBroadPhase2D,
    body: number,
    fromX: number,
    fromY: number,
    fromRotation: number,
  ): void {
    let currentX = fromX;
    let currentY = fromY;
    let remainingX = bodies.positionX[body]! - fromX;
    let remainingY = bodies.positionY[body]! - fromY;
    let impacts = 0;
    while ((remainingX !== 0 || remainingY !== 0) && impacts < MAX_CCD_IMPACTS_PER_TICK) {
      const selected = this.findEarliestImpact(
        bodies,
        colliders,
        broadPhase,
        body,
        currentX,
        currentY,
        fromRotation,
        remainingX,
        remainingY,
      );
      if (selected === null) {
        currentX += remainingX;
        currentY += remainingY;
        remainingX = 0;
        remainingY = 0;
        break;
      }
      currentX += remainingX * selected.timeOfImpact;
      currentY += remainingY * selected.timeOfImpact;
      const fraction = 1 - selected.timeOfImpact;
      remainingX *= fraction;
      remainingY *= fraction;
      const restitution = Math.max(
        materialRestitution(colliders.materials[selected.movingCollider]),
        materialRestitution(colliders.materials[selected.targetCollider]),
      );
      const remainingNormal = remainingX * selected.normalX + remainingY * selected.normalY;
      if (remainingNormal < 0) {
        remainingX -= (1 + restitution) * remainingNormal * selected.normalX;
        remainingY -= (1 + restitution) * remainingNormal * selected.normalY;
      }
      const velocityNormal =
        bodies.linearVelocityX[body]! * selected.normalX + bodies.linearVelocityY[body]! * selected.normalY;
      if (velocityNormal < 0) {
        bodies.linearVelocityX[body] -= (1 + restitution) * velocityNormal * selected.normalX;
        bodies.linearVelocityY[body] -= (1 + restitution) * velocityNormal * selected.normalY;
      }
      this.impactColliderIndices[this.impactCount] = selected.targetCollider;
      this.impactCount += 1;
      impacts += 1;
    }
    if (remainingX !== 0 || remainingY !== 0) {
      currentX += remainingX;
      currentY += remainingY;
      if (impacts === MAX_CCD_IMPACTS_PER_TICK) this.capCount += 1;
    }
    bodies.positionX[body] = currentX;
    bodies.positionY[body] = currentY;
  }

  private findEarliestImpact(
    bodies: BodyStore2D,
    colliders: ColliderStore2D,
    broadPhase: DynamicAabbBroadPhase2D,
    body: number,
    fromX: number,
    fromY: number,
    rotationRadians: number,
    translationX: number,
    translationY: number,
  ): SelectedImpact2D | null {
    let selected: SelectedImpact2D | null = null;
    for (let movingCollider = 0; movingCollider < colliders.capacity; movingCollider += 1) {
      const movingGeneration = colliders.generations[movingCollider]!;
      if (!colliders.has(movingCollider, movingGeneration)) continue;
      if (colliders.bodyIndices[movingCollider] !== body) continue;
      if ((colliders.flags[movingCollider]! & COLLIDER_SENSOR_2D) !== 0) continue;
      const movingRecord = colliders.shapes[movingCollider];
      if (movingRecord === null || !isSupportedSolid(movingRecord)) continue;
      const movingShape = this.shapeShell(movingRecord);
      const fromPose = publicPose(fromX, fromY, rotationRadians);
      const start = boundsOfShape2D(movingShape, fromPose);
      const end = boundsOfShape2D(movingShape, publicPose(fromX + translationX, fromY + translationY, rotationRadians));
      const candidateCount = broadPhase.queryAabbInto(
        Math.min(start.min[0], end.min[0]),
        Math.min(start.min[1], end.min[1]),
        Math.max(start.max[0], end.max[0]),
        Math.max(start.max[1], end.max[1]),
        this.candidateProxies,
        0,
        this.candidateProxies.length,
      );
      for (let candidate = 0; candidate < candidateCount; candidate += 1) {
        const proxy = this.candidateProxies[candidate]!;
        const targetCollider = broadPhase.proxyColliderIndices[proxy]!;
        const targetGeneration = broadPhase.proxyColliderGenerations[proxy]!;
        if (!colliders.has(targetCollider, targetGeneration)) continue;
        if (targetCollider === movingCollider) continue;
        const targetBody = colliders.bodyIndices[targetCollider]!;
        if (targetBody === body) continue;
        if ((colliders.flags[targetCollider]! & COLLIDER_SENSOR_2D) !== 0) continue;
        if (!collisionFiltersAllow2D(colliders.filters[movingCollider], colliders.filters[targetCollider])) continue;
        const targetRecord = colliders.shapes[targetCollider];
        if (targetRecord === null || !isSupportedSolid(targetRecord)) continue;
        const hit = shapeCastAgainstShape2D(
          movingShape,
          fromPose,
          [translationX, translationY],
          this.shapeShell(targetRecord),
          publicPose(bodies.positionX[targetBody]!, bodies.positionY[targetBody]!, bodies.rotationRadians[targetBody]!),
        );
        if (hit === null) continue;
        if (
          selected === null ||
          hit.timeOfImpact < selected.timeOfImpact ||
          (hit.timeOfImpact === selected.timeOfImpact &&
            compareColliderIdentity(
              targetCollider,
              targetGeneration,
              selected.targetCollider,
              colliders.generations[selected.targetCollider]!,
            ) < 0)
        ) {
          selected = {
            movingCollider,
            targetCollider,
            timeOfImpact: hit.timeOfImpact,
            normalX: hit.normal[0],
            normalY: hit.normal[1],
          };
        }
      }
    }
    return selected;
  }

  private isEligibleBody(bodies: BodyStore2D, body: number): boolean {
    return (
      body >= 0 &&
      body < bodies.capacity &&
      (bodies.flags[body]! & BODY_TYPE_DYNAMIC_2D) !== 0 &&
      (bodies.flags[body]! & BODY_CCD_2D) !== 0 &&
      (bodies.flags[body]! & BODY_SLEEPING_2D) === 0 &&
      bodies.inverseMass[body]! > 0
    );
  }

  private shapeShell(record: ShapeRecord2D): CRCPhysicsShape2D {
    let shell = this.shapeShells.get(record);
    if (shell === undefined) {
      shell = createShape2D(record);
      this.shapeShells.set(record, shell);
    }
    return shell;
  }

  private ensureCandidateCapacity(required: number): void {
    if (required <= this.candidateProxies.length) return;
    this.candidateProxies = growInt32(this.candidateProxies, normalizedCapacity(required));
  }

  private ensureImpactCapacity(required: number): void {
    if (required <= this.impactColliderIndices.length) return;
    this.impactColliderIndices = growInt32(this.impactColliderIndices, normalizedCapacity(required));
  }
}

export function collisionFiltersAllow2D(first: unknown, second: unknown): boolean {
  const firstFilter = asFilter(first);
  const secondFilter = asFilter(second);
  const firstGroup = integerBits(firstFilter.group ?? 0);
  const secondGroup = integerBits(secondFilter.group ?? 0);
  if (firstGroup !== 0 && firstGroup === secondGroup) return firstGroup > 0;
  const firstCategory = unsignedBits(firstFilter.category ?? 1);
  const secondCategory = unsignedBits(secondFilter.category ?? 1);
  const firstMask = unsignedBits(firstFilter.mask ?? 0xffff_ffff);
  const secondMask = unsignedBits(secondFilter.mask ?? 0xffff_ffff);
  return (firstMask & secondCategory) !== 0 && (secondMask & firstCategory) !== 0;
}

function isSupportedSolid(record: ShapeRecord2D): boolean {
  return record.leaves.length === 1 && record.leaves[0]!.kind !== "segment";
}

function publicPose(x: number, y: number, rotationRadians: number): CRCPhysicsPose2D {
  return {
    position: [x, y],
    rotationDegrees: rotationRadians * RADIANS_TO_DEGREES,
  };
}

function materialRestitution(material: unknown): number {
  if (typeof material !== "object" || material === null) return 0;
  const value = (material as Readonly<{ restitution?: unknown }>).restitution;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function asFilter(value: unknown): CollisionFilterRecord2D {
  return typeof value === "object" && value !== null ? (value as CollisionFilterRecord2D) : {};
}

function unsignedBits(value: number): number {
  return Number.isFinite(value) ? value >>> 0 : 0;
}

function integerBits(value: number): number {
  return Number.isFinite(value) ? value | 0 : 0;
}

function compareColliderIdentity(
  firstIndex: number,
  firstGeneration: number,
  secondIndex: number,
  secondGeneration: number,
): number {
  return firstIndex - secondIndex || firstGeneration - secondGeneration;
}

function normalizedCapacity(required: number): number {
  if (!Number.isInteger(required) || required < 1) {
    throw new RangeError("capacity must be a positive integer.");
  }
  let capacity = 1;
  while (capacity < required) capacity *= 2;
  return capacity;
}

function growInt32(source: Int32Array, capacity: number): Int32Array {
  const result = new Int32Array(capacity);
  result.set(source);
  return result;
}
