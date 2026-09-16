# First-Class 3D Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a wholly CRC-owned `@crc/physics/3d` rigid-body system and renderer-independent `@crc/physics/3d/geometry` toolkit, integrated with the existing realm scheduler and settled WebGL scene model, with a public `physics-3d` Studio example and deterministic scenario evidence.

**Architecture:** Pure immutable 3D shape and collision modules remain independent of CRC, WebGL, DOM, Canvas, and scheduling. A mounted `PhysicsWorld3D` owns one physics-lane participant and a separate 3D world kernel; successful WebGL traversal proposes topology, Begin applies it, Advance runs bounded fixed ticks after animation, Commit adopts one candidate, and settled WebGL composition consumes an interpolated quaternion pose without GL work during component composition. A new lockstep `@crc/webgl/internal` friend seam exposes copied CPU geometry and exact authored transform lineage while keeping physics presentation out of that lineage, so compound colliders are built by forward local composition rather than repeated inverse-world reconstruction.

**Tech Stack:** TypeScript 7, CRC JSX/createElement runtime, CRC signals and realm scheduler, settled `@crc/webgl` WebGL2 islands, Vitest Node, Vitest Browser with Playwright Chromium, esbuild, pnpm 11.21.0, Node 24.15.0.

**Spec:** `docs/superpowers/specs/2026-09-14-first-class-physics-design.md`

## Global Constraints

- Base every change on `codex/first-class-physics-2d` commit `962170d`; preserve unrelated work and never modify or reuse its worktree.
- Add a failing test before every production behavior change, run it once to observe the expected failure, implement the smallest passing behavior, rerun the focused evidence, and commit the reviewed task independently.
- Use Node 24.15.0 through `fnm exec --using=24.15.0` and pnpm 11.21.0 through `corepack pnpm@11.21.0`; use Playwright Chromium for browser evidence.
- CRC owns every 3D physics algorithm and runtime byte. Add no external engine, native binary, WebAssembly module, runtime service, worker, timer, second `requestAnimationFrame`, or third-party solver dependency.
- Publish only named, tree-shakable ESM exports through `@crc/physics/3d` and `@crc/physics/3d/geometry`. Do not add a root `@crc/physics` barrel, a namespace object, an import-time registry, or a second JSX runtime.
- `@crc/physics/3d/geometry` must run in plain Node without loading `@crc/core`, `@crc/webgl`, DOM, Canvas, WebGL, browser globals, a world, or a scheduler. Its declarations must not reference runtime or renderer types.
- `@crc/physics/3d` may import only public `@crc/core`, `@crc/webgl`, and their version-coupled `/internal` entries. Application code must never import `src`, `lib/*`, or an internal entry.
- One mounted awake `PhysicsWorld3D` owns one physics Advance registration. Bodies, colliders, contacts, queries, handles, shape renderers, and WebGL submissions own zero scheduler registrations.
- Preserve scheduler order: animation Advance first, physics Advance second, one shared Commit, one Plan, one Render. Use only realm logical time and the existing coalesced host frame.
- Default fixed step is `1000 / 60` milliseconds, default `maxCatchUpSteps` is `4`, default interpolation is `"linear"`, default gravity is `[0, 0, 0]`, default velocity iterations are `8`, and default position iterations are `3`.
- Rendering may occur at arbitrary cadence. Retain authoritative previous/current fixed-tick poses and derive presentation with position lerp plus shortest-path normalized quaternion slerp. Physics queries, handles, contacts, and events read authoritative state.
- Dynamic bodies exclusively own translation and quaternion orientation while enabled. Kinematic targets are application/animation-owned moving colliders. Disabled bodies are absent from solving and return pose ownership to authored values. Diagnose competing writers.
- Kinematic position and orientation bindings are independent partial targets: an omitted field retains the last accepted value and is never reset to an identity/default value by an update to the other field.
- Rigid-body poses never contain scale. CRC-owned resolved scale is baked into collider geometry. A scale change enqueues deterministic collider reconstruction and automatic mass/inertia recomputation at the next Begin.
- Keep bodies and colliders separate internally. A body attachment on geometry infers one self collider by default; `collider3D()` attaches compound or sensor geometry to the nearest ancestor body; `Group3D` is a body host with no inferred self collider.
- Preserve exact CRC/WebGL-authored local transform lineage as copied translation/quaternion/scale nodes. Build compound collider-local geometry by forward-composing the lineage suffix below the body host. Do not repeatedly obtain local collider transforms by multiplying a world matrix by an inverse body matrix.
- Physics presentation may affect the settled mesh model matrix, pick geometry, and projected focus bounds, but it must not enter authored transform lineage, collider geometry, mass properties, or authoritative query state.
- `PhysicsWorld3D` must live inside exactly one `WebGLLayer`; it cannot span islands. Scene composition remains CPU-only, performs no GL calls, and settles/render/pick/focus from the same presented model generation.
- `Cube` infers a box; uniform `Sphere` scale infers a sphere; nonuniform `Sphere` scale infers an ellipsoid; static `Mesh` infers a triangle mesh; dynamic or kinematic `Mesh` infers a deterministic convex hull; `Group3D` infers no self collider.
- Explicit moving triangle meshes and heightfields are rejected with an actionable concavity diagnostic. Moving `Mesh` always uses a convex hull unless the author supplies another convex shape.
- Public shapes are immutable nominal values backed by copied numeric storage. Public results are frozen semantic values. Tags, callbacks, signals, handles, and WebGL geometry descriptors retain application identity and are not deep-frozen.
- Support sphere, box, ellipsoid, capsule, cylinder, cone, convex hull, triangle mesh, and heightfield across the public pure-operation matrix. Triangle mesh and heightfield acceleration structures are immutable and deterministic.
- Use a separate 3D kernel: quaternion integration, tensor inertia, 3D support mapping, manifolds, impulse constraints, islands, sleeping, CCD, and queries must not route through a dimension union in solver hot paths.
- Sort creation effects, commands, pair keys, manifolds, islands, query results, semantic events, and teardown by stable numeric identity. Do not expose Map/Set, tree traversal, BVH traversal, hash, or cache order.
- Use pooled typed arrays and reusable scratch in hot solver paths where practical. Correctness and deterministic termination take priority over premature micro-optimization; every iterative algorithm has a fixed bound and fail-closed diagnostic.
- Sensors use `sensor: true`, overlap queries/events, and no contact constraint. Do not add a separate sensor factory.
- 2D and 3D worlds share only scheduler/lifecycle concepts. They never collide, share bodies, or perform a 2.5D bridge in this plan.
- Public runtime diagnostics must identify missing worlds, wrong dimensions, malformed/foreign attachments, duplicate handles, moving concave meshes, invalid automatic mass, conflicting pose writers, nonfinite transforms, unsupported sheared moving geometry, and stale commands.
- The public `physics-3d` example and deterministic laboratory must use only supported public imports and no private loop. Semantic and geometry assertions precede any visual evidence.
- Update current normative contracts from verified behavior; the dated design remains historical intent where current code or executable tests differ.

## File and Responsibility Map

### WebGL lockstep friend seam

- Modify `packages/webgl/package.json` and `packages/webgl/tsconfig.build.json`: add a version-coupled `./internal` entry and build artifact without exposing it from the root.
- Create `packages/webgl/src/internal.ts`: export only copied CPU geometry, exact transform-lineage, primitive-inference, and presentation-scope capabilities for the matching official physics package.
- Modify `packages/webgl/src/lib/types.ts`: add empty public `CRCPhysics3DPropExtension`; extend supported geometric target props.
- Modify `packages/webgl/src/lib/components/group-3d.ts`: extend the empty physics prop base and push exact authored TRS lineage with its current model scope.
- Modify `packages/webgl/src/lib/components/mesh.ts`, `cube.ts`, and `sphere.ts`: resolve one canonical local TRS record through shared helpers and submit the same transformed geometry used by inference, rendering, picking, and focus.
- Modify `packages/webgl/src/lib/scene/types.ts` and `composer.ts`: keep an authored-lineage stack separate from the model-matrix stack; allow a physics presentation scope to affect only the model stack.
- Modify `packages/webgl/src/lib/geometry/geometry.ts`: expose immutable copied geometry snapshots only through the friend entry; never expose GL resources.
- Create `packages/webgl/src/lib/physics-friend.test.tsx`: exact lineage, CPU geometry copies, prop augmentation, presentation/pick/focus alignment, LIFO cleanup, no composition-time GL work, and wrong-backend diagnostics.

### Pure 3D geometry

- Create `packages/physics/src/3d-geometry.ts` and `packages/physics/src/3d.ts`: geometry-only and world-facing named export surfaces.
- Create `packages/physics/src/lib/3d/types.ts`, `numeric-policy.ts`, `math.ts`, `shape-records.ts`, and `shapes.ts`: vectors, quaternions, matrices, poses, bounds, rays, shapes, transforms, bounds, mass properties, convex hull construction, triangle mesh BVH, and heightfield cells.
- Create `packages/physics/src/lib/3d/collision/analytic.ts`, `support.ts`, `gjk.ts`, `epa.ts`, `manifold.ts`, `pairs.ts`, and `casts.ts`: deterministic analytic and support-mapped pair operations plus mesh/heightfield traversal.
- Create colocated Node tests for all public operations and private algorithms, including seeded invariants, exact ordering, degeneracy, and iteration caps.

### 3D world kernel and runtime

- Create `packages/physics/src/lib/3d/world/storage.ts`, `broad-phase.ts`, `integrator.ts`, `contact-cache.ts`, `solver.ts`, `ccd.ts`, `queries.ts`, and `world.ts`: generation-safe pools, deterministic broad/narrow phase, tensor impulses, sleeping, CCD, queries, rollback, fixed ticks, and presentation.
- Create `packages/physics/src/lib/3d/runtime/ownership.ts`, `trace.ts`, `context.ts`, `descriptors.ts`, `controller.ts`, `world-component.ts`, `body-handle.ts`, and `events.ts`: one world participant, topology transactions, exact world/body scope, handles/commands, ordered events, and teardown.
- Create `packages/physics/src/lib/3d/webgl/inference.ts`, `presentation.ts`, and `components.ts`: Cube/Sphere/Mesh/Group3D inference, exact compound lineage, dynamic presentation scopes, shape-to-WebGL geometry caching, and public physics shape components.

### Scenarios, consumers, contracts, and evidence

- Create `packages/scenarios/src/physics-3d.example.tsx` and `packages/scenarios/src/physics-3d.ts`; register the public example as `physics-3d` and keep deterministic controls/snapshots separate from presentation metadata.
- Create focused Node, browser, lifecycle, performance, replay, long-run, and repeated-handoff tests under `packages/physics/src/lib/3d/` and `packages/core/test/`.
- Modify workspace, package-consumer, packed-consumer, Studio declaration, catalog, documentation-export, and build configuration for exact `@crc/physics/3d`, `/3d/geometry`, and `@crc/webgl/internal` boundaries.
- Update normative scheduler, animation, hooks, drawing, style, layout, events, ownership, and settled-WebGL contracts plus public Learn/API/package docs and dated field notes.

