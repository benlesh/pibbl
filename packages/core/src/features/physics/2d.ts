import type { CRCPhysicsInspection2D, CRCPhysicsBodyInspection2D } from "./lib/2d/inspection-types.js";
import type {
  CRCPhysicsAabb2D,
  CRCPhysicsPose2D,
  CRCPhysicsRay2D,
  CRCPhysicsShape2D,
  CRCPhysicsVector2,
} from "./2d-geometry.js";
import type {
  CRCPhysicsQueryHit2D,
  CRCPhysicsQueryMatch2D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions2D,
  CRCPhysicsQueryResult2D,
  CRCPhysicsBodyHandle2D,
  CRCPhysicsWorldHandle2D,
} from "./lib/2d/types.js";
import {
  collider2D,
  dynamicBody2D,
  kinematicBody2D,
  staticBody2D,
} from "./lib/2d/runtime/descriptors.js";
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
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
  crcPhysicsBody2D,
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

export { crcPhysicsBody2D };

export { crcPhysicsWorld2D };

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
 * @param world - World to query. See {@link CRCPhysicsWorldHandle2D}.
 * @param ray - Ray origin, direction, and travel limit. See {@link CRCPhysicsRay2D}.
 * @param options - Result mode and collider filtering. See {@link CRCPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one hit or null for closest mode, or ordered hits for all mode.
 * See {@link CRCPhysicsQueryResult2D} , {@link CRCPhysicsQueryHit2D} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsRay2D}
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link CRCPhysicsQueryHit2D}
 * @see {@link CRCPhysicsQueryMode}
 */
export function raycast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  ray: CRCPhysicsRay2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
  return requirePhysicsWorld2DController(world).raycast(ray, options);
}

/**
 * Sweeps a shape through the committed world using the selected result mode and filters.
 *
 * @param world - World to query. See {@link CRCPhysicsWorldHandle2D}.
 * @param shape - Shape to sweep. See {@link CRCPhysicsShape2D}.
 * @param from - Initial shape pose. See {@link CRCPhysicsPose2D}.
 * @param translation - Translation vector for the sweep. See {@link CRCPhysicsVector2}.
 * @param options - Result mode and collider filtering. See {@link CRCPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one hit or null for closest mode, or ordered hits for all mode.
 * See {@link CRCPhysicsQueryResult2D} , {@link CRCPhysicsQueryHit2D} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link CRCPhysicsQueryHit2D}
 * @see {@link CRCPhysicsQueryMode}
 */
export function shapeCast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
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
 * @param world - World to query. See {@link CRCPhysicsWorldHandle2D}.
 * @param shape - Shape to test for overlaps. See {@link CRCPhysicsShape2D}.
 * @param pose - Shape pose. See {@link CRCPhysicsPose2D}.
 * @param options - Result mode and collider filtering. See {@link CRCPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link CRCPhysicsQueryResult2D} , {@link CRCPhysicsQueryMatch2D} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsShape2D}
 * @see {@link CRCPhysicsPose2D}
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link CRCPhysicsQueryMatch2D}
 * @see {@link CRCPhysicsQueryMode}
 */
export function overlapShape2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).overlapShape(
    shape,
    pose,
    options,
  );
}

/**
 * Queries committed world colliders intersecting an axis-aligned region.
 *
 * @param world - World to query. See {@link CRCPhysicsWorldHandle2D}.
 * @param bounds - Axis-aligned query bounds in public coordinates. See {@link CRCPhysicsAabb2D}.
 * @param options - Result mode and collider filtering. See {@link CRCPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link CRCPhysicsQueryResult2D} , {@link CRCPhysicsQueryMatch2D} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsAabb2D}
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link CRCPhysicsQueryMatch2D}
 * @see {@link CRCPhysicsQueryMode}
 */
export function queryAabb2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  bounds: CRCPhysicsAabb2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, options);
}

/**
 * Queries committed world colliders containing a point.
 *
 * @param world - World to query. See {@link CRCPhysicsWorldHandle2D}.
 * @param point - Point in public coordinates. See {@link CRCPhysicsVector2}.
 * @param options - Result mode and collider filtering. See {@link CRCPhysicsQueryOptions2D}.
 * @returns A boolean for any mode, one match or null for closest mode, or matches for all mode.
 * See {@link CRCPhysicsQueryResult2D} , {@link CRCPhysicsQueryMatch2D} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsVector2}
 * @see {@link CRCPhysicsQueryOptions2D}
 * @see {@link CRCPhysicsQueryResult2D}
 * @see {@link CRCPhysicsQueryMatch2D}
 * @see {@link CRCPhysicsQueryMode}
 */
