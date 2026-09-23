---
id: api-types-physics-3d
title: 3D physics types
summary: Public world, body, collider, query, event, and geometry contracts for @crc/physics/3d.
kind: api
slug: physics-3d
apiCategory: types
symbols:
  [
    Box3DProps,
    Capsule3DProps,
    Cone3DProps,
    ConvexHull3DProps,
    CRCPhysicsAabb3D,
    CRCPhysicsAttachment3D,
    CRCPhysicsAxisLocks3D,
    CRCPhysicsBodyAttachment3D,
    CRCPhysicsBodyHandle3D,
    CRCPhysicsBodyStateEvent3D,
    CRCPhysicsBodyStateHandler3D,
    CRCPhysicsColliderAttachment3D,
    CRCPhysicsColliderConfiguration3D,
    CRCPhysicsColliderHandle3D,
    CRCPhysicsCollisionEvent3D,
    CRCPhysicsCollisionFilter,
    CRCPhysicsCollisionHandler3D,
    CRCPhysicsContactPoint3D,
    CRCPhysicsDistance3D,
    CRCPhysicsDynamicBody3DOptions,
    CRCPhysicsHitHandler3D,
    CRCPhysicsKinematicBody3DOptions,
    CRCPhysicsKinematicTarget3D,
    CRCPhysicsMassProperties3D,
    CRCPhysicsMatrix3,
    CRCPhysicsOverlapEvent3D,
    CRCPhysicsOverlapHandler3D,
    CRCPhysicsPose3D,
    CRCPhysicsQuaternion,
    CRCPhysicsQueryHit3D,
    CRCPhysicsQueryMatch3D,
    CRCPhysicsQueryMode,
    CRCPhysicsQueryOptions3D,
    CRCPhysicsQueryResult3D,
    CRCPhysicsRay3D,
    CRCPhysicsShape3D,
    CRCPhysicsShapeContact3D,
    CRCPhysicsShapeHit3D,
    CRCPhysicsSolverOptions,
    CRCPhysicsStaticBody3DOptions,
    CRCPhysicsTransform3D,
    CRCPhysicsVector3,
    CRCPhysicsWorld3DProps,
    CRCPhysicsWorldHandle3D,
    Cylinder3DProps,
    Ellipsoid3DProps,
    Heightfield3DProps,
    PhysicsShape3DProps,
  ]
---

# 3D physics types

Import runtime-connected types from `@crc/physics/3d`. Geometry-only consumers
may import the geometry types from `@crc/physics/3d/geometry` without loading CRC
or WebGL.

## CRCPhysicsVector3

A readonly `[x, y, z]` tuple.

## CRCPhysicsQuaternion

A readonly canonical `[x, y, z, w]` orientation tuple.

## CRCPhysicsMatrix3

A readonly row-major 3×3 matrix tuple used for inertia.

## CRCPhysicsPose3D

Rigid translation and quaternion orientation. Scale is never part of a body
pose; authored scale is baked into collider geometry.

## CRCPhysicsTransform3D

An alias of `CRCPhysicsPose3D` for pure geometry transforms.

## CRCPhysicsAabb3D

Readonly `min` and `max` world-space corners.

## CRCPhysicsRay3D

Readonly origin, direction, and nonnegative maximum distance.

## CRCPhysicsShape3D

The nominal immutable shape descriptor accepted by pure operations, colliders,
and `PhysicsShape3D`.

## CRCPhysicsMassProperties3D

Volume, center of mass, mass, and inertia tensor derived from a shape.

## CRCPhysicsDistance3D

Signed separation, closest points, and normal between two shapes.

## CRCPhysicsContactPoint3D

One pair of surface points and their signed separation.

## CRCPhysicsShapeContact3D

A contact normal and stable list of contact points.

## CRCPhysicsShapeHit3D

Point, normal, distance, time of impact, and optional triangle metadata from a
pure cast.