## Fixed Public Surface

The renderer-independent entry exports the following values, and the world entry re-exports them:

```ts
export {
  sphereShape3D,
  boxShape3D,
  ellipsoidShape3D,
  capsuleShape3D,
  cylinderShape3D,
  coneShape3D,
  convexHullShape3D,
  triangleMeshShape3D,
  heightfieldShape3D,
  boundsOfShape3D,
  massProperties3D,
  containsPoint3D,
  distanceBetweenShapes3D,
  overlapShapes3D,
  contactBetweenShapes3D,
  raycastShape3D,
  shapeCastAgainstShape3D,
  transformShape3D,
};
```

The world entry additionally exports:

```ts
export {
  PhysicsWorld3D,
  PhysicsShape3D,
  Box3D,
  Ellipsoid3D,
  Capsule3D,
  Cylinder3D,
  Cone3D,
  ConvexHull3D,
  Heightfield3D,
  dynamicBody3D,
  staticBody3D,
  kinematicBody3D,
  collider3D,
  crcPhysicsBody3D,
  crcPhysicsWorld3D,
  applyForce3D,
  applyImpulse3D,
  applyTorque3D,
  setLinearVelocity3D,
  setAngularVelocity3D,
  teleportBody3D,
  wakeBody3D,
  sleepBody3D,
  enableBody3D,
  disableBody3D,
  raycast3D,
  shapeCast3D,
  overlapShape3D,
  queryAabb3D,
  queryPoint3D,
};
```

No root `@crc/physics` export, joints, debug surface, replay surface, manual step, or 2.5D bridge is added.

The geometry types and exact factory signatures are:

```ts
export type CRCPhysicsVector3 = readonly [x: number, y: number, z: number];
export type CRCPhysicsQuaternion = readonly [
  x: number,
  y: number,
  z: number,
  w: number,
];
export type CRCPhysicsMatrix3 = readonly [
  m00: number,
  m01: number,
  m02: number,
  m10: number,
  m11: number,
  m12: number,
  m20: number,
  m21: number,
  m22: number,
];

export interface CRCPhysicsPose3D {
  readonly position: CRCPhysicsVector3;
  readonly orientation: CRCPhysicsQuaternion;
}
export type CRCPhysicsTransform3D = CRCPhysicsPose3D;
export interface CRCPhysicsAabb3D {
  readonly min: CRCPhysicsVector3;
  readonly max: CRCPhysicsVector3;
}
export interface CRCPhysicsRay3D {
  readonly origin: CRCPhysicsVector3;
  readonly direction: CRCPhysicsVector3;
  readonly maxDistance: number;
}
declare const physicsShape3DBrand: unique symbol;
export interface CRCPhysicsShape3D {
  readonly [physicsShape3DBrand]: true;
}
export interface CRCPhysicsMassProperties3D {
  readonly volume: number;
  readonly centerOfMass: CRCPhysicsVector3;
  readonly mass: number;
  readonly inertiaTensor: CRCPhysicsMatrix3;
}
export interface CRCPhysicsDistance3D {
  readonly separation: number;
  readonly pointOnFirst: CRCPhysicsVector3;
  readonly pointOnSecond: CRCPhysicsVector3;
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector3;
}
export interface CRCPhysicsContactPoint3D {
  readonly pointOnFirst: CRCPhysicsVector3;
  readonly pointOnSecond: CRCPhysicsVector3;
  readonly separation: number;
}
export interface CRCPhysicsShapeContact3D {
  readonly normal: CRCPhysicsVector3;
  readonly points: readonly CRCPhysicsContactPoint3D[];
}
export interface CRCPhysicsShapeHit3D {
  readonly point: CRCPhysicsVector3;
  readonly normal: CRCPhysicsVector3;
  readonly distance: number;
  readonly timeOfImpact: number;
  readonly triangleIndex?: number;
  readonly barycentric?: CRCPhysicsVector3;
}

export function sphereShape3D(
  input: Readonly<{
    radius: number;
    center?: CRCPhysicsVector3;
  }>,
): CRCPhysicsShape3D;
export function boxShape3D(
  input: Readonly<{
    width: number;
    height: number;
    depth: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D;
export function ellipsoidShape3D(
  input: Readonly<{
    radii: CRCPhysicsVector3;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D;
export function capsuleShape3D(
  input: Readonly<{
    start: CRCPhysicsVector3;
    end: CRCPhysicsVector3;
    radius: number;
  }>,
): CRCPhysicsShape3D;
export function cylinderShape3D(
  input: Readonly<{
    radius: number;
    halfHeight: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D;
export function coneShape3D(
  input: Readonly<{
    radius: number;
    halfHeight: number;
    center?: CRCPhysicsVector3;
    orientation?: CRCPhysicsQuaternion;
  }>,
): CRCPhysicsShape3D;
export function convexHullShape3D(
  input: Readonly<{
    points: readonly CRCPhysicsVector3[];
  }>,
): CRCPhysicsShape3D;
export function triangleMeshShape3D(
  input: Readonly<{
    positions: ArrayLike<number>;
    indices?: ArrayLike<number>;
  }>,
): CRCPhysicsShape3D;
export function heightfieldShape3D(
  input: Readonly<{
    rows: number;
    columns: number;
    heights: ArrayLike<number>;
    cellSizeX?: number;
    cellSizeZ?: number;
    heightScale?: number;
    origin?: CRCPhysicsVector3;
  }>,
): CRCPhysicsShape3D;
```

`cylinderShape3D` and `coneShape3D` use local positive Y as their axis. Heightfields contain exactly `rows * columns` finite samples with `rows >= 2`, `columns >= 2`, positive cell sizes, deterministic two-triangle cells, and row-major X-then-Z ordering. Triangle meshes and heightfields have zero mass unless a triangle mesh is a consistently wound closed manifold; world-facing dynamic automatic mass still rejects either shape because moving concave geometry is unsupported.

The pure operations have exact signatures:

```ts
export function boundsOfShape3D(
  shape: CRCPhysicsShape3D,
  pose?: CRCPhysicsPose3D,
): CRCPhysicsAabb3D;
export function massProperties3D(
  shape: CRCPhysicsShape3D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties3D;
export function containsPoint3D(
  shape: CRCPhysicsShape3D,
  pose: CRCPhysicsPose3D,
  point: CRCPhysicsVector3,
): boolean;
export function distanceBetweenShapes3D(
  first: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  second: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsDistance3D;
export function overlapShapes3D(
  first: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  second: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): boolean;
export function contactBetweenShapes3D(
  first: CRCPhysicsShape3D,
  firstPose: CRCPhysicsPose3D,
  second: CRCPhysicsShape3D,
  secondPose: CRCPhysicsPose3D,
): CRCPhysicsShapeContact3D | null;
export function raycastShape3D(
  shape: CRCPhysicsShape3D,
  pose: CRCPhysicsPose3D,
  ray: CRCPhysicsRay3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null;
export function shapeCastAgainstShape3D(
  moving: CRCPhysicsShape3D,
  from: CRCPhysicsPose3D,
  translation: CRCPhysicsVector3,
  target: CRCPhysicsShape3D,
  targetPose: CRCPhysicsPose3D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit3D | null;
export function transformShape3D(
  shape: CRCPhysicsShape3D,
  transform: CRCPhysicsTransform3D,
): CRCPhysicsShape3D;
```

Quaternion factories accept any finite nonzero quaternion and snapshot its normalized canonical form; `q` and `-q` normalize to the representation whose first nonzero component in `[w, x, y, z]` is positive. Outputs use `[x, y, z, w]` and identity `[0, 0, 0, 1]`.

The runtime body/collider boundary is:

```ts
export interface CRCPhysicsAxisLocks3D {
  readonly x?: boolean;
  readonly y?: boolean;
  readonly z?: boolean;
}
export interface CRCPhysicsColliderConfiguration3D {
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
  readonly onCollisionStart?: CRCPhysicsCollisionHandler3D;
  readonly onCollisionEnd?: CRCPhysicsCollisionHandler3D;
  readonly onHit?: CRCPhysicsHitHandler3D;
  readonly onOverlapStart?: CRCPhysicsOverlapHandler3D;
  readonly onOverlapEnd?: CRCPhysicsOverlapHandler3D;
}
export interface CRCPhysicsDynamicBody3DOptions {
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
export interface CRCPhysicsStaticBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}
export interface CRCPhysicsKinematicTarget3D {
  readonly position?: Signal<CRCPhysicsVector3>;
  readonly orientation?: Signal<CRCPhysicsQuaternion>;
}
export interface CRCPhysicsKinematicBody3DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle3D;
  readonly target?: CRCPhysicsKinematicTarget3D;
  readonly allowSleep?: boolean;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration3D | CRCPhysicsShape3D;
}
```

The exact world, handle, command, query, and event boundary is:

