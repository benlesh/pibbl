# 2D physics audit — 2026-09-29

> **Historical status: PRE-REPAIR AUDIT.** These findings describe the original runtime. See [the repair evidence](2026-09-29-physics-2d-implementation.md) for subsequent changes.

Status: review and proposed work, not an approved replacement architecture.

## Assessment

The current 2D runtime is not ready to claim parity with established game-physics engines. The shipped lab loses every gravity-driven body through its floor within five seconds while all 218 focused existing tests pass. CRC's component ownership and scheduler integration are valuable; its numerical quality and public verification surface need substantially stronger evidence.

For agentic coding, the target is a component that can be composed, exercised, observed, and repaired using supported APIs. An agent should not need to discover solver constants, duplicate pose state, or import scheduler internals to prove a scene works.

## Fresh evidence and limits

- Environment: macOS, Node **26.9.0**, pnpm **11.21.0**, Playwright Chromium. Node differs from the documented Node 24.15+ LTS environment; this is diagnostic evidence, not a release trust-gate claim.
- Command: `corepack pnpm@11.21.0 exec vitest run packages/core/src/features/physics/lib/2d packages/core/test/physics-2d-lab.test.ts packages/core/src/lib/backend/physics-presentation.test.tsx --browser.headless --browser.ui=false --maxWorkers=4`.
- Result: **27 files, 218 tests passed**, 2.59 s. Public type-only tests are excluded by the existing Vitest configuration. No aggregate trust gate, package build, or cross-browser determinism claim was made.
- Opened `http://127.0.0.1:5173/#/testing/physics-2d` in the browser. Untouched bodies disappeared below the floor; the live circle state later showed downward velocity above 3,798 logical units/s.
- A temporary browser diagnostic mounted the actual public lab controller, attached its canvas, installed the existing test scheduler, and flushed 601 frames at 50 ms intervals without invoking an action. The committed samples are in [the measurements file](2026-09-29-physics-2d-audit-measurements.json).
- Independent public-API reproduction: a radius-12 Circle under a Group at `[64,202]`, dynamic mass 1, damping 0.15, restitution 0.1, gravity `[0,600]`, with a static Rectangle at `[12,216]` sized `456 × 20`. After five seconds, 50 ms ticks gave center y=3441.704555, vy=1645.194157; 1000/60 ms ticks gave center y=204.005, vy=-0.907029, still awake. The floor-contact center should be approximately 204.
- Temporary diagnostics intentionally threw serialized samples to expose browser results; those reporting failures are not part of the 218-test result. They were removed from test discovery after this audit. No production code or existing tests were changed.
- Review covered exports/types, body/world lifecycle, scheduler admission, solver/integration, contacts and casts, CCD, presentation and transform rules, lab and learning examples, and the relevant tests. This is not a proof of every shape pair or workload. No external engine was benchmarked or installed.

| Untouched lab time | Circle center y | Circle vy | Capsule center y | Orange handoff center y |
| ------------------ | --------------: | --------: | ---------------: | ----------------------: |
| 1 s                |         218.535 |    -2.709 |          258.250 |                 215.845 |
| 5 s                |        3441.705 |  1645.194 |         4801.676 |                3425.245 |
| 10 s               |       15179.324 |  2884.551 |        17430.793 |               20720.245 |
| 30 s               |       88117.399 |  3943.840 |        91130.840 |              239900.245 |

Floor top is y=216. Circle radius is 12. All seven gravity-driven bodies were below the floor at five seconds.

## Prioritized findings

### P1 — Ordinary resting contact fails at the lab's own scale and timestep

`packages/scenarios/src/physics-2d-lab.example.tsx` sets gravity 600 and a 50 ms fixed step. `world/integrator.ts` integrates velocity and position before collision solving. `numeric-policy.ts` fixes maximum position correction at 0.2, with three default position iterations. `world/solver.ts` caps each contact-point correction accordingly.

For a circle resting on a static floor, gravity alone adds roughly 1.5 units of displacement per 50 ms tick before correction; a single contact can correct at most 0.6 units over three iterations. Residual penetration accumulates until the body passes through the floor. Restitution/damping affect the exact rate but do not eliminate the mismatch. The independent 20/60 Hz comparison supports this mechanism. Do not infer that it is the only problem affecting other shapes.

