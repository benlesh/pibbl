# 2D physics repair: implementation and verification

> **Historical status: DATED IMPLEMENTATION EVIDENCE.** Measurements and verification below describe this repair, not universal engine guarantees.

Date: 2026-09-29. Branch: `codex/physics-2d-quality`.

## Decision and algorithm

Public worlds now use pinned Rapier 2D compat 0.21.0 (Apache-2.0), with its
license included in the package. CRC retains the shared scheduler, identity,
commands, presentation, pure queries and rollback. The engine handles solid
contacts and integration. We compared the repaired CRC reference solver,
Planck 1.5.0, bare Rapier and the CRC/Rapier integration. This is a selected
implementation, not a public engine-selection framework.

The existing CRC sequential-impulse solver did not reliably settle larger piles.
Its initial drop issue was fixed before comparison: support impulses precede
position integration, restitution avoids repeatedly exciting a resting contact,
and capsule sides produce support faces. Public worlds use Rapier; the private
reference remains to reproduce the comparison rather than serving applications.

Rapier provides engine-state snapshots, which fit CRC's failed-frame rollback
contract. [Rapier serialization](https://rapier.rs/docs/user_guides/javascript/serialization/)
documents that facility. Replay tests restore both engine and CRC state. This
is a same-version/same-input claim; CRC's own geometry uses JavaScript
trigonometry, so this work does not claim arbitrary cross-platform bitwise
identity. See [Rapier's determinism constraints](https://rapier.rs/docs/user_guides/javascript/determinism/).

CCD motion clamping alone was insufficient for opposing fast dynamic bodies in
our pinned-engine reproduction. Bounded substeps account for velocity,
acceleration, rotation about the center of mass and each convex leaf's smallest feature. Exhausting the
64-step budget rolls back instead of silently tunneling. Intermediate impact
facts survive separation within the tick for public callbacks. Sensors remain
discrete. [Rapier CCD](https://rapier.rs/docs/user_guides/javascript/rigid_body_ccd/)
and [Box2D simulation guidance](https://box2d.org/documentation/md_simulation.html)
provide external context; executable tests define this adapter's exact behavior.

## Recorded performance

Machine: Apple M5 Max, macOS arm64, Node 24.15.0. The reproducible runner uses
600 fixed ticks, excludes the first 60 from timing, and reports natural sleep.
Full JSON: [integrated benchmark](2026-09-29-physics-2d-integrated-benchmark.json).
No wall-clock CI threshold is inferred from this machine.

| Workload                               | CRC reference p95 | CRC + Rapier p95 | Bare Rapier p95 |
| -------------------------------------- | ----------------: | ---------------: | --------------: |
| 1,000-box settling pile                |          19.56 ms |          7.50 ms |         1.17 ms |
| 100 awake bodies + 1,001 static bodies |           1.27 ms |          1.48 ms |         0.19 ms |

All 1,000 integrated Rapier bodies slept; the CRC reference slept 16 and Planck
slept 22 in this particular grid scene. None escaped. These results do not
establish universal engine superiority. The static-heavy case remains slower
than the reference because engine snapshots and the adapter have real costs.
Skipping unchanged static-body synchronization reduced its measured integrated
p95 from about 1.86 ms to 1.48 ms in consecutive runs.

`crc-rapier` includes CRC kernel/transaction work; bare engines do not. These
measurements exclude Canvas painting and public signal publication. Public
structural tests additionally verify per-body reads avoid full-world snapshots,
idle worlds request no frames, passive participants share the scheduler, and
keyed removal/rollback/disposal release owned resources.

The built runtime entry is about 3.81 MB uncompressed / 1.35 MB gzip, including
embedded WASM but excluding small shared chunks. One fresh Node 24 import took
40.8 ms on this machine; this is not a browser/network startup guarantee. The
[recorded startup sample](2026-09-29-physics-2d-startup.json) is explicit about
scope. Pure geometry avoids WASM; runtime imports require ESM/top-level await.

## Public behavior repaired

- The real lab settles naturally; its observation action does not force sleep.
  Sensor crossing uses velocity, and presentation probes read actual drawing
  transforms rather than reporting an artificial zero offset.
- `space="local"` lets reusable worlds move/scale with their viewports while
  keeping physics identity and velocity. Pointer conversion is explicit.
- Frame-end kinematic targets distribute over accepted catch-up ticks. A moving
  platform/passenger regression compares 30 and 60 Hz display cadence.
- Inline callbacks retain collider identity and no longer keep resting worlds
  active. Complete delivers the latest surviving handler; removal still suppresses
  delivery. Fast CCD impacts include public start/hit/end callbacks.
- Dragging captures the exact body's displayed pose through the handle-targeted
  inspection overload, preserving off-center grabs under Canvas scaling and
  interpolation. Multiple draggable components do not select one another.
- Compound COM updates stay aligned, engine-range/geometry-complexity limits fail
  explicitly, and per-body presentation/handle access no longer snapshots all
  bodies. Reference broad-phase/geometry tests remain in the suite.
- `inspectPhysics2D`, `PhysicsDebug2D`, and `@crc/physics/2d/testing` support public
  observations and deterministic isolated browser tests. The harness restores
  the clock on disposal and failed reset.
- Searchable public API/guide pages cover all 2D exports, including units,
  ownership, approximation, query timing, loading and CCD limits. Studio and
  packed package consumers exercise the public declarations.

## Scope and acceptance

This repairs the existing rigid-body feature, its composition, tests and
observability. It does not add joints, a character controller, swept sensors,
network persistence, workers, or a second scheduler. No claim of full Box2D or
Rapier feature parity is made. Reference trajectories intentionally change under
the selected solver; public tests use appropriate tolerances.

Manual preview: `http://127.0.0.1:5173/#/examples/composition/physics-panels`.
The original laboratory remains at `#/testing/physics-2d`.

## Verification record

Environment: Node 24.15.0, pnpm 11.21.0, Playwright Chromium on macOS.

- `corepack pnpm@11.21.0 trust` was run. Scenario discovery/catalog validation,
  documentation checks and all 968 documentation mutation probes passed. The
  command then stopped at historical-status validation of the pre-existing
  untracked component-manipulation implementation plan. The corresponding design
  and a separate path-geometry design also lack required banners. Those unrelated
  documents were preserved. **The aggregate gate has not passed.**
- Remaining static gate commands were run separately: Studio documentation,
  production acceptance-code exclusion, typecheck, lint, package builds and
  source/built Studio builds passed. Exact public runtime/editor export parity
  passed. Final changed-code checks are recorded below when complete.
- Packed tarball consumers passed Bundler/NodeNext declarations, runtime exports,
  isolated pure geometry, shared core identity and package boundaries. The
  package-entry inventory was updated for `./2d/testing` and passed 3/3.
- Studio documentation browser navigation/search passed. Public testing reference
  pages are permitted in search; private `#/testing` routes and lab/scenario
  records remain excluded.
- Visual safeguard passed and preserved all baseline bytes during its rejection
  drill. The API-page visual changed intentionally: two new public physics pages
  add sidebar entries and move subsequent entries down. Expected and actual
  images were inspected; the 31,143-pixel difference is confined to that sidebar
  reflow. Only `studio-api-crc.expected.png` was updated. The next visual run
  matched all eight baselines. No simulation screenshot baseline was relaxed.

- Final full browser run: `corepack pnpm@11.21.0 test:ci` passed **253 files,
  3,002 tests**, with four intentional performance-guard skips. The scaled
  off-center drag remains strict: its production fix captures presentation pose
  instead of authority; no pixel tolerance was widened.
- `corepack pnpm@11.21.0 test:smoke:built` passed 1/1 after a fresh package build.
  `corepack pnpm@11.21.0 trust:package` passed with the final inspection overload.
  `node tooling/verify-studio-pivot.mjs` confirmed exact source/built/editor export
  parity and source/built runtime loading.
- `corepack pnpm@11.21.0 trust:lifecycle` passed: 8 ownership files / 31 tests,
  then 6 structural-performance files / 48 tests, with four opt-in guards skipped.
- Typecheck and ESLint passed on the final API/lesson work. A subsequent narrow
  review caught disabled-body type consistency in targeted inspection. After
  the correction, an independent run of inspection, every learning-example test
  and Rapier integration tests passed **225/225**. The physics package was rebuilt
  successfully. Formatting and `git diff --check` passed.

The aggregate gate remains blocked only at the unrelated historical-status
validation described above; it is not reported green.