```ts
export interface CRCPhysicsCollisionFilter {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}
export interface CRCPhysicsSolverOptions {
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}
export interface CRCPhysicsWorld3DProps {
  readonly gravity?: CRCPhysicsVector3;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler3D;
  readonly onWake?: CRCPhysicsBodyStateHandler3D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNode;
}
declare const physicsAttachment3DBrand: unique symbol;
export interface CRCPhysicsBodyAttachment3D {
  readonly [physicsAttachment3DBrand]: "body";
}
export interface CRCPhysicsColliderAttachment3D {
  readonly [physicsAttachment3DBrand]: "collider";
}
export type CRCPhysicsAttachment3D =
  CRCPhysicsBodyAttachment3D | CRCPhysicsColliderAttachment3D;
export function dynamicBody3D(
  options?: CRCPhysicsDynamicBody3DOptions,
): CRCPhysicsBodyAttachment3D;
export function staticBody3D(
  options?: CRCPhysicsStaticBody3DOptions,
): CRCPhysicsBodyAttachment3D;
export function kinematicBody3D(
  options?: CRCPhysicsKinematicBody3DOptions,
): CRCPhysicsBodyAttachment3D;
export function collider3D(
  options?: CRCPhysicsColliderConfiguration3D,
): CRCPhysicsColliderAttachment3D;

declare const bodyHandle3DBrand: unique symbol;
export interface CRCPhysicsBodyHandle3D {
  readonly [bodyHandle3DBrand]: true;
  readonly position: Signal<CRCPhysicsVector3>;
  readonly orientation: Signal<CRCPhysicsQuaternion>;
  readonly linearVelocity: Signal<CRCPhysicsVector3>;
  readonly angularVelocityDegreesPerSecond: Signal<CRCPhysicsVector3>;
  readonly sleeping: Signal<boolean>;
  readonly enabled: Signal<boolean>;
  readonly generation: Signal<number>;
}
declare const colliderHandle3DBrand: unique symbol;
export interface CRCPhysicsColliderHandle3D {
  readonly [colliderHandle3DBrand]: true;
}
declare const worldHandle3DBrand: unique symbol;
export interface CRCPhysicsWorldHandle3D {
  readonly [worldHandle3DBrand]: true;
  readonly revision: Signal<number>;
}
export function crcPhysicsBody3D(): CRCPhysicsBodyHandle3D;
export function crcPhysicsWorld3D(): CRCPhysicsWorldHandle3D;
export function applyForce3D(
  body: CRCPhysicsBodyHandle3D,
  force: CRCPhysicsVector3,
  options?: Readonly<{ at?: CRCPhysicsVector3; wake?: boolean }>,
): void;
export function applyImpulse3D(
  body: CRCPhysicsBodyHandle3D,
  impulse: CRCPhysicsVector3,
  options?: Readonly<{ at?: CRCPhysicsVector3; wake?: boolean }>,
): void;
export function applyTorque3D(
  body: CRCPhysicsBodyHandle3D,
  torque: CRCPhysicsVector3,
): void;
export function setLinearVelocity3D(
  body: CRCPhysicsBodyHandle3D,
  velocity: CRCPhysicsVector3,
): void;
export function setAngularVelocity3D(
  body: CRCPhysicsBodyHandle3D,
  degreesPerSecond: CRCPhysicsVector3,
): void;
export function teleportBody3D(
  body: CRCPhysicsBodyHandle3D,
  pose: CRCPhysicsPose3D,
): void;
export function wakeBody3D(body: CRCPhysicsBodyHandle3D): void;
export function sleepBody3D(body: CRCPhysicsBodyHandle3D): void;
export function enableBody3D(
  body: CRCPhysicsBodyHandle3D,
  options?: Readonly<{ velocity?: "zero" | "preserve" }>,
): void;
export function disableBody3D(body: CRCPhysicsBodyHandle3D): void;

export type CRCPhysicsQueryMode = "closest" | "any" | "all";
export interface CRCPhysicsQueryOptions3D<
  Mode extends CRCPhysicsQueryMode = "closest",
> {
  readonly mode?: Mode;
  readonly sensors?: "include" | "exclude" | "only";
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly excludeBody?: CRCPhysicsBodyHandle3D;
  readonly excludeCollider?: CRCPhysicsColliderHandle3D;
}
export interface CRCPhysicsQueryHit3D extends CRCPhysicsShapeHit3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly collider: CRCPhysicsColliderHandle3D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}
export interface CRCPhysicsQueryMatch3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly collider: CRCPhysicsColliderHandle3D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}
export type CRCPhysicsQueryResult3D<
  Mode extends CRCPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;
export function raycast3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  ray: CRCPhysicsRay3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
export function shapeCast3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  shape: CRCPhysicsShape3D,
  from: CRCPhysicsPose3D,
  translation: CRCPhysicsVector3,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryHit3D>;
export function overlapShape3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  shape: CRCPhysicsShape3D,
  pose: CRCPhysicsPose3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
export function queryAabb3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  bounds: CRCPhysicsAabb3D,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;
export function queryPoint3D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle3D,
  point: CRCPhysicsVector3,
  options?: CRCPhysicsQueryOptions3D<Mode>,
): CRCPhysicsQueryResult3D<Mode, CRCPhysicsQueryMatch3D>;

export interface CRCPhysicsCollisionEvent3D {
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
export interface CRCPhysicsOverlapEvent3D {
  readonly selfBody: CRCPhysicsBodyHandle3D;
  readonly selfCollider: CRCPhysicsColliderHandle3D;
  readonly otherBody: CRCPhysicsBodyHandle3D;
  readonly otherCollider: CRCPhysicsColliderHandle3D;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}
export interface CRCPhysicsBodyStateEvent3D {
  readonly body: CRCPhysicsBodyHandle3D;
  readonly sleeping: boolean;
  readonly tick: number;
}
export type CRCPhysicsCollisionHandler3D = (
  event: CRCPhysicsCollisionEvent3D,
) => void;
export type CRCPhysicsHitHandler3D = (
  event: CRCPhysicsCollisionEvent3D,
) => void;
export type CRCPhysicsOverlapHandler3D = (
  event: CRCPhysicsOverlapEvent3D,
) => void;
export type CRCPhysicsBodyStateHandler3D = (
  event: CRCPhysicsBodyStateEvent3D,
) => void;
```

All-hit ray/shape casts sort by time then collider identity; overlap/AABB/point results sort by collider identity. The package declaration-merges `physics?: CRCPhysicsAttachment3D` into `@crc/webgl`'s empty `CRCPhysics3DPropExtension`; no Canvas prop is augmented by the 3D entry.

## Numeric and Determinism Policy

- Use finite JavaScript numbers for public inputs and authoritative values; use `Float64Array` for solver numeric state and fixed-width integer typed arrays for IDs, generations, flags, filters, tree links, and indices.
- Use `GEOMETRY_EPSILON_3D = 1e-9`, `CONTACT_SLOP_3D = 0.005`, `MAX_POSITION_CORRECTION_3D = 0.2`, `RESTITUTION_VELOCITY_THRESHOLD_3D = 1`, `SLEEP_LINEAR_SPEED_3D = 0.05`, `SLEEP_ANGULAR_SPEED_DEGREES_3D = 0.5`, `SLEEP_DURATION_SECONDS_3D = 0.5`, `FAT_AABB_MARGIN_3D = 0.1`, `MAX_GJK_ITERATIONS_3D = 32`, `MAX_EPA_ITERATIONS_3D = 48`, and `MAX_CCD_IMPACTS_PER_TICK_3D = 4`.
- Normalize quaternions after every public admission and integration step. Shortest-path slerp negates the destination when the dot product is negative; a zero-angle tie retains the canonical representation.
- Convex hull input is deduplicated lexicographically within epsilon, requires four noncoplanar points, chooses the lexicographically lowest valid seed tetrahedron, expands the lowest visible face first, and emits canonical outward faces sorted by vertex identities.
- Mesh BVH splits the longest centroid-bounds axis with X/Y/Z tie order, sorts by centroid then triangle index, chooses the lower median, and traverses lower node identity first for exact distance ties.
- Heightfield cell `(row, column)` emits triangles `(a, c, b)` then `(b, c, d)` in row-major order; public triangle indices follow that stable order.
- Broad-phase pair keys are `(minColliderId, maxColliderId)` and are sorted lexicographically before narrow phase. Static-static and disabled pairs do not reach the solver.
- GJK/EPA support ties use lower canonical vertex/feature identity. Bounded failure rejects the pair with a trace fact rather than looping or inventing a contact.
- Contact points sort by pair key, penetration, then stable feature identity before constraints. The first implementation may retain up to four points per 3D manifold.
- Sequential impulses run exactly the configured velocity iteration count, followed by exactly the configured position iteration count. Friction uses `sqrt(first * second)` and restitution uses `max(first, second)`.
- Semi-implicit integration updates linear/angular velocity before position/orientation. Quaternion derivative uses world angular velocity converted from degrees per second at admission. Damping is `1 / (1 + damping * dt)`.
- Tensor inertia is stored in local body coordinates; each solve derives the inverse world tensor from the normalized orientation. Locked rotation axes zero the corresponding local inverse-inertia response, and locked translation axes zero velocity/impulse response deterministically.
- CCD sweeps opted-in convex dynamic bodies against solid convex, mesh, and heightfield targets, chooses earliest time then collider identity, resolves at most four impacts, and completes any remainder discretely.

## Task Dependency and Milestone Gates

- Tasks 1–3 establish the WebGL friend seam and standalone sphere/box geometry boundary.
- Tasks 4–7 deliver the first complete Cube/Sphere vertical slice: solver, scheduler, WebGL attachment, public `physics-3d` Studio example, and focused browser evidence. After Task 7, start the built Studio and report its exact local URL while continuing the plan.
- Tasks 8–10 expand the complete convex, triangle-mesh, heightfield, pure-query, world-query, and rendering matrix.
- Tasks 11–12 lock compound lineage, inference, kinematic partial targets, scale rebuilds, events, commands, interaction, deterministic replay, long-running bounds, and lifecycle cycles.
- Tasks 13–14 complete package consumers, declarations, documentation, ownership, and structural performance.
- Task 15 runs fresh final verification and records the clean branch evidence.

---

### Task 1: Add the lockstep WebGL physics friend seam

**Files:**

- Modify: `packages/webgl/package.json`
- Modify: `packages/webgl/tsconfig.build.json`
- Create: `packages/webgl/src/internal.ts`
- Modify: `packages/webgl/src/lib/types.ts`
- Modify: `packages/webgl/src/lib/geometry/geometry.ts`
- Modify: `packages/webgl/src/lib/scene/types.ts`
- Modify: `packages/webgl/src/lib/scene/composer.ts`
- Modify: `packages/webgl/src/lib/components/group-3d.ts`
- Modify: `packages/webgl/src/lib/components/mesh.ts`
- Modify: `packages/webgl/src/lib/components/cube.ts`
- Modify: `packages/webgl/src/lib/components/sphere.ts`
- Create: `packages/webgl/src/lib/physics-friend.test.tsx`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: current CPU scene composer, immutable `CRCWebGLGeometry`, canonical Cube/Sphere geometry, transform order, settled pick/focus generation, and core official attachment lifecycle.
- Produces: `@crc/webgl/internal` with copied geometry access, exact authored lineage, supported-primitive resolution, and a presentation-only model scope; public empty `CRCPhysics3DPropExtension` on `Group3D`, `Cube`, `Sphere`, and `Mesh` props.

- [ ] **Step 1: Write failing friend-seam and lifecycle tests**

  Assert the root package does not export friend names; `/internal` returns copied positions/indices/bounds; Group3D lineage records exact translation, canonical quaternion, and scale nodes; Cube/Sphere/Mesh facts use the same resolved local transform and geometry as submission; a presentation scope affects render, pick, and focus models but not authored lineage; scopes unwind after descendants and on throw; no GL call occurs before settlement.

- [ ] **Step 2: Run the focused WebGL tests and observe missing APIs**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/physics-friend.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the internal entry, augmentation base, authored lineage, and presentation scope do not exist.

- [ ] **Step 3: Implement exact authored transform nodes**

  Resolve WebGL transform style once into a frozen `{ translation, orientation, scale, matrix }` record. Keep `authoredTransformStack` beside `modelStack`; ordinary Group3D scopes push both, while `pushPhysicsPresentation` multiplies only the model stack. The friend snapshot returns copied numeric tuples and an immutable lineage array, never composer mutation or GPU state.

