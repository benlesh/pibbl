# First-Class Physics Foundation and Baseline 2D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Historical status: READY IMPLEMENTATION PLAN.** This plan implements Projects 1 and 2 of the approved physics design as one reviewable vertical delivery. Three-dimensional rigid bodies, extended 3D shapes and terrain, joints and motors, diagnostics/replay, and possible 2.5D conversion require separate approved plans.

**Goal:** Ship a wholly CRC-owned `@crc/physics/2d` rigid-body system and renderer-independent `@crc/physics/2d/geometry` toolkit that share CRC's one realm scheduler, fixed-tick determinism, component ownership, signals, Canvas transforms, events, and teardown guarantees.

**Architecture:** Pure immutable shape modules and standalone collision operations have no CRC runtime dependency. The world-facing 2D entry uses one component-owned world controller, compact pooled body/collider state, a dynamic AABB broad phase, deterministic convex narrow phase, sequential impulses, sleeping, and bounded CCD. Core gains a closed official attachment protocol plus ordered animation/physics Advance lanes; successful traversal proposes topology, Begin applies it, Advance produces a candidate simulation generation, Commit atomically publishes and adopts it, and Render consumes one interpolated presentation transform per body.

**Tech Stack:** TypeScript 7, CRC JSX/createElement runtime, CRC signals and realm scheduler, HTML Canvas 2D, Vitest Browser with Playwright Chromium, Vitest Node for renderer-free geometry, esbuild, pnpm 11.21.0, Node 24.15 or newer.

**Spec:** `docs/superpowers/specs/2026-09-14-first-class-physics-design.md`

**Scope rationale:** Scheduler infrastructure and an unconnected package skeleton do not meet CRC's public-scenario evidence bar. Projects 1 and 2 therefore travel in one plan but retain separate review gates: Tasks 1–6 establish the foundation and pure geometry; Tasks 7–18 complete the baseline 2D vertical slice. No 3D implementation enters this plan.

**Prerequisites:** The current signal/scheduler, animation, JSX authoring, style/layout, standard Canvas shape, filter, event/focus, Layer, and settled WebGL contracts must remain green. Read `AGENTS.md`, this plan, the spec, and every contract named under Global Constraints before beginning Task 1.

## Global Constraints

- Preserve unrelated working-tree changes and untracked files. Stage only files named by the active task.
- Add a failing test before each production behavior change, run it once to observe the expected failure, implement the smallest passing behavior, rerun the focused test, and commit that task independently.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.
- CRC owns every physics algorithm and runtime byte. Add no engine, native binary, WebAssembly download, worker, timer, second `requestAnimationFrame`, or transitive runtime dependency.
- `@crc/physics/2d/geometry` must execute without loading `@crc/core`, a DOM, Canvas, WebGL, or a scheduler. Its declarations must not reference CRC runtime types.
- `@crc/physics/2d` may import only public `@crc/core` and the version-coupled `@crc/core/internal` friend entry. Applications must never import physics source or `lib/*` paths.
- Keep runtime APIs as named ESM exports. Do not add `physics.*`, a mutable singleton, an import-time registry, a second JSX runtime, or side effects on module import.
- Keep shapes and public results nominal, copied, deeply immutable with respect to numeric data, and detached from caller-owned arrays. Tags, callbacks, signals, and handles retain application identity and are not deep-frozen.
- Treat positive X as right, positive Y as down, rigid-body rotation as clockwise degrees, velocity as logical units per second, acceleration as logical units per second squared, and fixed-step duration as milliseconds.
- Existing `Arc` and `Wedge` contour angles remain explicitly named radians; rigid-body pose and angular velocity remain explicitly named degrees.
- One mounted awake `PhysicsWorld2D` owns one physics Advance registration. Bodies, colliders, contacts, queries, and handles own zero scheduler registrations.
- Animation Advance always precedes physics Advance. Both use the same frame snapshot and signal staging batch; Commit occurs once before Plan and Render.
- Use logical frame time only. The default fixed step is `1000 / 60` milliseconds, default `maxCatchUpSteps` is `4`, and excess elapsed time is discarded and traced.
- Dynamic bodies own pose while enabled. Static authored pose and kinematic authored/signal target pose remain application-owned. Diagnose competing dynamic authored pose changes rather than treating them as teleports.
- Component traversal never mutates committed simulation topology. Successful render transactions enqueue immutable next-Begin topology commands; failed traversal discards candidates and acquisitions.
- A failed world Advance discards only that world's candidate and staged writes. It must not suppress another world, animation, root, or Complete callback.
- Rendering and ordinary CRC pointer targeting use the same interpolated presentation pose. Handles, contacts, events, and physics queries use latest authoritative fixed-tick state.
- Keep Canvas root-logical coordinates independent of CSS size, backing pixels, pixel ratio, filters, Layer raster density, and camera concepts.
- Preserve component identity, source paint order, Group transform semantics, Clip/Layer/filter behavior, layout placement, event propagation, focus geometry, and exact teardown ownership.
- A body and collider stay separate internally but one body attachment infers one self collider by default. `collider2D()` is only the explicit compound/sensor path.
- Every current inspectable Canvas shape receives deterministic inference: `Rectangle`, `Circle`, `Ellipse`, `Arc`, `Wedge`, `Polygon`, `RegularPolygon`, `Star`, `Line`, `HorizontalLine`, `VerticalLine`, and eligible `SvgPath`.
- Opaque `Path2D`, glyph outlines, decoded image alpha, and browser-specific raster facts never determine collision. `Path`, `Text`, and `Image` require the explicit shape or declared stable box described by the spec.
- Sensors use `sensor: true`; they produce overlap events and queries but no contact constraint. Do not add a `sensor2D` factory.
- The first solver supports dynamic circle, ellipse, box/rounded-box, capsule, convex polygon, and deterministic convex compounds; segment/chain and inferred static contours are supported as zero-area static/kinematic collision geometry.
- Concave and curved inferred contours use CRC-owned fixed-tolerance flattening and stable triangulation. Never depend on Canvas pixel output or browser `Path2D` inspection.
- Use deterministic numeric arrays/pools in hot loops. No per-contact, per-constraint-iteration, or per-body-frame object, array, closure, signal, component, or element allocation is permitted after capacity warm-up.
- Sort externally visible query hits and events explicitly. Never expose Map/Set, tree traversal, hash, manifold-cache, or solver-island iteration order.
- Public standalone operations return immutable semantic records. Raw GJK/EPA/SAT state, feature IDs, broad-phase nodes, cached impulses, scratch objects, integrators, and constraint rows remain private.
- Initial shape casts sweep translation at fixed orientation. Initial CCD is body opt-in, bounded to supported convex dynamic bodies, and does not imply continuous sensor events.
- Do not add public `world.step()`, `run()`, manual clock mutation, contact modification callbacks, arbitrary solver-loop callbacks, snapshots, rollback, joints, or debug renderers in this plan.
- Read and update the exact contracts before final documentation: `docs/design/signals-and-scheduling-contract.md`, `animation-contract.md`, `runtime-hooks-contract.md`, `drawing-components-contract.md`, `style-system-contract.md`, `layout-system-contract.md`, `canvas-surface-contract.md`, `user-events-contract.md`, `focus-and-keyboard-navigation-contract.md`, `mouse-interaction-contract.md`, `event-resource-ownership.md`, and `runtime-resource-ownership.md`.
- Public behavior requires one presentation-neutral scenario imported by both Studio and headless tests. Assert semantic state and geometry before visual pixels; inspect expected, actual, and diff before updating any intentional baseline.

## File and Responsibility Map

### Core official-package seam

- Modify `packages/core/src/lib/scheduler/types.ts`: add closed ordered Advance lanes, owner-safe friend batch types, and physics trace-record variants without making physics public from core.
- Modify `packages/core/src/lib/scheduler/realm-scheduler.ts`: capture and run animation then physics registrations in stable registration order; retain one host frame, per-writer failure isolation, Commit acknowledgement, and Complete aggregation.
- Modify `packages/core/src/lib/animation/playback.ts`: register every existing playback explicitly in the animation Advance lane without changing playback sampling or ownership.
- Modify `packages/core/src/lib/animation/playback.test.ts`: preserve playback behavior and prove the explicit animation lane remains ahead of physics.
- Create `packages/core/src/lib/scheduler/simulation-participant.ts`: component-owned official simulation owner, Begin admission, physics-lane registration, Commit acknowledgement, Complete delivery, render invalidation, and exact cancellation.
- Create `packages/core/src/lib/scheduler/simulation-participant.test.tsx`: lane ordering, staged animation reads, failure isolation, owner replacement, cancellation, and counter evidence.
- Modify `packages/core/src/internal.ts`: export only the version-coupled simulation and attachment seams and types.
- Modify `packages/core/src/lib/element-enhancers.ts`: support registered official prop attachments plus resolved-primitive preparation while preserving identity-transparent lifecycle and LIFO cleanup.
- Modify `packages/core/src/lib/element-enhancers.test.ts`: attachment validation, custom-component forwarding, clone/layout preservation, preparation order, render failure, removal, and disposal.
- Modify `packages/core/src/lib/render.ts`: reconcile the registered `physics` attachment only on primitive hosts and invoke resolved preparation before backend primitive execution.
- Modify `packages/core/src/lib/backend/types.ts` and `packages/core/src/lib/backend/canvas-2d-backend.ts`: carry and apply one attachment-provided logical presentation transform before the primitive's ordinary presentation.
- Create `packages/core/src/lib/backend/physics-presentation.test.tsx`: prove pixels, pointer geometry, focus bounds, filters, Group, Clip, and Layer use the same additional transform.
- Modify `packages/core/src/lib/types.ts` and every supported Canvas prop interface under `packages/core/src/lib/components/`: add the empty exported `CRCPhysics2DPropExtension` base without runtime imports.
- Modify `packages/core/src/index.ts`: export the empty augmentation interface only; never export physics values.

### Physics package and pure geometry

- Create `packages/physics/package.json`: side-effect-free package metadata, optional matching core peer, `./2d` and `./2d/geometry` exports, and a two-entry esbuild build.
- Create `packages/physics/tsconfig.build.json`: declarations for `src/2d.ts` and `src/2d-geometry.ts` with no source publication.
- Create `packages/physics/README.md`: installation, geometry-only use, 2D JSX setup, units, ownership, scheduler, and deferred-feature boundaries.
- Create `packages/physics/src/2d-geometry.ts`: renderer-free shape factories, operations, and public geometry/result types.
- Create `packages/physics/src/2d.ts`: world, attachments, handles, commands, events, queries, matching components, and re-exported baseline geometry names.
- Create `packages/physics/src/lib/shared/validation.ts`: finite scalar/integer/range checks with stable diagnostics.
- Create `packages/physics/src/lib/2d/types.ts`: public vectors, poses, bounds, rays, shapes, mass/distance/contact/hit records, filters, bodies, colliders, worlds, handles, events, and query options.
- Create `packages/physics/src/lib/2d/numeric-policy.ts`: fixed tolerances, solver defaults, sleep thresholds, broad-phase margin, CCD limits, and unit conversion constants.
- Create `packages/physics/src/lib/2d/math.ts`: allocation-free vector, matrix, rotation, AABB, interval, and scalar helpers with caller-owned outputs.
- Create `packages/physics/src/lib/2d/shape-records.ts`: package-private nominal WeakMap records, immutable convex leaves, copied vertices, and stable leaf identities.
- Create `packages/physics/src/lib/2d/shapes.ts`: all public shape factories, rigid transforms, validation, flattening, triangulation, bounds, and mass properties.
- Create `packages/physics/src/lib/2d/shapes.test.ts`: public black-box immutability, validation, known-answer, transform, flattening, and mass-property tests.
- Create `packages/physics/src/lib/2d/collision/analytic.ts`: analytic circle/capsule/segment cases.
- Create `packages/physics/src/lib/2d/collision/support.ts`: convex support maps for circle, ellipse, box, rounded box, capsule, and polygon leaves.
- Create `packages/physics/src/lib/2d/collision/gjk.ts`: distance/simplex iteration with fixed iteration and tie policy.
- Create `packages/physics/src/lib/2d/collision/epa.ts`: penetration normal/depth from intersecting convex support pairs.
- Create `packages/physics/src/lib/2d/collision/manifold.ts`: stable geometric contacts and private solver feature matching.
- Create `packages/physics/src/lib/2d/collision/pairs.ts`: compound/chain traversal, signed distance, overlap, contact selection, and public immutable projection.
- Create `packages/physics/src/lib/2d/collision/casts.ts`: point, ray, and fixed-orientation translational shape casts.
- Create `packages/physics/src/lib/2d/collision/*.test.ts`: algorithm-specific known-answer, invariant, degeneracy, seeded, and maximum-iteration evidence.

### World kernel and runtime ownership

