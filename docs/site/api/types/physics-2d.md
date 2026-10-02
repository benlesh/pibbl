---
id: api-types-physics-2d
title: 2D physics types
summary: World, body, collider, query, event, inspection, Canvas-shape, and pure-geometry contracts.
kind: api
slug: physics-2d
apiCategory: types
symbols:
  [
    CRCPhysicsAabb2D,
    CRCPhysicsAttachment2D,
    CRCPhysicsBodyAttachment2D,
    CRCPhysicsBodyHandle2D,
    CRCPhysicsBodyInspection2D,
    CRCPhysicsBodyStateEvent2D,
    CRCPhysicsBodyStateHandler2D,
    CRCPhysicsColliderAttachment2D,
    CRCPhysicsColliderConfiguration2D,
    CRCPhysicsColliderHandle2D,
    CRCPhysicsColliderInspection2D,
    CRCPhysicsCollisionEvent2D,
    CRCPhysicsCollisionFilter,
    CRCPhysicsCollisionHandler2D,
    CRCPhysicsContactInspection2D,
    CRCPhysicsContactPoint2D,
    CRCPhysicsDebug2DProps,
    CRCPhysicsDistance2D,
    CRCPhysicsDynamicBody2DOptions,
    CRCPhysicsHitHandler2D,
    CRCPhysicsInspection2D,
    CRCPhysicsKinematicBody2DOptions,
    CRCPhysicsKinematicTarget2D,
    CRCPhysicsMassProperties2D,
    CRCPhysicsOverlapEvent2D,
    CRCPhysicsOverlapHandler2D,
    CRCPhysicsPose2D,
    CRCPhysicsPrimitiveProps2D,
    CRCPhysicsQueryHit2D,
    CRCPhysicsQueryMatch2D,
    CRCPhysicsQueryMode,
    CRCPhysicsQueryOptions2D,
    CRCPhysicsQueryResult2D,
    CRCPhysicsRay2D,
    CRCPhysicsShape2D,
    CRCPhysicsShapeContact2D,
    CRCPhysicsShapeHit2D,
    CRCPhysicsSolverOptions,
    CRCPhysicsStaticBody2DOptions,
    CRCPhysicsTransform2D,
    CRCPhysicsVector2,
    CRCPhysicsWorld2DProps,
    CRCPhysicsWorldHandle2D,
    Capsule2DProps,
    Capsule2DStyle,
    Chain2DProps,
    Chain2DStyle,
    PhysicsShape2DProps,
    PhysicsShape2DStyle,
    Segment2DProps,
    Segment2DStyle,
  ]
keywords: [physics, 2d, types, collision, rapier]
---

# 2D physics types