At 60 Hz the isolated circle remains bounded but does not sleep after five seconds. The restitution threshold is 1 logical unit/s, while each gravity tick adds about 10 units/s. This can repeatedly trigger restitution at resting contact; the measured nonzero upward velocity is consistent with that mechanism. A focused velocity/contact trace should pin the full sleep failure before selecting a fix.

Action: define a coherent logical-unit/timestep policy, stabilize contacts under that policy, and verify real resting and stacking behavior. Changing the demo to 60 Hz is useful but insufficient. Do not merely increase correction caps or force sleep until tests pass.

### P1 — The lab can pass without proving its visible promises

- `physics-2d-lab.ts` implements `settle` by calling `sleepBody2D()` on every solid. Rename that action to explicit sleep or replace it with actual observation of settling.
- `cross-sensor` teleports directly into the sensor and zeros velocity. The overlap callback teleports out. This proves queued event/command ordering, not swept crossing.
- `PresentationProbe` copies `handle.position` into `presentedPositions`. The reported offset compares authoritative state with its copied value, not with the transform actually drawn. Linear interpolation legitimately differs from authoritative pose; an always-near-zero assertion is also the wrong contract for smooth interpolation.
- The main lab test invokes forced sleep after only a few frames. Its platform test checks endpoint displacement without a passenger. Its long-duration kernel test is one ball in a different arena, not the shipped lab or a mixed-shape stack.
- Solver tests named for resting and stacking inject synthetic manifolds and perform a solve. They are useful unit tests but cannot establish long-running integration stability.

Action: retain explicit command tests, but separate them from simulation-quality claims. Observe paint/hit geometry independently and run the exact visible scene naturally.

### P1 before a parity claim — CCD is a limited translation sweep

`world/ccd.ts` casts moving shapes at their previous rotation against targets at their already-integrated final pose. It reflects the moving body's linear velocity without a coupled impact response on the target. Pure rotational sweep is absent; sensors are skipped; after four impacts it applies the remaining displacement discretely.

These are code-confirmed limitations, not newly reproduced failures in each class. Some are explicit foundation-plan choices, including discrete remainder after the cap. They need documented boundaries and adversarial cases: opposing fast bodies, fast moving platforms, a rotating long bar, multiple ricochets, and thin sensors. Do not present the `ccd` boolean as a general no-tunneling guarantee.

### P2 — Transform composition has an unexpectedly narrow safe path

`canvas/presentation.ts` rejects enabled dynamic bodies under non-unit ancestor scale/skew and rejects changes to their ancestor matrix or authored body pose. This enforces exclusive pose ownership, but a reusable physics component can fail when a parent is resized, moved, or animated. A transparent `PhysicsWorld2D` does not establish a local simulation coordinate space.

This is shipped behavior, not an accidental violation to remove casually. The next design must make simulation space versus viewport/layout space explicit, including pointer, query, rendering, and focus conversions. Test wrapping the same component in Group, layout, Clip, Layer, and filters; do not change Group semantics to accommodate physics.

### P2 — Idle kinematic worlds keep scheduling and allocating

`runtime/controller.ts:hasAwakeBodies()` returns true for every kinematic body regardless of velocity or target changes. The lab contains a stationary kinematic platform. Each advance requests a render and publishes a new revision. `world.ts:captureCheckpoint()` snapshots the world stores, broad phase, contacts, and two solvers; `captureObject()` copies typed arrays using `.slice()` and copies maps/arrays. Public signal projection also builds snapshots and maps.

The cost is code-confirmed; no throughput or GC benchmark was run. Stable pool capacities do not establish allocation-free updates. Measure actual bytes copied/allocated and frame work at 100/1,000 dynamic bodies and large static scenery. Preserve transactional failure isolation while improving this; replacing checkpoints with an unsafe in-place step would regress an important CRC guarantee.

### P2 — Public authoring and debugging information is incomplete

The 2D API is mostly discoverable through source/types, the package README, and examples. The public site has dedicated 3D geometry reference pages but no equivalent detailed 2D runtime/command/query reference found in this audit. `tooling/studio-docs/api-exports.ts` includes only the 3D geometry entry in the documented export map, despite defining paths for 2D entries.