- Create `packages/physics/src/lib/2d/world/storage.ts`: dense pooled body, collider, proxy, contact, constraint, island, and free-list arrays with generation-checked integer identities.
- Create `packages/physics/src/lib/2d/world/broad-phase.ts`: deterministic dynamic AABB tree, moved-proxy buffer, pair generation, queries, and exact proxy cleanup.
- Create `packages/physics/src/lib/2d/world/integrator.ts`: force accumulation, damping, gravity, semi-implicit velocity/pose integration, and axis/fixed-rotation rules.
- Create `packages/physics/src/lib/2d/world/contact-cache.ts`: persistent ordered pair keys, manifold matching, warm-start impulses, begin/end transitions, and sensor overlap state.
- Create `packages/physics/src/lib/2d/world/solver.ts`: stable island construction, velocity constraints, friction/restitution, positional correction, sleep/wake, and candidate mutation only.
- Create `packages/physics/src/lib/2d/world/ccd.ts`: bounded conservative advancement for opted-in convex dynamics against supported solids.
- Create `packages/physics/src/lib/2d/world/queries.ts`: committed-world point/AABB/ray/shape queries with deterministic public ordering.
- Create `packages/physics/src/lib/2d/world/world.ts`: normalized configuration, topology commands, fixed-tick accumulator, checkpoint/candidate adoption, interpolation, and failure rollback.
- Create `packages/physics/src/lib/2d/world/*.test.ts`: storage generations, tree invariants, integration, contacts, stacking, friction, restitution, sleeping, CCD, queries, and rollback.
- Create `packages/physics/src/lib/2d/runtime/ownership.ts`: deterministic counters for worlds, registrations, bodies, colliders, handles, commands, candidates, events, shapes, and caches.
- Create `packages/physics/src/lib/2d/runtime/trace.ts`: source-only scheduler/world trace records with collector failure self-disable.
- Create `packages/physics/src/lib/2d/runtime/descriptors.ts`: body/collider immutable attachment factories, module augmentation, core attachment registration, and normalized option comparison.
- Create `packages/physics/src/lib/2d/runtime/context.ts`: render-local nearest-world/body stacks with balanced enter/exit diagnostics.
- Create `packages/physics/src/lib/2d/runtime/controller.ts`: world scheduler owner, topology candidate queue, Advance candidate, staged handle/world signals, Commit adoption, render invalidation, and Complete events.
- Create `packages/physics/src/lib/2d/runtime/world-component.ts`: non-painting ordinary `PhysicsWorld2D` component and `crcPhysicsWorld2D()` hook.
- Create `packages/physics/src/lib/2d/runtime/body-handle.ts`: `crcPhysicsBody2D()`, lazy readonly signals, generation binding, and named Begin commands.
- Create `packages/physics/src/lib/2d/runtime/events.ts`: immutable self-oriented collision/overlap/sleep/wake records and stable delivery ordering.
- Create `packages/physics/src/lib/2d/runtime/*.test.tsx`: descriptor identity, world scope, body/collider lifecycle, transaction failure, handle staleness, scheduler cadence, interpolation, event order, and ownership balance.

### Canvas inference, presentation, and matching components

- Create `packages/physics/src/lib/2d/canvas/inference.ts`: identity-based mapping from resolved core primitive type/style to explicit physics shapes; reject opaque/platform-dependent cases with targeted diagnostics.
- Create `packages/physics/src/lib/2d/canvas/presentation.ts`: initial-pose capture, parent/world transform conversion, dynamic presentation delta, static/kinematic authority checks, and handoff snapshots.
- Create `packages/physics/src/lib/2d/canvas/components.ts`: `Capsule2D`, `Segment2D`, `Chain2D`, and generic `PhysicsShape2D` using public `definePrimitive`, Canvas path drawing, and `crcEventTarget`.
- Create `packages/physics/src/lib/2d/canvas/custom.ts`: `withPhysicsShape2D` capability adapter for a `definePrimitive` value without a registry.
- Create `packages/physics/src/lib/2d/canvas/*.test.tsx`: inference matrix for every current primitive, compound scopes, layout/Group/Clip/Layer/filter alignment, custom primitives, and explicit-collider diagnostics.

### Scenarios, consumers, contracts, and trust evidence

- Create `packages/scenarios/src/physics-2d-lab.example.tsx`: public falling, stacking, bounce, sensor, kinematic platform, animation handoff, query, and command scene.
- Create `packages/scenarios/src/physics-2d-lab.ts`: deterministic actions and semantic snapshots over the exact public example.
- Create `packages/scenarios/src/learning/composition/physics-2d.example.tsx`: concise body/collider/sensor and animation-authority lesson.
- Modify `packages/scenarios/src/catalog.ts`, `packages/scenarios/src/learning-catalog.ts`, `packages/scenarios/src/index.ts`, and `packages/scenarios/package.json`: register the scenario and physics dependency.
- Create `packages/core/test/physics-2d-lab.test.ts`, `packages/core/test/physics-ownership.test.ts`, and `packages/core/test/physics-performance.test.ts`: headless public behavior, lifecycle, and structural cost.
- Modify `vitest.config.ts`: source-mode aliases for `@crc/physics/2d` and `@crc/physics/2d/geometry` while leaving built mode package-resolved.
- Modify `package.json` and `pnpm-lock.yaml`: workspace scripts and lockfile entries; add physics ownership/performance tests to existing gates.
- Modify `playground/package-consumer/index.ts`, `playground/package-consumer/jsx.tsx`, `playground/package-consumer/runtime.mjs`, `tooling/verify-packed-consumer.mjs`, `playground/src/crc-editor-types.txt`, and `tooling/verify-studio-types.mjs`: Bundler, NodeNext, runtime, tree-shaking, optional-peer, packed, and editor evidence.
- Create `docs/site/api/components/physics-world-2d.md`, `docs/site/api/components/physics-shape-2d.md`, `docs/site/api/functions/physics-2d.md`, `docs/site/api/hooks/crc-physics-body-2d.md`, `docs/site/api/hooks/crc-physics-world-2d.md`, `docs/site/api/types/physics-2d.md`, and `docs/site/learn/guides/physics-2d.md`.
- Modify the twelve normative contracts named in Global Constraints plus `README.md`, `packages/core/README.md`, `docs/library-status.md`, `AGENTS.md`, `docs/scenario-index.md`, `tooling/verify-docs.mjs`, `tooling/docs-contract-preservation-baseline.json`, `tooling/studio-docs/api-exports.ts`, and `tooling/studio-docs/api-exports.check.ts`.

## Fixed Public Surface for This Plan

The renderer-free entry exports these runtime values:

```ts
export {
  circleShape2D,
  ellipseShape2D,
  boxShape2D,
  roundedBoxShape2D,
  capsuleShape2D,
  arcShape2D,
  wedgeShape2D,
  segmentShape2D,
  chainShape2D,
  polygonShape2D,
  boundsOfShape2D,
  massProperties2D,
  containsPoint2D,
  distanceBetweenShapes2D,
  overlapShapes2D,
  contactBetweenShapes2D,
  raycastShape2D,
  shapeCastAgainstShape2D,
  transformShape2D,
};
```

The world-facing entry re-exports those names and adds:

```ts
export {
  PhysicsWorld2D,
  PhysicsShape2D,
  Capsule2D,
  Segment2D,
  Chain2D,
  dynamicBody2D,
  staticBody2D,
  kinematicBody2D,
  collider2D,
  withPhysicsShape2D,
  crcPhysicsBody2D,
  crcPhysicsWorld2D,
  applyForce2D,
  applyImpulse2D,
  applyTorque2D,
  setLinearVelocity2D,
  setAngularVelocity2D,
  teleportBody2D,
  wakeBody2D,
  sleepBody2D,
  enableBody2D,
  disableBody2D,
  raycast2D,
  shapeCast2D,
  overlapShape2D,
  queryAabb2D,
  queryPoint2D,
};
```

No root `@crc/physics` export is added. No 3D, joints, debug, or replay export is added by this plan.
`@crc/physics/2d` also exports every public `CRCPhysics*2D`, component-prop,
component-style, option, event, handle, and query type fixed below.
`@crc/physics/2d/geometry` exports only the renderer-independent vector, pose,
bounds, ray, shape, mass, distance, contact, hit, and shape-factory input types
used by its functions.

The public geometry values are:

```ts
export type CRCPhysicsVector2 = readonly [x: number, y: number];

export interface CRCPhysicsPose2D {
  readonly position: CRCPhysicsVector2;
  readonly rotationDegrees: number;
}

export type CRCPhysicsTransform2D = CRCPhysicsPose2D;

export interface CRCPhysicsAabb2D {
  readonly min: CRCPhysicsVector2;
  readonly max: CRCPhysicsVector2;
}

export interface CRCPhysicsRay2D {
  readonly origin: CRCPhysicsVector2;
  readonly direction: CRCPhysicsVector2;
  readonly maxDistance: number;
}

declare const physicsShape2DBrand: unique symbol;
export interface CRCPhysicsShape2D {
  readonly [physicsShape2DBrand]: true;
}

export interface CRCPhysicsMassProperties2D {
  readonly area: number;
  readonly centroid: CRCPhysicsVector2;
  readonly mass: number;
  readonly rotationalInertia: number;
}

export interface CRCPhysicsDistance2D {
  readonly separation: number;
  readonly pointOnFirst: CRCPhysicsVector2;
  readonly pointOnSecond: CRCPhysicsVector2;
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
}

export interface CRCPhysicsContactPoint2D {
  readonly pointOnFirst: CRCPhysicsVector2;
  readonly pointOnSecond: CRCPhysicsVector2;
  readonly separation: number;
}

export interface CRCPhysicsShapeContact2D {
  /** Direction from the second shape toward the first. */
  readonly normal: CRCPhysicsVector2;
  readonly points: readonly CRCPhysicsContactPoint2D[];
}

export interface CRCPhysicsShapeHit2D {
  readonly point: CRCPhysicsVector2;
  readonly normal: CRCPhysicsVector2;
  readonly distance: number;
  readonly timeOfImpact: number;
}
```

Shape factory inputs use copied finite numbers:

```ts
export function circleShape2D(
  input: Readonly<{
    radius: number;
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D;

export function ellipseShape2D(
  input: Readonly<{
    radiusX: number;
    radiusY: number;
    center?: CRCPhysicsVector2;
    rotationDegrees?: number;
  }>,
): CRCPhysicsShape2D;

export function boxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D;

export function roundedBoxShape2D(
  input: Readonly<{
    width: number;
    height: number;
    radius:
      | number
      | readonly [
          topLeft: number,
          topRight: number,
          bottomRight: number,
          bottomLeft: number,
        ];
    center?: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D;

export function capsuleShape2D(
  input: Readonly<{
    start: CRCPhysicsVector2;
    end: CRCPhysicsVector2;
    radius: number;
  }>,
): CRCPhysicsShape2D;

export function arcShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
    thickness: number;
  }>,
): CRCPhysicsShape2D;

export function wedgeShape2D(
  input: Readonly<{
    center?: CRCPhysicsVector2;
    radius: number;
    startAngleRadians: number;
    endAngleRadians: number;
    counterclockwise?: boolean;
  }>,
): CRCPhysicsShape2D;

export function segmentShape2D(
  input: Readonly<{
    start: CRCPhysicsVector2;
    end: CRCPhysicsVector2;
  }>,
): CRCPhysicsShape2D;

export function chainShape2D(
  input: Readonly<{
    points: readonly CRCPhysicsVector2[];
    closed?: boolean;
    radius?: number;
  }>,
): CRCPhysicsShape2D;

export function polygonShape2D(
  input: Readonly<{
    points: readonly CRCPhysicsVector2[];
  }>,
): CRCPhysicsShape2D;
```

`polygonShape2D` accepts one strictly convex simple polygon in clockwise or counterclockwise input order, removes only an exactly repeated closing vertex, normalizes winding, rejects collinear/duplicate/self-intersecting input, and stores vertices in deterministic canonical order. Concave component inference uses private stable triangulation; this plan does not publish an automatic decomposition factory.

The standalone functions have exact signatures:

```ts
export function boundsOfShape2D(
  shape: CRCPhysicsShape2D,
  pose?: CRCPhysicsPose2D,
): CRCPhysicsAabb2D;

export function massProperties2D(
  shape: CRCPhysicsShape2D,
  options?: Readonly<{ density?: number }>,
): CRCPhysicsMassProperties2D;

export function containsPoint2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  point: CRCPhysicsVector2,
): boolean;

export function distanceBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsDistance2D;

export function overlapShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): boolean;

export function contactBetweenShapes2D(
  first: CRCPhysicsShape2D,
  firstPose: CRCPhysicsPose2D,
  second: CRCPhysicsShape2D,
  secondPose: CRCPhysicsPose2D,
): CRCPhysicsShapeContact2D | null;

export function raycastShape2D(
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  ray: CRCPhysicsRay2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit2D | null;

export function shapeCastAgainstShape2D(
  moving: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  target: CRCPhysicsShape2D,
  targetPose: CRCPhysicsPose2D,
  options?: Readonly<{ includeInitialOverlap?: boolean }>,
): CRCPhysicsShapeHit2D | null;

export function transformShape2D(
  shape: CRCPhysicsShape2D,
  transform: CRCPhysicsTransform2D,
): CRCPhysicsShape2D;
```

The public body, collider, filter, world, and handle boundary is:

