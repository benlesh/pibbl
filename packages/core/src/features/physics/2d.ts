import type { PibblPhysicsInspection2D, PibblPhysicsBodyInspection2D } from "./lib/2d/inspection-types.js";
import type {
  PibblPhysicsAabb2D,
  PibblPhysicsPose2D,
  PibblPhysicsRay2D,
  PibblPhysicsShape2D,
  PibblPhysicsVector2,
} from "./2d-geometry.js";
import type {
  PibblPhysicsQueryHit2D,
  PibblPhysicsQueryMatch2D,
  PibblPhysicsQueryOptions2D,
  PibblPhysicsBodyHandle2D,
  PibblPhysicsWorldHandle2D,
} from "./lib/2d/types.js";
import {
  collider2D,
  dynamicBody2D,
  kinematicBody2D,
  staticBody2D,
} from "./lib/2d/runtime/descriptors.js";
import {
  PhysicsWorld2D,
  pibblPhysicsWorld2D,
} from "./lib/2d/runtime/world-component.js";
import {
  Capsule2D,
  Chain2D,
  PhysicsShape2D,
  Segment2D,
} from "./lib/2d/canvas/components.js";
import { withPhysicsShape2D } from "./lib/2d/canvas/custom.js";
import {
  applyForce2D,
  applyImpulse2D,
  applyTorque2D,
  pibblPhysicsBody2D,
  disableBody2D,
  enableBody2D,
  isPhysicsBodyHandle2D,
  physicsBodyHandleBinding2D,
  setAngularVelocity2D,
  setLinearVelocity2D,
  sleepBody2D,
  teleportBody2D,
  wakeBody2D,
} from "./lib/2d/runtime/body-handle.js";
import { requirePhysicsWorld2DController } from "./lib/2d/runtime/controller.js";

export * from "./2d-geometry.js";
export {
  raycastShape2D,
  shapeCastAgainstShape2D,
} from "./lib/2d/collision/casts.js";
export * from "./lib/2d/types.js";

export { PhysicsWorld2D };
export { PhysicsShape2D, Capsule2D, Segment2D, Chain2D };

export { collider2D, dynamicBody2D, kinematicBody2D, staticBody2D };
export { withPhysicsShape2D };

export { pibblPhysicsBody2D };

export { pibblPhysicsWorld2D };

export {
  applyForce2D,
  applyImpulse2D,
  applyTorque2D,
  disableBody2D,
  enableBody2D,
  setAngularVelocity2D,
  setLinearVelocity2D,
  sleepBody2D,
  teleportBody2D,
  wakeBody2D,
};

/**
 * Tests whether the committed world has any ray match, stopping at the first match.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link PibblPhysicsRay2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Whether a matching collider exists.
 */
export function raycastAny2D(
  world: PibblPhysicsWorldHandle2D,
  ray: PibblPhysicsRay2D,
  options?: PibblPhysicsQueryOptions2D,
): boolean {
  return requirePhysicsWorld2DController(world).raycast(ray, { ...options, mode: "any" });
}

/**
 * Returns the first ray result ordered by time of impact, distance, then collider identity, or null.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link PibblPhysicsRay2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns One result or null. See {@link PibblPhysicsQueryHit2D}.
 */
export function raycastClosest2D(
  world: PibblPhysicsWorldHandle2D,
  ray: PibblPhysicsRay2D,
  options?: PibblPhysicsQueryOptions2D,
): PibblPhysicsQueryHit2D | null {
  return requirePhysicsWorld2DController(world).raycast(ray, { ...options, mode: "closest" });
}

/**
 * Returns all ray results ordered by time of impact, distance, then collider identity as a frozen array.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link PibblPhysicsRay2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Frozen results, empty when no collider matches. See {@link PibblPhysicsQueryHit2D}.
 */
export function raycastAll2D(
  world: PibblPhysicsWorldHandle2D,
  ray: PibblPhysicsRay2D,
  options?: PibblPhysicsQueryOptions2D,
): readonly PibblPhysicsQueryHit2D[] {
  return requirePhysicsWorld2DController(world).raycast(ray, { ...options, mode: "all" });
}

/**
 * Tests whether the committed world has any shape sweep match, stopping at the first match.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to sweep. See {@link PibblPhysicsShape2D}.
 * @param from - Initial shape pose. See {@link PibblPhysicsPose2D}.
 * @param translation - Translation vector for the sweep. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Whether a matching collider exists.
 */
export function shapeCastAny2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): boolean {
  return requirePhysicsWorld2DController(world).shapeCast(shape, from, translation, { ...options, mode: "any" });
}

