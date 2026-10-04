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

export function raycast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  ray: CRCPhysicsRay2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D> {
  return requirePhysicsWorld2DController(world).raycast(ray, options);
}

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

export function queryAabb2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  bounds: CRCPhysicsAabb2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryAabb(bounds, options);
}

export function queryPoint2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D> {
  return requirePhysicsWorld2DController(world).queryPoint(point, options);
}

/** Converts root-logical pointer coordinates to this world's simulation space. */
export function toPhysicsPoint2D(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
): CRCPhysicsVector2 {
  return requirePhysicsWorld2DController(world).convertPoint(point, false);
}

/** Converts a simulation-space point to root-logical Canvas coordinates. */
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

/** Returns immutable JSON-safe observations without advancing the simulation. */
export function inspectPhysics2D(
  world: CRCPhysicsWorldHandle2D,
): import("./lib/2d/inspection-types.js").CRCPhysicsInspection2D;

/** Returns the immutable observation for this currently bound body, if any. */
export function inspectPhysics2D(
  body: CRCPhysicsBodyHandle2D,
): import("./lib/2d/inspection-types.js").CRCPhysicsBodyInspection2D | undefined;
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

/** A borrowed committed solid batch, structurally compatible with a flow obstacle source. */
export function physicsObstacles2D(world: CRCPhysicsWorldHandle2D): Readonly<{
  read(): Readonly<{ revision: number; boxes: Float64Array; ellipses: Float64Array; polygons: Float64Array }>;
}> {
  return requirePhysicsWorld2DController(world).getObstacleSource();
}