- [ ] **Step 4: Implement supported primitive facts and copied geometry access**

  Directly compare receiver function identity with `Group3D`, `Cube`, `Sphere`, and `Mesh`. Return `group`, `cube`, `sphere`, or `mesh`, its exact local transform record, current authored parent lineage, and immutable CPU geometry descriptor/data where applicable. Unknown WebGL primitives fail with a component/source diagnostic rather than name-based dispatch.

- [ ] **Step 5: Add the empty public extension and internal package entry**

  Extend `CRCWebGLTargetProps` and `Group3DProps` with `CRCPhysics3DPropExtension`. Export the empty interface from `@crc/webgl` for declaration merging but no physics value. Build `src/internal.ts` as a separate externalized entry and assert applications cannot reach it from the root.

- [ ] **Step 6: Run WebGL, package, and type regressions**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/webgl/src/lib/physics-friend.test.tsx packages/webgl/src/lib/scene packages/webgl/src/lib/components --browser.headless --browser.ui=false
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run typecheck
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 -C packages/webgl run build
  ```

  Expected: PASS with unchanged scenes when physics is absent and no extra GL work during composition.

- [ ] **Step 7: Commit the WebGL friend seam**

  ```bash
  git add packages/webgl/package.json packages/webgl/tsconfig.build.json packages/webgl/src/internal.ts packages/webgl/src/lib/types.ts packages/webgl/src/lib/geometry/geometry.ts packages/webgl/src/lib/scene/types.ts packages/webgl/src/lib/scene/composer.ts packages/webgl/src/lib/components/group-3d.ts packages/webgl/src/lib/components/mesh.ts packages/webgl/src/lib/components/cube.ts packages/webgl/src/lib/components/sphere.ts packages/webgl/src/lib/physics-friend.test.tsx playground/package-consumer/index.ts
  git commit -m "feat(webgl): add official 3d physics seam"
  ```

### Task 2: Scaffold the 3D package surface and immutable sphere/box geometry

**Files:**

- Modify: `packages/physics/package.json`
- Modify: `packages/physics/tsconfig.build.json`
- Modify: `packages/physics/README.md`
- Modify: `pnpm-lock.yaml`
- Create: `packages/physics/src/3d.ts`
- Create: `packages/physics/src/3d-geometry.ts`
- Create: `packages/physics/src/lib/3d/types.ts`
- Create: `packages/physics/src/lib/3d/numeric-policy.ts`
- Create: `packages/physics/src/lib/3d/math.ts`
- Create: `packages/physics/src/lib/3d/shape-records.ts`
- Create: `packages/physics/src/lib/3d/shapes.ts`
- Create: `packages/physics/src/lib/3d/public-types.test.ts`
- Create: `packages/physics/src/lib/3d/shapes.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes: shared finite validation only; geometry entry consumes no core/WebGL type or runtime.
- Produces: the fixed public 3D geometry declarations, runtime-facing public types, a `/3d` entry that re-exports implemented geometry without placeholder runtime values, nominal sphere/box shapes, canonical quaternion math, bounds, rigid transforms, and analytic mass properties. Tasks 6, 7, and 10 add runtime values only when their implementations exist.

- [ ] **Step 1: Write failing public-boundary and known-answer tests**

  Import every fixed geometry name from `/3d/geometry`, geometry re-exports plus all available runtime-facing types from `/3d`, and assert no root barrel. Prove declarations for `/geometry` contain no CRC/WebGL references. Cover copied arrays, frozen results, quaternion canonicalization, transformed bounds, sphere mass, and a `2 × 4 × 6` box at density `3` with volume `48`, mass `144`, center `[0,0,0]`, and diagonal inertia `[624, 480, 240]`.

- [ ] **Step 2: Run Node tests and typecheck to observe missing entries**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/public-types.test.ts packages/physics/src/lib/3d/shapes.test.ts --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run typecheck
  ```

  Expected: FAIL on unresolved 3D entries and factories.

- [ ] **Step 3: Add side-effect-free entries and exact public types**

  Add `./3d` and `./3d/geometry` exports, optional `@crc/webgl` peer metadata, workspace dev dependency, source aliases, and four-entry physics build. Externalize both CRC peers/internal entries. Define the fixed geometry signatures and runtime-facing public types; keep not-yet-implemented runtime values absent rather than shipping throwing stubs.

- [ ] **Step 4: Implement quaternion/vector/matrix primitives and nominal records**

  Use caller-owned output buffers internally, copy public inputs into `Float64Array`, canonicalize normalized quaternions, and retain one frozen public shell in a private WeakMap. Implement exact rigid pose composition, point/vector rotation, matrix-tensor multiplication, AABB operations, and stable zero cleanup.

- [ ] **Step 5: Implement sphere and oriented box shapes**

  Store sphere center/radius and box half-extents/center/orientation as immutable records. Implement `boundsOfShape3D`, `massProperties3D`, and `transformShape3D`; a rigid transform composes position/orientation and never accepts scale.

- [ ] **Step 6: Run pure tests and inspect the built geometry graph**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/public-types.test.ts packages/physics/src/lib/3d/shapes.test.ts --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 -C packages/physics run build
  ```

  Expected: PASS; `dist/3d-geometry.mjs` has no core, WebGL, scheduler, DOM, Canvas, or browser import.

- [ ] **Step 7: Commit the 3D package and base geometry**

  ```bash
  git add packages/physics/package.json packages/physics/tsconfig.build.json packages/physics/README.md packages/physics/src/3d.ts packages/physics/src/3d-geometry.ts packages/physics/src/lib/3d/types.ts packages/physics/src/lib/3d/numeric-policy.ts packages/physics/src/lib/3d/math.ts packages/physics/src/lib/3d/shape-records.ts packages/physics/src/lib/3d/shapes.ts packages/physics/src/lib/3d/public-types.test.ts packages/physics/src/lib/3d/shapes.test.ts vitest.config.ts pnpm-lock.yaml
  git commit -m "feat(physics): add immutable 3d sphere and box geometry"
  ```

### Task 3: Complete pure sphere/box contacts and casts

**Files:**

- Create: `packages/physics/src/lib/3d/collision/analytic.ts`
- Create: `packages/physics/src/lib/3d/collision/support.ts`
- Create: `packages/physics/src/lib/3d/collision/gjk.ts`
- Create: `packages/physics/src/lib/3d/collision/epa.ts`
- Create: `packages/physics/src/lib/3d/collision/manifold.ts`
- Create: `packages/physics/src/lib/3d/collision/pairs.ts`
- Create: `packages/physics/src/lib/3d/collision/casts.ts`
- Create: `packages/physics/src/lib/3d/collision/analytic.test.ts`
- Create: `packages/physics/src/lib/3d/collision/support.test.ts`
- Create: `packages/physics/src/lib/3d/collision/gjk.test.ts`
- Create: `packages/physics/src/lib/3d/collision/epa.test.ts`
- Create: `packages/physics/src/lib/3d/collision/manifold.test.ts`
- Create: `packages/physics/src/lib/3d/collision/pairs.test.ts`
- Create: `packages/physics/src/lib/3d/collision/casts.test.ts`
- Modify: `packages/physics/src/3d-geometry.ts`
- Modify: `packages/physics/src/3d.ts`
- Modify: `tooling/verify-packed-consumer.mjs`

**Interfaces:**

- Consumes: Task 2 immutable records, canonical poses, and fixed iteration policy.
- Produces: `containsPoint3D`, signed distance, overlap, contact, ray cast, and fixed-orientation translational shape cast for sphere/box pairs plus a reusable convex support/manifold kernel.

- [ ] **Step 1: Write failing analytic, support, symmetry, and cast tests**

  Cover sphere-sphere, point-sphere, point-box, sphere-box, aligned and rotated box-box; separated/touching/penetrating/coincident cases; input-swap witness exchange and normal reversal; common rigid-transform invariance; ray tangent/start-overlap/non-normalized directions; shape-cast zero translation and earliest hit; deterministic support ties; seeded cases with printed seeds.

- [ ] **Step 2: Run the complete 3D collision directory and observe failure**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  ```

  Expected: FAIL because the collision modules and exports are absent.

- [ ] **Step 3: Implement analytic primitives and bounded 3D GJK/EPA**

  Route sphere pairs through analytic functions and convex fallback through allocation-controlled support maps. GJK returns stable witnesses; EPA expands the lowest-distance face with feature-identity ties and stops at the fixed cap. Failure returns a private diagnostic status, never an infinite loop or fabricated contact.

- [ ] **Step 4: Implement stable manifolds, pair projection, rays, and casts**

  Clip box faces to retain up to four stable points; sphere contacts retain one. Sort points by penetration and feature identity. Public projection freezes copied semantic values only. Ray and shape casts use analytic routes where available and conservative advancement elsewhere.

- [ ] **Step 5: Add a strict geometry-only packed consumer**

  Install only the physics tarball in an offline temporary package, import `/3d/geometry`, run sphere/box distance and ray tests, bundle an esbuild metafile, and assert no core/WebGL/world/scheduler/browser input enters the graph.

- [ ] **Step 6: Run Node and packed boundary evidence**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run test:package-consumer:packed
  ```

  Expected: PASS with deterministic bounded results and a renderer-free geometry bundle.

- [ ] **Step 7: Commit the pure sphere/box collision slice**

  ```bash
  git add packages/physics/src/lib/3d/collision packages/physics/src/3d-geometry.ts packages/physics/src/3d.ts tooling/verify-packed-consumer.mjs
  git commit -m "feat(physics): add pure 3d sphere and box collisions"
  ```

### Task 4: Build the pooled 3D sphere/box world kernel

**Files:**

- Create: `packages/physics/src/lib/3d/world/storage.ts`
- Create: `packages/physics/src/lib/3d/world/storage.test.ts`
- Create: `packages/physics/src/lib/3d/world/broad-phase.ts`
- Create: `packages/physics/src/lib/3d/world/broad-phase.test.ts`
- Create: `packages/physics/src/lib/3d/world/integrator.ts`
- Create: `packages/physics/src/lib/3d/world/integrator.test.ts`
- Create: `packages/physics/src/lib/3d/world/contact-cache.ts`
- Create: `packages/physics/src/lib/3d/world/contact-cache.test.ts`
- Create: `packages/physics/src/lib/3d/world/solver.ts`
- Create: `packages/physics/src/lib/3d/world/solver.test.ts`
- Create: `packages/physics/src/lib/3d/runtime/ownership.ts`

**Interfaces:**

- Consumes: immutable sphere/box records, private manifolds, numeric policy, and normalized body/collider definitions.
- Produces: generation-checked typed-array storage, deterministic dynamic AABB broad phase, quaternion/tensor integration, persistent contacts, islands, sequential impulses, friction/restitution, sensors, and automatic compound mass properties.

- [ ] **Step 1: Write failing generation, growth, and broad-phase tests**

  Allocate/remove/reuse body and collider slots; prove generation changes reject stale access; grow capacities without changing committed numeric values; assert tree parent/child/height/bounds invariants after every mutation; and assert public candidate pairs sort lexicographically despite different insertion orders.