/**
 * Returns the first shape sweep result ordered by time of impact, distance, then collider identity, or null.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to sweep. See {@link PibblPhysicsShape2D}.
 * @param from - Initial shape pose. See {@link PibblPhysicsPose2D}.
 * @param translation - Translation vector for the sweep. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns One result or null. See {@link PibblPhysicsQueryHit2D}.
 */
export function shapeCastClosest2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): PibblPhysicsQueryHit2D | null {
  return requirePhysicsWorld2DController(world).shapeCast(shape, from, translation, { ...options, mode: "closest" });
}

/**
 * Returns all shape sweep results ordered by time of impact, distance, then collider identity as a frozen array.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to sweep. See {@link PibblPhysicsShape2D}.
 * @param from - Initial shape pose. See {@link PibblPhysicsPose2D}.
 * @param translation - Translation vector for the sweep. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Frozen results, empty when no collider matches. See {@link PibblPhysicsQueryHit2D}.
 */
export function shapeCastAll2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): readonly PibblPhysicsQueryHit2D[] {
  return requirePhysicsWorld2DController(world).shapeCast(shape, from, translation, { ...options, mode: "all" });
}

/**
 * Tests whether the committed world has any shape overlap match, stopping at the first match.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to test. See {@link PibblPhysicsShape2D}.
 * @param pose - Shape pose. See {@link PibblPhysicsPose2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Whether a matching collider exists.
 */
export function hasShapeOverlap2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  options?: PibblPhysicsQueryOptions2D,
): boolean {
  return requirePhysicsWorld2DController(world).overlapShape(shape, pose, { ...options, mode: "any" });
}

/**
 * Returns the first shape overlap result ordered by collider index, then generation, or null.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to test. See {@link PibblPhysicsShape2D}.
 * @param pose - Shape pose. See {@link PibblPhysicsPose2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns One result or null. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findShapeOverlap2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  options?: PibblPhysicsQueryOptions2D,
): PibblPhysicsQueryMatch2D | null {
  return requirePhysicsWorld2DController(world).overlapShape(shape, pose, { ...options, mode: "closest" });
}

/**
 * Returns all shape overlap results ordered by collider index, then generation as a frozen array.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to test. See {@link PibblPhysicsShape2D}.
 * @param pose - Shape pose. See {@link PibblPhysicsPose2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Frozen results, empty when no collider matches. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findAllShapeOverlaps2D(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  options?: PibblPhysicsQueryOptions2D,
): readonly PibblPhysicsQueryMatch2D[] {
  return requirePhysicsWorld2DController(world).overlapShape(shape, pose, { ...options, mode: "all" });
}

/**
 * Tests whether the committed world has any bounds intersection match, stopping at the first match.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param bounds - Axis-aligned query bounds. See {@link PibblPhysicsAabb2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Whether a matching collider exists.
 */
export function hasAabbMatch2D(
  world: PibblPhysicsWorldHandle2D,
  bounds: PibblPhysicsAabb2D,
  options?: PibblPhysicsQueryOptions2D,
): boolean {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, { ...options, mode: "any" });
}

/**
 * Returns the first bounds intersection result ordered by collider index, then generation, or null.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param bounds - Axis-aligned query bounds. See {@link PibblPhysicsAabb2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns One result or null. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findAabbMatch2D(
  world: PibblPhysicsWorldHandle2D,
  bounds: PibblPhysicsAabb2D,
  options?: PibblPhysicsQueryOptions2D,
): PibblPhysicsQueryMatch2D | null {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, { ...options, mode: "closest" });
}

/**
 * Returns all bounds intersection results ordered by collider index, then generation as a frozen array.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param bounds - Axis-aligned query bounds. See {@link PibblPhysicsAabb2D}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Frozen results, empty when no collider matches. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findAllAabbMatches2D(
  world: PibblPhysicsWorldHandle2D,
  bounds: PibblPhysicsAabb2D,
  options?: PibblPhysicsQueryOptions2D,
): readonly PibblPhysicsQueryMatch2D[] {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, { ...options, mode: "all" });
}

/**
 * Tests whether the committed world has any point containment match, stopping at the first match.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param point - Point in simulation coordinates. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Whether a matching collider exists.
 */
export function hasPointMatch2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): boolean {
  return requirePhysicsWorld2DController(world).queryPoint(point, { ...options, mode: "any" });
}