```ts
export interface CRCPhysicsCollisionFilter {
  readonly category?: number;
  readonly mask?: number;
  readonly group?: number;
}

export type CRCPhysicsCollisionHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
export type CRCPhysicsHitHandler2D = (
  event: CRCPhysicsCollisionEvent2D,
) => void;
export type CRCPhysicsOverlapHandler2D = (
  event: CRCPhysicsOverlapEvent2D,
) => void;
export type CRCPhysicsBodyStateHandler2D = (
  event: CRCPhysicsBodyStateEvent2D,
) => void;

export interface CRCPhysicsColliderConfiguration2D {
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
  readonly onCollisionStart?: CRCPhysicsCollisionHandler2D;
  readonly onCollisionEnd?: CRCPhysicsCollisionHandler2D;
  readonly onHit?: CRCPhysicsHitHandler2D;
  readonly onOverlapStart?: CRCPhysicsOverlapHandler2D;
  readonly onOverlapEnd?: CRCPhysicsOverlapHandler2D;
}

export interface CRCPhysicsDynamicBody2DOptions {
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

export interface CRCPhysicsStaticBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

export interface CRCPhysicsKinematicTarget2D {
  readonly position?: Signal<CRCPhysicsVector2>;
  readonly rotationDegrees?: Signal<number>;
}

export interface CRCPhysicsKinematicBody2DOptions {
  readonly enabled?: boolean;
  readonly handle?: CRCPhysicsBodyHandle2D;
  readonly target?: CRCPhysicsKinematicTarget2D;
  readonly allowSleep?: boolean;
  readonly collider?:
    false | CRCPhysicsColliderConfiguration2D | CRCPhysicsShape2D;
}

declare const physicsAttachment2DBrand: unique symbol;
export interface CRCPhysicsBodyAttachment2D {
  readonly [physicsAttachment2DBrand]: "body";
}
export interface CRCPhysicsColliderAttachment2D {
  readonly [physicsAttachment2DBrand]: "collider";
}
export type CRCPhysicsAttachment2D =
  CRCPhysicsBodyAttachment2D | CRCPhysicsColliderAttachment2D;

export function dynamicBody2D(
  options?: CRCPhysicsDynamicBody2DOptions,
): CRCPhysicsBodyAttachment2D;
export function staticBody2D(
  options?: CRCPhysicsStaticBody2DOptions,
): CRCPhysicsBodyAttachment2D;
export function kinematicBody2D(
  options?: CRCPhysicsKinematicBody2DOptions,
): CRCPhysicsBodyAttachment2D;
export function collider2D(
  options?: CRCPhysicsColliderConfiguration2D,
): CRCPhysicsColliderAttachment2D;

declare module "@crc/core" {
  interface CRCPhysics2DPropExtension {
    readonly physics?: CRCPhysicsAttachment2D;
  }
}
```

The world defaults and component contract are:

```ts
export interface CRCPhysicsSolverOptions {
  readonly velocityIterations?: number;
  readonly positionIterations?: number;
}

export interface CRCPhysicsWorld2DProps {
  readonly gravity?: CRCPhysicsVector2;
  readonly fixedStepMilliseconds?: number;
  readonly maxCatchUpSteps?: number;
  readonly interpolation?: "linear" | "none";
  readonly sleeping?: boolean;
  readonly solver?: CRCPhysicsSolverOptions;
  readonly onSleep?: CRCPhysicsBodyStateHandler2D;
  readonly onWake?: CRCPhysicsBodyStateHandler2D;
  readonly onError?: (error: unknown) => void;
  readonly children?: CRCNode;
}
```

Defaults are gravity `[0, 0]`, fixed step `1000 / 60`, maximum catch-up `4`, interpolation `"linear"`, sleeping enabled, velocity iterations `8`, and position iterations `3`. Iteration counts are safe integers from `1` through `32`; fixed step is finite and greater than zero; maximum catch-up is a safe integer from `1` through `16`.

The four matching Canvas primitives use CRC's normal event, focus, local style,
layout-item, paint, cursor, and `physics` contracts. Their additional public
types are exact rather than inferred from an internal generic:

```ts
export interface CRCPhysicsPrimitiveProps2D
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly keyboardFocusable?: boolean;
  readonly keyboardNavigationBounds?: Readonly<LayoutBox>;
  readonly physics?: CRCPhysicsAttachment2D;
}

export interface PhysicsShape2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface PhysicsShape2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly shape: CRCPhysicsShape2D;
  readonly lineInteractionWidth?: number;
}

export interface Capsule2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Capsule2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
  readonly radius: number;
  readonly lineInteractionWidth?: number;
}

export interface Segment2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Segment2DStyle
  extends
    SystemStyle,
    Omit<PaintStyle, "fill">,
    CursorStyle,
    BoxStyle,
    LayoutItemStyle {
  readonly start: CRCPhysicsVector2;
  readonly end: CRCPhysicsVector2;
  readonly lineInteractionWidth?: number;
}

export interface Chain2DProps extends CRCPhysicsPrimitiveProps2D {}
export interface Chain2DStyle
  extends SystemStyle, PaintStyle, CursorStyle, BoxStyle, LayoutItemStyle {
  readonly points: readonly CRCPhysicsVector2[];
  readonly closed?: boolean;
  readonly radius?: number;
  readonly lineInteractionWidth?: number;
}
```

The constructors are standard `CRCPrimitiveComponent` values parameterized by
those prop/style pairs. `Capsule2D.radius` is required and positive;
`Chain2D.radius` defaults to zero and is nonnegative. All point arrays are
copied at style resolution before paint, event registration, or collider
inference.

Handles expose readonly signals through lazy accessors and no mutating methods:

```ts
declare const bodyHandle2DBrand: unique symbol;
export interface CRCPhysicsBodyHandle2D {
  readonly [bodyHandle2DBrand]: true;
  readonly position: Signal<CRCPhysicsVector2>;
  readonly rotationDegrees: Signal<number>;
  readonly linearVelocity: Signal<CRCPhysicsVector2>;
  readonly angularVelocityDegreesPerSecond: Signal<number>;
  readonly sleeping: Signal<boolean>;
  readonly enabled: Signal<boolean>;
  readonly generation: Signal<number>;
}

declare const colliderHandle2DBrand: unique symbol;
export interface CRCPhysicsColliderHandle2D {
  readonly [colliderHandle2DBrand]: true;
}

declare const worldHandle2DBrand: unique symbol;
export interface CRCPhysicsWorldHandle2D {
  readonly [worldHandle2DBrand]: true;
  readonly revision: Signal<number>;
}

export function crcPhysicsBody2D(): CRCPhysicsBodyHandle2D;
export function crcPhysicsWorld2D(): CRCPhysicsWorldHandle2D;

export function applyForce2D(
  body: CRCPhysicsBodyHandle2D,
  force: CRCPhysicsVector2,
  options?: Readonly<{ at?: CRCPhysicsVector2; wake?: boolean }>,
): void;
export function applyImpulse2D(
  body: CRCPhysicsBodyHandle2D,
  impulse: CRCPhysicsVector2,
  options?: Readonly<{ at?: CRCPhysicsVector2; wake?: boolean }>,
): void;
export function applyTorque2D(
  body: CRCPhysicsBodyHandle2D,
  torque: number,
): void;
export function setLinearVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  velocity: CRCPhysicsVector2,
): void;
export function setAngularVelocity2D(
  body: CRCPhysicsBodyHandle2D,
  degreesPerSecond: number,
): void;
export function teleportBody2D(
  body: CRCPhysicsBodyHandle2D,
  pose: CRCPhysicsPose2D,
): void;
export function wakeBody2D(body: CRCPhysicsBodyHandle2D): void;
export function sleepBody2D(body: CRCPhysicsBodyHandle2D): void;
export function enableBody2D(
  body: CRCPhysicsBodyHandle2D,
  options?: Readonly<{ velocity?: "zero" | "preserve" }>,
): void;
export function disableBody2D(body: CRCPhysicsBodyHandle2D): void;
```

Every command copies finite array data immediately, queues one Begin record in realm invocation order, and becomes inert for an unbound/stale generation. Development traces identify the stale command; production does not throw asynchronously for it.

World-query generics return boolean, closest result, or sorted immutable
results while preserving inference from `mode`:

```ts
export type CRCPhysicsQueryMode = "closest" | "any" | "all";

export interface CRCPhysicsQueryOptions2D<
  Mode extends CRCPhysicsQueryMode = "closest",
> {
  readonly mode?: Mode;
  readonly sensors?: "include" | "exclude" | "only";
  readonly collisionFilter?: CRCPhysicsCollisionFilter;
  readonly excludeBody?: CRCPhysicsBodyHandle2D;
  readonly excludeCollider?: CRCPhysicsColliderHandle2D;
}

export interface CRCPhysicsQueryHit2D extends CRCPhysicsShapeHit2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly collider: CRCPhysicsColliderHandle2D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export interface CRCPhysicsQueryMatch2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly collider: CRCPhysicsColliderHandle2D;
  readonly bodyGeneration: number;
  readonly colliderGeneration: number;
  readonly tag: unknown;
}

export type CRCPhysicsQueryResult2D<
  Mode extends CRCPhysicsQueryMode,
  Result,
> = Mode extends "any"
  ? boolean
  : Mode extends "all"
    ? readonly Result[]
    : Result | null;

export function raycast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  ray: CRCPhysicsRay2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;

export function shapeCast2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  from: CRCPhysicsPose2D,
  translation: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryHit2D>;

export function overlapShape2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  shape: CRCPhysicsShape2D,
  pose: CRCPhysicsPose2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;

export function queryAabb2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  bounds: CRCPhysicsAabb2D,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;

export function queryPoint2D<Mode extends CRCPhysicsQueryMode = "closest">(
  world: CRCPhysicsWorldHandle2D,
  point: CRCPhysicsVector2,
  options?: CRCPhysicsQueryOptions2D<Mode>,
): CRCPhysicsQueryResult2D<Mode, CRCPhysicsQueryMatch2D>;
```

Overlap/AABB/point operations return `CRCPhysicsQueryMatch2D` rather than
manufacturing a geometric point, normal, or distance where none is unique.

Collision events are immutable and self-oriented:

```ts
export interface CRCPhysicsCollisionEvent2D {
  readonly selfBody: CRCPhysicsBodyHandle2D;
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  readonly otherBody: CRCPhysicsBodyHandle2D;
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  /** Direction from other toward self. */
  readonly normal: CRCPhysicsVector2;
  readonly points: readonly CRCPhysicsContactPoint2D[];
  readonly totalNormalImpulse: number;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsOverlapEvent2D {
  readonly selfBody: CRCPhysicsBodyHandle2D;
  readonly selfCollider: CRCPhysicsColliderHandle2D;
  readonly otherBody: CRCPhysicsBodyHandle2D;
  readonly otherCollider: CRCPhysicsColliderHandle2D;
  readonly tick: number;
  readonly selfTag: unknown;
  readonly otherTag: unknown;
}

export interface CRCPhysicsBodyStateEvent2D {
  readonly body: CRCPhysicsBodyHandle2D;
  readonly sleeping: boolean;
  readonly tick: number;
}
```

There is no continuous collision callback. Start/end/hit and overlap start/end are materialized only when a corresponding handler is present. Pair order is fixed by collider identity; receiver order is fixed by receiver identity; tick order always wins across catch-up steps.

## Core Friend Interfaces Fixed by This Plan

The core scheduler remains private. `@crc/core/internal` adds only the following closed official-package capability:

```ts
export type CRCInternalAdvanceLane = "animation" | "physics";

// Reuse the CRCInternalFrame already exported for official renderers.

export interface CRCInternalSignalBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
}

declare const internalSimulationOwnerBrand: unique symbol;
export interface CRCInternalSimulationOwner {
  readonly [internalSimulationOwnerBrand]: true;
}

export function crcInternalCurrentSimulationOwner(): CRCInternalSimulationOwner;
export function crcInternalQueueSimulationBegin(
  owner: CRCInternalSimulationOwner,
  command: (
    frame: CRCInternalFrame,
    batch: CRCInternalSignalBatch,
    sequence: number,
  ) => void,
): Readonly<{ readonly sequence: number; cancel(): void }>;
export function crcInternalRegisterSimulationAdvance(
  owner: CRCInternalSimulationOwner,
  lane: CRCInternalAdvanceLane,
  advance: (frame: CRCInternalFrame, batch: CRCInternalSignalBatch) => void,
): () => void;
export function crcInternalQueueSimulationCommitAcknowledgement(
  owner: CRCInternalSimulationOwner,
  callback: (
    frame: CRCInternalFrame,
    outcome: Readonly<{ readonly applied: boolean }>,
  ) => void,
): void;
export function crcInternalQueueSimulationComplete(
  owner: CRCInternalSimulationOwner,
  callback: (frame: CRCInternalFrame) => void,
): void;
export function crcInternalRequestSimulationRender(
  owner: CRCInternalSimulationOwner,
): void;
export function crcInternalOnSimulationRenderTransactionFinish(
  owner: CRCInternalSimulationOwner,
  callback: (success: boolean) => void,
): void;
```

The implementation uses the existing internal owner liveness and component teardown facts rather than accepting arbitrary application owner objects. The public core root does not re-export these names.

The closed attachment protocol is also friend-only:

```ts
export interface CRCInternalPrimitiveAttachmentInput {
  readonly componentType: Function;
  readonly componentName: string;
  readonly props: Readonly<Record<PropertyKey, unknown>>;
  readonly style: Readonly<Record<PropertyKey, unknown>>;
  readonly source: CRCElementSource | undefined;
  readonly parentWorldTransform: DOMMatrix;
}

export interface CRCInternalMountedPropAttachment {
  update(value: unknown): void;
  enter(): void;
  preparePrimitive(
    input: CRCInternalPrimitiveAttachmentInput,
  ): Readonly<{ readonly presentationTransform2D?: DOMMatrix }> | void;
  exit(success: boolean): void;
  dispose(): void;
}

export function crcInternalCreatePropAttachment<T extends object>(
  property: "physics",
  publicValue: T,
  mount: () => CRCInternalMountedPropAttachment,
): T;
```

Core recognizes registered attachment objects only on primitive hosts. An ordinary custom component receives `physics` as normal application data and may forward it. A primitive with an unregistered non-null `physics` value reports a source-located diagnostic. Clone, layout placement, policy preparation, and Layer snapshots preserve the registered value by identity without copying its mutable mounted state.

## Fixed Numeric and Solver Policy

