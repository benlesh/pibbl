---
id: api-function-physics-2d
title: 2D physics functions and components
summary: Pibbl-scheduled 2D worlds, descriptors, commands, queries, inspection, Canvas primitives, and pure geometry.
kind: api
slug: physics-2d
apiCategory: function
symbols:
  [
    Capsule2D,
    Chain2D,
    PhysicsDebug2D,
    PhysicsShape2D,
    PhysicsWorld2D,
    Segment2D,
    applyForce2D,
    applyImpulse2D,
    applyTorque2D,
    arcShape2D,
    boundsOfShape2D,
    boxShape2D,
    capsuleShape2D,
    chainShape2D,
    circleShape2D,
    collider2D,
    contactBetweenShapes2D,
    containsPoint2D,
    pibblPhysicsBody2D,
    pibblPhysicsWorld2D,
    disableBody2D,
    distanceBetweenShapes2D,
    dynamicBody2D,
    ellipseShape2D,
    enableBody2D,
    fromPhysicsPoint2D,
    inspectPhysics2D,
    kinematicBody2D,
    massProperties2D,
    overlapShape2D,
    overlapShapes2D,
    polygonShape2D,
    queryAabb2D,
    queryPoint2D,
    raycast2D,
    raycastShape2D,
    roundedBoxShape2D,
    segmentShape2D,
    setAngularVelocity2D,
    setLinearVelocity2D,
    shapeCast2D,
    shapeCastAgainstShape2D,
    sleepBody2D,
    staticBody2D,
    teleportBody2D,
    toPhysicsPoint2D,
    transformShape2D,
    wakeBody2D,
    wedgeShape2D,
    withPhysicsShape2D,
  ]
relatedTypes:
  [PibblPhysicsWorld2DProps, PibblPhysicsBodyHandle2D, PibblPhysicsShape2D]
keywords: [physics, 2d, rapier, collision, query, canvas]
---

# 2D physics functions and components

```tsx
import {
  Capsule2D,
  Chain2D,
  PhysicsDebug2D,
  PhysicsShape2D,
  PhysicsWorld2D,
  Segment2D,
  circleShape2D,
  collider2D,
  pibblPhysicsBody2D,
  pibblPhysicsWorld2D,
  dynamicBody2D,
} from "@pibbl/core/physics/2d";
```

