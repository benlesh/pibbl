---
id: api-function-physics-2d
title: 2D physics functions and components
summary: CRC-scheduled 2D worlds, descriptors, commands, queries, inspection, Canvas primitives, and pure geometry.
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
    crcPhysicsBody2D,
    crcPhysicsWorld2D,
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
  [CRCPhysicsWorld2DProps, CRCPhysicsBodyHandle2D, CRCPhysicsShape2D]
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
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  dynamicBody2D,
} from "@crc/core/physics/2d";
```

`@crc/core/physics/2d` is a component-scoped, CRC-scheduled Rapier 2D world. It
does not start a second animation loop. For recipes and interaction examples,
read the [2D physics guide](#/learn/guides/physics-2d). Pure construction and
geometry operations are also exported by `@crc/core/physics/2d/geometry`.
The central contracts are
[`CRCPhysicsWorld2DProps`](#/api/types/physics-2d#crcphysicsworld2dprops),
[`CRCPhysicsBodyHandle2D`](#/api/types/physics-2d#crcphysicsbodyhandle2d), and
[`CRCPhysicsShape2D`](#/api/types/physics-2d#crcphysicsshape2d).

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
[`CRCPhysicsWorld2DProps`](#/api/types/physics-2d#crcphysicsworld2dprops).

### `crcPhysicsWorld2D`

```text
function crcPhysicsWorld2D(): CRCPhysicsWorldHandle2D;
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
  <PhysicsDebug2D world={crcPhysicsWorld2D()} color="rgba(0, 160, 255, .8)" />
);
```

Renders a read-only diagnostic overlay of committed collider bounds, centers
of mass, contact points, and contact normals. It creates no pointer targets,
does not advance the world, and is appropriate for tests and development-only
scenes.

### `withPhysicsShape2D`

```text
function withPhysicsShape2D<P, I, ResolvedStyle>(
  component: CRCPrimitiveComponent<P, I>,
  options: { resolveShape(style: Readonly<ResolvedStyle>): CRCPhysicsShape2D },
): CRCPrimitiveComponent<
  P & CRCPhysicsPrimitiveProps2D,
  I & { physics?: CRCPhysicsAttachment2D }
>;
```

Derives a primitive that resolves an immutable shape synchronously from its
resolved style. This is the custom-primitive extension point; it does not mount
a world or alter paint order.

## Descriptor and handle factories

```text
function dynamicBody2D(
  options?: CRCPhysicsDynamicBody2DOptions,
): CRCPhysicsBodyAttachment2D;
function staticBody2D(
  options?: CRCPhysicsStaticBody2DOptions,
): CRCPhysicsBodyAttachment2D;
function kinematicBody2D(
  options?: CRCPhysicsKinematicBody2DOptions,
): CRCPhysicsBodyAttachment2D;
function collider2D(
  options?: CRCPhysicsColliderConfiguration2D,
): CRCPhysicsColliderAttachment2D;
function crcPhysicsBody2D(): CRCPhysicsBodyHandle2D;
```

Attach a body descriptor to a primitive and child `collider2D()` descriptors to
its geometry. Dynamic bodies receive forces and contacts; static bodies remain
fixed; kinematic bodies follow declared signals and affect other bodies. The
body primitive's authored transform supplies its initial pose. `crcPhysicsBody2D`
is a stable hook handle that can bind to one live body at a time.

## Commands

Commands enter CRC's Begin phase and take effect on the next admitted physics
frame; none mutate a world during render.

```text
function applyForce2D(
  body: CRCPhysicsBodyHandle2D,
  force: CRCPhysicsVector2,
  options?: { at?: CRCPhysicsVector2; wake?: boolean },
): void;
function applyImpulse2D(
  body: CRCPhysicsBodyHandle2D,
  impulse: CRCPhysicsVector2,
  options?: { at?: CRCPhysicsVector2; wake?: boolean },
): void;
function applyTorque2D(body: CRCPhysicsBodyHandle2D, torque: number): void;
function setLinearVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  velocity: CRCPhysicsVector2,
): void;
function setAngularVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  degreesPerSecond: number,
): void;
function teleportBody2D(
  body: CRCPhysicsBodyHandle2D,
  pose: CRCPhysicsPose2D,
): void;
function wakeBody2D(body: CRCPhysicsBodyHandle2D): void;
function sleepBody2D(body: CRCPhysicsBodyHandle2D): void;
function disableBody2D(body: CRCPhysicsBodyHandle2D): void;
function enableBody2D(
  body: CRCPhysicsBodyHandle2D,
  options?: { velocity?: "zero" | "preserve" },
): void;
```

`at` is a world-space application point. Teleportation sets a pose without a
sweep. Re-enabling uses zero velocity unless `preserve` is selected.

## Mounted-world queries and observation

```text
function raycast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  ray: CRCPhysicsRay2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
function shapeCast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;
function overlapShape2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
function queryAabb2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  bounds: CRCPhysicsAabb2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
function queryPoint2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
function toPhysicsPoint2D(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
): CRCPhysicsVector2;
function fromPhysicsPoint2D(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
): CRCPhysicsVector2;
function inspectPhysics2D(
  world: CRCPhysicsWorldHandle2D,
): CRCPhysicsInspection2D;
function inspectPhysics2D(
  body: CRCPhysicsBodyHandle2D,
): CRCPhysicsBodyInspection2D | undefined;
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
[`CRCPhysicsShape2D`](#/api/types/physics-2d#crcphysicsshape2d) from their
corresponding option object.

```text
function boundsOfShape2D(shape: CRCPhysicsShape2D): CRCPhysicsAabb2D;
function massProperties2D(
  shape: CRCPhysicsShape2D,
  density?: number,
): CRCPhysicsMassProperties2D;
function transformShape2D(
  shape: CRCPhysicsShape2D,
  transform: CRCPhysicsTransform2D,
): CRCPhysicsShape2D;
function containsPoint2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  point: CRCPhysicsVector2,
): boolean;
function distanceBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsDistance2D;
function overlapShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): boolean;
function contactBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsShapeContact2D | null;
function raycastShape2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  ray: CRCPhysicsRay2D,
  options?: { includeInitialOverlap?: boolean },
): CRCPhysicsShapeHit2D | null;
function shapeCastAgainstShape2D(
  moving: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  target: CRCPhysicsShape2D,
  targetPose: CRCPhysicsPose2D,
  options?: { includeInitialOverlap?: boolean },
): CRCPhysicsShapeHit2D | null;
```

These deterministic functions need neither a mounted world nor CRC core.
`transformShape2D` returns a new descriptor. Contact normals point from the
second shape toward the first.