- [ ] **Step 2: Run storage and broad-phase tests and observe missing modules**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/world/storage.test.ts packages/physics/src/lib/3d/world/broad-phase.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because the 3D stores and broad phase do not exist.

- [ ] **Step 3: Implement pooled stores and deterministic AABB tree**

  Store positions, quaternions, linear/angular velocity, force/torque, inverse mass, local inverse inertia tensors, damping, gravity scale, sleep time, locks, flags, and generations in dedicated typed arrays. Collider storage owns body identity, immutable shape record, local pose, material, filter, sensor/mass flags, tag/handlers, proxy, and generation. Reuse the 2D ownership style but keep 3D hot arrays independent.

- [ ] **Step 4: Write failing integration, mass, and solver tests**

  Prove semi-implicit gravity at `dt=0.1`, force clearing, center/off-center impulse, world-space torque, quaternion normalization, angular damping, axis locks, static/kinematic immunity, sphere-ground rest, two-box stack, rotating off-center box, restitution, friction, sensor no-impulse, compound center-of-mass/tensor, and exact repeatability from identical definitions.

- [ ] **Step 5: Implement tensor integration and deterministic constraints**

  Derive world inverse inertia as `R * I_local^-1 * R^T`, apply impulses at contact offsets, integrate quaternion derivatives, and canonicalize after normalization. Merge sorted pair candidates with the previous contact cache; build islands by ascending body identity; warm-start stable features; solve normal plus two deterministic tangent axes for exactly configured iterations; apply bounded positional correction.

- [ ] **Step 6: Run the vertical kernel suite**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/world/storage.test.ts packages/physics/src/lib/3d/world/broad-phase.test.ts packages/physics/src/lib/3d/world/integrator.test.ts packages/physics/src/lib/3d/world/contact-cache.test.ts packages/physics/src/lib/3d/world/solver.test.ts --browser.enabled=false --environment node
  ```

  Expected: PASS with no public event allocation for unobserved contacts and balanced store/proxy counters.

- [ ] **Step 7: Commit the pooled sphere/box kernel**

  ```bash
  git add packages/physics/src/lib/3d/world/storage.ts packages/physics/src/lib/3d/world/storage.test.ts packages/physics/src/lib/3d/world/broad-phase.ts packages/physics/src/lib/3d/world/broad-phase.test.ts packages/physics/src/lib/3d/world/integrator.ts packages/physics/src/lib/3d/world/integrator.test.ts packages/physics/src/lib/3d/world/contact-cache.ts packages/physics/src/lib/3d/world/contact-cache.test.ts packages/physics/src/lib/3d/world/solver.ts packages/physics/src/lib/3d/world/solver.test.ts packages/physics/src/lib/3d/runtime/ownership.ts
  git commit -m "feat(physics): solve deterministic 3d sphere and box contacts"
  ```

### Task 5: Add fixed ticks, sleeping, CCD, queries, and rollback

**Files:**

- Create: `packages/physics/src/lib/3d/world/ccd.ts`
- Create: `packages/physics/src/lib/3d/world/ccd.test.ts`
- Create: `packages/physics/src/lib/3d/world/queries.ts`
- Create: `packages/physics/src/lib/3d/world/queries.test.ts`
- Create: `packages/physics/src/lib/3d/world/world.ts`
- Create: `packages/physics/src/lib/3d/world/world.test.ts`
- Create: `packages/physics/src/lib/3d/runtime/trace.ts`
- Modify: `packages/physics/src/lib/3d/world/solver.ts`
- Modify: `packages/physics/src/lib/3d/world/solver.test.ts`

**Interfaces:**

- Consumes: Task 4 kernel pieces and normalized topology/command records.
- Produces: sleeping, bounded CCD, authoritative world queries, checkpointed candidates, arbitrary-cadence fixed ticks, clamp tracing, rollback, and position/quaternion presentation interpolation.

- [ ] **Step 1: Write failing sleep, CCD, and committed-query tests**

  Assert island sleep only after 0.5 simulated seconds below both thresholds; wake on force/impulse/teleport/topology/kinematic/awake contact; fire an opted-in sphere through a thin box; enforce the four-impact cap; and cover closest/any/all ray/shape casts, overlaps, AABBs, points, sensors, filters, exclusions, tags, compound de-duplication, and stable ties.

- [ ] **Step 2: Implement deterministic sleeping, bounded CCD, and queries**

  Track island sleep timers by fixed ticks, remove sleeping islands from integration, and wake complete connected islands in body order. Sweep supported convex dynamics against sorted candidates, then complete capped remainders discretely. Materialize only requested public query results from committed state and never request a frame from a query.

- [ ] **Step 3: Write failing arbitrary-cadence, interpolation, and rollback tests**

  Drive logical times causing zero, one, and three ticks; compare equivalent fixed-tick totals across frame groupings; assert exactly four steps and discarded elapsed after a long stall; assert position lerp and quaternion slerp at fractional remainder; inject failure after topology, broad phase, narrow phase, velocity solve, position solve, CCD, event staging, and staged output.

- [ ] **Step 4: Implement one checkpointed 3D world candidate**

  Follow the 2D `PhysicsWorld2DKernel` ownership pattern with separate 3D stores. Snapshot mutated ranges, free-list/tree/contact lengths, accumulator, tick, and event cursors. `advance()` produces an uncommitted candidate; `adopt()` seals once; `discard()` restores exact state in reverse journal order. New/resumed worlds anchor at current logical time and never catch up inactive time.

- [ ] **Step 5: Prove deterministic replay and bounded long-run finiteness**

  Run identical 10,000-tick sphere/box scenes twice and compare exact discrete identities plus numeric tolerances; run a 100,000-tick bounded container and assert every position, orientation, velocity, tensor, AABB, and accumulator remains finite and within declared scene bounds.

- [ ] **Step 6: Run the complete Node world suite**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/world --browser.enabled=false --environment node
  ```

  Expected: PASS with bounded iteration, exact discrete rollback, repeatable output, and no core/WebGL import in world kernel files.

- [ ] **Step 7: Commit the transactional world**

  ```bash
  git add packages/physics/src/lib/3d/world packages/physics/src/lib/3d/runtime/trace.ts
  git commit -m "feat(physics): add transactional fixed tick 3d world"
  ```

### Task 6: Mount worlds and expose bodies, commands, queries, and events

**Files:**

- Create: `packages/physics/src/lib/3d/runtime/context.ts`
- Create: `packages/physics/src/lib/3d/runtime/descriptors.ts`
- Create: `packages/physics/src/lib/3d/runtime/descriptors.test.tsx`
- Create: `packages/physics/src/lib/3d/runtime/controller.ts`
- Create: `packages/physics/src/lib/3d/runtime/controller.test.tsx`
- Create: `packages/physics/src/lib/3d/runtime/world-component.ts`
- Create: `packages/physics/src/lib/3d/runtime/world-component.test.tsx`
- Create: `packages/physics/src/lib/3d/runtime/body-handle.ts`
- Create: `packages/physics/src/lib/3d/runtime/body-handle.test.tsx`
- Create: `packages/physics/src/lib/3d/runtime/events.ts`
- Create: `packages/physics/src/lib/3d/runtime/events.test.tsx`
- Modify: `packages/physics/src/3d.ts`

**Interfaces:**

- Consumes: existing core simulation-owner/physics-lane friend seam, generic primitive attachment lifecycle, Task 5 world candidate, signals, and Complete admission.
- Produces: `PhysicsWorld3D`, descriptors, nearest world/body scopes, one awake-world registration, handles, commands, world queries, sensors, ordered events, and module augmentation for supported WebGL props.

- [ ] **Step 1: Write failing descriptor, scope, and attachment tests**

  Assert copied/frozen options, nominal recognition, stable mounted identity across recreated descriptors, a normalized `"self"` request that awaits Task 7 resolved-primitive inference, `collider: false`, Group3D body-only behavior, collider-only nearest-body requirement, missing/mismatched WebGL world diagnostics, same-dimension nesting rejection, and no acquisition after invalid mass/material/filter/velocity inputs.

- [ ] **Step 2: Run runtime tests and observe missing APIs**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/runtime --browser.headless --browser.ui=false
  ```

  Expected: FAIL because 3D descriptors, controller, world component, handles, and events do not exist.

- [ ] **Step 3: Implement transactional world/topology ownership**

  `PhysicsWorld3D` requires the current WebGL backend/island, owns one controller hook slot, pushes one exact world scope, and returns children. Attachments collect immutable topology candidates during successful traversal; render failure discards them; success queues stable remove-before-add Begin records. The controller reads staged kinematic signals, advances one candidate, stages observed signals, adopts only after shared Commit, requests one render, and delivers events in Complete.

- [ ] **Step 4: Implement partial kinematic targets exactly**

  Read each bound target independently from the shared staging batch. If only position is bound, retain prior accepted orientation; if only orientation is bound, retain prior accepted position. Across multiple fixed ticks interpolate from the previous accepted target toward the current staged target without resampling animation at sub-times.

- [ ] **Step 5: Implement generation-bound handles, commands, queries, and events**

  Lazily allocate readonly signal bundles, bind one live body per handle, snapshot command arrays at call time, and queue force/impulse/torque/velocity/teleport/wake/sleep/enable/disable in realm invocation order. Sort observed collision/overlap/sleep/wake delivery by tick, semantic ordinal, pair, and receiver identity; callbacks queue work for the next Begin.

- [ ] **Step 6: Run scheduler/runtime integration tests**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/runtime packages/core/src/lib/scheduler/simulation-participant.test.tsx packages/core/src/lib/animation/playback.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with animation before physics, one shared Commit, one registration per awake world, no per-body registration, sibling-world failure isolation, and exact teardown.

- [ ] **Step 7: Commit the 3D runtime surface**

  ```bash
  git add packages/physics/src/lib/3d/runtime packages/physics/src/3d.ts
  git commit -m "feat(physics): mount transactional 3d worlds"
  ```

### Task 7: Integrate Cube/Sphere/Group3D presentation and ship the browser slice

**Files:**

- Create: `packages/physics/src/lib/3d/webgl/inference.ts`
- Create: `packages/physics/src/lib/3d/webgl/inference.test.tsx`
- Create: `packages/physics/src/lib/3d/webgl/presentation.ts`
- Create: `packages/physics/src/lib/3d/webgl/presentation.test.tsx`
- Modify: `packages/physics/src/lib/3d/runtime/descriptors.ts`
- Create: `packages/scenarios/src/physics-3d.example.tsx`
- Create: `packages/scenarios/src/physics-3d.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/scenarios/package.json`
- Create: `packages/core/test/physics-3d-slice.test.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: Tasks 1 and 6 friend/runtime seams, exact authored lineage, Cube/Sphere geometry, world presentation poses, settled submissions, pick/focus transaction, and public scenario catalog.
- Produces: complete box/sphere inference and presentation, compound Group3D basics, and a public built-Studio `physics-3d` example that visibly simulates multiple bodies with no second loop.

