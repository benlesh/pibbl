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