export function queryPoint2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryPoint(point, options);
}

/**
 * Converts root-logical pointer coordinates to this world's simulation space.
 *
 * @param world - World providing unit and coordinate conversion. See
 * {@link CRCPhysicsWorldHandle2D} .
 * @param point - Point in public Canvas coordinates. See {@link CRCPhysicsVector2}.
 * @returns The equivalent point in this world's local simulation space. See
 * {@link CRCPhysicsVector2} .
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsVector2}
 */
export function toPhysicsPoint2D(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
): CRCPhysicsVector2 {
  return requirePhysicsWorld2DController(world).convertPoint(point, false);
}

/**
 * Converts a simulation-space point to root-logical Canvas coordinates.
 *
 * @param world - World providing unit and coordinate conversion. See
 * {@link CRCPhysicsWorldHandle2D} .
 * @param point - Point in this world's local simulation space. See {@link CRCPhysicsVector2}.
 * @returns The equivalent point in public Canvas coordinates. See {@link CRCPhysicsVector2}.
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsVector2}
 */
export function fromPhysicsPoint2D(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
): CRCPhysicsVector2 {
  return requirePhysicsWorld2DController(world).convertPoint(point, true);
}

export type {
  CRCPhysicsInspection2D,
  CRCPhysicsBodyInspection2D,
  CRCPhysicsColliderInspection2D,
  CRCPhysicsContactInspection2D,
} from "./lib/2d/inspection-types.js";

/**
 * Returns immutable JSON-safe observations without advancing the simulation. See
 * {@link CRCPhysicsWorldHandle2D}.
 * @param world - World to inspect. See {@link CRCPhysicsWorldHandle2D}.
 * @returns Current world simulation and ownership diagnostics.
 */
export function inspectPhysics2D(
  world: CRCPhysicsWorldHandle2D,
): import("./lib/2d/inspection-types.js").CRCPhysicsInspection2D;

/**
 * Returns the immutable observation for this currently bound body, if any. See
 * {@link CRCPhysicsBodyHandle2D}.
 * @param body - Body to inspect. See {@link CRCPhysicsBodyHandle2D}.
 * @returns Current body diagnostics, or undefined when the handle has no live body.
 */
export function inspectPhysics2D(
  body: CRCPhysicsBodyHandle2D,
): import("./lib/2d/inspection-types.js").CRCPhysicsBodyInspection2D | undefined;
/**
 * Returns a diagnostic snapshot of a live world or body, or undefined when unavailable.
 *
 * @param target - World or body handle to inspect. See {@link CRCPhysicsWorldHandle2D} ,
 * {@link CRCPhysicsBodyHandle2D} .
 * @returns The corresponding diagnostics, or undefined for an unmounted body.
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 * @see {@link CRCPhysicsBodyHandle2D}
 * @see {@link CRCPhysicsInspection2D}
 * @see {@link CRCPhysicsBodyInspection2D}
 */
export function inspectPhysics2D(
  target: CRCPhysicsWorldHandle2D | CRCPhysicsBodyHandle2D,
):
  | import("./lib/2d/inspection-types.js").CRCPhysicsInspection2D
  | import("./lib/2d/inspection-types.js").CRCPhysicsBodyInspection2D
  | undefined {
  if (isPhysicsBodyHandle2D(target)) {
    const binding = physicsBodyHandleBinding2D(target);
    return binding?.controller.inspectBody(binding.bodyId);
  }
  return requirePhysicsWorld2DController(target).inspect();
}

export {
  PhysicsDebug2D,
  type CRCPhysicsDebug2DProps,
} from "./lib/2d/canvas/debug.js";

/**
 * A borrowed committed solid batch, structurally compatible with a flow obstacle source.
 *
 * @param world - World supplying collider geometry. See {@link CRCPhysicsWorldHandle2D}.
 * @returns An obstacle source whose read method returns the current revision and packed geometry.
 *
 * @see {@link CRCPhysicsWorldHandle2D}
 */
export function physicsObstacles2D(world: CRCPhysicsWorldHandle2D): Readonly<{
  read(): Readonly<{ revision: number; boxes: Float64Array; ellipses: Float64Array; polygons: Float64Array }>;
}> {
  return requirePhysicsWorld2DController(world).getObstacleSource();
}