`@pibbl/core/physics/2d` is a component-scoped, Pibbl-scheduled Rapier 2D world. It
does not start a second animation loop. For recipes and interaction examples,
read the [2D physics guide](#/learn/guides/physics-2d). Pure construction and
geometry operations are also exported by `@pibbl/core/physics/2d/geometry`.
The central contracts are
[`PibblPhysicsWorld2DProps`](#/api/types/physics-2d#pibblphysicsworld2dprops),
[`PibblPhysicsBodyHandle2D`](#/api/types/physics-2d#pibblphysicsbodyhandle2d), and
[`PibblPhysicsShape2D`](#/api/types/physics-2d#pibblphysicsshape2d).

## World and Canvas primitives

### `PhysicsWorld2D`

```tsx
const world = (
  <PhysicsWorld2D gravity={[0, 600]} fixedStepMilliseconds={1000 / 60} />
);
```

Creates one world for descendants. It owns fixed-step simulation, collision
delivery, presentation interpolation, and teardown. Default `space="root"`
uses root-logical coordinates; creation-only `space="local"` follows the
world's viewport transform. See
[`PibblPhysicsWorld2DProps`](#/api/types/physics-2d#pibblphysicsworld2dprops).

### `pibblPhysicsWorld2D`

```text
function pibblPhysicsWorld2D(): PibblPhysicsWorldHandle2D;
```

Returns the nearest world while a descendant evaluates. Use it for world
queries, coordinate conversion, and inspection.

### `PhysicsShape2D`, `Capsule2D`, `Segment2D`, and `Chain2D`

Canvas primitives that paint exact supported shapes and accept `physics`:

```tsx
const primitiveShapes = (
  <>
    <PhysicsShape2D style={{ shape: circleShape2D({ radius: 8 }) }} />
    <Capsule2D style={{ start: [0, 0], end: [36, 0], radius: 5 }} />
    <Segment2D style={{ start: [0, 0], end: [60, 0] }} />
    <Chain2D
      style={{
        points: [
          [0, 0],
          [40, 0],
          [40, 24],
        ],
        radius: 2,
      }}
    />
  </>
);
```

Their props and styles are covered by the
[2D physics types](#/api/types/physics-2d#physicsshape2dprops).

### `PhysicsDebug2D`

```tsx
const debug = (
  <PhysicsDebug2D world={pibblPhysicsWorld2D()} color="rgba(0, 160, 255, .8)" />
);
```

Renders a read-only diagnostic overlay of committed collider bounds, centers
of mass, contact points, and contact normals. It creates no pointer targets,
does not advance the world, and is appropriate for tests and development-only
scenes.

### `withPhysicsShape2D`

```text
function withPhysicsShape2D<P, I, ResolvedStyle>(
  component: PibblPrimitiveComponent<P, I>,
  options: { resolveShape(style: Readonly<ResolvedStyle>): PibblPhysicsShape2D },
): PibblPrimitiveComponent<
  P & PibblPhysicsPrimitiveProps2D,
  I & { physics?: PibblPhysicsAttachment2D }
>;
```

Derives a primitive that resolves an immutable shape synchronously from its
resolved style. This is the custom-primitive extension point; it does not mount
a world or alter paint order.

## Descriptor and handle factories

```text
function dynamicBody2D(
  options?: PibblPhysicsDynamicBody2DOptions,
): PibblPhysicsBodyAttachment2D;
function staticBody2D(
  options?: PibblPhysicsStaticBody2DOptions,
): PibblPhysicsBodyAttachment2D;
function kinematicBody2D(
  options?: PibblPhysicsKinematicBody2DOptions,
): PibblPhysicsBodyAttachment2D;
function collider2D(
  options?: PibblPhysicsColliderConfiguration2D,
): PibblPhysicsColliderAttachment2D;
function pibblPhysicsBody2D(): PibblPhysicsBodyHandle2D;
```

Attach a body descriptor to a primitive and child `collider2D()` descriptors to
its geometry. Dynamic bodies receive forces and contacts; static bodies remain
fixed; kinematic bodies follow declared signals and affect other bodies. The
body primitive's authored transform supplies its initial pose. `pibblPhysicsBody2D`
is a stable hook handle that can bind to one live body at a time.

## Commands

Commands enter Pibbl's Begin phase and take effect on the next admitted physics
frame; none mutate a world during render.

```text
function applyForce2D(
  body: PibblPhysicsBodyHandle2D,
  force: PibblPhysicsVector2,
  options?: { at?: PibblPhysicsVector2; wake?: boolean },
): void;
function applyImpulse2D(
  body: PibblPhysicsBodyHandle2D,
  impulse: PibblPhysicsVector2,
  options?: { at?: PibblPhysicsVector2; wake?: boolean },
): void;
function applyTorque2D(body: PibblPhysicsBodyHandle2D, torque: number): void;
function setLinearVelocity2D(
  body: PibblPhysicsBodyHandle2D,
  velocity: PibblPhysicsVector2,
): void;
function setAngularVelocity2D(
  body: PibblPhysicsBodyHandle2D,
  degreesPerSecond: number,
): void;
function teleportBody2D(
  body: PibblPhysicsBodyHandle2D,
  pose: PibblPhysicsPose2D,
): void;
function wakeBody2D(body: PibblPhysicsBodyHandle2D): void;
function sleepBody2D(body: PibblPhysicsBodyHandle2D): void;
function disableBody2D(body: PibblPhysicsBodyHandle2D): void;
function enableBody2D(
  body: PibblPhysicsBodyHandle2D,
  options?: { velocity?: "zero" | "preserve" },
): void;
```

`at` is a world-space application point. Teleportation sets a pose without a
sweep. Re-enabling uses zero velocity unless `preserve` is selected.

## Mounted-world queries and observation

```text
function raycast2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  ray: PibblPhysicsRay2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D>;
function shapeCast2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryHit2D>;
function overlapShape2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D>;
function queryAabb2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  bounds: PibblPhysicsAabb2D,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D>;
function queryPoint2D<Mode extends PibblPhysicsQueryMode = "closest">(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
  options?: PibblPhysicsQueryOptions2D<Mode>,
): PibblPhysicsQueryResult2D<Mode, PibblPhysicsQueryMatch2D>;
function toPhysicsPoint2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
): PibblPhysicsVector2;
function fromPhysicsPoint2D(
  world: PibblPhysicsWorldHandle2D,
  point: PibblPhysicsVector2,
): PibblPhysicsVector2;
function inspectPhysics2D(
  world: PibblPhysicsWorldHandle2D,
): PibblPhysicsInspection2D;
function inspectPhysics2D(
  body: PibblPhysicsBodyHandle2D,
): PibblPhysicsBodyInspection2D | undefined;
```

Queries read the committed world and accept filtering options. Modes produce a
closest nullable record, a boolean, or all records. The point helpers cross
between root-logical and simulation coordinates. `inspectPhysics2D(world)`
returns an immutable JSON-safe world observation without advancing, restoring,
or scheduling. `inspectPhysics2D(body)` returns only that body's observation;
an unbound or stale handle returns `undefined`.

## Pure shapes and geometry

`circleShape2D`, `ellipseShape2D`, `boxShape2D`, `roundedBoxShape2D`,
`capsuleShape2D`, `arcShape2D`, `wedgeShape2D`, `segmentShape2D`,
`chainShape2D`, and `polygonShape2D` each create an immutable
[`PibblPhysicsShape2D`](#/api/types/physics-2d#pibblphysicsshape2d) from their
corresponding option object.

```text
function boundsOfShape2D(shape: PibblPhysicsShape2D): PibblPhysicsAabb2D;
function massProperties2D(
  shape: PibblPhysicsShape2D,
  density?: number,
): PibblPhysicsMassProperties2D;
function transformShape2D(
  shape: PibblPhysicsShape2D,
  transform: PibblPhysicsTransform2D,
): PibblPhysicsShape2D;
function containsPoint2D(
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  point: PibblPhysicsVector2,
): boolean;
function distanceBetweenShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): PibblPhysicsDistance2D;
function overlapShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): boolean;
function contactBetweenShapes2D(
  first: PibblPhysicsShape2D,
  firstPose: PibblPhysicsPose2D,
  second: PibblPhysicsShape2D,
  secondPose: PibblPhysicsPose2D,
): PibblPhysicsShapeContact2D | null;
function raycastShape2D(
  shape: PibblPhysicsShape2D,
  pose: PibblPhysicsPose2D,
  ray: PibblPhysicsRay2D,
  options?: { includeInitialOverlap?: boolean },
): PibblPhysicsShapeHit2D | null;
function shapeCastAgainstShape2D(
  moving: PibblPhysicsShape2D,
  from: PibblPhysicsPose2D,
  translation: PibblPhysicsVector2,
  target: PibblPhysicsShape2D,
  targetPose: PibblPhysicsPose2D,
  options?: { includeInitialOverlap?: boolean },
): PibblPhysicsShapeHit2D | null;
```

These deterministic functions need neither a mounted world nor Pibbl core.
`transformShape2D` returns a new descriptor. Contact normals point from the
second shape toward the first.
