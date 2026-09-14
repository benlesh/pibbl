# First-class CRC-owned physics design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved design; current shipped behavior remains governed by `docs/design/`
> until implementation lands.

Status: design approved in conversation on 2026-09-14; written-spec review
pending.

Date: 2026-09-14

## Summary

CRC will add an optional official `@crc/physics` package with independent
`@crc/physics/2d` and `@crc/physics/3d` entry points. CRC will own the physics
implementation end to end. The package will not wrap, embed, download, or
delegate runtime behavior to a third-party engine.

Physics is a stateful simulation system, not an animation definition and not a
second renderer. Every mounted `PhysicsWorld2D` or `PhysicsWorld3D` joins the
existing realm scheduler as one world-level participant. It creates no
`requestAnimationFrame`, timer, worker loop, or per-body scheduler
registration. One CRC frame orders animation sampling before physics, commits
animation inputs and physics outputs together, and renders the resulting state
once:

```text
Begin
  -> Advance: animation
  -> Advance: physics
  -> Commit
  -> Plan
  -> Render
  -> Complete
```

Each world advances authoritative state in fixed-duration ticks derived from
the realm's logical frame time. A scheduled render may occur at any time. The
world runs the bounded number of complete physics ticks that have elapsed,
retains the fractional remainder, and derives an interpolated presentation
pose for that render. Fixed ticks are synchronous work inside Advance, not
independent scheduling.

The normal authoring path combines one body and one inferred collider:

```tsx
<Rectangle physics={dynamicBody2D()} />
<Cube physics={dynamicBody3D()} />
```

Bodies and colliders remain distinct internally. `collider2D()` and
`collider3D()` attach additional geometry to the nearest ancestor body for
compound objects. A sensor is an ordinary collider with `sensor: true`: it
reports overlaps but produces no collision response.

Transform ownership is exclusive. A dynamic body's pose belongs to physics. A
kinematic body's pose belongs to the application or CRC animation while the
body remains a moving collider. Disabling physics removes the body from the
solver and returns pose ownership to authored style or animation. No supported
mode lets animation and physics both write the same pose.

All current geometric Canvas and WebGL primitives accept a typed `physics`
prop after the corresponding physics entry point is imported. CRC infers an
exact or documented deterministic collider where its source geometry is
inspectable; opaque or platform-dependent geometry requires an explicit
collider. Every physics shape also has CRC-owned drawing support, and custom
primitives can declare a pure collider-shape resolver without a global
registry.

Two-dimensional and three-dimensional worlds share the scheduler and
transaction model but remain different solvers. They do not collide directly.
A future 2.5D adapter may extrude 2D geometry or constrain 3D bodies to a plane,
placing every participating body in one 3D solver rather than coupling two
incompatible simulations.

## Context and research evidence

The design is informed by established engine boundaries without adopting an
engine dependency:

- [Box2D simulation](https://box2d.org/documentation/md_simulation.html)
  separates bodies from shapes, supports multiple solid or sensor shapes per
  body, recommends a fixed time step, exposes body events after a world step,
  sleeps simulation islands, and bases deterministic ordering on creation
  order.
- [Box2D shape APIs](https://box2d.org/documentation/group__shape.html) cover
  circles, capsules, segments, chains, convex polygons, filters, materials,
  point tests, ray casts, sensors, and mass contribution.
- [Matter.js](https://brm.io/matter-js/docs/index.html) demonstrates ergonomic
  JavaScript-facing bodies, composites, constraints, events, sleeping, and
  scene queries, while keeping its optional runner separate from explicit
  engine updates.
- [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)
  demonstrates the value of identical initialization, step counts, and
  creation/removal order, as well as versioned world snapshots for later
  rollback tooling.
- [Jolt Physics architecture](https://jrouwe.github.io/JoltPhysics/) reinforces
  rigid-body motion types, broad- and narrow-phase separation, sleeping,
  shape queries, and the need to sort externally visible results rather than
  relying on internal traversal or callback order.

These projects are research evidence only. CRC will use no runtime code,
binary, WebAssembly module, global registry, worker, or transitive engine
dependency from them.

CRC's shipped contracts constrain the design more strongly than generic game
engine practice:

- one scheduler singleton already owns Begin, Advance, Commit, Plan, Render,
  and Complete;
- Advance work may publish signal values only through the scheduler staging
  batch;
- animation definitions use logical time, component-owned playback, writer
  leases, and one shared Commit;
- Canvas rendering is immediate-mode, while explicit `Layer` and `WebGLLayer`
  instances are the only retained rendering boundaries;
- WebGL geometry, scene composition, picking, bitmap publication, and GPU
  resources are owned by `@crc/webgl`; and
- official packages integrate only through the version-coupled
  `@crc/core/internal` friend entry.

Physics must extend those contracts rather than install a conventional game
loop beside them.

## Goals

- Provide useful deterministic rigid-body physics for both Canvas 2D and CRC
  WebGL 3D scenes.
- Keep the initial implementation and all runtime dependencies wholly owned by
  CRC.
- Use the existing realm scheduler, logical time, staged signal batch, render
  planning, and completion delivery.
- Schedule at most one host frame for every active root, animation, Layer,
  WebGL island, and physics world in the realm.
- Register one Advance participant per awake world, never one per body,
  collider, contact, joint, or query.
- Support arbitrary render cadence through fixed simulation ticks, bounded
  catch-up, and optional presentation interpolation.
- Make dynamic pose ownership exclusive and diagnose conflicting authored or
  animated transforms.
- Make one body plus one inferred collider the default JSX experience while
  retaining compound colliders, sensors, and render/physics geometry
  separation.
- Supply deterministic collider mappings for every current CRC geometric
  primitive where the source data permits it, and require explicit stable
  geometry where it does not.
- Supply a CRC rendering component for every public physics shape.
- Provide forces, impulses, contacts, overlap events, collision filtering,
  ray casts, shape casts, overlap queries, sleeping, and opt-in continuous
  collision detection.
- Establish lifecycle-owned body, collider, joint, world, query-handle, signal,
  and callback resources with exact cleanup.
- Preserve deterministic identity, command, solver, query-result, and event
  order within the documented implementation and numeric tolerance.
- Keep every public capability as tree-shakable as practical through named ESM
  exports, pure modules, immutable descriptors, and optional subpaths.
- Permit later CRC-owned solver optimization, including CRC-owned WebAssembly,
  without changing observable scheduling or authoring semantics.

## Non-goals

- Depending on or adapting Box2D, Matter.js, Rapier, Jolt, Box3D, Cannon,
  Ammo, Bullet, PhysX, Havok, or another external runtime.
- A second animation vocabulary, clock, frame runner, timer, worker loop, or
  manual root-render loop.
- Treating physics as `CRCAnimationDefinition` or allowing an animation and a
  dynamic solver to write the same body pose.
- A retained visual scene graph, entity-component system, game-object model,
  or one CRC component per contact/manifold point.
- Pixel collision, alpha-mask collision, GPU readback, shader-derived collision
  geometry, or browser-dependent text/image collision inference.
- Soft bodies, cloth, rope simulation beyond rigid constraints, fluid
  simulation, destruction/fracture, arbitrary N-body gravity, or particle
  simulation in the first physics architecture.
- Moving concave triangle-mesh rigid bodies in the first 3D solver.
- Cross-world joints, colliders, contacts, or direct 2D-to-3D collision.
- Automatic extrusion, projection, or camera-plane selection between Canvas
  and WebGL coordinate spaces.
- Public contact modification or arbitrary JavaScript callbacks inside the
  solver hot loop.
- Public manual scheduler time or world-step APIs in the initial surface.
- Bit-identical pixels, cross-browser floating-point identity, or guarantees
  beyond documented semantic and numeric tolerances.
- Automatic hidden promotion of Canvas content to WebGL, a worker, or a Layer.

## Package and export architecture

One optional workspace package, `packages/physics`, publishes dimensioned
entry points. There is deliberately no runtime namespace object and no root
barrel coupling both dimensions.

```text
@crc/physics/2d
  -> @crc/core
  -> @crc/core/internal

@crc/physics/3d
  -> @crc/core
  -> @crc/core/internal
  -> @crc/webgl
  -> matching official WebGL friend capability
```

The package declares the matching `@crc/core` release as a peer dependency.
`@crc/webgl` is an optional peer used only by 3D entry points. Bundled output
must externalize both peers so the application has one core realm scheduler,
one element identity, and one WebGL backend identity.

The primary entry points use top-level named ESM exports:

```tsx
import {
  PhysicsWorld2D,
  dynamicBody2D,
  circleShape2D,
  raycast2D,
} from "@crc/physics/2d";

import {
  PhysicsWorld3D,
  dynamicBody3D,
  capsuleShape3D,
  raycast3D,
} from "@crc/physics/3d";
```

CRC will not expose `physics.dynamic()`, `physics.shapes.circle()`, or another
runtime bag of functions. Methods are avoided for optional operations when a
named function can accept an opaque handle.

Heavy optional capabilities use separate side-effect-free subpaths:

- `@crc/physics/2d/joints` and `@crc/physics/3d/joints`;
- `@crc/physics/2d/debug` and `@crc/physics/3d/debug`; and
- later `@crc/physics/2d/replay` and `@crc/physics/3d/replay` entry points.

The package and every entry point are marked side-effect-free. Importing a
shape, query, joint, debug renderer, or replay utility cannot register global
behavior. Descriptor factories validate, copy, and freeze caller-owned data.
Advanced shape implementations carry nominal collision capabilities consumed
by a small generic solver seam rather than joining an import-time dispatch
registry.

The baseline solver necessarily contains the algorithms needed for its
baseline shape vocabulary. Optional debug rendering, snapshots, advanced
constraints, controllers, and the other dimension must not enter that bundle
unless imported.

## JSX typing and the runtime attachment seam

The public prop name is the ordinary string `physics`:

```tsx
<Cube physics={dynamicBody3D()} />
```

JSX does not use a computed symbol attribute. Physics descriptor values carry
a private nominal symbol internally, but the author never writes it.

Core and WebGL add deliberately empty public extension interfaces to the prop
types of supported geometric and body-host components. Importing
`@crc/physics/2d` declaration-merges
`physics?: CRCPhysicsAttachment2D` into the Canvas interfaces. Importing
`@crc/physics/3d` does the same for WebGL geometry and `Group3D`. Declaration
merging emits no JavaScript and imposes no runtime cost when physics is unused.

At runtime, core and WebGL recognize one generic branded attachment protocol.
The descriptor itself carries the official physics capability and world
association logic. Core does not import physics, physics performs no global
registration, and an unused physics entry point remains absent from the
application bundle. Unknown, malformed, foreign-version, or wrong-dimension
attachment values produce an actionable diagnostic naming the component and
`physics` prop.

The `physics` prop accepts exactly one immutable attachment:

```ts
type CRCPhysicsAttachment2D =
  CRCPhysicsBodyAttachment2D | CRCPhysicsColliderAttachment2D;

type CRCPhysicsAttachment3D =
  CRCPhysicsBodyAttachment3D | CRCPhysicsColliderAttachment3D;
```

Hand-authored lookalike objects are not accepted. This keeps validation,
versioning, tree-shaking, and internal capabilities explicit.

Public physics type names use CRC's existing `CRC` prefix. Runtime components,
factories, commands, and hooks retain the concise names shown throughout this
design.

## World components and scope

`PhysicsWorld2D` and `PhysicsWorld3D` are transparent structural components.
They create a component-owned simulation context and return their children.
They do not paint, create an event target, participate in layout, or establish
an accessibility node.

```tsx
<PhysicsWorld2D gravity={[0, 980]}>
  <Rectangle physics={dynamicBody2D()} />
</PhysicsWorld2D>
```

Three-dimensional worlds belong inside a `WebGLLayer`:

```tsx
<WebGLLayer camera={camera}>
  <PhysicsWorld3D gravity={[0, -9.81, 0]}>
    <Sphere physics={dynamicBody3D()} />
  </PhysicsWorld3D>
</WebGLLayer>
```

A body or collider without the matching nearest world reports a targeted
error. Worlds of the same dimension cannot nest. Multiple sibling worlds are
independent and may use different gravity, tick, solver, and filtering
configuration. Bodies, colliders, joints, contacts, and handles never cross a
world boundary.

A 2D world is logical rather than tied to a particular raster surface. A
managed Canvas `Layer` remains a rendering optimization and does not create a
new physics world or coordinate system. A world may span managed Layer
boundaries when logical ancestry is preserved, and its colliders use the same
root-logical transform facts as CRC events and focus geometry.

A 3D world belongs to one WebGL island in the initial architecture. It cannot
span two `WebGLLayer` instances or survive outside the owning island. WebGL
context loss suspends drawing but does not stop the CPU-owned physics world;
restoration renders the latest committed pose.

Representative world configuration is:

```ts
interface CRCPhysicsWorld2DProps {
  readonly gravity?: CRCPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly children?: CRCNode;
}

interface CRCPhysicsWorld3DProps {
  readonly gravity?: CRCPhysicsVector3;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly children?: CRCNode;
}

interface CRCPhysicsSolverOptions {
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}
```

Gravity defaults to the zero vector so top-down, diagram, and space scenes do
not move unexpectedly. Guides use explicit Canvas-friendly and WebGL-friendly
gravity values. The initial fixed step is `1000 / 60` milliseconds,
`maxCatchUpSteps` is four, interpolation is `"linear"`, sleeping is enabled,
and solver iteration defaults are fixed and documented. All numeric values
must be finite and ranges must be valid.

Changing gravity affects later ticks. Changing solver iteration counts affects
later ticks and therefore replay identity. Changing the fixed tick duration
reanchors the accumulator at the next Begin rather than interpreting an old
remainder under a new duration.

## Coordinate and unit contracts

Physics uses CRC logical world coordinates, not backing pixels or CSS pixels.
Root fit and device density never change simulation distances.

Two-dimensional worlds follow Canvas presentation:

- positive X points right;
- positive Y points down;
- positive rotation appears clockwise;
- position and distance use logical units;
- linear velocity uses logical units per second;
- linear acceleration uses logical units per second squared; and
- public angles and angular velocities are named in degrees and degrees per
  second, matching CRC's `rotationDegrees` authoring vocabulary.

Three-dimensional worlds follow the shipped WebGL coordinate system:

- positive Y points up;
- the default camera looks toward negative Z;
- position and distance use WebGL logical world units;
- linear velocity uses world units per second;
- orientations are normalized quaternions;
- Euler and joint-limit convenience inputs are explicitly named in degrees;
  and
- angular-velocity fields state their unit in the field name rather than
  accepting an ambiguous scalar or vector.

CRC does not call a logical unit a meter. Authors choose gravity, speed,
density, and geometry that are numerically appropriate for their scene. Guides
teach a consistent scene scale and warn against extremely small or large
colliders.

## Bodies, colliders, and shapes

A body owns motion and mass state. A collider owns contact geometry and
surface behavior. A shape is immutable geometry that may be shared by
colliders and CRC renderers.

This separation supports:

- multiple solid shapes on one moving body;
- sensor shapes attached to a solid body;
- different friction or restitution on different parts;
- collision geometry simpler than visual geometry;
- collider offsets from a stable body origin;
- one mass/inertia state for a compound visual object; and
- shared immutable geometry without shared mutable body state.

The separation is normally hidden by a body attachment with an inferred self
collider.

### Body attachments

The named factories are:

```ts
dynamicBody2D(options?)
staticBody2D(options?)
kinematicBody2D(options?)

dynamicBody3D(options?)
staticBody3D(options?)
kinematicBody3D(options?)
```

Each produces an immutable body attachment. On a geometric receiver, omitted
`collider` means one self collider. A collider configuration object without an
explicit shape also means self geometry. An explicit shape replaces inference.
`collider: false` creates a body without a self collider.

On `Group` or `Group3D`, which has no geometry, the attachment creates only the
body. Descendant `collider2D()` or `collider3D()` attachments supply its
compound geometry. An absent descendant collider is visual-only; descendants
do not silently become physical because an ancestor has a body.

Representative common body options are:

```ts
interface CRCPhysicsDynamicBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly linearVelocity?: CRCPhysicsVector2;
  readonly angularVelocityDegreesPerSecond?: number;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly gravityScale?: number;
  readonly mass?: "auto" | number;
  readonly fixedRotation?: boolean;
  readonly allowSleep?: boolean;
  readonly ccd?: boolean;
  readonly reenableVelocity?: "zero" | "preserve";
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

interface CRCPhysicsDynamicBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly linearVelocity?: CRCPhysicsVector3;
  readonly angularVelocityDegreesPerSecond?: CRCPhysicsVector3;
  readonly linearDamping?: number;
  readonly angularDamping?: number;
  readonly gravityScale?: number;
  readonly mass?: "auto" | number;
  readonly lockTranslation?: CRCPhysicsAxisLocks3D;
  readonly lockRotation?: CRCPhysicsAxisLocks3D;
  readonly allowSleep?: boolean;
  readonly ccd?: boolean;
  readonly reenableVelocity?: "zero" | "preserve";
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}
```

Static and kinematic option types expose only meaningful subsets. Static and
kinematic bodies have zero inverse mass and are not moved by impulses. A
kinematic body additionally accepts an application-owned target pose or
explicit signal bindings.

`mass: "auto"` is the default. It derives mass, local center of mass, and
inertia from non-sensor collider area or volume and density. An explicit mass
scales the automatically derived inertia consistently. Advanced explicit mass
properties may be added later without changing the default model.

### Collider attachments

`collider2D(options?)` and `collider3D(options?)` create collider-only
attachments. They use self geometry by default and bind to the nearest
ancestor body. A collider-only attachment without an ancestor body is an
error; standalone geometry uses a static, kinematic, or dynamic body
attachment instead.

Representative collider configuration is:

```ts
interface CRCPhysicsColliderConfiguration2D {
  readonly shape?: "self" | CRCPhysicsShape2D;
  readonly offset?: CRCPhysicsVector2;
  readonly rotationDegrees?: number;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly sensor?: boolean;
  readonly contributesToMass?: boolean;
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly tag?: unknown;
  readonly onCollisionStart?: CollisionHandler2D;
  readonly onCollisionEnd?: CollisionHandler2D;
  readonly onHit?: HitHandler2D;
  readonly onOverlapStart?: OverlapHandler2D;
  readonly onOverlapEnd?: OverlapHandler2D;
}

interface CRCPhysicsColliderConfiguration3D {
  readonly shape?: "self" | CRCPhysicsShape3D;
  readonly offset?: CRCPhysicsVector3;
  readonly orientation?: CRCPhysicsQuaternion;
  readonly density?: number;
  readonly friction?: number;
  readonly restitution?: number;
  readonly sensor?: boolean;
  readonly contributesToMass?: boolean;
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly tag?: unknown;
  readonly onCollisionStart?: CollisionHandler3D;
  readonly onCollisionEnd?: CollisionHandler3D;
  readonly onHit?: HitHandler3D;
  readonly onOverlapStart?: OverlapHandler3D;
  readonly onOverlapEnd?: OverlapHandler3D;
}
```

Density defaults to one, friction to `0.5`, restitution to zero, and `sensor`
to false. Friction must be finite and nonnegative. Restitution is finite from
zero through one. Default contact mixing uses the geometric mean of collider
friction and the maximum collider restitution. Sensors do not contribute to
mass unless `contributesToMass` is explicitly true.

`tag` is opaque application data. CRC retains its reference for events and
queries but never reads it to determine simulation behavior, identity, or
ordering. Freezing a descriptor does not deep-freeze a tag, callback, signal,
or handle supplied by the application.

`CollisionFilter` contains fixed-width category and mask bits plus an optional
signed group override. Filtering is evaluated before narrow-phase work.
Changing shape, offset, material, sensor, or filtering data becomes a queued
Begin command and cannot mutate a manifold while it is being solved.

### Sensors

A sensor is not a body type and has no separate fundamental factory:

```tsx
<Circle2D
  physics={collider2D({
    sensor: true,
    tag: "ground-check",
    onOverlapStart: (event) => setGrounded(event.other),
  })}
/>
```

It participates in broad- and narrow-phase overlap detection and scene
queries, but it creates no contact constraint and applies no collision impulse.
Sensor events are opt-in through handlers so worlds that do not observe them
do not pay to materialize public event records. Initial sensors are discrete;
fast-object trigger detection uses ray or shape casts rather than an implied
continuous sensor guarantee.

## Shape values and matching rendering components

Every public shape is an immutable nominal value containing copied geometry,
validated bounds, mass-property capability, broad-phase bounds capability,
and the narrow-phase support or acceleration data needed by its dimension.
Applications cannot mutate vertices behind CRC's caches.

The 2D shape factories are designed to include:

- `circleShape2D`;
- `boxShape2D`;
- `roundedBoxShape2D`;
- `capsuleShape2D`;
- `segmentShape2D`;
- `chainShape2D`; and
- `polygonShape2D` for validated convex polygons.

Concave 2D geometry is represented as a deterministic compound of convex
pieces. Automatic decomposition, when shipped, is a separately imported pure
factory with fixed tolerances and stable output ordering.

Matching Canvas components include `Circle2D`, `Capsule2D`, `Segment2D`,
`Chain2D`, `Polygon2D`, and generic `PhysicsShape2D`. Existing `Rectangle`
renders box and rounded-box geometry. Every shape value can be passed to
`PhysicsShape2D`, which uses ordinary CRC Canvas paint, transform, clip,
filter, event, focus, layout, and Layer behavior.

The 3D shape factories are designed to include:

- `sphereShape3D`;
- `boxShape3D`;
- `ellipsoidShape3D`;
- `capsuleShape3D`;
- `cylinderShape3D`;
- `coneShape3D`;
- `convexHullShape3D`;
- `triangleMeshShape3D`; and
- `heightfieldShape3D`.

Matching WebGL components include `Box3D`, `Ellipsoid3D`, `Capsule3D`,
`Cylinder3D`, `Cone3D`, `ConvexHull3D`, `Heightfield3D`, and generic
`PhysicsShape3D`. Existing `Cube`, `Sphere`, and `Mesh` cover their matching
forms. These components are settled WebGL scene contributors and make no GL
calls during component composition.

Every renderer comes from CRC-owned deterministic geometry generation. A
physics shape may choose a simpler visual tessellation without changing its
analytic or support-mapped collision definition. Rendering resolution never
changes collision results.

## Existing primitive collider inference

### Canvas 2D

| CRC component                            | Inferred collider                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Rectangle`                              | Box, or rounded box when corner radii are present                                                         |
| `Line`, `HorizontalLine`, `VerticalLine` | Segment or chain expanded by half the resolved stroke width                                               |
| `SvgPath`                                | Deterministically flattened closed polygon or open chain when the path satisfies documented contour rules |
| `Path` with opaque `Path2D`              | Explicit collider required                                                                                |
| `Text`                                   | Explicit collider or author-declared stable box required                                                  |
| `Image`                                  | Declared stable rectangular bounds or explicit collider                                                   |
| Physics shape components                 | Their exact immutable physics shape                                                                       |
| `Group`                                  | No self collider; may host a compound body                                                                |

Raw `Path2D` is intentionally opaque and browser-owned. CRC does not inspect
its commands. Text measurement, glyph outlines, decoded alpha, and image pixels
are also platform-owned and cannot determine replay-critical collision
geometry. A targeted diagnostic explains which explicit shape or declared box
is required.

SVG inference uses CRC-owned parsing and curve flattening with fixed tolerance,
contour, winding, and decomposition rules. Unsupported self-intersection,
degenerate contours, or ambiguous open/filled combinations require an explicit
shape rather than silently changing collision meaning.

A stroked line with positive width becomes one or more capsule-like solid
segments and may participate in automatic dynamic mass. A zero-width segment
or chain has no area and is static or kinematic by default; using it as the
only collider on an automatic-mass dynamic body is rejected.

Rectangle body inference accounts for its top-left drawing coordinates. CRC
places the inferred collider at the rectangle center while retaining a local
visual offset so the initial pixels do not move. A compound body's authored
origin remains stable even when automatic center-of-mass calculation produces
a different local mass center.

### WebGL 3D

| CRC component                | Inferred collider                                                   |
| ---------------------------- | ------------------------------------------------------------------- |
| `Cube`                       | Box using resolved size and scale                                   |
| Uniformly scaled `Sphere`    | Analytic sphere                                                     |
| Nonuniformly scaled `Sphere` | Ellipsoid                                                           |
| Static `Mesh`                | Exact immutable triangle mesh with a private acceleration structure |
| Dynamic or kinematic `Mesh`  | Deterministic convex hull                                           |
| Physics shape components     | Their exact immutable physics shape                                 |
| `Group3D`                    | No self collider; may host a compound body                          |

Moving concave triangle meshes are rejected in the first solver. An author may
use a convex hull, several child convex colliders, or an explicit simplified
physics shape. Static triangle meshes use immutable CPU geometry already owned
behind `CRCWebGLGeometry`; the official lockstep WebGL seam makes those copied
positions and indices available to physics without exposing source paths or
GPU readback.

Rigid-body pose contains translation and orientation, never scale. Resolved
scale is baked into collider geometry. Changing scale rebuilds the collider at
the next Begin and recomputes automatic mass properties. Negative scale mirrors
mesh vertices deterministically. Physics integrates 3D orientation as a
normalized quaternion and the WebGL renderer consumes that quaternion directly
rather than repeatedly converting through Euler angles.

## Custom components and primitives

An ordinary custom component accepts and forwards the attachment:

```tsx
import type { CRCPhysicsAttachment2D } from "@crc/physics/2d";

interface CardProps {
  readonly x: number;
  readonly y: number;
  readonly physics?: CRCPhysicsAttachment2D;
}

function Card({ x, y, physics }: CardProps) {
  return (
    <Rectangle
      style={{ x, y, width: 120, height: 80, cornerRadius: 12 }}
      physics={physics}
    />
  );
}
```

A compound custom component forwards a body attachment to `Group` or
`Group3D` and marks physical descendants with collider-only attachments.

A genuinely new primitive uses a pure side-effect-free adapter:

```ts
const RawDiamond = definePrimitive(renderDiamond, options);

export const Diamond = withPhysicsShape2D(RawDiamond, {
  resolveShape(style) {
    return polygonShape2D({ points: resolveDiamondPoints(style) });
  },
});
```

The 3D equivalent is `withPhysicsShape3D` around a value created with
`defineWebGLPrimitive`. The adapter:

- augments the final component's prop type with the matching attachment;
- derives one immutable self shape from already resolved style/geometry;
- receives no browser clock, mutable world, solver, or render callback;
- may not call hooks, mutate signals, retain transient records, or perform
  asynchronous work;
- is evaluated only when relevant resolved geometry changes; and
- stores capability on the returned primitive value rather than a global
  registry.

The same resolved geometry must drive drawing, event picking where applicable,
and inferred collision. If a custom primitive cannot supply stable geometry,
it may still accept an explicit collider but cannot claim self inference.

## Component identity, layout, and transform capture

Physics resource identity follows CRC component identity rather than descriptor
object identity. Re-evaluating `dynamicBody2D()` at the same successful host
slot updates the existing attachment when its normalized options change; it
does not recreate the body merely because the immutable descriptor is a new
JavaScript object. Keyed sibling identity has the same limits as ordinary CRC
components, and reparenting remounts the physical resource.

Resolved layout and transforms establish a body's initial world-relative pose
and collider geometry. A layout parent does not remain a physical constraint.
Later layout placement changes for an enabled dynamic body are root-pose
changes and receive the same diagnostic as an authored animation; authors use
an explicit teleport, a kinematic body, or disabled physics instead.

The physics-world boundary defines simulation coordinates. One transform
outside the complete world is presentation-only and affects every rendered
body together without changing contacts. Transforms inside the world are
resolved relative to that boundary. Translation and rotation establish body
or collider poses; scale and skew are deterministically baked into supported
collider geometry. A changing non-body ancestor transform that would move an
enabled dynamic descendant is rejected rather than becoming an implicit
second pose writer.

Canvas `Layer` density and local upright raster transforms never enter physics
coordinates. WebGL camera, projection, viewport, and backing density likewise
do not change 3D world geometry.

## Motion authority and animation interoperation

Physics and animation share scheduling but not pose authority:

| Mode             | Pose writer                     | In collision world | Moved by contacts |
| ---------------- | ------------------------------- | ------------------ | ----------------- |
| Physics disabled | Authored style or CRC animation | No                 | No                |
| Static body      | Authored placement              | Yes                | No                |
| Kinematic body   | Application or CRC animation    | Yes                | No                |
| Dynamic body     | Physics solver                  | Yes                | Yes               |

### Dynamic bodies

Authored translation and rotation seed a dynamic body when it is created or
re-enabled. Thereafter its root pose is physics-owned. A changing authored
root transform on an enabled dynamic body produces a diagnostic instead of
performing repeated implicit teleports. `teleportBody2D()` and
`teleportBody3D()` are explicit Begin commands.

Animation may continue to control non-pose presentation such as color,
opacity, filters, or a visual child transform. To animate the root pose, the
author disables physics or deliberately uses a kinematic body.

### Kinematic bodies

A kinematic body is an application-controlled moving collider. It solves the
moving-platform, elevator, door, conveyor, and authored obstacle cases: the
application or animation owns its target pose, physics never changes that pose,
and dynamic bodies respond to its calculated motion.

Kinematic targets may be ordinary snapshot values updated through component
rendering. For zero-latency animation-to-physics input, target fields may be
explicit signal bindings analogous to `track` binding an animation output.
Animation stages the target earlier in Advance; physics reads that staged value
from the same transaction before solving.

When one realm frame contains multiple fixed ticks, physics moves each
kinematic body deterministically from its prior accepted target toward the
current staged target across those ticks, using linear translation and 2D
angle or 3D quaternion interpolation. Physics does not resample the complete
animation program at private sub-times and therefore does not become an
animation evaluator.

Consequently, an animation-driven kinematic path is reproducible for the same
realm logical frame times but is not promised to produce cadence-independent
contacts across a different sequence of target-sampling frames. Applications
that require tick-defined physical motion use a velocity, motor, force, or
later explicit trajectory definition in the physics domain rather than relying
on incidental render cadence.

### Disabling and re-enabling physics

The recommended animation handoff is:

1. capture the body's committed or presentation pose;
2. disable its physics participation at Begin;
3. let authored style or animation own the pose;
4. finish or cancel the animation;
5. re-enable the body at the current authored pose; and
6. explicitly choose its resumed velocity policy.

`enabled: false` retains the component-owned body identity and allocation but
removes its colliders, contacts, and joints from active solving and stops
physics presentation. `reenableVelocity` defaults to `"zero"`; `"preserve"`
is explicit. Shape and mass changes made while disabled are applied before the
body reenters the world.

Declarative `enabled` changes discovered during rendering become next-Begin
commands. Controlled code needing an exact handoff frame uses the named
`disableBody2D`, `enableBody2D`, `disableBody3D`, or `enableBody3D` command
with a body handle. An animation completion delivered in Complete may enqueue
re-enablement for the next Begin, matching existing CRC completion admission.

No frame permits an animation and physics to publish the same pose. CRC may
make this conflict reproducible internally, but reproducible conflict is still
an error rather than supported mixing.

## Scheduler, fixed ticks, and arbitrary render cadence

The core scheduler retains its six public phases. Its official internal
Advance registration gains ordered lanes so correctness never depends on
component registration order:

1. the existing animation lane samples playbacks and stages animation values;
2. the physics lane advances captured awake worlds in stable world order; and
3. Commit validates and publishes the shared staging batch once.

This is an internal official-package seam, not a public scheduler plugin API.
Animations and physics worlds observe the same frame identity and logical time.
Animation, physics, topology, and body-control commands accepted for Begin
carry one realm invocation ordinal so a handoff such as disable-then-play has a
stable cross-domain order even though each subsystem drains its own command
records.

For one world with fixed duration `h`, each Advance performs the equivalent of:

```ts
elapsed = currentLogicalTime - previousLogicalTime;
acceptedElapsed = min(elapsed, h * maxCatchUpSteps);
accumulator += acceptedElapsed;

while (accumulator >= h) {
  previousState = currentState;
  currentState = simulateOneFixedTick(currentState, h);
  accumulator -= h;
}

alpha = accumulator / h;
presentation = interpolate(previousState, currentState, alpha);
```

The real implementation need not copy a complete world per line; it may use
double buffers, journals, checkpoints, and pooled mutable storage while
preserving the transaction.

Important timing rules are:

- `elapsed` comes from CRC logical time, never `Date.now()` or a private host
  timestamp;
- a new, resumed, or newly awakened world anchors at the current logical time
  and does not catch up time during which it was inactive;
- the number and order of fixed ticks are recorded in source-only trace
  evidence;
- at most `maxCatchUpSteps` run in one realm frame;
- excess elapsed time is discarded and the clamp is traced rather than
  creating an unbounded main-thread catch-up or private backlog loop;
- a world with awake bodies requests the next realm frame through the existing
  scheduler;
- a fully sleeping world releases that request and schedules nothing until a
  command, dependency, collider/world change, or collision-relevant update
  wakes it; and
- multiple active 2D and 3D worlds still share one pending host frame.

Linear interpolation in 2D uses position and the shortest documented angular
path. Three-dimensional interpolation uses position lerp and quaternion slerp.
Presentation interpolation intentionally displays authoritative simulation up
to one fixed tick behind logical time; extrapolation is not used because it can
visibly penetrate or predict contacts that never occur.

Authoritative body handles, queries, contacts, and events report the latest
completed fixed-tick state. Rendering consumes the interpolated presentation
pose. A named presentation-pose read is available to controlled handoff code
so disabling physics does not visually jump. Interpolation changes may request
Render work without publishing one ordinary signal per body.

Canvas interaction geometry and the WebGL bitmap/pick ledger use that same
presentation pose so visible pixels and ordinary CRC pointer targeting remain
aligned. Physics queries and contact records remain authoritative and may
therefore differ from presentation by less than one fixed tick when
interpolation is enabled.

If `interpolation: "none"`, rendering uses the latest authoritative pose. This
is useful for exact state visualization and tests but may visibly step when
render and simulation rates differ.

## Frame transaction and failure behavior

Each world begins Advance from its last committed authoritative snapshot and
produces a candidate generation containing:

- body poses and velocities;
- sleep/activation state;
- collider broad-phase proxies;
- contact manifolds and warm-start impulses;
- joint solver state;
- overlap state;
- queued semantic events;
- the accumulator remainder; and
- the presentation-pose generation.

The world stages its observed body/world signals into the shared signal batch.
Commit validates all animation and physics writes, publishes changed values,
and notifies consumers only after publication. The world adopts the candidate
generation only when its staging transaction succeeds. A world Advance error
discards that world's candidate and staged values without blocking another
world, animation, root, or completion.

A later Canvas or WebGL render failure does not roll back an already published
animation or simulation Commit. This matches existing signal and animation
semantics. The failed renderer remains responsible for its own fail-closed
resource behavior, while physics continues from its committed state unless
the owning component tree is torn down.

Collision, overlap, sleep, wake, joint-break, clamp, and isolated error
callbacks are delivered in Complete after candidate adoption. Writes and
commands issued by a callback enter the next eligible frame. Callback failure
does not roll back physics and is collected with other post-frame errors.

Component traversal discovers body, collider, and joint additions, updates,
and removals after the current simulation Advance. Successful render
transactions enqueue topology commands for the next Begin. Initial mount
renders authored poses, then requests the first physics frame. Removal and
failed render cleanup invalidate exact attachment generations so stale
commands or completions cannot target a replacement body.

## Body and world handles

Most bodies require no predeclared application handle. Every body still has a
compact stable internal identity; an observed event or query may lazily
materialize a lightweight command reference without creating the complete
readonly signal bundle. Controlled components opt into a stable
component-owned endpoint:

```tsx
function Ball() {
  const ball = crcPhysicsBody2D();

  return (
    <Circle2D
      physics={dynamicBody2D({ handle: ball })}
      onClick={() => applyImpulse2D(ball, [0, -400])}
    />
  );
}
```

`crcPhysicsBody2D()` and `crcPhysicsBody3D()` use one ordered hook slot and
return an opaque handle that may bind to at most one live attachment. Duplicate
binding is rejected. Removal unbinds the handle exactly once; commands against
an unbound or stale generation are inert in production and diagnostically
identifiable in development.

An observed handle exposes readonly signals for authoritative position,
orientation, linear velocity, angular velocity, sleeping, enabled status, and
body generation. These signals are created or activated only when requested so
unobserved bodies do not allocate a public signal bundle. Explicit `.get()`
reads retain ordinary CRC dependency semantics.

Operations are individually named exports:

```ts
applyForce2D(body, force, options?)
applyImpulse2D(body, impulse, options?)
applyTorque2D(body, torque)
setLinearVelocity2D(body, velocity)
setAngularVelocity2D(body, degreesPerSecond)
teleportBody2D(body, pose)
wakeBody2D(body)
sleepBody2D(body)
enableBody2D(body, options?)
disableBody2D(body)

applyForce3D(body, force, options?)
applyImpulse3D(body, impulse, options?)
applyTorque3D(body, torque)
setLinearVelocity3D(body, velocity)
setAngularVelocity3D(body, degreesPerSecond)
teleportBody3D(body, pose)
wakeBody3D(body)
sleepBody3D(body)
enableBody3D(body, options?)
disableBody3D(body)
```

Forces and impulses may optionally name a world-space application point.
Commands snapshot caller-owned arrays and enter Begin in invocation order.
Commands do not mutate a world synchronously from an event, render, or
completion callback.

`crcPhysicsWorld2D()` and `crcPhysicsWorld3D()` return the nearest current world
handle while a component is evaluating. A world handle exposes an optional
readonly revision signal for reactive query consumers but no `step()`,
`run()`, or clock mutation method.

## Collision response and solver architecture

The first CRC-owned CPU implementation is organized as separate dimensioned
kernels sharing only lifecycle, scheduler, descriptor, handle, trace, and
transaction scaffolding. It does not force 2D and 3D data through a generic
dimension union in hot loops.

The recommended implementation direction is:

- structure-of-arrays or similarly compact pooled body/collider state;
- a dynamic AABB tree broad phase with stable proxy identity;
- persistent contact pairs and cached manifolds;
- analytic primitive tests where they are simpler and more stable;
- support-mapping GJK/EPA or dimension-appropriate SAT for convex fallback;
- per-mesh immutable BVH acceleration for static 3D triangle geometry;
- semi-implicit velocity integration;
- iterative sequential-impulse velocity constraints and bounded positional
  correction;
- warm starting from committed contact impulses;
- connected-body islands for solving and sleeping; and
- conservative advancement or swept shape casting for opt-in CCD.

These algorithms are internal choices, not public value identities. CRC may
replace an implementation while preserving documented ordering, tolerances,
event semantics, and snapshot versioning. Solver changes that materially alter
observable results require release notes and updated deterministic evidence.

Restitution models normal elasticity and friction models tangential resistance.
Gravity is one world acceleration, while each dynamic body has a finite
`gravityScale`. Forces accumulate for the next fixed tick and then clear;
impulses change velocity at their accepted tick. Static and kinematic bodies do
not accept force-driven movement.

CCD is body opt-in. It prevents selected fast dynamic bodies from tunneling
through supported solid colliders by finding a bounded time of impact inside a
fixed tick. It does not promise continuous sensors, arbitrary concave moving
meshes, or unlimited recursive impacts.

## Collision and overlap events

Event materialization is opt-in per collider. The initial semantic set is:

- collision start;
- collision end;
- optional significant hit/contact impulse;
- sensor overlap start;
- sensor overlap end;
- body sleep and wake; and
- later joint breakage for breakable constraints.

There is no default per-frame `collisionActive` callback. Applications needing
continuous contact state query the committed body/contact state or explicitly
enable a contact observation mode.

Each receiver gets a self-oriented immutable record:

```ts
interface CRCPhysicsCollisionEvent3D {
  readonly selfBody: CRCPhysicsBodyHandle3D;
  readonly selfCollider: CRCPhysicsColliderHandle3D;
  readonly otherBody: CRCPhysicsBodyHandle3D;
  readonly otherCollider: CRCPhysicsColliderHandle3D;
  readonly normal: CRCPhysicsVector3;
  readonly points: readonly CRCPhysicsContactPoint3D[];
  readonly totalNormalImpulse: number;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}
```

The 2D record uses `CRCPhysicsVector2` and otherwise matches. The normal points
from the other collider toward the receiving self collider. Records contain no
mutable solver references and expire only semantically, not through
pooled-object mutation.

When multiple fixed ticks run in one realm frame, begin/end/hit events preserve
tick order. A pair that begins and ends during catch-up produces both events in
order. Across pairs, stable collider identities break ties. Across the two
subscribed sides of one pair, the lower stable receiver identity delivers
first. Events never inherit broad-phase traversal order.

## Scene queries and ray-cast hit detection

Queries are CPU physics operations over committed collider geometry, not
Canvas pixel hit tests or WebGL camera picking. The initial named query surface
is:

```ts
raycast2D(world, ray, options?)
shapeCast2D(world, shape, from, translation, options?)
overlapShape2D(world, shape, pose, options?)
queryAabb2D(world, bounds, options?)
queryPoint2D(world, point, options?)

raycast3D(world, ray, options?)
shapeCast3D(world, shape, from, translation, options?)
overlapShape3D(world, shape, pose, options?)
queryAabb3D(world, bounds, options?)
queryPoint3D(world, point, options?)
```

Ray input contains origin, normalized or normalizable direction, and finite
maximum distance. Results identify body and collider generation, tag, point,
outward normal, distance, and normalized time of impact. Triangle-mesh hits may
also identify a stable triangle index and barycentric coordinates.

Query options select closest, any, or all results; include or exclude sensors;
apply category/mask filtering; and optionally exclude a body or collider.
Public all-hit results sort by time of impact and stable collider identity.
Closest-hit ties use the same order. An internal early-out traversal may be
unordered only when the result cannot expose that order.

Queries outside Advance read the latest committed authoritative state. They do
not see interpolated presentation poses. A component that wants reactive query
output explicitly reads the world revision signal before issuing the query.
Queries may not mutate filters, bodies, or the world from inside a traversal
callback; the initial public surface avoids arbitrary callbacks in favor of
result and filter options.

WebGL pointer picking remains distinct:

- renderer picking asks which committed visible geometry is under a camera
  ray and participates in CRC event paint order;
- physics ray casting asks which committed collider is intersected in world
  space; and
- differing render and collider geometry may intentionally produce different
  results.

A later named helper may construct a physics ray from a committed WebGL camera
and root-logical pointer coordinate. It does not make physics picking the
default event target algorithm.

## Joints and constraints

Joints are optional nonpainting component-owned resources exported from
dimension-specific `/joints` subpaths. They accept body handles, live inside
one matching world, and create no event target or layout box.

The planned 2D vocabulary is:

- `DistanceJoint2D`;
- `RevoluteJoint2D`;
- `PrismaticJoint2D`;
- `WeldJoint2D`; and
- `WheelJoint2D`.

The planned 3D vocabulary is:

- `FixedJoint3D`;
- `DistanceJoint3D`;
- `BallJoint3D`;
- `HingeJoint3D`; and
- `SliderJoint3D`.

Joint configuration includes local anchors, axes, documented degree-based
limits, optional stiffness/damping, optional motor target and maximum force or
torque, collision-between-connected-bodies policy, and an optional break
threshold. Motor targets may use explicit signal bindings so animation stages
the input before physics in the same frame. A physics joint spring is a solver
constraint and is not CRC's analytic animation `spring()` definition.

Joint creation, update, removal, and breakage enter Begin. Removing either body
removes dependent joints exactly once. Handles from another world or dimension
are rejected before mutation.

Cone-twist, generic six-degree-of-freedom constraints, ragdoll builders,
vehicles, character controllers, and inverse-kinematic systems are later
tree-shakable projects, not implied by the baseline joint entry points.

## Sleeping and scheduler participation

Sleeping is an island-level optimization with deterministic thresholds and
counters. A connected island sleeps only after every dynamic member remains
under documented linear and angular motion thresholds for a documented number
of fixed ticks. Wall-clock duration and render-frame count do not determine
sleep.

A force, impulse, teleport, enabled/configuration change, new relevant contact,
moving kinematic collider, joint motor, or explicit wake command wakes the
affected island. Merely rendering, moving a camera, changing color, or
recompositing a Layer does not.

When every island in a world sleeps and no kinematic target, pending command,
query observation, or required topology work needs another Advance, the world
snaps presentation to the authoritative pose, clears interpolation remainder,
and releases its continuing-frame request. The world remains mounted and
retains its committed state. The next relevant command uses the ordinary realm
scheduler and anchors elapsed time at wake rather than simulating sleep time.

## Determinism, tracing, and replay

The initial guarantee matches CRC animation's level rather than promising
universal floating-point identity:

> Given the same CRC version, normalized world/body/collider/joint definitions,
> component identities, accepted command sequence, fixed-tick configuration,
> logical frame times, clamp outcomes, and application callback purity, CRC
> reproduces the same semantic simulation results within documented numeric
> tolerances.

Determinism requires:

- no random numbers in the solver;
- stable world, body, collider, joint, contact, and island identities;
- stable creation/removal and command order derived from CRC ownership and
  source identity;
- deterministic pair and island ordering independent of hash iteration;
- explicit sorting of public query and event output;
- fixed solver iteration counts;
- deterministic curve flattening, convex hull, decomposition, mesh BVH, and
  mass-property construction;
- fixed large-delta and maximum-CCD policies;
- no GPU result, browser raster, text metric, decoded alpha, or garbage
  collection timing in simulation; and
- source-only traces that have no semantic effect and disable themselves if
  collection throws.

Trace facts include frame identity, logical time, accepted/dropped elapsed
time, fixed tick identity, command order, topology changes, wake/sleep,
candidate/Commit outcome, event order, and optional deterministic state hashes.
Production keeps no history by default.

Different JavaScript engines may implement transcendental functions and
floating-point optimizations differently. CRC therefore does not initially
promise cross-engine bit identity. Tests use exact discrete state and stable
identity assertions plus narrow documented numeric tolerances for continuous
values. If CRC later adopts deterministic approximations or a CRC-owned WASM
kernel, the stronger guarantee is versioned and tested explicitly.

Public snapshot, restore, rollback, and command-recording APIs are deferred to
the optional `/replay` entry points. Their later design must version binary or
structured snapshots, include solver and shape implementation generations,
restore only at Begin, and never expose a second public clock or unscheduled
`world.step()`.

## Performance and memory model

The correctness architecture requires:

- one Advance registration per awake world;
- zero per-body scheduler registrations;
- no per-body CRC elements, component executions, signals, callbacks, or
  closures unless the author explicitly requests them;
- pooled or preallocated hot-loop records for bodies, colliders, broad-phase
  pairs, manifolds, constraints, islands, and temporary math;
- no steady-state object allocation per contact or solver iteration;
- immutable shared shape and acceleration data;
- sleeping-island exclusion from integration and solving;
- broad-phase updates only for changed proxies;
- event-record allocation only for observed semantic events;
- no Canvas readback, GPU readback, GL command, bitmap transfer, or WebGL
  context dependency in the solver; and
- deterministic ownership counters rather than heap-timing assertions.

The design does not promise a particular structure-of-arrays layout,
Float32/Float64 choice, hidden-class shape, or solver algorithm as public API.
Benchmarks guide those internal choices after semantic correctness is proven.

No worker or WASM implementation ships in the first tranche. A future
CRC-owned worker or WASM kernel may compute candidate state, but commands,
logical tick identity, shared Commit, stale-result rejection, callbacks, and
rendering remain on the existing observable schedule.

## Debug rendering and diagnostics

Optional debug components live outside baseline entry points:

```tsx
<PhysicsDebug2D world={world} />
<PhysicsDebug3D world={world} />
```

They render committed collider outlines, body origins, centers of mass,
sleep/awake state, contact points/normals, broad-phase bounds, and joints using
ordinary CRC Canvas or settled WebGL drawing. They create no simulation work,
readback, independent animation request, or alternate geometry source.

Development diagnostics identify:

- a body or collider outside a world;
- a collider without an ancestor body;
- wrong-dimension or foreign-version attachments;
- duplicate body-handle binding;
- cross-world or cross-dimension joints;
- dynamic pose changes from authored style;
- unsupported moving concave mesh geometry;
- degenerate or nonfinite shapes and transforms;
- invalid density, mass, damping, material, filter, step, or iteration values;
- stale commands and callbacks;
- fixed-step clamp events when tracing is enabled; and
- topology or user-callback failure with exact owner identity.

Production validation remains fail-closed where continuing could corrupt world
state.

## Two-dimensional and three-dimensional differences

The APIs intentionally share naming and ownership while preserving different
math and rendering constraints:

| Concern                    | 2D                               | 3D                                             |
| -------------------------- | -------------------------------- | ---------------------------------------------- |
| Coordinate convention      | Positive Y down                  | Positive Y up                                  |
| Rotation                   | One clockwise degree value       | Quaternion, with degree conveniences           |
| Angular velocity           | Scalar                           | Three-component vector                         |
| Inertia                    | Scalar                           | Three-dimensional tensor                       |
| Rendering host             | Canvas root or managed Layer     | One `WebGLLayer`                               |
| Primitive complex geometry | Polygon and chain                | Convex hull, static triangle mesh, heightfield |
| Dynamic complex geometry   | Convex pieces                    | Convex hull or convex compound                 |
| Common joints              | Revolute, prismatic, weld, wheel | Ball, hinge, slider, fixed                     |
| Ray                        | 2D origin/direction              | 3D origin/direction                            |
| Presentation interpolation | Position and angle               | Position and quaternion                        |
| Typical cost               | Lower                            | Higher broad/narrow phase and constraint cost  |

World scheduling, fixed ticks, transaction adoption, body/collider anatomy,
sensors, filtering, force/impulse commands, queries, exclusive pose ownership,
events, sleeping, handles, teardown, and replay identity otherwise match.

## Why 2D and 3D do not collide directly

A 2D body has no physical depth, uses scalar rotation and inertia, and lives in
root-logical Canvas coordinates. A 3D body has volume, quaternion orientation,
tensor inertia, and lives in one WebGL world's coordinates. A Canvas pixel or
rectangle also has no inherent camera depth or projection plane.

Directly coupling the solvers would require arbitrary choices for:

- which camera and depth plane locate a Canvas object in 3D;
- how a 3D contact normal and impulse project into 2D;
- how a 2D reaction affects 3D angular momentum;
- how opposite Y conventions map;
- which world owns contact, sleep, rollback, and event order; and
- how two independent fixed-tick configurations synchronize.

Those choices are application semantics, not seamless defaults. Therefore a
`PhysicsWorld2D` and `PhysicsWorld3D` may advance and Commit in the same realm
frame but never generate cross-dimensional pairs.

The credible future feature is 2.5D inside one 3D world:

- convert immutable 2D geometry into an explicitly extruded 3D shape;
- constrain a 3D body to one plane and selected rotation axes; or
- project a 3D pose into Canvas solely for presentation or interaction.

An extruded or plane-constrained object is a 3D collider and can therefore
contact other 3D bodies without solver coupling. A future conversion module
may expose named pure functions such as `extrudeShape3D`, but the initial
package reserves no live `PhysicsBridge2D3D` abstraction and promises no
automatic Canvas/WebGL collision.

## Ownership and teardown

Each resource has one exact owner:

| Resource                   | Owner                                                          | Release rule                                                                |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Physics world              | Exact `PhysicsWorld2D`/`PhysicsWorld3D` component generation   | Removal, replacement, failed mount, or root disposal                        |
| Scheduler registration     | Exact awake world generation                                   | World sleeps, fails closed, is removed, or is disposed                      |
| Body                       | Exact successful physics attachment generation                 | Attachment removal/replacement, owning body host removal, or world disposal |
| Collider                   | Exact collider or implicit-body attachment generation          | Attachment removal/replacement, ancestor body removal, or world disposal    |
| Joint                      | Exact joint component generation                               | Joint removal, either body removal, breakage, or world disposal             |
| Body handle binding        | Exact body attachment generation                               | Unbind, replacement, removal, failure cleanup, or handle-owner teardown     |
| Shape/BVH cache entry      | Exact world/package cache owner and immutable shape generation | Reference count reaches zero or owning world/context is disposed            |
| Candidate state/checkpoint | Exact world Advance transaction                                | Adopt after Commit or discard on failure                                    |
| Event record/queue         | Exact committed tick and observing attachment                  | Deliver or discard in Complete                                              |
| Debug resources            | Exact debug component generation                               | Component removal, context loss, failure, or disposal                       |

Every acquire/release path closes in `finally`. Failed definition validation
acquires nothing. Failed topology application restores the previous committed
world. Removing a parent recursively invalidates descendants before a stale
command or callback can observe replacement identity.

## Implementation decomposition

This architecture is too large for one implementation plan. It is decomposed
into independently reviewable projects while keeping one approved vocabulary:

1. **Physics foundation and scheduler seam**
   - package/export scaffolding;
   - nominal descriptors and type augmentation;
   - ordered animation/physics Advance lanes;
   - world/body/collider ownership and transaction checkpoints;
   - fixed-tick accumulator, clamp, interpolation, handles, and tracing.
2. **Baseline 2D rigid bodies**
   - circle, box/rounded box, capsule, segment/chain, and convex polygon;
   - dynamic AABB broad phase, contacts, impulses, friction, restitution;
   - gravity, sleeping, sensors, filtering, events, queries, and CCD;
   - existing Canvas inference and matching render components.
3. **Baseline 3D rigid bodies**
   - sphere, box, ellipsoid, capsule, and convex hull;
   - quaternion integration, 3D contacts/inertia, queries, sleeping, and CCD;
   - `Cube`, `Sphere`, `Mesh`, `Group3D`, and settled WebGL integration;
   - static triangle-mesh acceleration.
4. **Extended shapes and terrain**
   - deterministic 2D decomposition;
   - cylinder, cone, heightfield, and extended mesh tooling;
   - matching rendering components.
5. **Joints and motors**
   - dimension-specific joint entry points;
   - signal-bound motors, break events, and exact dependent ownership.
6. **Optional diagnostics and replay**
   - debug rendering;
   - versioned snapshots, restore, recording, and rollback evidence.
7. **Possible future 2.5D conversion**
   - explicit extrusion or plane-constrained 3D bodies only after demonstrated
     use cases.

Each project gets its own executable plan, failing public tests before
production code, a representative learning example, deterministic laboratory
scenarios, package-consumer evidence, lifecycle evidence, and proportional
trust-gate verification. The baseline 2D implementation precedes 3D so the
shared scheduler and transaction model are proven before tensor inertia,
quaternions, and 3D narrow phase are added.

## Evidence and verification

### Public scenarios

Representative 2D scenarios cover:

- falling, stacking, sliding, rolling, and bouncing shapes;
- gravity and per-body gravity scale;
- compound body geometry with a ground-check sensor;
- collision filters and deterministic begin/end/hit ordering;
- a kinematic moving platform driven by CRC animation in the same Advance;
- a dynamic ball disabled, animated into a container, and re-enabled without a
  pose jump;
- forces, impulses, torque, axis/rotation locks, sleep, wake, and CCD;
- closest/all ray casts, shape casts, overlaps, AABB, and point queries;
- Canvas Group transforms, layout placement, Clip, Layer, filters, events, and
  focus remaining aligned with rendering; and
- explicit colliders for opaque `Path2D`, text, and image geometry.

Representative 3D scenarios cover:

- falling and stacking cubes, spheres, capsules, and convex hulls;
- compound bodies and sensors under `Group3D`;
- quaternion rotation, angular impulse, axis locks, sleeping, and CCD;
- static triangle-mesh collision and dynamic convex-hull inference;
- kinematic animated doors and platforms;
- world-space ray/shape casts compared with independent WebGL camera picking;
- camera-only changes leaving physics state untouched;
- WebGL context loss while CPU physics continues; and
- one committed physics pose driving the matching rendered bitmap and pick
  ledger.

The same scenario modules are visible in the Studio and driven headlessly
through supported public imports. Learning examples remain concise; exhaustive
cadence, failure, and ordering fixtures stay in the test laboratory.

### Deterministic timing evidence

Tests drive arbitrary host-frame cadences and assert:

- zero, one, or several fixed ticks in one scheduled CRC frame as dictated by
  the accumulator;
- identical authoritative results for equivalent fixed-tick commands and
  per-tick inputs independent of render cadence when no clamp occurs;
- documented interpolated presentation at fractional remainders;
- bounded catch-up and exact clamp trace facts after a long stall;
- no catch-up for sleeping or paused time;
- animation target staging before kinematic solving in the same frame;
- one shared Commit before Plan and Render;
- failed candidate rollback without loss of unrelated animation/world work;
  and
- collision callbacks deferring commands to the next Begin.

### Structural and ownership evidence

Deterministic counters prove:

- one pending realm host frame across all roots, Layers, WebGL islands,
  animations, and physics worlds;
- one Advance registration per awake world and zero per body/collider/joint;
- no continuing registration for fully sleeping worlds;
- no steady-state hot-loop object allocation for unobserved worlds;
- no Canvas/GPU readback or GL commands from physics;
- stable broad-phase, pair, island, query, and event order;
- exact body/collider/joint/handle/cache/checkpoint ownership under success,
  failure, key replacement, reparenting, removal, context loss, and root
  disposal;
- no duplicate signal publication or stale completion delivery; and
- all ownership counts returning to baseline after final disposal.

### Package, typing, and browser evidence

Every shipped tranche verifies:

- side-effect-free named runtime exports and declarations;
- type augmentation only after importing the matching dimension;
- no 2D-to-3D or 3D-to-2D bundle pull-through;
- Bundler and NodeNext consumers;
- packed consumers with core only and with the optional WebGL peer;
- one shared `@crc/core` and `@crc/webgl` identity;
- source and built Studio modes plus editor declarations;
- public Learn, API, and Examples catalogs without laboratory metadata;
- semantic browser assertions before narrow visual evidence;
- lifecycle and structural-performance suites; and
- the aggregate repository trust gate on the documented environment.

Wall-clock benchmarks measure broad-phase, narrow-phase, solving,
interpolation, Canvas rendering, WebGL settlement/draw, bitmap transfer, and
composition separately. Performance targets are selected after baseline
collection and do not replace deterministic correctness.

## Required contract updates

Implementation updates the current normative contracts rather than treating
this dated design as permanent runtime authority. At minimum it revises:

- `docs/design/signals-and-scheduling-contract.md` for ordered Advance lanes,
  world registrations, staged reads, candidate adoption, sleeping, and clamp
  behavior;
- `docs/design/animation-contract.md` for exclusive pose ownership,
  kinematic signal targets, and animation/physics lane ordering;
- `docs/design/runtime-hooks-contract.md` for body/world handles and exact
  attachment ownership;
- `docs/design/drawing-components-contract.md` for matching physics shape
  components and inferred geometry;
- `docs/design/style-system-contract.md` for physics-owned transforms and
  disabled/kinematic authoring rules;
- `docs/design/layout-system-contract.md` for initial body placement from
  resolved layout without making layout a persistent physical constraint;
- `docs/design/canvas-surface-contract.md` for root-logical 2D physics across
  Layer presentation boundaries;
- `docs/design/user-events-contract.md` and mouse/focus guidance for the
  distinction between renderer picking and physics queries;
- `docs/design/event-resource-ownership.md` and
  `docs/design/runtime-resource-ownership.md` for worlds, bodies, colliders,
  joints, handles, checkpoints, events, and debug resources;
- the settled WebGL scene/rendering contract for quaternion body poses,
  geometry sharing, context loss, bitmap/pick consistency, and physics shape
  entries;
- public package README, Learn, API, Examples, and Studio declarations; and
- package, lifecycle, browser, visual, and structural-performance verifiers.

No implementation may weaken current Group transforms, source paint order,
logical event coordinates, one-realm scheduling, signal write guards, Layer
ownership, WebGL transactionality, or teardown guarantees merely to simplify
the solver.

## Approval decisions captured

The approved product and architecture decisions are:

- the initial physics implementation is fully CRC-owned;
- physics uses the existing scheduler and creates no additional frame loop;
- animation samples before physics and both publish through one Commit;
- physics advances through fixed ticks derived from arbitrary realm frame
  times, with bounded catch-up and interpolated presentation;
- bodies and colliders are distinct internally but combined by default in
  authoring;
- collider-only attachments are an explicit compound-body feature;
- sensors are colliders with `sensor: true`, not a separate body concept;
- ordinary dynamic-body pose belongs exclusively to physics;
- kinematic bodies are narrowly defined application-controlled moving
  colliders;
- disabling physics is the normal way to transfer a dynamic object's pose to
  animation, and re-enabling transfers it back at a frame boundary;
- all existing inspectable geometric primitives receive inferred colliders,
  opaque/platform-dependent primitives require explicit stable geometry, and
  every public collider shape receives CRC rendering support;
- `physics` is a normal JSX prop backed by nominal immutable descriptors and
  type augmentation;
- runtime namespace objects and import-time registries are prohibited in favor
  of named, tree-shakable exports;
- 2D and 3D have independent entry points and hot-loop kernels;
- 2D and 3D worlds share scheduling but do not collide directly;
- a future 2.5D solution belongs wholly inside one 3D solver; and
- implementation is staged through foundation, 2D, 3D, extended shapes,
  joints, and optional diagnostic/replay projects rather than one all-at-once
  plan.
