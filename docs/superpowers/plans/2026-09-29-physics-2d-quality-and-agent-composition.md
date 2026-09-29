# 2D physics quality and agent composition plan

> **Historical status: IMPLEMENTATION WORK RECORD.** The execution ledger records this repair; current behavior is defined by the 2D physics contract.

**Status:** scoped repairs implemented on `codex/physics-2d-quality`. Full browser suite passed 3,002 tests (four intentional skips); final targeted follow-up passed 225 tests. Aggregate signoff remains blocked by unrelated documentation-status banners; see the execution ledger and implementation evidence.

**Goal:** make supported 2D scenes physically credible, easily composed as CRC components, and independently verifiable by coding agents.

**Architecture:** retain one CRC scheduler and explicit component ownership. First deliver an honest, stable public lab. Then compare keeping the repaired kernel with a thin Planck or Rapier 2D integration before committing to further numerical infrastructure. Do not introduce a public multi-engine framework.

**Tech stack:** TypeScript, CRC public JSX/signals, Vitest browser tests, Playwright Chromium, pinned Rapier 2D compat 0.21.0. The engine decision and current contract supersede candidate-selection language in the original investigation checklist below.

**Evidence/spec input:** [audit and measurements](../../testing/field-notes/2026-09-29-physics-2d-audit.md), current public code/tests, and existing scheduling/style/layout/resource contracts. The older physics design contains removed 3D assumptions; it is not a wholesale current specification.

**Workflow:** use focused debugging and test-first implementation techniques. Repository vertical-slice delivery overrides the writing-plans skill's full-design-first and repeated-review recommendations. Work through the public scene first; present it for hands-on feedback before broadening verification. This plan does not authorize changing difficult-to-reverse public contracts without a concrete design decision.

## Constraints and invariants

- Preserve Group semantics, source paint order, root-logical input coordinates, hooks/keys, and exact disposal.
- CRC alone owns the host frame; no engine Runner, extra animation loop, or per-body scheduler registrations.
- Commands enter Begin, simulation advances in Advance, public state publishes in Commit, callbacks run in Complete. Callback commands are deferred.
- Preserve failed-step isolation and sibling-world progress. Determine how a candidate engine supports this before adopting it.
- Keep engine-only comparison fixtures private; supported application examples use public package entries.
- Explicitly specify logical distances, seconds versus milliseconds, degrees versus radians, body origin versus center of mass, and simulation versus presentation pose.
- Pin selected engine version and record license, package format, browser startup, loading, and disposal evidence.
- Do not claim parity from test count, screenshots alone, or a hand-authored contact manifold.

## Original investigation checklist

The checklist below records the breadth proposed before implementation. It is not a claim that every comparative experiment or optional new capability shipped. The execution ledger and [implementation evidence](../../testing/field-notes/2026-09-29-physics-2d-implementation.md) identify the actual work and its limits.

## Slice 1 — Honest, stable drop-and-settle laboratory

**Files:** `packages/scenarios/src/physics-2d-lab.example.tsx`, `packages/scenarios/src/physics-2d-lab.ts`, its catalog metadata, `packages/core/test/physics-2d-lab.test.ts`; numerical changes only where the focused reproduction proves they belong (`packages/physics/src/lib/2d/numeric-policy.ts`, `world/world.ts`, `world/solver.ts`, collision modules as necessary).

**Interface:** continue using existing `PhysicsWorld2D`, attachment factories, handles, commands, and `ScenarioController`; no new public runtime API is required for this slice.