- [ ] **Step 1: Write failing WebGL inference and presentation tests**

  Assert Cube dimensions include size and absolute scale; uniformly scaled Sphere infers sphere; Group3D hosts a body with untransformed child box/sphere colliders; body pose excludes scale; initial pixels do not jump; dynamic presentation uses authoritative parent/body capture; render, pick, and focus models match; context loss keeps CPU simulation advancing; camera-only changes leave physics unchanged; authored dynamic pose changes diagnose conflict. Nonuniform Sphere inference begins in Task 11 after Task 8 supplies ellipsoid geometry.

- [ ] **Step 2: Run focused browser tests and observe missing integration**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/webgl packages/core/test/physics-3d-slice.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because inference, presentation, and scenario are absent.

- [ ] **Step 3: Implement exact lineage inference and presentation scope**

  Capture the body host authored lineage and rigid seed pose once. Derive compound collider-local geometry by composing only the forward lineage suffix and explicit collider offset/orientation. Bake finite scale into shape geometry. During later traversal, compare authored pose/scale against the committed definition; enqueue scale rebuilds, diagnose dynamic pose writers, and push one presentation-only WebGL model scope whose release occurs in attachment `exit` after Group3D descendant scopes close.

- [ ] **Step 4: Build the first public scene**

  Register `physics-3d` with a fixed camera, explicit gravity, static floor, angled box obstacle, at least six dynamic cubes/spheres, varied friction/restitution, one compound Group3D body, and a ray query marker rendered from public data. Expose reset, drop, impulse, and query actions through handles; use no RAF, timer, manual step, or private import.

- [ ] **Step 5: Prove semantic browser behavior**

  Drive the same scenario module headlessly and assert falling, contact, bounce, angular response, frictional slowdown, compound alignment, query identity, bitmap/pick generation, one shared scheduler frame, and teardown. Add a screenshot only after semantic assertions and inspect expected/actual/diff before any baseline update.

- [ ] **Step 6: Build and start the Studio milestone**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run playground:build:built
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 -C playground run playground:built -- --host 127.0.0.1 --port 0
  ```

  Expected: a built Studio server on an available loopback port. Report its exact `http://127.0.0.1:<port>/` URL immediately and keep the server alive while continuing Tasks 8–15.

- [ ] **Step 7: Commit the first working browser slice**

  ```bash
  git add packages/physics/src/lib/3d/webgl packages/physics/src/lib/3d/runtime/descriptors.ts packages/scenarios/src/physics-3d.example.tsx packages/scenarios/src/physics-3d.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/scenarios/package.json packages/core/test/physics-3d-slice.test.ts docs/scenario-index.md
  git commit -m "feat(physics): ship 3d sphere and box browser slice"
  ```

### Task 8: Add ellipsoid, capsule, cylinder, cone, and convex hull geometry

**Files:**

- Modify: `packages/physics/src/lib/3d/shape-records.ts`
- Modify: `packages/physics/src/lib/3d/shapes.ts`
- Modify: `packages/physics/src/lib/3d/shapes.test.ts`
- Modify: `packages/physics/src/lib/3d/collision/support.ts`
- Modify: `packages/physics/src/lib/3d/collision/support.test.ts`
- Modify: `packages/physics/src/lib/3d/collision/pairs.ts`
- Modify: `packages/physics/src/lib/3d/collision/pairs.test.ts`
- Modify: `packages/physics/src/lib/3d/collision/casts.ts`
- Modify: `packages/physics/src/lib/3d/collision/casts.test.ts`
- Create: `packages/physics/src/lib/3d/hull.ts`
- Create: `packages/physics/src/lib/3d/hull.test.ts`
- Modify: `packages/physics/src/3d-geometry.ts`
- Modify: `packages/physics/src/3d.ts`

**Interfaces:**

- Consumes: Task 3 convex support/GJK/EPA/manifold kernel.
- Produces: immutable ellipsoid, capsule, cylinder, cone, and canonical convex-hull records with complete bounds, mass, containment, distance, overlap, contact, ray, shape-cast, and rigid-transform behavior.

- [ ] **Step 1: Write failing factory, hull, mass, and pair-matrix tests**

  Cover caller-array mutation, nonfinite/degenerate rejection, translated/oriented bounds, exact analytic volume/centroid/inertia for ellipsoid/capsule/cylinder/cone, hull canonicalization under permuted/duplicate input, coplanar rejection, every new family against sphere/box and itself, symmetry/invariance, tangent/penetration cases, seeded support directions, rays, and translational casts.

- [ ] **Step 2: Run pure 3D tests and observe unsupported shapes**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/hull.test.ts packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  ```

  Expected: FAIL because the five new factories/records/support mappings are absent.

- [ ] **Step 3: Implement analytic records and deterministic hull construction**

  Use local-Y cylinder/cone records, segment-axis capsule records, oriented ellipsoid records, and canonical hull vertices/faces. Compute hull faces with the fixed seed/visible-face/tie rules; compute volume, centroid, and full symmetric inertia tensor from outward tetrahedra; reject zero-volume hulls.

- [ ] **Step 4: Extend support maps and complete pure operations**

  Add analytic support for ellipsoid/capsule/cylinder/cone and vertex support for hull. Route all convex pairs through the bounded kernel, refine analytic containment/rays where stable, and preserve deterministic manifold/cast ordering.

- [ ] **Step 5: Run complete geometry tests and build**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/hull.test.ts packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 -C packages/physics run build
  ```

  Expected: PASS with no runtime/renderer imports in `/3d/geometry`.

- [ ] **Step 6: Commit the complete convex vocabulary**

  ```bash
  git add packages/physics/src/lib/3d/shape-records.ts packages/physics/src/lib/3d/shapes.ts packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/hull.ts packages/physics/src/lib/3d/hull.test.ts packages/physics/src/lib/3d/collision packages/physics/src/3d-geometry.ts packages/physics/src/3d.ts
  git commit -m "feat(physics): add complete convex 3d geometry"
  ```

### Task 9: Add static triangle meshes and heightfields

**Files:**

- Modify: `packages/physics/src/lib/3d/shape-records.ts`
- Modify: `packages/physics/src/lib/3d/shapes.ts`
- Modify: `packages/physics/src/lib/3d/shapes.test.ts`
- Create: `packages/physics/src/lib/3d/mesh-bvh.ts`
- Create: `packages/physics/src/lib/3d/mesh-bvh.test.ts`
- Modify: `packages/physics/src/lib/3d/collision/pairs.ts`
- Modify: `packages/physics/src/lib/3d/collision/pairs.test.ts`
- Modify: `packages/physics/src/lib/3d/collision/casts.ts`
- Modify: `packages/physics/src/lib/3d/collision/casts.test.ts`
- Modify: `packages/physics/src/3d-geometry.ts`
- Modify: `packages/physics/src/3d.ts`

**Interfaces:**

- Consumes: immutable copied mesh input, Task 8 convex operations, triangle support, and stable AABB math.
- Produces: `triangleMeshShape3D`, `heightfieldShape3D`, deterministic immutable BVHs/cell triangles, mesh mass policy, complete pure queries, and stable triangle hit metadata.

- [ ] **Step 1: Write failing mesh/heightfield and BVH tests**

  Cover indexed/nonindexed copying, invalid indices, empty/degenerate triangles, closed tetrahedron volume/tensor, open surface zero mass, height dimensions/defaults/sample ordering, fixed diagonal triangles, bounds, contains/distance/contact for representative closed meshes, convex-vs-mesh pairs, mesh-vs-mesh overlap, ray barycentrics, equal-distance triangle ties, and BVH invariants under permuted source triangles.

- [ ] **Step 2: Run mesh-focused Node tests and observe failure**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/mesh-bvh.test.ts packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  ```

  Expected: FAIL because mesh and heightfield records/acceleration are absent.

- [ ] **Step 3: Build canonical triangle records and immutable BVHs**

  Copy positions/indices, preserve stable source triangle identity, reject nonfinite/out-of-range data, omit zero-area triangles from collision while retaining deterministic diagnostics, and build the fixed longest-axis/lower-median BVH. Heightfields synthesize stable cell triangles without retaining caller arrays.

- [ ] **Step 4: Implement mesh mass and the complete pure pair/cast matrix**

  Compute signed tetrahedral volume/centroid/tensor only for a consistently wound closed two-manifold; otherwise return zero mass properties. Traverse BVHs with lower-bound distance ordering and stable ties. Test convex leaves against triangles through the existing support kernel; implement triangle-triangle overlap/distance for mesh pairs; return closest stable triangle index and barycentrics for ray/shape hits.

- [ ] **Step 5: Run geometry, acceleration, and package tests**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/hull.test.ts packages/physics/src/lib/3d/mesh-bvh.test.ts packages/physics/src/lib/3d/collision --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run test:package-consumer:packed
  ```

  Expected: PASS with bounded BVH traversal and no renderer dependency.

- [ ] **Step 6: Commit mesh and heightfield geometry**

  ```bash
  git add packages/physics/src/lib/3d/shape-records.ts packages/physics/src/lib/3d/shapes.ts packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/mesh-bvh.ts packages/physics/src/lib/3d/mesh-bvh.test.ts packages/physics/src/lib/3d/collision packages/physics/src/3d-geometry.ts packages/physics/src/3d.ts
  git commit -m "feat(physics): add 3d meshes and heightfields"
  ```

### Task 10: Expand the world solver and add every physics shape renderer

**Files:**

- Modify: `packages/physics/src/lib/3d/world/contact-cache.ts`
- Modify: `packages/physics/src/lib/3d/world/solver.ts`
- Modify: `packages/physics/src/lib/3d/world/solver.test.ts`
- Modify: `packages/physics/src/lib/3d/world/ccd.ts`
- Modify: `packages/physics/src/lib/3d/world/ccd.test.ts`
- Modify: `packages/physics/src/lib/3d/world/queries.ts`
- Modify: `packages/physics/src/lib/3d/world/queries.test.ts`
- Create: `packages/physics/src/lib/3d/webgl/components.ts`
- Create: `packages/physics/src/lib/3d/webgl/components.test.tsx`
- Modify: `packages/physics/src/3d.ts`

**Interfaces:**

- Consumes: complete pure shape matrix, static acceleration structures, world pools, and public `Mesh`/`createWebGLGeometry`.
- Produces: solver/query/CCD support for every shape, static concave colliders, and `PhysicsShape3D`, `Box3D`, `Ellipsoid3D`, `Capsule3D`, `Cylinder3D`, `Cone3D`, `ConvexHull3D`, and `Heightfield3D` settled-scene components.