There is no exported 2D debug-draw, replay, snapshot/restore, joint, or supported manual-test harness in `src/2d.ts`. World revision and body signals are useful building blocks but do not explain collider geometry, contacts, rejected steps, or interpolation. Body commands and a declarative enabled flag can require coordinated state updates; the handoff example contains this coordination explicitly.

For agent-written components, document creation-only versus reactive options, command timing, handle generation/removal, origin versus center of mass, units, callback timing, queries, and pose ownership. Supply composable recipes for dragging, throw release, animation handoff, compound colliders, and moving platforms. Consider API additions only after those recipes demonstrate a recurring need.

## Outside-world comparison

Sources checked 2026-09-29; this is a capability comparison, not a performance ranking.

| Candidate   | Relevant strengths                                                                                                                                               | CRC-specific work or uncertainty                                                                                                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Box2D 3     | Established contacts, joints, events, continuous/speculative collision; recommends 60 Hz with four substeps                                                      | C17 library: select and verify a browser/WASM binding separately; do not assume an old JS port is Box2D 3. Coordinate units, assets/startup, and rollback need integration work.                          |
| Planck.js   | JavaScript/TypeScript rewrite of Box2D; idiomatic API, source accessibility, reproducible testbed examples                                                       | Strong low-friction 2D evaluation candidate. Its numerical model is not automatically equivalent to current Box2D 3. Verify serialization/rollback and shape conversion against the exact pinned version. |
| Rapier 2D   | JS/TS WASM package, joints, scene queries, CCD, debug rendering, whole-world snapshots; documented cross-platform determinism with strict input/order conditions | Async WASM initialization and explicit disposal; validate bundle/Studio loading, supported shapes, unit conversion, and the cost of preserving CRC transaction semantics.                                 |
| Matter.js   | Browser-native JS ecosystem and accessible demos; explicitly callable `Engine.update`                                                                            | Useful ergonomics comparator. Test its required collision/stacking behavior rather than assuming parity from demos. CRC must own timing, not a Matter Runner.                                             |
| Current CRC | Natural Canvas attachment, inferred geometry, signals, ownership, existing transaction/scheduler integration                                                     | Owns a large solver/collision maintenance burden; basic shipped scene fails; no parity benchmark or rich public inspection surface.                                                                       |

References:

- [Box2D overview, units, CCD and joints](https://box2d.org/documentation/)
- [Box2D simulation, fixed steps and substeps](https://box2d.org/documentation/md_simulation.html)
- [Box2D determinism and rollback distinction](https://box2d.org/posts/2024/08/determinism/)
- [Planck source, purpose and testbed workflow](https://github.com/piqnt/planck.js)
- [Planck documentation](https://piqnt.com/planck.js/docs/)
- [Rapier JS initialization](https://rapier.rs/docs/user_guides/javascript/getting_started_js/)
- [Rapier rigid bodies and CCD](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/)
- [Rapier determinism conditions](https://rapier.rs/docs/user_guides/javascript/determinism/)
- [Rapier snapshot/restore](https://rapier.rs/docs/user_guides/javascript/serialization/)
- [Matter.Engine API](https://brm.io/matter-js/docs/classes/Engine.html)

## Recommended direction

Preserve CRC's ownership, authoring, and scheduling strengths. Make an established engine the preferred hypothesis for the simulation implementation, subject to a small measured comparison of Planck and Rapier 2D. The Three pivot is a useful architectural precedent, but physics cannot be plugged into `defineRenderLayer`: it must feed transforms, contacts, and queries into CRC's existing simulation phases rather than produce a single bitmap.

Do not introduce a universal multi-engine public abstraction or immediately rewrite all geometry. Compare equivalent simple shapes first; then explicitly resolve ellipse/concave/compound geometry and migration behavior. Do not require external engines to reproduce CRC's current numeric trajectories. Require common physical invariants and a clear authoring contract.

For agentic coding, prioritize: an independently readable scene state; deterministic commands and test time; a single pose owner; scoped identities; ordinary reusable components; searchable executable examples; and failure messages with a body/component identity and a concrete remedy. A backend choice alone does not provide these.

See [the staged plan](../../superpowers/plans/2026-09-29-physics-2d-quality-and-agent-composition.md). It starts with a visible stable slice and postpones broad hardening until feedback, per repository instructions.