- [ ] Add a failing test that mounts the actual lab and advances it untouched for five seconds. Assert every gravity-driven body's geometry stays above the floor within 0.5 logical units; for the circle assert center y <= 204.5. Record the current y≈3441.7 failure.
- [ ] Add the isolated radius-12 circle reproduction at 50 and 1000/60 ms with gravity 600, damping 0.15, restitution 0.1. Assert bounded contact and natural sleep within five seconds under the selected supported configuration; never issue `sleepBody2D` to establish natural sleep.
- [ ] Trace pre/post integration pose, separation, correction and normal impulse to pin the restitution/sleep issue. Decide and document the supported timestep/scale policy. Prefer safe defaults and internal numerical treatment; do not silently let accepted configurations leak bodies through floors. If 50 ms becomes unsupported, validate it explicitly and provide migration guidance.
- [ ] Repair the proven numerical failure and run the visible lab at the normal 60 Hz default. Retain the 50 ms case as a supported-case test or explicit rejection test, according to the decision above.
- [ ] Separate “force sleep” from “observe settling” and “teleport overlap” from “move through sensor.” Add a real velocity-driven crossing, with the speed chosen so discrete overlap is guaranteed; reserve swept sensor behavior for its own explicit contract.
- [ ] Replace fake presentation-offset evidence. Test a moving body halfway between fixed ticks using independently captured drawing transforms or rendered geometry plus pointer targeting. Expect the correct interpolated pose, not equality with authoritative state.
- [ ] Make the result available at `http://127.0.0.1:5173/#/testing/physics-2d` using the actual running server port. Ask the user to inspect natural settling, mixed shapes, impulse response, and smooth presentation. Report **slice ready for feedback**, not feature complete.