## CRCPhysicsAxisLocks3D

Independent optional `x`, `y`, and `z` translation or rotation locks.

## CRCPhysicsCollisionFilter

Optional category, mask, and signed collision group used by colliders and
queries.

## CRCPhysicsColliderConfiguration3D

Shape, rigid offset, density, material, sensor/mass flags, filter, tag, and
collision/overlap handlers for one collider.

## CRCPhysicsDynamicBody3DOptions

Dynamic-body enabled state, handle, initial velocities, damping, gravity scale,
mass, locks, sleeping, CCD, re-enable velocity policy, and optional self
collider.

## CRCPhysicsStaticBody3DOptions

Static-body enabled state, handle, and optional self collider.

## CRCPhysicsKinematicTarget3D

Independent position and orientation signal bindings read in the physics lane.

## CRCPhysicsKinematicBody3DOptions

Kinematic enabled state, handle, partial target bindings, sleeping policy, and
optional self collider.

## CRCPhysicsSolverOptions

Optional deterministic velocity- and position-iteration counts.

## CRCPhysicsWorld3DProps

World timing, gravity, interpolation, sleeping, solver, lifecycle handlers, and
children accepted by `PhysicsWorld3D`.

## CRCPhysicsAttachment3D

The union accepted by augmented WebGL `physics` props.

## CRCPhysicsBodyAttachment3D

Nominal body attachment returned by the three body descriptor functions.

## CRCPhysicsColliderAttachment3D

Nominal collider attachment returned by `collider3D`.

## CRCPhysicsBodyHandle3D

A generation-bound body endpoint with readonly committed-state signals.

## CRCPhysicsColliderHandle3D

A generation-bound collider identity returned by queries and events.

## CRCPhysicsWorldHandle3D

A nominal world endpoint with a committed query revision signal.

## CRCPhysicsQueryMode

`"closest"`, `"any"`, or `"all"` result selection.

## CRCPhysicsQueryOptions3D

Mode, sensor selection, collision filter, and body/collider exclusions.

## CRCPhysicsQueryHit3D

A cast hit plus body/collider handles, generations, and tag.

## CRCPhysicsQueryMatch3D

A non-cast query match with handles, generations, and tag.

## CRCPhysicsQueryResult3D

Conditional result type: boolean for `"any"`, a readonly array for `"all"`,
or one nullable result for `"closest"`.

## CRCPhysicsCollisionEvent3D

Ordered collision facts for one receiving collider, including contact points,
normal impulse, tags, generation-bound body/collider handles, and simulation
tick.

## CRCPhysicsOverlapEvent3D

Ordered sensor overlap facts for one receiving collider.

## CRCPhysicsBodyStateEvent3D

Ordered sleep/wake facts for one body and tick.

## CRCPhysicsCollisionHandler3D

Handler receiving `CRCPhysicsCollisionEvent3D`.

## CRCPhysicsHitHandler3D

Handler receiving collision impact events.

## CRCPhysicsOverlapHandler3D

Handler receiving `CRCPhysicsOverlapEvent3D`.

## CRCPhysicsBodyStateHandler3D

Handler receiving `CRCPhysicsBodyStateEvent3D`.

## PhysicsShape3DProps

`MeshProps` with an immutable `shape` in place of raw geometry.

## Box3DProps

Box dimensions, optional center/orientation, and physics-shape mesh props.

## Ellipsoid3DProps

Radii, optional center/orientation, and physics-shape mesh props.

## Capsule3DProps

Segment endpoints, radius, and physics-shape mesh props.

## Cylinder3DProps

Radius, half-height, optional center/orientation, and physics-shape mesh props.

## Cone3DProps

The cylinder-axis fields interpreted as a cone.

## ConvexHull3DProps

Finite hull points and physics-shape mesh props.

## Heightfield3DProps

Grid dimensions, heights, cell scaling, origin, and physics-shape mesh props.