Import these contracts with `type` from `@crc/core/physics/2d`. The pure geometry
subset is also available from `@crc/core/physics/2d/geometry`. For composition
recipes, see the [2D physics guide](#/learn/guides/physics-2d).

## Geometry

## `CRCPhysicsVector2`

Readonly `[x, y]` coordinates.

## `CRCPhysicsPose2D`

A position and Canvas-compatible `rotationDegrees`; transform is the pose alias
used by pure shape transformation.

## `CRCPhysicsTransform2D`

Alias of `CRCPhysicsPose2D` used by `transformShape2D`.

## `CRCPhysicsAabb2D`

Readonly minimum and maximum vector bounds.

## `CRCPhysicsRay2D`

Origin, non-zero direction, and non-negative maximum distance.

## `CRCPhysicsShape2D`

Nominal immutable descriptor made by a public shape factory. Its structure is
opaque; do not create one with an object literal.

## `CRCPhysicsMassProperties2D`

Area, centroid, mass, and rotational inertia for a shape and density.

## `CRCPhysicsDistance2D`

Signed separation, closest points, and a normal from the second shape toward
the first.

## `CRCPhysicsContactPoint2D`

Witness points with separation, and an overlap manifold with a second-to-first
normal and one or more points.

## `CRCPhysicsShapeContact2D`

The overlap manifold returned by pure contact queries: a normal and readonly
contact points.

## `CRCPhysicsShapeHit2D`

Ray or shape-cast point, normal, distance, and normalized time of impact.

## World, descriptors, and handles

## `CRCPhysicsWorld2DProps`

Signal-aware `PhysicsWorld2D` input: creation-only coordinate `space`, gravity,
fixed step, catch-up cap, interpolation, sleeping, solver settings, sleep and
wake handlers, error handler, and children. `space` is `"root"` or
creation-only `"local"`.

## `CRCPhysicsSolverOptions`

Reactive 1-through-32 iteration counts. Legacy public `velocityIterations`
maps to Rapier `numSolverIterations`; `positionIterations` maps to
`numInternalPgsIterations`.

## `CRCPhysicsWorldHandle2D`

Nominal `crcPhysicsWorld2D()` result with a readonly revision signal.

## `CRCPhysicsAttachment2D`

Nominal values accepted by a CRC `physics` prop. Create them with descriptor
functions, never object literals.

## `CRCPhysicsBodyAttachment2D`

Nominal body attachment made by `dynamicBody2D`, `staticBody2D`, or
`kinematicBody2D`.

## `CRCPhysicsColliderAttachment2D`

Nominal collider attachment made by `collider2D`.

## `CRCPhysicsDynamicBody2DOptions`

Dynamic configuration: enabled state, supplied handle, initial velocities,
damping, gravity scale, automatic or explicit mass, fixed rotation, sleep,
CCD, re-enable velocity mode, and optional inline collider.

## `CRCPhysicsStaticBody2DOptions`

Static enabled state, supplied handle, and optional inline collider.

## `CRCPhysicsKinematicBody2DOptions`

Kinematic configuration with optional position and rotation signals. Targets
are sampled by CRC's shared scheduler.

## `CRCPhysicsKinematicTarget2D`

Optional readonly position and rotation signal targets for a kinematic body.

## `CRCPhysicsColliderConfiguration2D`

Supplied or inferred shape, local offset and rotation, density, friction,
restitution, sensor flag, mass contribution, filtering, tag, and event
callbacks.

## `CRCPhysicsCollisionFilter`

Category, mask, and group values that determine eligible interactions and
queries.

## `CRCPhysicsBodyHandle2D`

Stable endpoint with readonly signals for pose, linear and angular velocity,
sleeping, enabled state, and generation.

## `CRCPhysicsColliderHandle2D`

Nominal identity used in query filtering and returned records.

## Query and event contracts

## `CRCPhysicsQueryMode`

`"closest"`, `"any"`, and `"all"` return a nullable record, boolean, or
readonly records. Options filter sensors, collision categories, and a body or
collider exclusion; the conditional result type follows the mode.

## `CRCPhysicsQueryOptions2D`

Sensor, collision-filter, and body/collider-exclusion input for a world query.

## `CRCPhysicsQueryResult2D`

Conditional query result: nullable closest record, boolean, or readonly array.

## `CRCPhysicsQueryHit2D`

Committed-world records with body and collider handles, generations, and the
arbitrary collider tag. A hit also carries cast geometry.

## `CRCPhysicsQueryMatch2D`

Committed overlap or point-query record with endpoint handles, generations,
and original tag.

## `CRCPhysicsCollisionEvent2D`

Solid-contact callback data: both endpoints, second-to-self normal, contact
points, total normal impulse, tick, and tags.

## `CRCPhysicsCollisionHandler2D`

Callback accepting a `CRCPhysicsCollisionEvent2D`.

## `CRCPhysicsOverlapEvent2D`

Sensor-overlap callback data: both endpoints, tick, and tags.

## `CRCPhysicsOverlapHandler2D`

Callback accepting a `CRCPhysicsOverlapEvent2D`.

## `CRCPhysicsHitHandler2D`

Collision-event callback for contact impacts.

## `CRCPhysicsBodyStateEvent2D`

Sleep or wake notification with body, sleeping state, and simulation tick.

## `CRCPhysicsBodyStateHandler2D`

Callback accepting a `CRCPhysicsBodyStateEvent2D`.

## Inspection and debug drawing

## `CRCPhysicsInspection2D`

Immutable JSON-safe world observation: engine identity, coordinate space,
revision, tick, advance/failure state, bodies, colliders, and contacts. It is
not a serialization or restore format.

## `CRCPhysicsBodyInspection2D`

Body identity, generation, type, enabled and sleeping state, simulation and
presentation poses, center of mass, velocities, and applicable mass.

## `CRCPhysicsColliderInspection2D`

Collider and owner identities, sensor state, serializable string label, shape
kinds, and committed bounds.

## `CRCPhysicsContactInspection2D`

Collider identities, sensor state, second-to-first normal, points, and normal
impulse.

## `CRCPhysicsDebug2DProps`

Input for `PhysicsDebug2D`: required world handle and optional Canvas color.
The overlay is read-only and has no pointer target.

## Canvas shape inputs

## `CRCPhysicsPrimitiveProps2D`

Shared event, keyboard, and `physics` props for physics-aware primitives.

## `PhysicsShape2DProps`

Props and style for a supplied shape. Style requires `shape`, supports normal
Canvas system, paint, cursor, box, and layout fields, plus interaction width.

## `PhysicsShape2DStyle`

The specified style input for `PhysicsShape2D`.

## `Capsule2DProps`

Props and style for `start`, `end`, and positive `radius`.

## `Capsule2DStyle`

Specified Canvas and capsule geometry style for `Capsule2D`.

## `Segment2DProps`

Props and stroked segment style with endpoints and interaction width; no fill.

## `Segment2DStyle`

Specified stroked Canvas style and endpoint geometry for `Segment2D`.

## `Chain2DProps`

Props and style for points, optional closure, non-negative radius, and
interaction width.

## `Chain2DStyle`

Specified Canvas and chain geometry style for `Chain2D`.
