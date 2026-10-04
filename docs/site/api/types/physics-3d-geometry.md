---
id: api-types-physics-3d-geometry
title: 3D physics geometry types
summary: Renderer-independent vectors, poses, shapes, contacts, casts, and mass properties.
kind: api
slug: physics-3d-geometry
apiCategory: types
symbols:
  [
    CRCPhysicsAabb3D,
    CRCPhysicsContactPoint3D,
    CRCPhysicsDistance3D,
    CRCPhysicsMassProperties3D,
    CRCPhysicsMatrix3,
    CRCPhysicsPose3D,
    CRCPhysicsQuaternion,
    CRCPhysicsRay3D,
    CRCPhysicsShape3D,
    CRCPhysicsShapeContact3D,
    CRCPhysicsShapeHit3D,
    CRCPhysicsTransform3D,
    CRCPhysicsVector3,
  ]
---

# 3D physics geometry types

Import these contracts with `type` from `@crc/core/physics/3d/geometry`.

## `CRCPhysicsAabb3D`

An axis-aligned minimum and maximum bound.

## `CRCPhysicsContactPoint3D`

One world-space contact position, normal, and penetration depth.

## `CRCPhysicsDistance3D`

The closest points, separating normal, and signed distance for two shapes.

## `CRCPhysicsMassProperties3D`

Volume, center of mass, and inertia information for one shape and density.

## `CRCPhysicsMatrix3`

A readonly three-by-three matrix used by inertia and transform results.

## `CRCPhysicsPose3D`

A position plus quaternion rotation.

## `CRCPhysicsQuaternion`

A readonly XYZW rotation quaternion.

## `CRCPhysicsRay3D`

A ray origin, normalized direction, and query distance.

## `CRCPhysicsShape3D`

The immutable closed box, sphere, ellipsoid, capsule, cylinder, cone,
convex-hull, triangle-mesh, or heightfield union.

## `CRCPhysicsShapeContact3D`

The contact manifold returned for two overlapping shapes.

## `CRCPhysicsShapeHit3D`

A ray- or shape-cast hit with distance, position, and normal.

## `CRCPhysicsTransform3D`

A position, rotation, and scale used by the pure geometry operations.

## `CRCPhysicsVector3`

A readonly XYZ vector tuple.