- Store public inputs and authoritative simulation values as finite JavaScript numbers. Internal hot arrays use `Float64Array`; integer IDs, generations, flags, category/mask bits, and tree links use `Int32Array` or `Uint32Array` as appropriate.
- Convert degrees to radians only at the kernel boundary with `Math.PI / 180`; normalize public committed degrees to `(-180, 180]` and select the shortest interpolation delta, choosing positive rotation for an exact 180-degree tie.
- Use `GEOMETRY_EPSILON = 1e-9`, `CONTACT_SLOP = 0.005`, `MAX_POSITION_CORRECTION = 0.2`, `RESTITUTION_VELOCITY_THRESHOLD = 1`, `SLEEP_LINEAR_SPEED = 0.05`, `SLEEP_ANGULAR_SPEED_DEGREES = 0.5`, `SLEEP_DURATION_SECONDS = 0.5`, `FAT_AABB_MARGIN = 0.1`, `MAX_GJK_ITERATIONS = 24`, `MAX_EPA_ITERATIONS = 32`, and `MAX_CCD_IMPACTS_PER_TICK = 4`.
- Curve flattening stops when the control geometry is within `0.05` logical units of its chord, with a maximum subdivision depth of `12`. Ties process the earlier source segment first.
- Stable triangulation removes collinear points only within `GEOMETRY_EPSILON`, chooses the valid ear with the lowest canonical vertex index, and emits triangle leaves in removal order.
- Dynamic-tree insertion minimizes perimeter increase; equal costs choose the lower subtree proxy identity. Balancing rotations use height first and lower proxy identity for exact ties.
- Broad-phase pair keys are `(minColliderId, maxColliderId)` and sort lexicographically before narrow phase.
- GJK and EPA use fixed maximum iterations and deterministic support-vertex ties by lower canonical vertex/leaf identity. Exceeding the iteration bound fails that pair closed with a trace diagnostic; it never loops indefinitely.
- Sequential impulses run exactly the configured velocity iteration count, then positional correction runs exactly the configured position iteration count. Contacts sort by pair key and stable point index before constraints are built.
- Friction mixing is `sqrt(first * second)`. Restitution mixing is `max(first, second)`. Sensors skip constraint construction.
- Damping uses `velocity *= 1 / (1 + damping * dt)`. Forces accumulate until the next accepted fixed tick and clear after that tick. Semi-implicit integration updates velocity before pose.
- A body sleeps only after every dynamic body in its connected island stays below both thresholds for `SLEEP_DURATION_SECONDS`; a command, topology change, kinematic contact, or awake-body contact resets the island timer.
- CCD uses conservative advancement against supported solid convex leaves, earliest time-of-impact then collider identity, no more than `MAX_CCD_IMPACTS_PER_TICK`, and discrete completion for any remainder after the cap.
- Public `all` query results sort by time of impact/distance where present, then collider identity. Overlap-only results sort by collider identity. Closest ties use the same comparator.

## Task Dependency and Review Gates

- Tasks 1–6 are the foundation gate. Task 6 must prove a packed geometry-only consumer before world/runtime work begins.
- Tasks 7–10 establish the deterministic world kernel and may proceed only after Task 6.
- Tasks 11–13 integrate component ownership, Canvas presentation, commands, and events and may proceed only after Task 10.
- Task 14 adds the public proving scenario after the public 2D entry is usable.
- Tasks 15–17 lock structural evidence, consumers, contracts, and documentation.
- Task 18 is the final aggregate gate. No later task may weaken an earlier task's public or ownership evidence.
- The separate 3D plan begins only after Task 18 records a passing aggregate gate and a written review confirms the core friend seam does not require a second scheduler or a renderer-specific world controller.

---

### Task 1: Add ordered animation and physics Advance lanes

**Files:**

- Modify: `packages/core/src/lib/scheduler/types.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.ts`
- Modify: `packages/core/src/lib/animation/playback.ts`
- Modify: `packages/core/src/lib/animation/playback.test.ts`
- Create: `packages/core/src/lib/scheduler/simulation-participant.ts`
- Create: `packages/core/src/lib/scheduler/simulation-participant.test.tsx`
- Modify: `packages/core/src/internal.ts`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`

**Interfaces:**

- Consumes: existing Begin commands, `SignalCommitBatch`, Commit acknowledgements, Complete callbacks, component teardown ownership, and renderer invalidation.
- Produces: the `CRCInternalSimulationOwner`, batch, lane, Begin, Advance, acknowledgement, Complete, and render-request interfaces fixed above.

- [ ] **Step 1: Write failing lane-order and shared-batch tests**

  Register two animation-lane probes and two physics-lane probes in interleaved component order. Have animation stage `target = 8`, physics read it through the same batch and stage `result = 13`, then assert the trace is `animation-a`, `animation-b`, `physics-a`, `physics-b`, one Commit publishes both values, and one host frame renders once. Add a physics failure whose writer is discarded while a sibling physics world, animation, root, and Complete callback still succeed.

- [ ] **Step 2: Run the focused scheduler test and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/scheduler/simulation-participant.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the simulation participant and explicit physics lane do not exist.

- [ ] **Step 3: Implement lane storage and stable capture**

  Replace the one `Set<AdvanceRegistration>` with one registration record carrying `lane`, `registrationOrder`, and `active`. Capture a frozen prefix at frame start, sort only by the fixed lane ordinal then registration order, and retain current late-admission behavior. Existing animation registration must explicitly select `"animation"`; the new friend adapter selects `"physics"`.

  ```ts
  const ADVANCE_LANE_ORDER = { animation: 0, physics: 1 } as const;
  registrations.sort(
    (a, b) =>
      ADVANCE_LANE_ORDER[a.lane] - ADVANCE_LANE_ORDER[b.lane] ||
      a.registrationOrder - b.registrationOrder,
  );
  ```

- [ ] **Step 4: Implement the component-owned simulation friend adapter**

  Reuse hook/component teardown identity to create one owner per mounted slot. Wrap `SignalCommitBatch` so official packages cannot call `commit()` or `clear()`. Make every queued callback verify owner liveness and cancel all registrations/commands/completions during teardown. `crcInternalRequestSimulationRender` must use the existing coalesced instance request and never call a host scheduler directly. Update existing playback registration to choose the animation lane explicitly; do not route playback through the simulation-owner adapter.

- [ ] **Step 5: Run scheduler, signal, animation, and internal-consumer tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/scheduler/simulation-participant.test.tsx packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/animation/playback.test.ts packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/animation-ownership.test.ts --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 run typecheck
  ```

  Expected: PASS with existing animation traces unchanged except for newly explicit lane metadata.

- [ ] **Step 6: Lock the friend seam in source and packed consumers**

  Import every new type/value only from `@crc/core/internal`, assert none exists on `@crc/core`, and assert the packed internal bundle contains one scheduler identity rather than embedding a second core runtime.

- [ ] **Step 7: Commit the ordered scheduler seam**

  ```bash
  git add packages/core/src/lib/scheduler/types.ts packages/core/src/lib/scheduler/realm-scheduler.ts packages/core/src/lib/scheduler/simulation-participant.ts packages/core/src/lib/scheduler/simulation-participant.test.tsx packages/core/src/lib/animation/playback.ts packages/core/src/lib/animation/playback.test.ts packages/core/src/internal.ts playground/package-consumer/index.ts playground/package-consumer/runtime.mjs
  git commit -m "feat(core): add official physics scheduler lane"
  ```

### Task 2: Add the closed primitive attachment and presentation seam

**Files:**

- Modify: `packages/core/src/lib/element-enhancers.ts`
- Modify: `packages/core/src/lib/element-enhancers.test.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/backend/types.ts`
- Modify: `packages/core/src/lib/backend/canvas-2d-backend.ts`
- Create: `packages/core/src/lib/backend/physics-presentation.test.tsx`
- Modify: `packages/core/src/internal.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/lib/components/arc.ts`
- Modify: `packages/core/src/lib/components/circle.ts`
- Modify: `packages/core/src/lib/components/ellipse.ts`
- Modify: `packages/core/src/lib/components/g.ts`
- Modify: `packages/core/src/lib/components/horizontal-line.ts`
- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/lib/components/line.ts`
- Modify: `packages/core/src/lib/components/path.ts`
- Modify: `packages/core/src/lib/components/polygon.ts`
- Modify: `packages/core/src/lib/components/regular-polygon.ts`
- Modify: `packages/core/src/lib/components/rect.ts`
- Modify: `packages/core/src/lib/components/star.ts`
- Modify: `packages/core/src/lib/components/svg-path.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/vertical-line.ts`
- Modify: `packages/core/src/lib/components/wedge.ts`

**Interfaces:**

- Consumes: existing identity-transparent enhancer lifecycle, primitive definition/style resolution, world transform, backend primitive input, render transaction, and component prop interfaces.
- Produces: the closed prop-attachment interfaces above plus public empty `CRCPhysics2DPropExtension`.

- [ ] **Step 1: Write failing registered-attachment lifecycle tests**

  Create a friend-only fake attachment and prove mount/update/enter/prepare/child traversal/exit order, stable mounted identity across descriptor recreation, removal disposal, failed prepare LIFO cleanup, keyed replacement, policy clone, layout placement, Layer snapshot equality, and root disposal. Put the same registered value on an ordinary custom component and assert it is not mounted until that component forwards it to a primitive.

- [ ] **Step 2: Run enhancer and backend tests and observe missing APIs**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/backend/physics-presentation.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because registered prop attachments and presentation transforms are absent.

- [ ] **Step 3: Register attachments without an import-time dispatch registry**

  Keep registration in a core-owned `WeakMap<object, AttachmentFactoryRecord>` populated only when `crcInternalCreatePropAttachment` constructs a value. During primitive reconciliation, inspect only the `physics` property, accept only WeakMap-recognized objects, and merge that mounted lifecycle with existing enhancer metadata. Never scan arbitrary props or component trees.

- [ ] **Step 4: Prepare resolved primitive geometry and apply presentation**

  After style resolution and before `driver.runPrimitive`, call `preparePrimitive` with the primitive function identity, resolved style, source, and current parent world transform. Carry the returned `presentationTransform2D` in the backend primitive input. Canvas applies it before the existing primitive presentation and filter capture so paint, filter silhouette, child transforms, event paths, and focus bounds observe one transform.

- [ ] **Step 5: Add type-augmentation bases to all supported hosts**

  Export an empty `CRCPhysics2DPropExtension` from core. Extend the prop interface for every file listed above, including structural `Group`; do not add a concrete `physics` property or runtime import to core. Add compile assertions that `physics` is absent before module augmentation and becomes typed after the physics module is imported in Task 3.

- [ ] **Step 6: Prove invalid and unsupported placement diagnostics**

  Assert an unregistered object on a primitive `physics` prop names the component, property, and JSX source. Assert wrong-dimension metadata and a self-inferred collider on a primitive without a resolver fail before resource acquisition. Assert an ordinary custom component can retain any application prop named `physics` until it forwards a registered attachment.

- [ ] **Step 7: Run core rendering regressions**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/backend/physics-presentation.test.tsx packages/core/src/lib/primitive-presentation.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/layout/layout-jsx.test.tsx --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 run typecheck
  ```

  Expected: PASS with one primitive traversal and unchanged behavior for primitives without attachments.

- [ ] **Step 8: Commit the attachment seam**

  ```bash
  git add packages/core/src/lib/element-enhancers.ts packages/core/src/lib/element-enhancers.test.ts packages/core/src/lib/render.ts packages/core/src/lib/backend/types.ts packages/core/src/lib/backend/canvas-2d-backend.ts packages/core/src/lib/backend/physics-presentation.test.tsx packages/core/src/internal.ts packages/core/src/lib/types.ts packages/core/src/index.ts packages/core/src/lib/components/arc.ts packages/core/src/lib/components/circle.ts packages/core/src/lib/components/ellipse.ts packages/core/src/lib/components/g.ts packages/core/src/lib/components/horizontal-line.ts packages/core/src/lib/components/img.ts packages/core/src/lib/components/line.ts packages/core/src/lib/components/path.ts packages/core/src/lib/components/polygon.ts packages/core/src/lib/components/regular-polygon.ts packages/core/src/lib/components/rect.ts packages/core/src/lib/components/star.ts packages/core/src/lib/components/svg-path.ts packages/core/src/lib/components/text.ts packages/core/src/lib/components/vertical-line.ts packages/core/src/lib/components/wedge.ts
  git commit -m "feat(core): add official primitive attachment seam"
  ```

### Task 3: Scaffold `@crc/physics` and lock the 2D public types

**Files:**