Focused command:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/physics-2d-lab.test.ts packages/physics/src/lib/2d/canvas/presentation.test.tsx packages/physics/src/lib/2d/world/solver.test.ts --browser.headless --browser.ui=false
```

## Slice 2 — Decide whether to keep or replace the simulation kernel

**Files:** create a private `tooling/physics-comparison/` fixture runner and results document; integrate one candidate through a temporary private simulation adapter only after its standalone evidence is useful. Avoid public exports until the decision is made.

**Interface:** use a versioned private scene description containing body IDs, initial poses, mass/material values, shapes, and tick-indexed commands; outputs contain poses, velocities, sleep states, contacts, and timing/allocation measurements. Each engine converts the same logical scene into its own units. Report exact pinned versions and conversion factors.

- [ ] Run current CRC, Planck and Rapier 2D against a circle drop, ten-box stack, box pyramid, high-speed thin-wall impact, and a moving platform carrying a box. Use equivalent geometry and physical inputs, not identical solver knob values.
- [ ] Initial proposed acceptance: no escapes/nonfinite state over 30 seconds; maximum settled penetration <=0.5 logical units at the documented viewport scale; <=0.25-unit positional jitter during the final second; supported resting stacks sleep within five seconds after their last disturbance. Validate these targets with visible behavior and record any revision rather than weakening them silently.
- [ ] Compare friction/resting incline behavior, restitution against expected rebound, mass ratios 1:1 and 1:10, and invariance of accepted ticks under 30/60/120 Hz render grouping. Time-dependent inputs must be sampled at the same simulation times; do not compare different input streams.
- [ ] Exercise CCD head-on moving bodies, moving platforms, rotational sweeps and cap exhaustion separately. State supported sensor behavior for each engine; absence of swept sensors is not automatically an engine defect.
- [ ] Measure update cost and allocations with 100/1,000 active bodies and a substantial static field. Report median/p95 on a recorded machine, plus stable structural work counts; do not make developer-machine wall-clock numbers universal CI gates.
- [ ] Prototype the leading engine under one real CRC world, preserving signals/events and exact cleanup. Test async initialization cancellation if using WASM and inject a failed frame to prove rollback/isolation. Include unit conversion for velocity, force, torque, inertia, queries and contact normals.
- [ ] Write a decision record: keep CRC only if measured quality and maintenance cost justify it; otherwise select the candidate meeting integration and numerical requirements. Planck is the first low-friction JS/TS candidate; Rapier is the snapshot/determinism candidate. Box2D 3 is a numerical reference, with browser binding evaluation needed before treating it as a drop-in option.

**Decision gate:** present measured results and the concrete migration contract. Engine adoption is a proposed architectural change, not a conclusion already proven by this audit. Do not expand the custom solver or build adapters for every engine while this decision is open.

## Slice 3 — A reusable physics component in a responsive composition

**Files:** `packages/physics/src/lib/2d/canvas/presentation.ts`, `runtime/controller.ts`, `types.ts`; `packages/scenarios/src/learning/composition/physics-2d.example.tsx`; create focused composition scenarios/tests and `docs/design/physics-2d-contract.md` once decisions are accepted.

**Interface decision before production changes:** choose an explicit simulation-space/viewport relationship. Preserve root-logical pointer conventions. Define whether moving a viewport moves only presentation or teleports/rebases bodies, and define scale/resize/query conversions. Do not guess a new public API name in implementation.

- [ ] Write a public scenario rendering two instances of the same physics component with independent worlds and keyed bodies inside layout. Resize/reposition the containing panel, reorder keyed children, and toggle visibility.
- [ ] Assert stable identity/velocity across harmless rerenders and keyed reorder, isolation between worlds, exact teardown, and an explicit outcome for resize/reposition. Check Group, Clip, Layer, filters, and hit targeting using the same scene.
- [ ] Implement the smallest coordinate-boundary change justified by that scenario. Keep decorative transforms separate from authoritative simulation motion, with clear diagnostics for unsupported skew/nonuniform scale.
- [ ] Demonstrate a compound visual body with a sensor child and explicit custom collision geometry. Verify body origin, mass center, contact geometry and drawing align, including the chosen approximation policy for ellipses and concave shapes if an external engine is adopted.
- [ ] Simplify the drag/throw and animation-handoff examples to one clear pose owner at a time. Test cancel, pointer capture loss, unmount while dragging, queued commands on stale handles, and same-frame ownership changes. Add a helper only if the recipe cannot be made reliably simple with current APIs.
- [ ] Show the working composition in Studio for feedback before broad API hardening.

## Slice 4 — Supported agent observation and testing

**Files:** new focused physics testing/debug entry files only after the API contract is accepted; `packages/physics/package.json`, `src/2d.ts` as appropriate, public docs under `docs/site/`, Studio declarations, consumer fixtures, and the shared test lab.

**Proposed interface contract:** a supported testing harness mounts ordinary public scenes, advances the existing realm scheduler by specified accepted ticks, performs named public actions, and returns JSON-safe observations. A read-only inspection surface exposes stable body identity, authoritative and presentation pose, collider geometry, contacts, sleep state, pending/committed revision, and failures. Test control must be isolated from production playback and must not create a second clock.

- [ ] Specify pause/step/reset semantics and fixture ownership before adding an exported test clock. Consumers must not need `@crc/core/internal` imports. Distinguish diagnostic snapshots from full engine serialization/restore.
- [ ] Drive one drop/drag/platform scene manually and headlessly using the same action and observation surface. Save seed, exact tick-indexed inputs, configuration, engine version, and mismatch output on failure.
- [ ] Add optional contact/shape/center-of-mass overlays with `pointerEvents="none"`; assert inspection never changes authoritative simulation results.
- [ ] Stop stationary kinematic worlds from requesting endless frames; wake them on target or topology changes. Test one shared host frame while active and no physics frame requests once idle.
- [ ] Publish searchable 2D reference pages and minimal runnable recipes. Cover creation-only/reactive values, units, signal ownership, command timing, disabled bodies, handles, query semantics, shape approximation and documented CCD limits. Include 2D runtime entries in documentation/export consistency checks.

## After experiential feedback — hardening and completion

- [ ] Expand the common quality matrix across all supported shape pairs, stacks, slopes, compounds, filters/sensors, high speeds, long stalls, force duration semantics, moving kinematic targets over catch-up ticks, mass changes, and failure recovery.
- [ ] Add a complete moving-platform passenger test: same target path under different render cadence produces equivalent tick-state within documented tolerance. Current code applies the final frame target in the first catch-up tick; test the desired sampling contract explicitly.
- [ ] Verify repeated mount/reset/dispose, removed callback targets, stale query handles, sibling worlds, and canceled engine initialization. Count owned resources rather than waiting for GC.
- [ ] Measure full-world checkpoint copies and public snapshot allocations. Optimize only proven costs while preserving transaction guarantees.
- [ ] Evaluate joints next through concrete drag-spring/pendulum/bridge scenes if product scope requires them. Joints are a common engine capability but are not a prerequisite to the first stability slice. Character controllers, workers and networking remain separately scoped.
- [ ] Run public export/declaration, Bundler/NodeNext, packed-consumer, source/built-browser, and Studio-editor checks for every new public surface. Perform one independent focused review of changed behavior, reusing the reviewer for unresolved material issues.
- [ ] Run `corepack pnpm@11.21.0 trust` in Node 24.15+ on the Node 24 LTS line and record fresh results. Only then report **feature complete** for the accepted scope.

## Agentic acceptance tasks

Give a fresh coding agent only public documentation and one task at a time: build a draggable compound body; place it in a resizable panel; add a moving platform carrying it; detect a sensor event; write a reproducible headless regression; remove and remount it safely.

Pass means each task compiles through public entries, works visibly, has semantic assertions through supported tooling, does not duplicate the engine clock, and needs no private source knowledge or undocumented tuning. Record failures and required manual corrections. Avoid making “agent-friendly” a subjective claim based on shorter JSX alone.

## Execution ledger — 2026-09-29

- [x] Reproduced untouched-lab and isolated-circle failures before fixes. Repaired the reference solver's support ordering, low-speed restitution and capsule support contacts. The lab now uses 60 Hz, natural sleep, velocity-driven sensor crossing, and real Canvas-transform presentation observations. The early slice was offered for hands-on feedback.
- [x] Compared CRC reference, Planck 1.5.0, bare Rapier 0.21.0 and integrated Rapier using reproducible settling piles and a static-heavy field. Recorded machine, exact versions, timings, natural sleep and escaped bodies. This was a targeted engine-selection comparison, not the complete proposed cross-engine slope/pyramid/mass-ratio matrix.
- [x] Selected Rapier with explicit 100-logical-units-per-meter conversion, engine snapshots, rollback/replay, material/filter adaptation, bounded CCD, geometry approximation and engine-range diagnostics. Public runtime uses one engine; the custom solver remains private comparison evidence. Async runtime loading is module-owned embedded WASM, with no component-owned initialization task to cancel. License and startup cost are recorded.
- [x] Added local simulation space, root/local pointer conversion and a reusable two-world Studio lesson. Public evidence verifies moving/scaling the boundary preserves body identity and velocity. Existing transform, query, keyed ownership and drag tests remain; the proposed all-features-in-one-scene visual matrix was not used as a completion claim.
- [x] Added immutable JSON-safe inspection, a read-only debug overlay, and a public isolated-realm test harness with deterministic frame advancement, action flushing, reset and exact cleanup. Public docs cover usage and limitations; applications need no private test-clock imports.
- [x] Fixed kinematic catch-up sampling and tested a carried passenger at 30/60 Hz. Preserved intermediate CCD impacts for public callbacks. Inline handler changes preserve collider identity and idle behavior; Complete resolves the latest surviving handler.
- [x] Removed full-world copies from per-body presentation/handle reads; unchanged static synchronization is skipped. Active and passive scheduler participation preserves same-frame target updates while settled worlds request no frames. Owned-world and keyed-removal counters verify cleanup.
- [x] Recorded integrated performance: 1,000-box pile p95 7.50 ms versus reference 19.56 ms, all 1,000 integrated bodies asleep versus reference 16. Static-heavy p95 1.48 ms versus reference 1.27 ms. Numbers include kernel transactions but exclude Canvas painting/public signal publication. No universal timing claim or CI wall-clock gate.
- [x] Added searchable public API pages and guide, package exports, packed consumer coverage, source/built runtime loading and Studio declarations. Independent review found and drove ownership, compound-COM and callback regressions; latest focused run is 281 passing tests on Node 24.15.0.
- [ ] Aggregate gate green: attempted on Node 24.15.0; blocked by required historical-status banners missing from unrelated component-manipulation/path-geometry documents. All remaining gate stages were exercised separately, including types/lint/builds, packed consumers, Studio navigation/search, eight visual baselines, built smoke, lifecycle and structural performance. The [verification record](../../testing/field-notes/2026-09-29-physics-2d-implementation.md) records exact results and the preserved blocker. No aggregate-green claim.

### Explicitly outside this repair

Joints, character controllers, swept sensors, worker execution, network persistence and public engine selection are new capabilities, not fixes to the existing contract. No full external-engine feature parity is claimed. The proposed fresh-agent task study has not been conducted: public recipes, package consumers and deterministic tests provide executable authoring evidence, not a measured claim about autonomous agent success rates. Full-world rollback snapshots remain an identified static-heavy performance cost; removing them would require an equally strong transaction design.
