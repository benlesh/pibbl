---
id: api-types-physics-2d
title: 2D physics types
summary: World, body, collider, query, event, inspection, Canvas-shape, and pure-geometry contracts.
kind: api
slug: physics-2d
apiCategory: types
symbols:
  [
    PibblPhysicsAabb2D,
    PibblPhysicsAttachment2D,
    PibblPhysicsBodyAttachment2D,
    PibblPhysicsBodyHandle2D,
    PibblPhysicsBodyInspection2D,
    PibblPhysicsBodyStateEvent2D,
    PibblPhysicsBodyStateHandler2D,
    PibblPhysicsColliderAttachment2D,
    PibblPhysicsColliderConfiguration2D,
    PibblPhysicsColliderHandle2D,
    PibblPhysicsColliderInspection2D,
    PibblPhysicsCollisionEvent2D,
    PibblPhysicsCollisionFilter,
    PibblPhysicsCollisionHandler2D,
    PibblPhysicsContactInspection2D,
    PibblPhysicsContactPoint2D,
    PibblPhysicsDebug2DProps,
    PibblPhysicsDistance2D,
    PibblPhysicsDynamicBody2DOptions,
    PibblPhysicsHitHandler2D,
    PibblPhysicsInspection2D,
    PibblPhysicsKinematicBody2DOptions,
    PibblPhysicsKinematicTarget2D,
    PibblPhysicsMassProperties2D,
    PibblPhysicsOverlapEvent2D,
    PibblPhysicsOverlapHandler2D,
    PibblPhysicsPose2D,
    PibblPhysicsPrimitiveProps2D,
    PibblPhysicsQueryHit2D,
    PibblPhysicsQueryMatch2D,
    PibblPhysicsQueryMode,
    PibblPhysicsQueryOptions2D,
    PibblPhysicsQueryResult2D,
    PibblPhysicsRay2D,
    PibblPhysicsShape2D,
    PibblPhysicsShapeContact2D,
    PibblPhysicsShapeHit2D,
    PibblPhysicsSolverOptions,
    PibblPhysicsStaticBody2DOptions,
    PibblPhysicsTransform2D,
    PibblPhysicsVector2,
    PibblPhysicsWorld2DProps,
    PibblPhysicsWorldHandle2D,
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

Import these contracts with `type` from `@pibbl/core/physics/2d`. The pure geometry
subset is also available from `@pibbl/core/physics/2d/geometry`. For composition
recipes, see the [2D physics guide](#/learn/guides/physics-2d).

## Geometry

## `PibblPhysicsVector2`

Readonly `[x, y]` coordinates.

## `PibblPhysicsPose2D`

A position and Canvas-compatible `rotationDegrees`; transform is the pose alias
used by pure shape transformation.

## `PibblPhysicsTransform2D`

Alias of `PibblPhysicsPose2D` used by `transformShape2D`.

## `PibblPhysicsAabb2D`

Readonly minimum and maximum vector bounds.

## `PibblPhysicsRay2D`

Origin, non-zero direction, and non-negative maximum distance.

## `PibblPhysicsShape2D`

Nominal immutable descriptor made by a public shape factory. Its structure is
opaque; do not create one with an object literal.

## `PibblPhysicsMassProperties2D`

Area, centroid, mass, and rotational inertia for a shape and density.

## `PibblPhysicsDistance2D`

Signed separation, closest points, and a normal from the second shape toward
the first.

## `PibblPhysicsContactPoint2D`

Witness points with separation, and an overlap manifold with a second-to-first
normal and one or more points.

## `PibblPhysicsShapeContact2D`

The overlap manifold returned by pure contact queries: a normal and readonly
contact points.

## `PibblPhysicsShapeHit2D`

Ray or shape-cast point, normal, distance, and normalized time of impact.

## World, descriptors, and handles

## `PibblPhysicsWorld2DProps`

Signal-aware `PhysicsWorld2D` input: creation-only coordinate `space`, gravity,
fixed step, catch-up cap, interpolation, sleeping, solver settings, sleep and
wake handlers, error handler, and children. `space` is `"root"` or
creation-only `"local"`.

## `PibblPhysicsSolverOptions`

Reactive 1-through-32 iteration counts. Legacy public `velocityIterations`
maps to Rapier `numSolverIterations`; `positionIterations` maps to
`numInternalPgsIterations`.

## `PibblPhysicsWorldHandle2D`

Nominal `pibblPhysicsWorld2D()` result with a readonly revision signal.

## `PibblPhysicsAttachment2D`

Nominal values accepted by a Pibbl `physics` prop. Create them with descriptor
functions, never object literals.

## `PibblPhysicsBodyAttachment2D`

Nominal body attachment made by `dynamicBody2D`, `staticBody2D`, or
`kinematicBody2D`.

## `PibblPhysicsColliderAttachment2D`

Nominal collider attachment made by `collider2D`.

## `PibblPhysicsDynamicBody2DOptions`

Dynamic configuration: enabled state, supplied handle, initial velocities,
damping, gravity scale, automatic or explicit mass, fixed rotation, sleep,
CCD, re-enable velocity mode, and optional inline collider.

## `PibblPhysicsStaticBody2DOptions`

Static enabled state, supplied handle, and optional inline collider.

## `PibblPhysicsKinematicBody2DOptions`

Kinematic configuration with optional position and rotation signals. Targets
are sampled by Pibbl's shared scheduler.

## `PibblPhysicsKinematicTarget2D`

Optional readonly position and rotation signal targets for a kinematic body.

## `PibblPhysicsColliderConfiguration2D`

Supplied or inferred shape, local offset and rotation, density, friction,
restitution, sensor flag, mass contribution, filtering, tag, and event
callbacks.

## `PibblPhysicsCollisionFilter`

Category, mask, and group values that determine eligible interactions and
queries.

## `PibblPhysicsBodyHandle2D`

Stable endpoint with readonly signals for pose, linear and angular velocity,
sleeping, enabled state, and generation.

## `PibblPhysicsColliderHandle2D`

Nominal identity used in query filtering and returned records.

## Query and event contracts

## `PibblPhysicsQueryMode`

`"closest"`, `"any"`, and `"all"` return a nullable record, boolean, or
readonly records. Options filter sensors, collision categories, and a body or
collider exclusion; the conditional result type follows the mode.

## `PibblPhysicsQueryOptions2D`

Sensor, collision-filter, and body/collider-exclusion input for a world query.

## `PibblPhysicsQueryResult2D`

Conditional query result: nullable closest record, boolean, or readonly array.

## `PibblPhysicsQueryHit2D`

Committed-world records with body and collider handles, generations, and the
arbitrary collider tag. A hit also carries cast geometry.

## `PibblPhysicsQueryMatch2D`

Committed overlap or point-query record with endpoint handles, generations,
and original tag.

## `PibblPhysicsCollisionEvent2D`

Solid-contact callback data: both endpoints, second-to-self normal, contact
points, total normal impulse, tick, and tags.

## `PibblPhysicsCollisionHandler2D`

Callback accepting a `PibblPhysicsCollisionEvent2D`.

## `PibblPhysicsOverlapEvent2D`

Sensor-overlap callback data: both endpoints, tick, and tags.

## `PibblPhysicsOverlapHandler2D`

Callback accepting a `PibblPhysicsOverlapEvent2D`.

## `PibblPhysicsHitHandler2D`

Collision-event callback for contact impacts.

## `PibblPhysicsBodyStateEvent2D`

Sleep or wake notification with body, sleeping state, and simulation tick.

## `PibblPhysicsBodyStateHandler2D`

Callback accepting a `PibblPhysicsBodyStateEvent2D`.

## Inspection and debug drawing

## `PibblPhysicsInspection2D`

Immutable JSON-safe world observation: engine identity, coordinate space,
revision, tick, advance/failure state, bodies, colliders, and contacts. It is
not a serialization or restore format.

## `PibblPhysicsBodyInspection2D`

Body identity, generation, type, enabled and sleeping state, simulation and
presentation poses, center of mass, velocities, and applicable mass.

## `PibblPhysicsColliderInspection2D`

Collider and owner identities, sensor state, serializable string label, shape
kinds, and committed bounds.

## `PibblPhysicsContactInspection2D`

Collider identities, sensor state, second-to-first normal, points, and normal
impulse.

## `PibblPhysicsDebug2DProps`

Input for `PhysicsDebug2D`: required world handle and optional Canvas color.
The overlay is read-only and has no pointer target.

## Canvas shape inputs

## `PibblPhysicsPrimitiveProps2D`

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