- Create: `packages/physics/package.json`
- Create: `packages/physics/tsconfig.build.json`
- Create: `packages/physics/README.md`
- Create: `packages/physics/src/2d.ts`
- Create: `packages/physics/src/2d-geometry.ts`
- Create: `packages/physics/src/lib/shared/validation.ts`
- Create: `packages/physics/src/lib/2d/types.ts`
- Create: `packages/physics/src/lib/2d/numeric-policy.ts`
- Create: `packages/physics/src/lib/2d/public-types.test.ts`
- Modify: `vitest.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `@crc/core` public signal/node types only from the world-facing entry and Task 1/2 friend declarations only from runtime modules.
- Produces: package exports and every public type/signature fixed above; runtime functions initially throw only inside the focused red test and are implemented before this task is committed.

- [ ] **Step 1: Write failing package/type tests**

  Add compile fixtures importing all geometry names from `@crc/physics/2d/geometry`, all world names from `@crc/physics/2d`, and no root barrel. Prove the geometry declarations contain no `@crc/core` reference, body/collider attachments are nominal, query overloads narrow by `mode`, shape arrays are readonly, and importing `@crc/physics/2d` augments supported core props but not arbitrary custom component props.

- [ ] **Step 2: Run typecheck and observe missing package failures**

  ```bash
  corepack pnpm@11.21.0 run typecheck
  ```

  Expected: FAIL on unresolved `@crc/physics/2d` and `/geometry` imports.

- [ ] **Step 3: Create the package manifest and entry graph**

  Configure `./2d` and `./2d/geometry` exports, `sideEffects: false`, no dependencies, optional peer `@crc/core: 0.0.1`, and matching core as a workspace dev dependency. Build both entries with splitting; externalize `@crc/core` and `@crc/core/internal`; publish only `dist`.

- [ ] **Step 4: Define public types, augmentation, and stable defaults**

  Implement the interfaces fixed above, the named matching-component prop/style types, the `@crc/core` merge for `CRCPhysics2DPropExtension`, and the numeric constants in `numeric-policy.ts`. Use unique-symbol declarations for compile-time nominality and package-private WeakMaps for runtime recognition; never attach mutable records to public values.

- [ ] **Step 5: Add source aliases and package scripts**

  Alias the two exact subpaths in source-mode Vitest before the broader `/2d` match. Add package build and focused Node geometry-test scripts without enabling a second workspace scheduler.

- [ ] **Step 6: Run typecheck and build**

  ```bash
  corepack pnpm@11.21.0 run typecheck
  corepack pnpm@11.21.0 -C packages/physics run build
  ```

  Expected: PASS; both declaration and ESM entries exist, and the geometry bundle has no core import.

- [ ] **Step 7: Commit the package and type boundary**

  ```bash
  git add packages/physics/package.json packages/physics/tsconfig.build.json packages/physics/README.md packages/physics/src/2d.ts packages/physics/src/2d-geometry.ts packages/physics/src/lib/shared/validation.ts packages/physics/src/lib/2d/types.ts packages/physics/src/lib/2d/numeric-policy.ts packages/physics/src/lib/2d/public-types.test.ts package.json pnpm-lock.yaml vitest.config.ts
  git commit -m "feat(physics): scaffold dimensioned 2d package"
  ```

### Task 4: Implement immutable 2D shapes, bounds, transforms, and mass properties

**Files:**

- Create: `packages/physics/src/lib/2d/math.ts`
- Create: `packages/physics/src/lib/2d/shape-records.ts`
- Create: `packages/physics/src/lib/2d/shapes.ts`
- Create: `packages/physics/src/lib/2d/shapes.test.ts`
- Modify: `packages/physics/src/2d-geometry.ts`
- Modify: `packages/physics/src/2d.ts`

**Interfaces:**

- Consumes: Task 3 geometry types, validation, and fixed numeric policy.
- Produces: all shape factories plus `boundsOfShape2D`, `massProperties2D`, and `transformShape2D`.

- [ ] **Step 1: Write failing public known-answer and immutability tests**

  Cover every factory with caller-array mutation after construction, frozen results, nonfinite and negative dimensions, canonical polygon winding/start vertex, zero-area segment/chain behavior, circle/ellipse/box/capsule formulas, transformed bounds, and density-scaled mass/inertia. Use a 2-by-4 box at density 3 to assert area `8`, mass `24`, centroid `[0, 0]`, and inertia `40` about its centroid.

- [ ] **Step 2: Run the Node geometry test and observe missing behavior**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/shapes.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL on missing factories and operations.

- [ ] **Step 3: Implement nominal records and allocation-free math helpers**

  Store one frozen public shell in a WeakMap to a private record containing canonical convex leaves, local transforms, bounds, area, centroid, and unit-density inertia. Copy every vertex into owned `Float64Array` storage. Reject public lookalikes through one `requireShapeRecord2D` diagnostic.

- [ ] **Step 4: Implement analytic primitive records**

  Use exact area/inertia formulas for circle, ellipse, box, capsule, and polygon leaves. Represent rounded boxes as a support-mapped box core plus radius. Represent rigid transforms as immutable wrapper records that share leaf geometry and compose local poses without mutating the source.

- [ ] **Step 5: Implement deterministic curves and compounds**

  Flatten arc and wedge curves with the fixed chord tolerance/depth. Canonicalize contours, triangulate concave wedge contours with the fixed lowest-index ear rule, and keep emitted leaf order stable. Chains retain segment source order and optional radius.

- [ ] **Step 6: Run shape tests and generated invariants**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/shapes.test.ts --browser.enabled=false --environment node
  corepack pnpm@11.21.0 -C packages/physics run build
  ```

  Expected: PASS with no core reference in the built geometry entry.

- [ ] **Step 7: Commit immutable shapes**

  ```bash
  git add packages/physics/src/lib/2d/math.ts packages/physics/src/lib/2d/shape-records.ts packages/physics/src/lib/2d/shapes.ts packages/physics/src/lib/2d/shapes.test.ts packages/physics/src/2d-geometry.ts packages/physics/src/2d.ts
  git commit -m "feat(physics): add immutable 2d shapes"
  ```

### Task 5: Implement standalone distance, overlap, and contact operations

**Files:**

- Create: `packages/physics/src/lib/2d/collision/analytic.ts`
- Create: `packages/physics/src/lib/2d/collision/analytic.test.ts`
- Create: `packages/physics/src/lib/2d/collision/support.ts`
- Create: `packages/physics/src/lib/2d/collision/support.test.ts`
- Create: `packages/physics/src/lib/2d/collision/gjk.ts`
- Create: `packages/physics/src/lib/2d/collision/gjk.test.ts`
- Create: `packages/physics/src/lib/2d/collision/epa.ts`
- Create: `packages/physics/src/lib/2d/collision/epa.test.ts`
- Create: `packages/physics/src/lib/2d/collision/manifold.ts`
- Create: `packages/physics/src/lib/2d/collision/manifold.test.ts`
- Create: `packages/physics/src/lib/2d/collision/pairs.ts`
- Create: `packages/physics/src/lib/2d/collision/pairs.test.ts`
- Modify: `packages/physics/src/2d-geometry.ts`
- Modify: `packages/physics/src/2d.ts`

**Interfaces:**

- Consumes: immutable shape records and caller-owned math output buffers.
- Produces: `containsPoint2D`, `distanceBetweenShapes2D`, `overlapShapes2D`, `contactBetweenShapes2D`, plus private solver manifold generation.

- [ ] **Step 1: Write failing analytic and support-map tests**

  Assert exact circle-circle, point-circle, capsule-point, segment-point, and axis-aligned box results. For ellipse/rounded-box/polygon support maps, assert selected extrema in eight directions and lower canonical vertex identity on exact ties.

- [ ] **Step 2: Run focused tests and observe missing modules**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/collision/analytic.test.ts packages/physics/src/lib/2d/collision/support.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because the collision modules do not exist.

- [ ] **Step 3: Implement analytic cases and bounded GJK/EPA**

  Route simple pairs through analytic functions; route remaining convex leaves through GJK for signed separation and EPA for penetration. Every loop checks the fixed iteration bound, repeated support point, finite progress, and deterministic tie rules. Return failure as a private diagnostic result rather than an invented contact.

- [ ] **Step 4: Write failing symmetry, invariance, compound, and manifold tests**

  For each supported family pair, swap inputs and assert equal separation, exchanged witness points, and reversed normal. Translate/rotate both inputs together and assert invariant separation. Cover separated, touching, shallow/deep penetration, parallel edges, coincident centers, compound leaves, and chain segments. Seed generated cases with fixed integer seeds printed in assertion messages.

- [ ] **Step 5: Implement stable contact summaries and private feature matching**

  Clip incident/reference edges for polygonal contacts, emit at most two 2D points, sort by tangent projection then leaf/feature identity, and project only immutable point/separation data publicly. Keep feature IDs exclusively in the private manifold record used for warm starting.

- [ ] **Step 6: Run the complete standalone pair suite**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/collision --browser.enabled=false --environment node
  corepack pnpm@11.21.0 -C packages/physics run build
  ```

  Expected: PASS; malformed lookalikes and nonfinite poses fail before collision iteration.

- [ ] **Step 7: Commit collision geometry**

  ```bash
  git add packages/physics/src/lib/2d/collision/analytic.ts packages/physics/src/lib/2d/collision/analytic.test.ts packages/physics/src/lib/2d/collision/support.ts packages/physics/src/lib/2d/collision/support.test.ts packages/physics/src/lib/2d/collision/gjk.ts packages/physics/src/lib/2d/collision/gjk.test.ts packages/physics/src/lib/2d/collision/epa.ts packages/physics/src/lib/2d/collision/epa.test.ts packages/physics/src/lib/2d/collision/manifold.ts packages/physics/src/lib/2d/collision/manifold.test.ts packages/physics/src/lib/2d/collision/pairs.ts packages/physics/src/lib/2d/collision/pairs.test.ts packages/physics/src/2d-geometry.ts packages/physics/src/2d.ts
  git commit -m "feat(physics): add pure 2d collision operations"
  ```

### Task 6: Add standalone casts and prove the geometry-only package boundary

**Files:**

- Create: `packages/physics/src/lib/2d/collision/casts.ts`
- Create: `packages/physics/src/lib/2d/collision/casts.test.ts`
- Modify: `packages/physics/src/2d-geometry.ts`
- Modify: `packages/physics/src/2d.ts`
- Modify: `tooling/verify-packed-consumer.mjs`

**Interfaces:**

- Consumes: Task 5 pair distance/support operations and Task 3 package exports.
- Produces: `raycastShape2D`, `shapeCastAgainstShape2D`, and a packed geometry-only install that contains no core/WebGL runtime.

- [ ] **Step 1: Write failing ray and translational cast tests**

  Cover hits/misses, non-normalized directions, finite maximum distance, start overlap include/exclude, tangent hits, zero translation, compound earliest hit, chain/segment hits, equal-time leaf ties, and immutable hit output. Assert time of impact in `[0, 1]` and distance in logical units.

- [ ] **Step 2: Run the Node cast suite and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/collision/casts.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because cast functions are missing.

- [ ] **Step 3: Implement analytic rays and conservative advancement**

  Use analytic ray tests for circle/capsule/segment where available and support-based advancement for other convex leaves. Compound casts choose minimum time of impact then stable leaf identity. Stop on hit tolerance, no progress, maximum distance, or the fixed iteration bound; never rotate the moving shape during a cast.

- [ ] **Step 4: Add a geometry-only packed consumer**

  Pack `@crc/physics`, install only that tarball in a fresh temporary consumer with strict peers, import `/2d/geometry`, run one circle/box distance and ray test, and bundle it with an esbuild metafile. Assert no input path contains `@crc/core`, `@crc/webgl`, `requestAnimationFrame`, Canvas, or physics world modules.

- [ ] **Step 5: Run all pure geometry and packed-boundary evidence**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/shapes.test.ts packages/physics/src/lib/2d/collision --browser.enabled=false --environment node
  corepack pnpm@11.21.0 run test:package-consumer:packed
  ```

  Expected: PASS, including offline geometry-only installation without core.

- [ ] **Step 6: Commit the foundation gate**

  ```bash
  git add packages/physics/src/lib/2d/collision/casts.ts packages/physics/src/lib/2d/collision/casts.test.ts packages/physics/src/2d-geometry.ts packages/physics/src/2d.ts tooling/verify-packed-consumer.mjs
  git commit -m "feat(physics): add standalone 2d casts"
  ```

### Task 7: Build generation-safe pooled storage and the dynamic AABB broad phase

**Files:**

- Create: `packages/physics/src/lib/2d/world/storage.ts`
- Create: `packages/physics/src/lib/2d/world/storage.test.ts`
- Create: `packages/physics/src/lib/2d/world/broad-phase.ts`
- Create: `packages/physics/src/lib/2d/world/broad-phase.test.ts`
- Create: `packages/physics/src/lib/2d/runtime/ownership.ts`

**Interfaces:**

- Consumes: private shape records, AABB math, stable numeric policy, and copied normalized body/collider definitions.
- Produces: generation-checked body/collider IDs, reusable typed-array stores, proxy ownership, moved-proxy pair generation, and deterministic counters.

- [ ] **Step 1: Write failing storage generation and reuse tests**

  Allocate/remove/reallocate bodies and colliders, assert indices may be reused only with incremented generations, stale `(index, generation)` pairs cannot read or mutate replacements, and all free-list/capacity/live counters return to baseline. Grow from capacity 4 to 8 and assert committed numeric state and stable identities survive copying.

- [ ] **Step 2: Run storage tests and observe the missing module**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/storage.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because pooled world storage is absent.

- [ ] **Step 3: Implement dense typed arrays and exact ownership counters**

  Keep positions, rotations, velocities, forces, inverse mass/inertia, damping, sleep time, flags, and generations in dedicated arrays. Keep collider body ID, shape record, material, filter, tag, handlers, proxy ID, and generation in collider storage. Object references live in capacity-sized arrays cleared on release; hot numeric fields live in typed arrays.

- [ ] **Step 4: Write failing dynamic-tree invariant and pair-order tests**

  Insert, move, remove, and reinsert proxies; after each mutation assert parent/child reciprocity, exact heights, enclosing bounds, one leaf per collider, and no leaked nodes. Feed the same final proxies in different insertion orders and assert public candidate pairs sort lexicographically by collider identity even when tree shapes differ.

- [ ] **Step 5: Implement the dynamic AABB tree**

  Use the fixed perimeter-cost insertion and tie rules. Fat bounds include `FAT_AABB_MARGIN` plus the signed displacement projection. Buffer only moved proxies, query their fat bounds, deduplicate numeric pair keys without exposing Set order, radix/lexicographically sort, and clear the moved flag after pair publication.