- [ ] **Step 1: Write failing world shape-matrix tests**

  Simulate each convex family falling/rolling/resting on box, triangle-mesh, and heightfield surfaces; test convex-convex stacks, compound mixed shapes, sensors, filters, friction/restitution, sleeping, CCD against thin mesh triangles, ray/shape/overlap/AABB/point queries, triangle metadata, and explicit rejection of dynamic/kinematic triangle mesh or heightfield shapes.

- [ ] **Step 2: Extend contact, solver, CCD, and query kernels**

  Dispatch through private shape-record capabilities, expand concave candidates through sorted BVH triangles, retain stable triangle/feature IDs for warm starts, exclude static-static pairs, and preserve one bounded CCD/query traversal. Automatic dynamic mass requires positive finite convex/compound volume; zero-volume/sensor-only/moving-concave bodies fail before topology adoption.

- [ ] **Step 3: Write failing renderer geometry and settled-scene tests**

  Mount every physics renderer, compare generated vertices/bounds to its shape, assert deterministic tessellation counts, one CPU composition submission, no GL call before settlement, geometry cache reuse by shape identity, correct paint/pick/focus transforms, and exact disposal/context-restoration behavior.

- [ ] **Step 4: Implement CRC-owned deterministic render geometry**

  Cache immutable `CRCWebGLGeometry` per physics shape identity. Use fixed longitude/latitude or radial segment counts declared in the test for curved visuals, exact hull/mesh triangles, and heightfield triangles. Ordinary components return public `Mesh` and forward `physics`, events, focus, color, opacity, cursor, and transforms; no raw GL/internal source import enters public application code.

- [ ] **Step 5: Run Node and browser shape matrices**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/world --browser.enabled=false --environment node
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/webgl/components.test.tsx packages/webgl/src/lib/scene --browser.headless --browser.ui=false
  ```

  Expected: PASS for every public shape with no composition-time GL work.

- [ ] **Step 6: Commit solver and rendering expansion**

  ```bash
  git add packages/physics/src/lib/3d/world packages/physics/src/lib/3d/webgl/components.ts packages/physics/src/lib/3d/webgl/components.test.tsx packages/physics/src/3d.ts
  git commit -m "feat(physics): complete 3d shape solving and rendering"
  ```

### Task 11: Complete inference, compound lineage, scale rebuilds, and pose authority

**Files:**

- Modify: `packages/physics/src/lib/3d/webgl/inference.ts`
- Modify: `packages/physics/src/lib/3d/webgl/inference.test.tsx`
- Modify: `packages/physics/src/lib/3d/webgl/presentation.ts`
- Modify: `packages/physics/src/lib/3d/webgl/presentation.test.tsx`
- Modify: `packages/physics/src/lib/3d/runtime/descriptors.ts`
- Modify: `packages/physics/src/lib/3d/runtime/descriptors.test.tsx`
- Modify: `packages/physics/src/lib/3d/runtime/controller.ts`
- Modify: `packages/physics/src/lib/3d/runtime/controller.test.tsx`
- Modify: `packages/physics/src/lib/3d/world/world.ts`
- Modify: `packages/physics/src/lib/3d/world/world.test.ts`

**Interfaces:**

- Consumes: complete WebGL primitive facts, copied Mesh geometry, exact lineage nodes, all public shapes, topology transactions, and partial kinematic bindings.
- Produces: the complete Cube/Sphere/Mesh/Group3D inference contract, forward-only compound geometry, deterministic scale/mass rebuild, exclusive dynamic/kinematic/disabled pose ownership, and actionable diagnostics.

- [ ] **Step 1: Write the complete failing inference/diagnostic matrix**

  Assert Cube box dimensions under positive/negative scale; uniform/nonuniform Sphere inference; static Mesh exact triangle mesh; dynamic/kinematic Mesh canonical hull; Group3D no self collider; explicit shapes override inference; moving explicit concave rejection; body/collider outside world; dimension mismatch; invalid auto mass; duplicate handle; dynamic authored pose conflict; nonfinite and sheared moving lineage diagnostics.

- [ ] **Step 2: Write exact compound-lineage and churn regression tests**

  Create nested translated/rotated/scaled Group3D compounds with tiny and very large coordinates. Re-render identical values 10,000 times and assert exact collider topology IDs, mass/tensor, contact pair identities, and ownership counts remain unchanged. Change one descendant local transform and assert only its collider plus aggregate automatic mass rebuild once in stable order.

- [ ] **Step 3: Implement forward lineage suffix composition**

  Store the body-host lineage depth and exact local transform record. For each descendant collider, compose the authored nodes after that depth plus the collider host transform and explicit offset/orientation into body-local geometry. Bake scale/mirroring directly into copied shape vertices or analytic parameters. Never compute this relation from inverse world matrices.

- [ ] **Step 4: Implement complete pose authority and scale updates**

  Compare dynamic authored translation/orientation against its accepted seed and reject changes while enabled. Allow static updates as topology changes. Read independent kinematic partial targets without resetting unbound fields. Disabled bodies stop physics presentation and accept authored transforms; re-enable seeds current authored pose and applies zero/preserve velocity policy. Scale changes rebuild collider geometry and automatic mass/tensor at Begin without altering body pose.

- [ ] **Step 5: Run runtime/WebGL regression suites**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/runtime packages/physics/src/lib/3d/webgl packages/physics/src/lib/3d/world/world.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with stable topology under unchanged renders and actionable diagnostics for every unsupported case.

- [ ] **Step 6: Commit inference and pose ownership**

  ```bash
  git add packages/physics/src/lib/3d/webgl packages/physics/src/lib/3d/runtime packages/physics/src/lib/3d/world/world.ts packages/physics/src/lib/3d/world/world.test.ts
  git commit -m "feat(physics): complete 3d inference and pose authority"
  ```

### Task 12: Finish the public `physics-3d` example and deterministic laboratory

**Files:**

- Modify: `packages/scenarios/src/physics-3d.example.tsx`
- Modify: `packages/scenarios/src/physics-3d.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/physics-3d-lab.test.ts`
- Create: `packages/core/test/physics-3d-replay.test.ts`
- Create: `packages/core/test/physics-3d-cycles.test.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: only public `@crc/core`, `@crc/webgl`, and `@crc/physics/3d` APIs.
- Produces: the completed public Studio example, reusable deterministic control/snapshot module, ray-based interaction, and headless evidence for replay, long-run simulation, and repeated handoff/teardown cycles.

- [ ] **Step 1: Write failing public scenario and replay tests**

  Drive reset, settle, ray query, grab, drag, throw, impulse, teleport, disable, authored move, re-enable, sleep, wake, and disposal through public handles/events. Assert exact semantic event/query ordering, authoritative poses/velocities, presentation offset bound, compound geometry alignment, one scheduler frame, and identical snapshots for identical inputs.

- [ ] **Step 2: Complete the visible scene with every required behavior**

  Keep multiple dynamic objects, floor, angled and offset obstacles, high/low restitution bodies, high/low friction bodies, visible rolling/quaternion rotation, a compound body with child sensor, convex/mesh/heightfield examples, and a ray marker. Use WebGL pointer coordinates/picking only to form a public world-space ray; use physics raycast/commands for grab and throw. If the existing camera seam cannot construct a public ray without private imports, retain click-selected impulse/throw controls and document the deterministic ray-query demonstration instead of adding a new camera API.

- [ ] **Step 3: Implement deterministic grab/throw ownership**

  On grab, snapshot the selected dynamic body's presentation pose, disable it, bind authored target values to pointer/ray intersection, and render it without physics competition. On release, re-enable at the authored pose and apply a velocity/impulse derived from a bounded fixed sample history owned by the scenario—not a timer or second loop. Every state transition enters through public commands and CRC events.

- [ ] **Step 4: Add long-run and repeated lifecycle cycles**

  Run two identical public action tapes and compare stable identities/discrete state plus numeric tolerance; retain Task 5's 100,000-tick Node kernel evidence as the long-run gate; repeat enable → teleport → throw → disable → removal/remount 1,000 times through ordinary scheduled frames; assert finite bounded state, no stale callback/command, increasing generations, and all counters/resources back to baseline after final disposal.

- [ ] **Step 5: Run public browser and scenario catalog evidence**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-3d-slice.test.ts packages/core/test/physics-3d-lab.test.ts packages/core/test/physics-3d-replay.test.ts packages/core/test/physics-3d-cycles.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 scenarios:check
  ```

  Expected: PASS using the same scenario module displayed by Studio, with no manual step or additional frame loop.

- [ ] **Step 6: Commit the complete public example and laboratory**

  ```bash
  git add packages/scenarios/src/physics-3d.example.tsx packages/scenarios/src/physics-3d.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/core/test/physics-3d-lab.test.ts packages/core/test/physics-3d-replay.test.ts packages/core/test/physics-3d-cycles.test.ts docs/scenario-index.md
  git commit -m "test(physics): complete public 3d physics laboratory"
  ```

### Task 13: Lock declarations, tree shaking, packed consumers, and Studio types

**Files:**

- Modify: `packages/physics/package.json`
- Modify: `packages/physics/tsconfig.build.json`
- Modify: `packages/physics/README.md`
- Modify: `packages/webgl/package.json`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/package-consumer/tsconfig.bundler.json`
- Modify: `playground/package-consumer/tsconfig.nodenext.json`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `tooling/studio-docs/api-exports.ts`
- Modify: `tooling/studio-docs/api-exports.check.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: built core/WebGL/physics packages and the exact public surface from Tasks 1–12.
- Produces: Bundler, NodeNext, packed, runtime, declaration-merging, optional-peer, side-effect, editor, source-Studio, built-Studio, and tree-shaking proof.

- [ ] **Step 1: Add failing source and built consumer assertions**

  Import every 3D runtime value/type from `/3d`, every pure name from `/3d/geometry`, author JSX and `createElement` with Cube/Sphere/Mesh/Group3D physics props, and prove attachments remain absent before importing the matching dimension. Add type errors for 2D attachments on WebGL hosts, 3D attachments on Canvas hosts, lookalikes, moving triangle meshes, and unsupported root imports.

- [ ] **Step 2: Extend strict packed consumers**

  Pack physics and WebGL beside core/types. Run offline consumers for physics-alone geometry, core+WebGL+physics world use, Bundler, and NodeNext. Assert tarballs contain declarations/maps but no source, geometry-only installs no peers, world-facing peers are optional at manifest level but required by import, one core/WebGL identity is used, and root package surfaces do not leak internal names.

- [ ] **Step 3: Add explicit tree-shaking metafile checks**

  Bundle `sphereShape3D` from `/geometry` and reject world/runtime/WebGL/2D inputs. Bundle `dynamicBody3D` from `/3d` and reject 2D/joints/debug/replay. Bundle the public Studio scene and assert no external engine, WASM, worker, timer, RAF, or duplicate core/WebGL implementation.

- [ ] **Step 4: Update Studio declarations and export inventory**

  Add exact subpath declarations, augmentation, shape/component/handle/query/event types, and editor examples. Keep `@crc/webgl/internal` absent from public editor declarations and API inventories while its packed official entry remains buildable.

- [ ] **Step 5: Run package/type/Studio gates**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run typecheck
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run build
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run test:package-consumer
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run test:package-consumer:packed
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run playground:build
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 run playground:build:built
  ```

  Expected: PASS in geometry-only, source, packed, Bundler, NodeNext, Studio source, and Studio built modes.

