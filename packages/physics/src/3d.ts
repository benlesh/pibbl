export * from "./3d-geometry.js";
export * from "./lib/3d/types.js";
import type {
  CRCPhysicsAabb3D,
  CRCPhysicsPose3D,
  CRCPhysicsRay3D,
  CRCPhysicsShape3D,
  CRCPhysicsVector3,
} from "./3d-geometry.js";
import type {
  CRCPhysicsQueryHit3D,
  CRCPhysicsQueryMatch3D,
  CRCPhysicsQueryMode,
  CRCPhysicsQueryOptions3D,
  CRCPhysicsQueryResult3D,
  CRCPhysicsWorldHandle3D,
} from "./lib/3d/types.js";
import {
  collider3D,
  dynamicBody3D,
  kinematicBody3D,
  staticBody3D,
} from "./lib/3d/runtime/descriptors.js";
import {
  PhysicsWorld3D,
  crcPhysicsWorld3D,
} from "./lib/3d/runtime/world-component.js";
import {
  applyForce3D,
  applyImpulse3D,
  applyTorque3D,
  crcPhysicsBody3D,
  disableBody3D,
  enableBody3D,
  setAngularVelocity3D,
  setLinearVelocity3D,
  sleepBody3D,
  teleportBody3D,
  wakeBody3D,
} from "./lib/3d/runtime/body-handle.js";
import { requirePhysicsWorld3DController } from "./lib/3d/runtime/controller.js";

export {
  Box3D,
  Capsule3D,
  Cone3D,
  ConvexHull3D,
  Cylinder3D,
  Ellipsoid3D,
  Heightfield3D,
  PhysicsShape3D,
  type Box3DProps,
  type Capsule3DProps,
  type Cone3DProps,
  type ConvexHull3DProps,
  type Cylinder3DProps,
  type Ellipsoid3DProps,
  type Heightfield3DProps,
  type PhysicsShape3DProps,
} from "./lib/3d/webgl/components.js";

export { PhysicsWorld3D, crcPhysicsWorld3D };
export { collider3D, dynamicBody3D, kinematicBody3D, staticBody3D };
export { crcPhysicsBody3D };
export {
  applyForce3D,
  applyImpulse3D,
  applyTorque3D,
  disableBody3D,
  enableBody3D,
  setAngularVelocity3D,
  setLinearVelocity3D,
  sleepBody3D,
  teleportBody3D,
  wakeBody3D,
};

export function raycast3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  ray: CRCPhysicsRay3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
  return requirePhysicsWorld3DController(world).raycast(ray, options);
}

export function shapeCast3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  shape: CRCPhysicsShape3D,
  from: CRCPhysicsPose3D,
  translation: CRCPhysicsVector3,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D> {
  return requirePhysicsWorld3DController(world).shapeCast(
    shape,
    from,
    translation,
    options,
  );
}

export function overlapShape3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  shape: CRCPhysicsShape3D,
  pose: CRCPhysicsPose3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
  return requirePhysicsWorld3DController(world).overlapShape(shape, pose, options);
}

export function queryAabb3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  bounds: CRCPhysicsAabb3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
  return requirePhysicsWorld3DController(world).queryAabb(bounds, options);
}

export function queryPoint3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  point: CRCPhysicsVector3,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D> {
  return requirePhysicsWorld3DController(world).queryPoint(point, options);
}