- [ ] **Step 6: Run broad-phase tests and structural allocation assertions**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/storage.test.ts packages/physics/src/lib/2d/world/broad-phase.test.ts --browser.enabled=false --environment node
  ```

  Expected: PASS with no per-query closure and stable allocated-node counts after warm-up.

- [ ] **Step 7: Commit world storage and broad phase**

  ```bash
  git add packages/physics/src/lib/2d/world/storage.ts packages/physics/src/lib/2d/world/storage.test.ts packages/physics/src/lib/2d/world/broad-phase.ts packages/physics/src/lib/2d/world/broad-phase.test.ts packages/physics/src/lib/2d/runtime/ownership.ts
  git commit -m "feat(physics): add pooled 2d broad phase"
  ```

### Task 8: Integrate bodies and solve deterministic contacts

**Files:**

- Create: `packages/physics/src/lib/2d/world/integrator.ts`
- Create: `packages/physics/src/lib/2d/world/integrator.test.ts`
- Create: `packages/physics/src/lib/2d/world/contact-cache.ts`
- Create: `packages/physics/src/lib/2d/world/contact-cache.test.ts`
- Create: `packages/physics/src/lib/2d/world/solver.ts`
- Create: `packages/physics/src/lib/2d/world/solver.test.ts`

**Interfaces:**

- Consumes: Task 7 storage/pairs and Task 5 private manifolds.
- Produces: one allocation-stable fixed-tick integrator, persistent contact cache, stable islands, sequential impulses, positional correction, and candidate events.

- [ ] **Step 1: Write failing integration tests**

  Assert one dynamic body under `[0, 10]` gravity with `dt = 0.1` changes velocity before pose, force clears after one tick, impulse applies immediately at its accepted tick, off-center impulse changes angular velocity, damping follows `1 / (1 + damping * dt)`, fixed rotation prevents angular response, and static/kinematic bodies have zero inverse mass and ignore force movement.

- [ ] **Step 2: Run integrator tests and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/integrator.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because integration is absent.

- [ ] **Step 3: Implement semi-implicit integration and force/impulse accumulation**

  Use seconds `dt = fixedStepMilliseconds / 1000`. Apply gravity scale and force times inverse mass, apply torque times inverse inertia, damp velocities, then update position and angle. Convert angular public degrees to internal radians at command admission and convert only for public projection.

- [ ] **Step 4: Write failing contact-cache and solver tests**

  Cover circle-ground rest, two-box stack, symmetric head-on restitution, tangential friction, different collider mixing, sensor pair with no impulse, compound self-collision exclusion, stable begin/end transitions, warm-start reuse by private feature ID, and equal pair/point tie order. Run each scene twice from identical definitions and assert exact discrete state plus numeric tolerance for continuous values.

- [ ] **Step 5: Implement persistent contacts and island construction**

  Merge sorted broad-phase pairs with the prior sorted contact cache. Recompute manifolds for overlapping fat proxies, carry matched impulses by private feature identity, emit begin/end candidates, and build connected dynamic-body islands in ascending body identity. Static/kinematic bodies connect constraints but do not merge otherwise independent dynamic islands through one shared immovable body.

- [ ] **Step 6: Implement sequential impulses and positional correction**

  Precompute effective normal/tangent masses, warm start, run exactly 8 default velocity iterations, clamp accumulated normal impulse nonnegative and tangent impulse to mixed friction times normal impulse, apply restitution only below the negative threshold, then run exactly 3 default bounded position iterations.

  ```ts
  accumulatedNormal = Math.max(0, accumulatedNormal + normalDelta);
  const frictionLimit = mixedFriction * accumulatedNormal;
  accumulatedTangent = Math.max(
    -frictionLimit,
    Math.min(frictionLimit, accumulatedTangent + tangentDelta),
  );
  ```

- [ ] **Step 7: Run deterministic solver tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/integrator.test.ts packages/physics/src/lib/2d/world/contact-cache.test.ts packages/physics/src/lib/2d/world/solver.test.ts --browser.enabled=false --environment node
  ```

  Expected: PASS without allocating public event objects when no handlers observe them.

- [ ] **Step 8: Commit integration and contact solving**

  ```bash
  git add packages/physics/src/lib/2d/world/integrator.ts packages/physics/src/lib/2d/world/integrator.test.ts packages/physics/src/lib/2d/world/contact-cache.ts packages/physics/src/lib/2d/world/contact-cache.test.ts packages/physics/src/lib/2d/world/solver.ts packages/physics/src/lib/2d/world/solver.test.ts
  git commit -m "feat(physics): solve deterministic 2d contacts"
  ```

### Task 9: Add sleeping, bounded CCD, and committed-world queries

**Files:**

- Create: `packages/physics/src/lib/2d/world/ccd.ts`
- Create: `packages/physics/src/lib/2d/world/ccd.test.ts`
- Create: `packages/physics/src/lib/2d/world/queries.ts`
- Create: `packages/physics/src/lib/2d/world/queries.test.ts`
- Modify: `packages/physics/src/lib/2d/world/solver.ts`
- Modify: `packages/physics/src/lib/2d/world/solver.test.ts`

**Interfaces:**

- Consumes: solved islands, storage, broad-phase tree, standalone casts, filters, and lazy handle materialization.
- Produces: island sleep/wake, opted-in CCD, and all committed-world query kernels.

- [ ] **Step 1: Write failing sleep/wake tests**

  Assert a resting connected island sleeps only after 0.5 seconds below both thresholds, releases integration/solver work, and wakes completely on force, impulse, teleport, collider/topology change, moving kinematic contact, or awake-body contact. With sleeping disabled, assert bodies never enter sleep and the world remains advance-eligible.

- [ ] **Step 2: Implement deterministic island sleeping**

  Track one minimum eligible time per island, reset all member timers together, and change sleep flags in body identity order. Emit sleep/wake facts only for observed handlers and never from broad-phase traversal order.

- [ ] **Step 3: Write failing CCD tests**

  Fire a small opted-in circle through a thin static wall at a velocity that tunnels discretely; assert the earliest supported impact is resolved, equal-time walls choose lower collider identity, disabled CCD tunnels in the characterization fixture, sensors remain discrete, and the four-impact cap terminates a pinball corridor deterministically.

- [ ] **Step 4: Implement bounded conservative advancement**

  Sweep each opted-in awake dynamic convex leaf from its pre-integration pose through proposed translation, query swept AABB candidates, apply filter/sensor rules, choose earliest time then identity, resolve at most four impacts, and finish the remaining fraction discretely after the cap. Trace the cap without calling application code.

- [ ] **Step 5: Write failing committed query tests**

  Cover closest/any/all ray casts, shape casts, overlap shapes, AABBs, and points; include/exclude/only sensors; category/mask/group filtering; excluded body/collider; compound duplicate suppression; tag retention; stale world/handle behavior; and exact public sort order. Assert queries never observe presentation interpolation or mutate the tree.

- [ ] **Step 6: Implement allocation-controlled world queries**

  Traverse broad-phase/tree candidates into world-owned scratch arrays, run narrow phase against committed poses, sort numeric hits, then materialize only the requested public result. `mode: "any"` returns on the first semantic match without exposing traversal identity; `mode: "closest"` still resolves exact ties by collider identity.

- [ ] **Step 7: Run sleep, CCD, and query tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/solver.test.ts packages/physics/src/lib/2d/world/ccd.test.ts packages/physics/src/lib/2d/world/queries.test.ts --browser.enabled=false --environment node
  ```

  Expected: PASS with bounded iterations and no Canvas/core import in kernel files.

- [ ] **Step 8: Commit sleeping, CCD, and queries**

  ```bash
  git add packages/physics/src/lib/2d/world/solver.ts packages/physics/src/lib/2d/world/solver.test.ts packages/physics/src/lib/2d/world/ccd.ts packages/physics/src/lib/2d/world/ccd.test.ts packages/physics/src/lib/2d/world/queries.ts packages/physics/src/lib/2d/world/queries.test.ts
  git commit -m "feat(physics): add sleeping ccd and world queries"
  ```

### Task 10: Build fixed-tick world candidates, rollback, and interpolation

**Files:**

- Create: `packages/physics/src/lib/2d/world/world.ts`
- Create: `packages/physics/src/lib/2d/world/world.test.ts`
- Create: `packages/physics/src/lib/2d/runtime/trace.ts`

**Interfaces:**

- Consumes: Tasks 7–9 kernel modules and normalized world/topology/command records.
- Produces:

  ```ts
  interface PhysicsWorld2DKernel {
    proposeTopology(records: readonly PhysicsTopologyRecord2D[]): void;
    applyBegin(commands: readonly PhysicsCommand2D[]): void;
    advance(
      input: Readonly<{
        frameId: number;
        logicalTime: number;
        stagedKinematicTargets: ReadonlyMap<number, PhysicsPose2D>;
      }>,
    ): PhysicsWorld2DCandidate | undefined;
    adopt(candidate: PhysicsWorld2DCandidate): void;
    discard(candidate: PhysicsWorld2DCandidate): void;
    presentationPose(bodyId: number): PhysicsPose2D;
    dispose(): void;
  }
  ```

- [ ] **Step 1: Write failing arbitrary-cadence accumulator tests**

  Drive logical times that produce zero, one, and three fixed ticks; assert retained fractional remainder and interpolated pose. Drive equivalent total fixed ticks under different frame groupings and assert identical authoritative state when no clamp occurs. Drive a long stall and assert exactly four steps, discarded elapsed time, one clamp trace, and no private backlog.

- [ ] **Step 2: Run world tests and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world/world.test.ts --browser.enabled=false --environment node
  ```

  Expected: FAIL because the world coordinator does not exist.

- [ ] **Step 3: Implement checkpointed candidate generations**

  Snapshot only mutated array ranges, free-list heads, tree roots, cache lengths, accumulator, tick counter, and event cursors. `advance` starts from committed state, mutates candidate storage, and never publishes it. `adopt` swaps or seals candidate journals exactly once; `discard` restores every range and count in reverse mutation order.

- [ ] **Step 4: Implement fixed ticks and presentation interpolation**

  Anchor a new/resumed world at current logical time. Clamp accepted elapsed before accumulation, simulate complete steps only, retain remainder, and compute body presentation from previous/current authoritative poses. Use shortest clockwise-degree interpolation with the positive 180-degree tie rule; `"none"` returns current authoritative pose.

- [ ] **Step 5: Add failure and trace tests**

  Inject failures after topology, broad phase, narrow phase, velocity solve, position solve, CCD, and event staging. Assert committed arrays, proxies, contacts, accumulator, events, and counters match the exact pre-advance snapshot. Install a trace collector that throws once and assert tracing disables itself without changing simulation results.

