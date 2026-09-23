# First-class 3D physics delivery field note

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence for
> the named candidate and environment, not current API guidance or reusable test
> totals.

Delivery verification date: 2026-09-16

Branch: `codex/first-class-physics-3d`

Integration base: `4e9e990` (`docs(webgl): record lighting delivery evidence`)

Verified implementation revision before this evidence-only note: `ee4fe30`

## Delivered scope

The completed work adds first-class deterministic 3D physics to
`@crc/physics/3d` and pure geometry to `@crc/physics/3d/geometry`. It preserves
CRC's component-owned lifecycle and realm scheduler: mounted worlds contribute
one simulation participant, fixed ticks run in the scheduler's simulation
lane, and successful commits publish one coherent pose/revision generation for
WebGL render, pick, and focus settlement.

The public surface covers immutable sphere, box, ellipsoid, capsule, cylinder,
cone, convex-hull, triangle-mesh, heightfield, and transformed shape records;
deterministic contact, ray, shape-cast, overlap, mass-property,
rigid-body, collider, material, filter, event, query, command, and handle APIs;
declarative `PhysicsWorld3D`; `dynamicBody3D`, `staticBody3D`, `kinematicBody3D`,
and `collider3D` descriptors; shape components; and the `crcPhysicsWorld3D` and
`crcPhysicsBody3D` hooks.

Multiple `collider3D` descriptors can compose one body's compound mass and
collision behavior; there is no separate public compound-shape factory.

WebGL Cube, Sphere, Mesh, and Group3D declarations infer exact physics shape and
pose information through the official version-coupled friend seam. Dynamic
simulation pose is authoritative for rendering, picking, and focus. Kinematic
partial targets retain the last accepted counterpart, while disabling restores
authored ownership and re-enabling seeds from the complete authored pose.

The public Studio laboratory at `#/testing/physics-3d` shows every supported
shape and exposes deterministic reset, settle, drop, query, grab, drag, throw,
impulse, teleport, disable, authored move, re-enable, sleep, wake, remove, and
remount actions. Its replay evidence locks action/query, contact, sensor, pose,
generation, and lifecycle behavior through public APIs.

The implementation has no external physics engine, WASM or worker runtime, a
second animation loop, or public manual `world.step()` escape hatch. Moving
triangle meshes and heightfields, soft bodies, fluids, joints, character
controllers, and worker execution remain outside this delivery.

## Integration and review record

Tasks 1–7 were completed before the WebGL lighting delivery landed. At the
approved checkpoint the same branch and worktree were rebased onto `4e9e990`;
the complete 2D and 3D history was retained. Conflicts were resolved in favor
of current public code, tests, and contracts, preserving lighting/material/
background semantics together with physics extension identity and authored
transform lineage.

Implementation proceeded in a visible vertical slice before exhaustive
hardening. The complete shape scene was made available in the live Studio, then
the convex, concave, solver, inference, authority, replay, ownership, package,
documentation, and trust surfaces were hardened. Independent scoped reviews
required corrections for numeric topology, transaction rollback, inference
cache identity, partial kinematic targets, public lifecycle evidence,
documentation examples, and teardown proofs. Each scoped correction was
re-reviewed with no remaining blocking finding before final integration review.

The Task 14 plan's instruction to reference-count shape, BVH, and render-geometry
caches was superseded during implementation by the current normative ownership
contract: these immutable descriptor-derived values use descriptor-keyed
`WeakMap` caches and are deliberately not reference-counted runtime resources or
observable garbage-collection contracts. Runtime-owned stores, broad-phase
state, contact caches, solvers, materialized handles, and scheduler registration
retain explicit acquisition and teardown evidence.

## Reviewed visual evidence

The 3D physics laboratory deliberately uses unlit materials so the entire shape
matrix remains visible without coupling the physics demonstration to a lighting
setup. Rebase verification retained the current lighting defaults and corrected
only fixtures that intentionally exercise unlit geometry.

Three existing Studio shell baselines changed because the new 3D physics guide
and API material expand navigation/search content: `studio-learn-landing`,
`studio-api-crc`, and `studio-search-open`. Expected, actual, and diff images
were inspected before those expected images were updated. The final visual
safeguard rejected its deliberate mutation and recovered green; the diagram
editor teaser had zero differing pixels; all nine Studio visual baselines
matched.

## Focused evidence

Fresh Node.js `v24.15.0` evidence included:

- the final pure 3D geometry/collision/world selection: 21 files and 259 tests;
- the focused public runtime/WebGL/laboratory selection: 14 files and 87 tests;
- package consumers across source, built, packed, Bundler, and NodeNext modes,
  with 48 public 3D values and 18 geometry-only values;
- Studio declaration parity with 303-type structural coverage;
- ten complete public remounts plus 1,000 mounted remove/adopt/remount
  transitions, ending at generation 1,001 with no live resources or stale
  handles; and
- structural evidence for one scheduler participant across 1,000 separated
  bodies, sleeping exclusion, stable capacities, exact moved/candidate counts,
  and 5,000-triangle mesh plus 5,000-triangle heightfield BVHs.

Repository scans found no external engine, WASM, Worker, timer, or independent
animation-frame loop in 3D production source; no public manual world step; and
no production import through an `@crc/physics` root barrel. The package exposes
only `./2d`, `./2d/geometry`, `./3d`, and `./3d/geometry`, with optional peer
relationships to matching Core and WebGL packages.

## Aggregate trust evidence

The authoritative final command ran from the clean candidate with Node.js
`v24.15.0` and pnpm `11.21.0`:

```sh
fnm exec --using=24.15.0 -- corepack pnpm@11.21.0 trust
```

It exited zero. Fresh output recorded:

- 66 lessons, 12 tutorial snapshots, and 23 deterministic test laboratories;
- 14 guides, 165 current/migration documents, 86 historical/work records, and
  all 997 documentation mutation probes;
- typecheck, lint/format, all package builds, source and built Studio builds,
  Studio documentation acceptance, and production-boundary checks;
- packed Core/WebGL friend identity plus source, built, packed, Bundler, and
  NodeNext consumer checks;
- the complete bounded-concurrency browser suite: 255 files, 3,197 passed and
  2 intentionally skipped tests of 3,199;
- Studio documentation, visual safeguard, all 9 Studio visual baselines, and
  built-package smoke: 2 files and 4 tests;
- lifecycle: 8 files and 37 tests; and
- structural performance: 7 files, 40 passed and 2 opt-in wall-clock tests
  intentionally skipped.

The non-fatal output consisted of the repository's existing future Vite native
loader extension notices, ineffective dynamic-import notices, and large-chunk
notices. None changed the zero exit status.

## Browser-visible checkpoint

The isolated worktree Studio served the public laboratory at
`http://127.0.0.1:56724/#/testing/physics-3d`. The complete all-shape scene was
made visible before the later exhaustive hardening and trust work, matching the
explicit delivery order for this branch. The automated public action laboratory,
headless browser coverage, and reviewed Studio shell evidence provide the final
repeatable verification record.
