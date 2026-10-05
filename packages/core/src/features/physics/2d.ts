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
  PibblPhysicsQueryMode,
  PibblPhysicsQueryOptions2D,
  PibblPhysicsQueryResult2D,
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
 * Queries the committed world with a ray using the selected result mode and filters.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link PibblPhysicsRay2D}.
 * @param options - Result mode and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one hit or null for closest mode, or ordered hits for all mode.
 * See {@link PibblPhysicsQueryResult2D} , {@link PibblPhysicsQueryHit2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsRay2D}
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link PibblPhysicsQueryHit2D}
 * @see {@link PibblPhysicsQueryMode}
 */
export function raycast2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  ray: PibblPhysicsRay2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D> {
  return requirePhysicsWorld2DController(world).raycast(ray, options);
}

/**
 * Sweeps a shape through the committed world using the selected result mode and filters.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to sweep. See {@link PibblPhysicsShape2D}.
 * @param from - Initial shape pose. See {@link PibblPhysicsPose2D}.
 * @param translation - Translation vector for the sweep. See {@link PibblPhysicsVector2}.
 * @param options - Result mode and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one hit or null for closest mode, or ordered hits for all mode.
 * See {@link PibblPhysicsQueryResult2D} , {@link PibblPhysicsQueryHit2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link PibblPhysicsQueryHit2D}
 * @see {@link PibblPhysicsQueryMode}
 */
export function shapeCast2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D> {
  return requirePhysicsWorld2DController(world).shapeCast(
    shape,
    from,
    translation,
    options,
  );
}

/**
 * Queries committed world colliders overlapping a posed shape.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param shape - Shape to test for overlaps. See {@link PibblPhysicsShape2D}.
 * @param pose - Shape pose. See {@link PibblPhysicsPose2D}.
 * @param options - Result mode and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link PibblPhysicsQueryResult2D} , {@link PibblPhysicsQueryMatch2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsShape2D}
 * @see {@link PibblPhysicsPose2D}
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link PibblPhysicsQueryMatch2D}
 * @see {@link PibblPhysicsQueryMode}
 */
export function overlapShape2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).overlapShape(
    shape,
    pose,
    options,
  );
}

/**
 * Queries committed world colliders intersecting an axis-aligned region.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param bounds - Axis-aligned query bounds in public coordinates. See {@link PibblPhysicsAabb2D}.
 * @param options - Result mode and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link PibblPhysicsQueryResult2D} , {@link PibblPhysicsQueryMatch2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsAabb2D}
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link PibblPhysicsQueryMatch2D}
 * @see {@link PibblPhysicsQueryMode}
 */
export function queryAabb2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  bounds: PibblPhysicsAabb2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, options);
}

/**
 * Queries committed world colliders containing a point.
 *
 * @param world - World to query. See {@link PibblPhysicsWorldHandle2D}.
 * @param point - Point in public coordinates. See {@link PibblPhysicsVector2}.
 * @param options - Result mode and collider filtering. See {@link PibblPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link PibblPhysicsQueryResult2D} , {@link PibblPhysicsQueryMatch2D} .
 *
 * @see {@link PibblPhysicsWorldHandle2D}
 * @see {@link PibblPhysicsVector2}
 * @see {@link PibblPhysicsQueryOptions2D}
 * @see {@link PibblPhysicsQueryResult2D}
 * @see {@link PibblPhysicsQueryMatch2D}
 * @see {@link PibblPhysicsQueryMode}
 */
export function queryPoint2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryPoint(point, options);
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