- [ ] **Step 6: Run the complete kernel suite**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/world --browser.enabled=false --environment node
  ```

  Expected: PASS with exact discrete rollback and documented continuous tolerances.

- [ ] **Step 7: Commit transactional world advancement**

  ```bash
  git add packages/physics/src/lib/2d/world/world.ts packages/physics/src/lib/2d/world/world.test.ts packages/physics/src/lib/2d/runtime/trace.ts
  git commit -m "feat(physics): add transactional fixed tick world"
  ```

### Task 11: Mount worlds and reconcile body/collider attachments transactionally

**Files:**

- Create: `packages/physics/src/lib/2d/runtime/descriptors.ts`
- Create: `packages/physics/src/lib/2d/runtime/descriptors.test.tsx`
- Create: `packages/physics/src/lib/2d/runtime/context.ts`
- Create: `packages/physics/src/lib/2d/runtime/controller.ts`
- Create: `packages/physics/src/lib/2d/runtime/controller.test.tsx`
- Create: `packages/physics/src/lib/2d/runtime/world-component.ts`
- Create: `packages/physics/src/lib/2d/runtime/world-component.test.tsx`
- Modify: `packages/physics/src/2d.ts`

**Interfaces:**

- Consumes: Task 1 simulation owner, Task 2 attachment lifecycle, Task 10 world kernel, core hook slots, and render-transaction finish.
- Produces: `PhysicsWorld2D`, body/collider factories, nearest world/body scope, committed topology commands, and `crcPhysicsWorld2D`.

- [ ] **Step 1: Write failing descriptor validation and identity tests**

  Assert every factory copies arrays, freezes normalized option records, preserves tag/callback/signal/handle identity, rejects invalid density/material/filter/mass/damping/velocity values, recognizes no hand-authored lookalike, and updates an existing mounted body when a freshly created equivalent descriptor appears at the same component slot.

- [ ] **Step 2: Run descriptor tests and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/runtime/descriptors.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because body/collider attachments are absent.

- [ ] **Step 3: Implement world and body render scopes**

  Define `PhysicsWorld2D` as an ordinary component that owns one controller hook slot, pushes its controller before returning its children, and pops through the official `setCurrentComponentAfterRender` friend seam after descendant traversal. Attachment `enter` requires the nearest world, pushes a body scope for body attachments, and requires a nearest body for collider-only attachments. Same-dimension nested worlds and collider-only roots fail with owner/source diagnostics.

- [ ] **Step 4: Reconcile topology after successful render only**

  During attachment preparation, collect immutable body/collider candidate records keyed by component identity/generation. At root transaction finish, discard on failure; on success enqueue one owner-scoped Begin command that diffs the complete world candidate against committed topology in stable identity order. Remove descendants before parents and add parents before descendants.

- [ ] **Step 5: Register one awake world and adopt only after Commit**

  The controller owns at most one physics-lane registration. During Advance it reads staged kinematic signals, asks the kernel for one candidate, stages only active public signals/revision, and registers one Commit acknowledgement. Adopt and request Render only when `outcome.applied`; otherwise discard. Queue immutable semantic events for Complete after adoption.

- [ ] **Step 6: Test mount, update, removal, sleep, failure, and sibling worlds**

  Assert initial authored render precedes next-Begin topology, equivalent updates retain IDs, changed options update once, removed attachments release exact resources, failed sibling traversal preserves the previous topology, sleeping releases Advance, commands wake it, and two worlds fail/adopt independently while sharing one host frame.

- [ ] **Step 7: Run runtime and scheduler integration tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/runtime/descriptors.test.tsx packages/physics/src/lib/2d/runtime/controller.test.tsx packages/physics/src/lib/2d/runtime/world-component.test.tsx packages/core/src/lib/scheduler/simulation-participant.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: PASS with one Advance registration per awake world and none per body/collider.

- [ ] **Step 8: Commit world/component ownership**

  ```bash
  git add packages/physics/src/lib/2d/runtime/descriptors.ts packages/physics/src/lib/2d/runtime/descriptors.test.tsx packages/physics/src/lib/2d/runtime/context.ts packages/physics/src/lib/2d/runtime/controller.ts packages/physics/src/lib/2d/runtime/controller.test.tsx packages/physics/src/lib/2d/runtime/world-component.ts packages/physics/src/lib/2d/runtime/world-component.test.tsx packages/physics/src/2d.ts
  git commit -m "feat(physics): mount transactional 2d worlds"
  ```

### Task 12: Infer every Canvas collider and apply physics presentation

**Files:**

- Create: `packages/physics/src/lib/2d/canvas/inference.ts`
- Create: `packages/physics/src/lib/2d/canvas/inference.test.tsx`
- Create: `packages/physics/src/lib/2d/canvas/presentation.ts`
- Create: `packages/physics/src/lib/2d/canvas/presentation.test.tsx`
- Create: `packages/physics/src/lib/2d/canvas/components.ts`
- Create: `packages/physics/src/lib/2d/canvas/components.test.tsx`
- Create: `packages/physics/src/lib/2d/canvas/custom.ts`
- Create: `packages/physics/src/lib/2d/canvas/custom.test.tsx`
- Modify: `packages/physics/src/lib/2d/runtime/descriptors.ts`
- Modify: `packages/physics/src/2d.ts`

**Interfaces:**

- Consumes: resolved primitive identity/style from Task 2, Task 4 shape factories, committed/presentation body pose, and existing core path/style behavior.
- Produces: complete current-primitive inference, dynamic presentation delta, matching shape components, and `withPhysicsShape2D`.

- [ ] **Step 1: Write the failing inference matrix**

  Render each current core primitive under a body attachment and assert its private normalized collider leaves: rectangle/rounded rectangle, circle, ellipse, arc with stroke radius, wedge, convex/concave/rounded polygon, regular polygon, star, all line variants, and eligible SVG path. Assert opaque `Path`, text without declared stable box, and image without declared stable bounds require an explicit shape before acquisition.

- [ ] **Step 2: Run inference tests and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/canvas/inference.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because primitive inference is absent.

- [ ] **Step 3: Implement identity-based inference from resolved style**

  Use direct imported component identity comparisons, never component-name dispatch or an import-time registry. Reuse CRC's existing numeric geometry helpers where their output is stable and public; copy the resolved numeric result into physics-owned shapes. Flatten rounded/curved contours and triangulate concavity with Task 4 policy. Preserve line source order and SVG contour order.

- [ ] **Step 4: Write failing pose-authority and presentation tests**

  Assert initial pixels remain in authored placement, a committed dynamic pose produces one root-logical delta, and changing authored dynamic pose while enabled reports a diagnostic rather than teleporting. Assert static authored updates, kinematic snapshot/signal targets, disabled animation ownership, re-enable handoff, nested Group transforms, layout placement, Clip, Layer, filter silhouette, click target, and focus bounds all align with presented pixels.

- [ ] **Step 5: Implement local/world pose conversion and presentation delta**

  Capture the initial body world transform and body-local origin after layout/style resolution. For dynamic rendering compute `parentWorldInverse * presentedBodyWorld * inverse(initialBodyLocal)` and pass that DOMMatrix through the core attachment presentation seam. Reject noninvertible/skewed/non-rigid dynamic ancestor transforms; bake finite authored scale into collider geometry and keep scale out of body pose.

- [ ] **Step 6: Implement matching Canvas components and custom adapter**

  `Capsule2D`, `Segment2D`, and `Chain2D` create deterministic `Path2D` paint geometry, draw it through the public Canvas primitive contract, and register that exact path through `crcEventTarget`; copy core's documented opacity, fill, stroke, cursor, focus-bound, and line-interaction semantics without importing a source or `lib/*` path. `PhysicsShape2D` dispatches every public shape record without exposing its private record. `withPhysicsShape2D` returns a new primitive value carrying one pure resolved-style shape resolver in value-owned metadata; reject hooks, async results, non-shapes, and resolver mutation.

- [ ] **Step 7: Run Canvas integration regressions**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/canvas packages/core/src/lib/backend/physics-presentation.test.tsx packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with one component traversal and no pixel/GPU readback.

- [ ] **Step 8: Commit inference and presentation**

  ```bash
  git add packages/physics/src/lib/2d/canvas/inference.ts packages/physics/src/lib/2d/canvas/inference.test.tsx packages/physics/src/lib/2d/canvas/presentation.ts packages/physics/src/lib/2d/canvas/presentation.test.tsx packages/physics/src/lib/2d/canvas/components.ts packages/physics/src/lib/2d/canvas/components.test.tsx packages/physics/src/lib/2d/canvas/custom.ts packages/physics/src/lib/2d/canvas/custom.test.tsx packages/physics/src/lib/2d/runtime/descriptors.ts packages/physics/src/2d.ts
  git commit -m "feat(physics): integrate 2d colliders with canvas"
  ```

### Task 13: Add body handles, commands, sensors, and ordered events

**Files:**

- Create: `packages/physics/src/lib/2d/runtime/body-handle.ts`
- Create: `packages/physics/src/lib/2d/runtime/body-handle.test.tsx`
- Create: `packages/physics/src/lib/2d/runtime/events.ts`
- Create: `packages/physics/src/lib/2d/runtime/events.test.tsx`
- Modify: `packages/physics/src/lib/2d/runtime/controller.ts`
- Modify: `packages/physics/src/lib/2d/runtime/descriptors.ts`
- Modify: `packages/physics/src/lib/2d/world/world.ts`
- Modify: `packages/physics/src/lib/2d/world/queries.ts`
- Modify: `packages/physics/src/2d.ts`

**Interfaces:**

- Consumes: component-owned controller, generation IDs, kernel commands/query functions, and Complete ordering.
- Produces: all public body/world hooks, named commands, world queries, lazy signals, sensors, and collision/overlap/sleep/wake events.

- [ ] **Step 1: Write failing handle binding and lazy-signal tests**

  Assert one hook slot returns stable handle identity, one handle binds to at most one body, removal unbinds exactly once, re-add increments generation, stale commands are inert, and no body signal exists until its accessor is first read. Once observed, assert position/velocity/sleep/enabled/generation publish atomically in the shared Commit.

- [ ] **Step 2: Run handle tests and observe failure**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/runtime/body-handle.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: FAIL because handles and commands are absent.

- [ ] **Step 3: Implement generation-bound handles and Begin commands**

  Copy force/impulse/point/velocity/pose arrays at call time, capture current binding generation, and queue through the owner-safe Begin seam. Apply commands in realm sequence order. `disable` removes active colliders/contacts while retaining allocation; `enable` re-enters at authored pose with default zero velocity or explicit preserve; teleport updates broad-phase proxies and wakes the island.

- [ ] **Step 4: Write failing sensor and event-order tests**

  Cover solid collision start/end/hit, sensor overlap start/end, sleep/wake, a pair that begins and ends during three catch-up ticks, both subscribed sides, handler removal, callback throwing, owner removal before Complete, tags, self-oriented normals, immutable records, and callback commands deferred to next Begin.

- [ ] **Step 5: Materialize and deliver observed events only**

  Keep numeric event facts in candidate buffers. After Commit adoption, sort by tick, semantic event ordinal, pair identity, and receiver identity; then create frozen public handles/points/records only for live subscribed receivers. Queue each delivery through Complete, call the collider/world callback order fixed by the normalized descriptor, collect callback failures, and suppress stale generations.

- [ ] **Step 6: Expose deterministic world queries**

  Validate a live world handle, read committed kernel state only, apply mode overload semantics, lazily materialize body/collider handles for results, and never request a frame. A reactive component explicitly reads `world.revision.get()` before querying.

- [ ] **Step 7: Run handles, events, queries, and scheduler ordering tests**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/runtime/body-handle.test.tsx packages/physics/src/lib/2d/runtime/events.test.tsx packages/physics/src/lib/2d/world/queries.test.ts packages/core/src/lib/scheduler/simulation-participant.test.tsx --browser.headless --browser.ui=false
  ```

  Expected: PASS with no event allocation for unobserved worlds.

- [ ] **Step 8: Commit public control and event APIs**

  ```bash
  git add packages/physics/src/lib/2d/runtime/body-handle.ts packages/physics/src/lib/2d/runtime/body-handle.test.tsx packages/physics/src/lib/2d/runtime/events.ts packages/physics/src/lib/2d/runtime/events.test.tsx packages/physics/src/lib/2d/runtime/controller.ts packages/physics/src/lib/2d/runtime/descriptors.ts packages/physics/src/lib/2d/world/world.ts packages/physics/src/lib/2d/world/queries.ts packages/physics/src/2d.ts
  git commit -m "feat(physics): add 2d commands queries and events"
  ```

### Task 14: Add the public 2D physics laboratory and animation handoff lesson

**Files:**

- Create: `packages/scenarios/src/physics-2d-lab.example.tsx`
- Create: `packages/scenarios/src/physics-2d-lab.ts`
- Create: `packages/scenarios/src/learning/composition/physics-2d.example.tsx`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/scenarios/package.json`
- Create: `packages/core/test/physics-2d-lab.test.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: the complete public `@crc/physics/2d` surface only.
- Produces: one presentation-neutral proving scenario shared by Studio/headless tests and one concise public learning example.

- [ ] **Step 1: Write the failing headless scenario test**

  Import the scenario controller rather than duplicating its scene. Drive reset, settle, impulse, sensor crossing, kinematic platform movement, query, disable, animation transfer, re-enable, and owner removal actions. Assert authoritative body poses/velocities, contact/overlap sequence, query tags, sleep state, world revision, presented-vs-authoritative offset bound, and one shared scheduler frame.

- [ ] **Step 2: Run the scenario test and observe missing catalog entries**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-2d-lab.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL because the physics scenario and catalog registration do not exist.

- [ ] **Step 3: Build the deterministic laboratory scene**

  Use a fixed logical viewport and explicit gravity. Include a static ground/container, dynamic circle, box, ellipse, capsule, convex polygon and star compound, ground-check sensor, animated kinematic platform, and a disabled/animated/re-enabled ball. Expose scenario actions through handles and named commands; do not expose a manual world step.

- [ ] **Step 4: Keep the animation/physics ownership transfer explicit**

  The transfer action snapshots presentation pose, calls `disableBody2D`, starts a CRC tween on authored position after disable admission, and calls `enableBody2D({ velocity: "zero" })` from completion for next Begin. The platform uses `kinematicBody2D` target signals tracked by CRC animation so physics reads the staged value in its later Advance lane.

- [ ] **Step 5: Add semantic and visual evidence**

  Assert each action's structured snapshot before adding one stable screenshot for the default settled scene and one for the animation-handoff destination. Mask no physics geometry. If a platform pixel differs, inspect expected/actual/diff and record the cause before any intentional baseline update.

- [ ] **Step 6: Add the concise learning example**

  Show one `Rectangle physics={staticBody2D()}`, one `Circle physics={dynamicBody2D()}`, one child `collider2D({ sensor: true })`, one impulse command, and a short note that dynamic root pose is physics-owned. Keep laboratory-only query/order controls out of the learning example.

- [ ] **Step 7: Run scenario, catalog, and learning checks**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-2d-lab.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 scenarios:check
  ```

  Expected: PASS using the same scenario implementation in Studio and headless execution.

- [ ] **Step 8: Commit the public proving scenario**

  ```bash
  git add packages/scenarios/src/physics-2d-lab.example.tsx packages/scenarios/src/physics-2d-lab.ts packages/scenarios/src/learning/composition/physics-2d.example.tsx packages/scenarios/src/catalog.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/index.ts packages/scenarios/package.json packages/core/test/physics-2d-lab.test.ts docs/scenario-index.md
  git commit -m "test(physics): add public 2d physics laboratory"
  ```

### Task 15: Lock lifecycle ownership and structural performance

**Files:**

- Create: `packages/core/test/physics-ownership.test.ts`
- Create: `packages/core/test/physics-performance.test.ts`
- Modify: `packages/physics/src/lib/2d/runtime/ownership.ts`
- Modify: `packages/physics/src/lib/2d/runtime/controller.ts`
- Modify: `packages/physics/src/lib/2d/world/storage.ts`
- Modify: `packages/physics/src/lib/2d/world/broad-phase.ts`
- Modify: `packages/physics/src/lib/2d/world/solver.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: source-only ownership/work snapshots and the public laboratory.
- Produces: exact resource balance and structural-work gates included in repository lifecycle/performance scripts.

- [ ] **Step 1: Write failing ownership tests from a captured baseline**

  Mount/update/key-replace/reparent/remove/dispose worlds, bodies, compound colliders, sensors, handles, observed signals, queued commands, candidates, events, and cached shapes. Inject render and Advance failures at every acquisition boundary. After final disposal assert active counts equal baseline and acquired minus released is zero for each owned resource.

- [ ] **Step 2: Run ownership tests and observe missing counters or leaks**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-ownership.test.ts --browser.headless --browser.ui=false
  ```

  Expected: FAIL until every listed resource has exact counter evidence and cleanup.

- [ ] **Step 3: Close lifecycle paths in `finally`**

  Ensure failed descriptor validation acquires nothing; failed topology retains prior committed state; failed candidate returns all journals/scratch; owner teardown cancels registrations/commands/completions; handle signals detach; shape-cache references decrement; and queued stale event deliveries release without invoking callbacks.

- [ ] **Step 4: Write failing structural performance assertions**

  Warm one world with 1,000 dynamic circles and 10,000 static boxes partitioned spatially. Assert one world Advance registration, zero per-body scheduler registrations, moved-proxy work proportional to moved bodies, narrow-phase work proportional to broad-phase candidates, sleeping-island exclusion, zero unobserved event records, stable hot-pool capacities after warm-up, and one root render per committed presentation generation.

- [ ] **Step 5: Add source-only work and allocation counters**

  Count tree insert/remove/query nodes, generated pairs, narrow-phase pairs, manifolds, constraint rows, islands, CCD casts, fixed ticks, presentation poses, public result records, and pool growth. Counters must not choose behavior and must be removable from production bundles by tree shaking/minification.

- [ ] **Step 6: Run lifecycle and performance gates**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-ownership.test.ts packages/core/test/physics-performance.test.ts --browser.headless --browser.ui=false
  corepack pnpm@11.21.0 test:lifecycle
  corepack pnpm@11.21.0 test:performance
  ```

  Expected: PASS. Wall-clock measurements may be reported but do not replace structural assertions.

- [ ] **Step 7: Commit ownership and performance evidence**

  ```bash
  git add packages/core/test/physics-ownership.test.ts packages/core/test/physics-performance.test.ts packages/physics/src/lib/2d/runtime/ownership.ts packages/physics/src/lib/2d/runtime/controller.ts packages/physics/src/lib/2d/world/storage.ts packages/physics/src/lib/2d/world/broad-phase.ts packages/physics/src/lib/2d/world/solver.ts package.json
  git commit -m "test(physics): lock ownership and structural cost"
  ```

### Task 16: Complete package, tree-shaking, typing, and Studio consumers

**Files:**

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

- Consumes: built `@crc/core` and `@crc/physics` packages plus the fixed public surface.
- Produces: Bundler, NodeNext, packed, runtime, editor, optional-peer, and tree-shaking evidence.

- [ ] **Step 1: Add failing source-consumer assertions**

  Import every public runtime value/type from its supported subpath, author JSX and equivalent `createElement`, exercise one geometry-only calculation, and prove wrong-dimension/lookalike attachments fail typing. Add a custom component that explicitly forwards `physics` and another that does not.

- [ ] **Step 2: Run type consumers and observe missing declarations**

  ```bash
  corepack pnpm@11.21.0 run test:package-consumer
  ```

  Expected: FAIL until package exports, declarations, JSX augmentation, and runtime imports agree.

- [ ] **Step 3: Extend packed-package verification**

  Pack physics beside types/core. Run two offline strict-peer consumers: geometry-only installs physics alone; world-facing installs matching core and physics. Assert tarballs contain both entry declarations/maps, no source, no WebGL, one core identity, optional peer metadata, and no bundled core implementation markers.

- [ ] **Step 4: Add tree-shaking metafile assertions**

  Bundle `circleShape2D` from `/geometry` and assert no world, scheduler, collider, event, Canvas component, or core input appears. Bundle `dynamicBody2D` from `/2d` and assert no 3D/WebGL/joints/debug/replay module appears. Bundle a complete world and assert exactly one core package root.

- [ ] **Step 5: Update Studio editor declarations and API export fixtures**

  Add the two subpath declarations, module augmentation, JSX examples, named types, and expected API-page mapping. Verify source and built Studio modes resolve the same public surface without exposing test-lab metadata.

- [ ] **Step 6: Run consumer, package, type, and Studio gates**

  ```bash
  corepack pnpm@11.21.0 run typecheck
  corepack pnpm@11.21.0 run build
  corepack pnpm@11.21.0 run test:package-consumer
  corepack pnpm@11.21.0 run test:package-consumer:packed
  corepack pnpm@11.21.0 run playground:build
  corepack pnpm@11.21.0 run playground:build:built
  ```

  Expected: PASS with geometry-only, core+physics, source Studio, and built Studio consumers.

- [ ] **Step 7: Commit consumer and package evidence**

  ```bash
  git add playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/package-consumer/tsconfig.bundler.json playground/package-consumer/tsconfig.nodenext.json playground/src/crc-editor-types.txt tooling/verify-packed-consumer.mjs tooling/verify-studio-types.mjs tooling/studio-docs/api-exports.ts tooling/studio-docs/api-exports.check.ts package.json pnpm-lock.yaml
  git commit -m "test(physics): verify public 2d package consumers"
  ```

### Task 17: Update normative contracts and public documentation

**Files:**

- Create: `docs/site/api/components/physics-world-2d.md`
- Create: `docs/site/api/components/physics-shape-2d.md`
- Create: `docs/site/api/functions/physics-2d.md`
- Create: `docs/site/api/hooks/crc-physics-body-2d.md`
- Create: `docs/site/api/hooks/crc-physics-world-2d.md`
- Create: `docs/site/api/types/physics-2d.md`
- Create: `docs/site/learn/guides/physics-2d.md`
- Create: `docs/testing/field-notes/2026-09-14-first-class-physics-2d.md`
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
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`
- Modify: `tooling/verify-docs.mjs`
- Modify: `tooling/docs-contract-preservation-baseline.json`

**Interfaces:**

- Consumes: verified behavior and exact public names from Tasks 1–16.
- Produces: current normative contracts, Learn/API documentation, package/root status, agent context, and dated testing evidence.

- [ ] **Step 1: Add failing documentation/export checks**

  Require one API location for every new runtime value/type, require links from package/root docs and the physics guide, reject root namespace examples, require geometry-only examples to import `/2d/geometry`, and require world examples to show one shared CRC scheduler with no `step()` or private loop.

- [ ] **Step 2: Run documentation checks and observe missing pages**

  ```bash
  node tooling/verify-docs.mjs
  corepack pnpm@11.21.0 docs:check
  corepack pnpm@11.21.0 studio-docs:check
  ```

  Expected: FAIL on unmapped physics exports and missing current contracts/pages.

- [ ] **Step 3: Update scheduling, animation, and ownership contracts**

  Record animation-before-physics lanes, one awake-world registration, shared Commit, fixed-tick/clamp/interpolation semantics, candidate adoption, dynamic/kinematic/disabled pose authority, topology admission, callbacks in Complete, exact world/body/collider/handle/event ownership, and failure isolation.

- [ ] **Step 4: Update drawing, style, layout, surface, and interaction contracts**

  Record the `physics` augmentation seam, full current primitive inference matrix, explicit opaque geometry, matching shape components, root-logical coordinate mapping, body initial placement, Group/Clip/Layer/filter composition, and presentation-pose alignment for paint/pointer/focus while queries remain authoritative.

- [ ] **Step 5: Write the public guide and API pages**

  Explain world/body/collider/shape anatomy, fused default, compound sensors, standalone geometry, gravity/units, commands/handles, query modes, fixed ticks under arbitrary rendering, determinism limits, animation handoff, kinematic platforms, performance, and unsupported 3D/joints/replay. Every example must compile through the docs verifier.

- [ ] **Step 6: Record field evidence and refresh preservation baselines deliberately**

  Record browser/version, focused and aggregate commands, observed numeric tolerances, visual-diff inspection, failure injections, flakes, discarded approaches, and reusable test-tool opportunities. Update preservation statements only for reviewed normative additions; do not absorb unrelated contract drift.

- [ ] **Step 7: Run documentation and link verification**

  ```bash
  node tooling/verify-docs.mjs
  corepack pnpm@11.21.0 docs:check
  corepack pnpm@11.21.0 studio-docs:check
  corepack pnpm@11.21.0 lint:format
  ```

  Expected: PASS with all new API snippets compiler-checked.

- [ ] **Step 8: Commit contracts and documentation**

  ```bash
  git add docs/site/api/components/physics-world-2d.md docs/site/api/components/physics-shape-2d.md docs/site/api/functions/physics-2d.md docs/site/api/hooks/crc-physics-body-2d.md docs/site/api/hooks/crc-physics-world-2d.md docs/site/api/types/physics-2d.md docs/site/learn/guides/physics-2d.md docs/testing/field-notes/2026-09-14-first-class-physics-2d.md docs/design/signals-and-scheduling-contract.md docs/design/animation-contract.md docs/design/runtime-hooks-contract.md docs/design/drawing-components-contract.md docs/design/style-system-contract.md docs/design/layout-system-contract.md docs/design/canvas-surface-contract.md docs/design/user-events-contract.md docs/design/focus-and-keyboard-navigation-contract.md docs/design/mouse-interaction-contract.md docs/design/event-resource-ownership.md docs/design/runtime-resource-ownership.md README.md packages/core/README.md docs/library-status.md AGENTS.md tooling/verify-docs.mjs tooling/docs-contract-preservation-baseline.json
  git commit -m "docs(physics): document first class 2d physics"
  ```

### Task 18: Run final browser, package, lifecycle, and aggregate trust gates

**Files:**

- Modify only if evidence reveals a defect: files already named by Tasks 1–17
- Modify: `docs/testing/field-notes/2026-09-14-first-class-physics-2d.md`

**Interfaces:**

- Consumes: the complete implementation and repository trust contract.
- Produces: fresh final evidence and a clean, reviewable project boundary for the separate 3D plan.

- [ ] **Step 1: Run the pure geometry and kernel suites in Node**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/shapes.test.ts packages/physics/src/lib/2d/collision packages/physics/src/lib/2d/world --browser.enabled=false --environment node
  ```

  Expected: PASS with zero failed tests.

- [ ] **Step 2: Run focused browser integration, ownership, and performance suites**

  ```bash
  corepack pnpm@11.21.0 exec vitest run packages/physics/src/lib/2d/runtime packages/physics/src/lib/2d/canvas packages/core/test/physics-2d-lab.test.ts packages/core/test/physics-ownership.test.ts packages/core/test/physics-performance.test.ts --browser.headless --browser.ui=false
  ```

  Expected: PASS with one shared scheduler and all ownership counts returned to baseline.

- [ ] **Step 3: Run static, package, and built-mode gates**

  ```bash
  corepack pnpm@11.21.0 trust:static
  corepack pnpm@11.21.0 trust:package
  corepack pnpm@11.21.0 test:smoke:built
  ```

  Expected: PASS in source, packed, and built consumption modes.

- [ ] **Step 4: Run browser and lifecycle gates**

  ```bash
  corepack pnpm@11.21.0 trust:browser
  corepack pnpm@11.21.0 trust:lifecycle
  ```

  Expected: PASS. Inspect physics expected/actual/diff artifacts even when the visual runner reports success.

- [ ] **Step 5: Run the aggregate repository gate**

  ```bash
  corepack pnpm@11.21.0 trust
  ```

  Expected: exit code 0 on the documented Node/pnpm/Chromium environment.

- [ ] **Step 6: Review the final diff and public bundle boundaries**

  Confirm no unrelated files are staged, no external physics dependency exists, no root `@crc/physics` or 3D export leaked in, geometry imports load no core, all public names have docs/tests, and generated/baseline changes have recorded reasons.

- [ ] **Step 7: Append exact final evidence and commit the record**

  ```bash
  git add docs/testing/field-notes/2026-09-14-first-class-physics-2d.md
  git commit -m "docs(testing): record 2d physics trust evidence"
  ```

## Completion Criteria

This plan is complete only when:

- `@crc/physics/2d/geometry` installs and executes without core, DOM, Canvas, WebGL, or scheduler code and exposes the complete immutable shape/operation surface fixed here.
- `@crc/physics/2d` provides world, body/collider, sensor, handle/command, query/event, inference, and matching-renderer behavior exclusively through named tree-shakable exports.
- Every existing inspectable Canvas shape has deterministic collider inference, and every public physics shape has direct or generic CRC Canvas rendering.
- One realm frame always runs animation Advance before physics Advance, commits once, plans/renders once, and uses no second host loop.
- Fixed ticks, catch-up clamp, interpolation, topology admission, rollback, public ordering, and numeric tolerances have deterministic executable evidence.
- Dynamic, static, kinematic, disabled, and animation-handoff pose authority match the approved design with actionable diagnostics for conflicts.
- The broad phase, narrow phase, solver, sleeping, CCD, queries, and internal algorithms pass isolated tests without becoming public compatibility APIs.
- Lifecycle counters balance under success, failure, replacement, reparenting, removal, and disposal; structural tests prove one registration per awake world and allocation-stable hot loops.
- The exact public scenario is usable in Studio and driven headlessly; semantic assertions precede reviewed visual evidence.
- Bundler, NodeNext, packed, source Studio, built Studio, documentation, browser, lifecycle, performance, and aggregate trust gates pass freshly on the documented environment.
- The testing field note records commands, environment, results, tolerances, visual inspection, failures, and reusable lessons.

## Follow-on Plan Boundaries

After this plan completes, write and approve separate executable plans in this order:

1. **Baseline 3D rigid bodies:** `/3d/geometry`, sphere, ellipsoid, box, capsule, convex hull, static mesh BVH, quaternion/inertia solver, `Cube`/`Sphere`/`Mesh` inference, settled WebGL presentation/picking, and context-loss evidence.
2. **Extended shapes and terrain:** cylinder, cone, heightfield, reduced-piece 2D decomposition tooling, extended mesh tooling, and matching render components.
3. **Joints and motors:** dimension-specific `/joints` subpaths, constraints, signal-bound motors, break events, and dependent ownership.
4. **Diagnostics and replay:** `/debug` renderers, versioned `/replay` snapshots, Begin-only restore, recording, rollback, and state-hash evidence.
5. **Possible 2.5D conversion:** only after concrete use cases justify explicit extrusion or plane-constrained 3D bodies; never by coupling live 2D and 3D solvers.

Each follow-on plan must read the implemented contracts and fresh evidence from this plan rather than assuming the planned private seams survived unchanged.