/**
 * Returns the first point containment result ordered by collider index, then generation, or null.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param point - Point in simulation coordinates. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns One result or null. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findPointMatch2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): PibblPhysicsQueryMatch2D | null {
  return requirePhysicsWorld2DController(world).queryPoint(point, { ...options, mode: "closest" });
}

/**
 * Returns all point containment results ordered by collider index, then generation as a frozen array.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param point - Point in simulation coordinates. See {@link PibblPhysicsVector2}.
 * @param options - Sensor policy and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns Frozen results, empty when no collider matches. See {@link PibblPhysicsQueryMatch2D}.
 */
export function findAllPointMatches2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D,
): readonly PibblPhysicsQueryMatch2D[] {
  return requirePhysicsWorld2DController(world).queryPoint(point, { ...options, mode: "all" });
}

/**
 * Converts root-logical pointer coordinates to this world's simulation space.
 *
 * @param world - World providing unit and coordinate conversion. See
 * {@link PibblPhysicsWorldHandle2D} .
 * @param point - Point in public Canvas coordinates. See {@link PibblPhysicsVector2}.
 * @returns The equivalent point in this world's local simulation space. See
 * {@link PibblPhysicsVector2} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsVector2}
 */
export function toPhysicsPoint2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
): PibblPhysicsVector2 {
  return requirePhysicsWorld2DController(world).convertPoint(point, false);
}

/**
 * Converts a simulation-space point to root-logical Canvas coordinates.
 *
 * @param world - World providing unit and coordinate conversion. See
 * {@link PibblPhysicsWorldHandle2D} .
 * @param point - Point in this world's local simulation space. See {@link PibblPhysicsVector2}.
 * @returns The equivalent point in public Canvas coordinates. See {@link PibblPhysicsVector2}.
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsVector2}
 */
export function fromPhysicsPoint2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
): PibblPhysicsVector2 {
  return requirePhysicsWorld2DController(world).convertPoint(point, true);
}

export type {
  PibblPhysicsInspection2D,
  PibblPhysicsBodyInspection2D,
  PibblPhysicsColliderInspection2D,
  PibblPhysicsContactInspection2D,
} from "./lib/2d/inspection-types.js";

/**
 * Returns immutable JSON-safe observations without advancing the simulation. See
 * {@link PibblPhysicsWorldHandle2D}.
 * @param world - World to inspect. See {@link PibblPhysicsWorldHandle2D}.
 * @returns Current world simulation and ownership diagnostics.
 */
export function inspectPhysics2D(
  world: PibblPhysicsWorldHandle2D,
): import("./lib/2d/inspection-types.js").PibblPhysicsInspection2D;

/**
 * Returns the immutable observation for this currently bound body, if any. See
 * {@link PibblPhysicsBodyHandle2D}.
 * @param body - Body to inspect. See {@link PibblPhysicsBodyHandle2D}.
 * @returns Current body diagnostics, or undefined when the handle has no live body.
 */
export function inspectPhysics2D(
  body: PibblPhysicsBodyHandle2D,
): import("./lib/2d/inspection-types.js").PibblPhysicsBodyInspection2D | undefined;
/**
 * Returns a diagnostic snapshot of a live world or body, or undefined when unavailable.
 *
 * @param target - World or body handle to inspect. See {@link PibblPhysicsWorldHandle2D} ,
 * {@link PibblPhysicsBodyHandle2D} .
 * @returns The corresponding diagnostics, or undefined for an unmounted body.
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsBodyHandle2D}
 * @see {@link PibblPhysicsInspection2D}
 * @see {@link PibblPhysicsBodyInspection2D}
 */
export function inspectPhysics2D(
  target: PibblPhysicsWorldHandle2D | PibblPhysicsBodyHandle2D,
):
  | import("./lib/2d/inspection-types.js").PibblPhysicsInspection2D
  | import("./lib/2d/inspection-types.js").PibblPhysicsBodyInspection2D
  | undefined {
  if (isPhysicsBodyHandle2D(target)) {
    const binding = physicsBodyHandleBinding2D(target);
    return binding?.controller.inspectBody(binding.bodyId);
  }
  return requirePhysicsWorld2DController(target).inspect();
}

export {
  PhysicsDebug2D,
  type PibblPhysicsDebug2DProps,
} from "./lib/2d/canvas/debug.js";

/**
 * A borrowed committed solid batch, structurally compatible with a flow obstacle source.
 *
 * @param world - World supplying collider geometry. See {@link PibblPhysicsWorldHandle2D}.
 * @returns An obstacle source whose read method returns the current revision and packed geometry.
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 */
export function physicsObstacles2D(world: PibblPhysicsWorldHandle2D): Readonly<{
  read(): Readonly<{ revision: number; boxes: Float64Array; ellipses: Float64Array; polygons: Float64Array }>;
}> {
  return requirePhysicsWorld2DController(world).getObstacleSource();
}