- [ ] **Step 6: Commit package and consumer boundaries**

  ```bash
  git add packages/physics/package.json packages/physics/tsconfig.build.json packages/physics/README.md packages/webgl/package.json playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json tooling/verify-packed-consumer.mjs playground/src/crc-editor-types.txt tooling/verify-studio-types.mjs tooling/studio-docs/api-exports.ts tooling/studio-docs/api-exports.check.ts package.json pnpm-lock.yaml
  git commit -m "test(physics): verify public 3d package consumers"
  ```

### Task 14: Lock ownership, performance, contracts, and public documentation

**Files:**

- Create: `packages/core/test/physics-3d-ownership.test.ts`
- Create: `packages/core/test/physics-3d-performance.test.ts`
- Modify: `packages/physics/src/lib/3d/runtime/ownership.ts`
- Modify: `packages/physics/src/lib/3d/runtime/controller.ts`
- Modify: `packages/physics/src/lib/3d/world/storage.ts`
- Modify: `packages/physics/src/lib/3d/world/broad-phase.ts`
- Modify: `packages/physics/src/lib/3d/world/solver.ts`
- Create: `docs/site/api/components/physics-world-3d.md`
- Create: `docs/site/api/components/physics-shape-3d.md`
- Create: `docs/site/api/functions/physics-3d.md`
- Create: `docs/site/api/hooks/crc-physics-body-3d.md`
- Create: `docs/site/api/hooks/crc-physics-world-3d.md`
- Create: `docs/site/api/types/physics-3d.md`
- Create: `docs/site/learn/guides/physics-3d.md`
- Create: `docs/testing/field-notes/2026-09-15-first-class-physics-3d.md`
- Modify: `docs/design/signals-and-scheduling-contract.md`
- Modify: `docs/design/animation-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/layout-system-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/user-events-contract.md`
- Modify: `docs/design/focus-and-keyboard-navigation-contract.md`
- Modify: `docs/design/mouse-interaction-contract.md`
- Modify: `docs/design/event-resource-ownership.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `packages/webgl/README.md`
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`
- Modify: `tooling/verify-docs.mjs`
- Modify: `tooling/docs-contract-preservation-baseline.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: verified behavior and exact public names from Tasks 1–13.
- Produces: exact ownership/performance counters, current normative contracts, complete public Learn/API/package docs, and dated field evidence.

- [ ] **Step 1: Write failing ownership and structural-work tests**

  Mount/update/key-replace/reparent/remove/dispose worlds, bodies, compound colliders, sensors, handles, observed signals, queued commands, candidates, events, shapes, BVHs, render-geometry caches, and presentation scopes. Inject failures at every acquisition/adoption boundary. Warm 1,000 dynamic convex bodies and 10,000 static mesh/heightfield triangles; assert one world registration, zero per-body registrations, moved-proxy proportionality, candidate-pair proportionality, sleeping exclusion, stable pool/cache capacities, zero unobserved event records, and one WebGL/root render per committed presentation generation.

- [ ] **Step 2: Close lifecycle paths and add source-only counters**

  Balance acquire/release in `finally`; cancel owner-scoped commands/completions; release stale handles/signals/events; discard candidate journals; reference-count shape/BVH/render-geometry caches; and count tree nodes, pairs, narrow-phase leaves, manifolds, constraint rows, islands, CCD casts, ticks, presentation poses, public records, and pool growth without allowing counters to choose behavior.

- [ ] **Step 3: Add failing documentation/export checks**

  Require one API location for every new value/type, links from package/root docs and the physics guide, `/3d/geometry` imports for pure examples, `/3d` imports for worlds, no root namespace, no `world.step()`, no additional loop, and a documented distinction between renderer picking and authoritative physics queries.

- [ ] **Step 4: Update normative contracts and public docs from verified code**

  Record animation-before-physics lanes, one awake-world participant, fixed ticks/clamp/slerp, candidate adoption, exact transform lineage, dynamic/kinematic/disabled authority, scale rebuilds, settled-scene presentation/pick/focus alignment, inference matrix, moving-concave diagnostics, commands/queries/events, context-loss continuation, deterministic limits, and exact ownership. Teach the public example and standalone Node geometry without claiming unimplemented joints/debug/replay/2.5D behavior.

- [ ] **Step 5: Run ownership, performance, docs, and formatting gates**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-3d-ownership.test.ts packages/core/test/physics-3d-performance.test.ts --browser.headless --browser.ui=false
  node tooling/verify-docs.mjs
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 docs:check
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 studio-docs:check
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 lint:format
  ```

  Expected: PASS with every ownership count at baseline and every public export documented.

- [ ] **Step 6: Commit ownership, contracts, and documentation**

  ```bash
  git add packages/core/test/physics-3d-ownership.test.ts packages/core/test/physics-3d-performance.test.ts packages/physics/src/lib/3d docs/site docs/testing/field-notes/2026-09-15-first-class-physics-3d.md docs/design README.md packages/core/README.md packages/webgl/README.md docs/library-status.md AGENTS.md tooling/verify-docs.mjs tooling/docs-contract-preservation-baseline.json package.json
  git commit -m "docs(physics): document first class 3d physics"
  ```

### Task 15: Run final review and repository trust gates

**Files:**

- Modify only when evidence reveals a defect: files already named by Tasks 1–14
- Modify: `docs/testing/field-notes/2026-09-15-first-class-physics-3d.md`

**Interfaces:**

- Consumes: complete implementation, reviewer ledger, and repository trust contract.
- Produces: fresh Node/browser/built/package/lifecycle/trust evidence, final independent reviewer approval, identified implementation commits, and a clean branch.

- [ ] **Step 1: Run the pure Node geometry and solver suites**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/shapes.test.ts packages/physics/src/lib/3d/hull.test.ts packages/physics/src/lib/3d/mesh-bvh.test.ts packages/physics/src/lib/3d/collision packages/physics/src/lib/3d/world --browser.enabled=false --environment node
  ```

  Expected: PASS for pure geometry, deterministic replay, long-running finiteness, broad/narrow phase, integration, impulses, sleeping, sensors, filters, CCD, queries, rollback, and repeated lifecycle cycles.

- [ ] **Step 2: Run focused source browser integration**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/3d/runtime packages/physics/src/lib/3d/webgl packages/core/test/physics-3d-slice.test.ts packages/core/test/physics-3d-lab.test.ts packages/core/test/physics-3d-replay.test.ts packages/core/test/physics-3d-cycles.test.ts packages/core/test/physics-3d-ownership.test.ts packages/core/test/physics-3d-performance.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with one shared scheduler, settled rendering/picking alignment, source-mode exports, context-loss behavior, and balanced ownership.

- [ ] **Step 3: Run static, package, and built-browser gates**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust:static
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust:package
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 test:smoke:built
  ```

  Expected: PASS for TypeScript declarations/module augmentation, tree shaking, packed consumers, source/built Studio, and built browser smoke.

- [ ] **Step 4: Run browser, lifecycle, and aggregate gates**

  ```bash
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust:browser
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust:lifecycle
  fnm exec --using=24.15.0 corepack pnpm@11.21.0 trust
  ```

  Expected: exit code 0. Inspect expected/actual/diff visual artifacts even when the runner passes; never rewrite a baseline without a documented intentional reason.

- [ ] **Step 5: Prove forbidden dependencies and loops are absent**

  Search package manifests, lockfile changes, built metafiles, and source for external physics engines, WASM/native downloads, workers, timers, new `requestAnimationFrame`, manual step APIs, root `@crc/physics`, and bundled duplicate core/WebGL identities. Record exact zero-result commands and any benign existing matches in the field note.

- [ ] **Step 6: Dispatch the final whole-branch reviewer and resolve findings once**

  Give the reviewer the plan, spec, SDD ledger, complete merge-base-to-HEAD review package, deferred minors/rulings, and fresh test evidence. Require explicit spec-compliance and code-quality verdicts. If findings exist, send the complete list to one fixer, run one scoped re-review, and record any residual ruling exactly as required by the SDD skill.

- [ ] **Step 7: Record evidence, commit, and prove a clean worktree**

  ```bash
  git add docs/testing/field-notes/2026-09-15-first-class-physics-3d.md
  git commit -m "docs(testing): record 3d physics trust evidence"
  git status --short --branch
  git log --oneline codex/first-class-physics-2d..HEAD
  ```

  Expected: clean `codex/first-class-physics-3d` worktree with every reviewed implementation commit listed.

## Completion Criteria

This plan is complete only when:

- `@crc/physics/3d/geometry` executes in plain Node with no core, WebGL, DOM, Canvas, scheduler, or browser dependency and exposes every approved shape and pure operation.
- `@crc/physics/3d` exposes only named tree-shakable world, body/collider, handle/command, query/event, shape-renderer, and geometry exports; no root barrel or namespace API exists.
- Cube, Sphere, Mesh, and Group3D inference follows the exact approved matrix, every public physics shape renders through CRC-owned settled WebGL geometry, and moving concave geometry fails with an actionable diagnostic.
- One realm frame always samples animation before bounded deterministic physics ticks, commits once, plans/renders once, and uses no second loop.
- Authoritative fixed-tick state and interpolated presentation are separate; paint, picking, and focus share one presented generation while queries/events remain authoritative.
- Dynamic, kinematic, static, and disabled pose authority is exclusive; partial kinematic bindings retain unbound fields; scale changes rebuild geometry/mass without entering pose.
- Compound colliders use exact forward CRC-owned local transform lineage and unchanged renders cause zero collider topology, mass, or contact churn.
- Broad phase, narrow phase, tensor integration, impulses, friction, restitution, sleeping, sensors, filters, forces, commands, queries, ordered events, and optional CCD pass deterministic isolated tests.
- Identical inputs replay identically within documented tolerances; long-running simulation stays finite/bounded; repeated enable/teleport/throw/disable/teardown cycles leave no stale work or owned resources.
- The public `physics-3d` Studio example visibly demonstrates multiple dynamics, obstacles, bounce, roll, rotation, friction, restitution, compound geometry, and a ray/query result, with grabbing/throwing when the public picking seam supports it cleanly.
- Source and built browser tests, declarations/module augmentation, Bundler/NodeNext/packed consumers, tree shaking, lifecycle/performance checks, and aggregate trust gates pass freshly on Node 24.15.0, pnpm 11.21.0, and Playwright Chromium.
- A fresh final reviewer approves spec compliance and code quality, all implementation commits are identified, and the isolated worktree is clean.
