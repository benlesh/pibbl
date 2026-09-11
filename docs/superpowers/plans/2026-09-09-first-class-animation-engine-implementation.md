# First-Class Animation Engine Implementation Plan

> **Historical status: EXECUTION PLAN.** This is the second of two dependency-ordered plans for the approved signals and animation design.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CRC's complete deterministic animation surface—seekable definitions, stateful steppers, composable programs, writer leases, component-owned playback, update-driven transitions, milestones, debugging traces, and public scenario evidence—on the single signal graph and frame scheduler.

**Architecture:** Immutable definitions describe typed values over local time, immutable programs bind definitions to writable signals and compose them in sequence/parallel/repeat trees, and one component-owned playback run resolves activation snapshots plus control state. Playback registers with the realm scheduler's Advance phase, stages user and metadata values into its shared signal transaction, and delivers milestones only after Commit, renderer planning, and Render. Seekable definitions sample logical time directly; steppers replay exact fixed steps. Writer leases reserve every reachable output for a run, preventing ambiguous writers while allowing transaction-local sequential stages.

**Tech Stack:** TypeScript, CRC signals and centralized scheduler, HTML Canvas 2D and `OffscreenCanvas` Layers, synchronous CRC hooks, deterministic analytic/fixed-step math, Vitest Browser with Playwright Chromium, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-09-first-class-signals-and-animation-design.md`

**Prerequisite:** Complete `docs/superpowers/plans/2026-09-09-first-class-signals-and-central-scheduler-implementation.md`, including its aggregate trust gate and review, before starting this plan.

## Global Constraints

- Preserve unrelated working-tree changes and untracked files; stage only files named by the active task.
- Add a failing test before each production behavior change.
- Do not introduce a free-standing `play(program)` function. Running state is owned by `crcPlayback` or the internal transition hook slot.
- Do not introduce another `requestAnimationFrame`, timer loop, renderer clock, or per-playback scheduler. Every animation advances in the existing realm scheduler's Advance phase.
- Definitions and programs are immutable normalized snapshots. Caller mutation after construction cannot affect current or future runs.
- Keep public definition/program types nominal and opaque. Only `defineAnimation` and `stepper` expose custom callbacks.
- Built-in interpolation is number-only. Every other `T` requires an explicit `CRCInterpolator<T>`.
- Time-based definitions sample logical time, not accumulated display-frame deltas. Only stateful steppers integrate fixed deltas.
- Stage every user-output, playback-status, and playback-time write before the single Commit phase. No renderer or callback may observe a partially advanced frame.
- Reserve every reachable writable signal for the whole accepted run. Sequential same-signal tracks are valid; simultaneous program overlap is rejected; competing active runs fail unless replacement is explicit.
- Direct `set`/`update` on a leased output is an error. Cancellation retains the last committed value.
- Custom easing/interpolation/sampling/step callbacks run synchronously under the signal write guard. A failure discards only that playback's staged values and cancels only that playback.
- Deliver playback milestones in Complete after render. Handler work is deferred to the next frame and handler failure cannot prevent later callbacks.
- Keep ordinary Canvas 2D full-root immediate mode. Preserve explicit Layer cache behavior and every existing filter/layout/transform/clip/event/focus contract.
- Keep worker/WASM execution, cross-thread signals, automatic caching, timeline labels/builders, arbitrary callback nodes, audio/network clocks, public manual clocks, and pixel determinism out of scope.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.

## File and responsibility map

- `packages/core/src/lib/animation/types.ts`: public easing, interpolation, definition, program, playback, event, and transition types.
- `packages/core/src/lib/animation/easing.ts`: immutable built-in easing functions, cubic-bezier solver, and steps easing.
- `packages/core/src/lib/animation/definition.ts`: normalized definition records, tween/keyframe/custom/stepper construction, private metadata, and seekable sampling.
- `packages/core/src/lib/animation/spring.ts`: analytic damped-oscillator sampling, velocity, and deterministic settlement duration.
- `packages/core/src/lib/animation/program.ts`: immutable program tree, duration classification, writer spans, static conflict validation, and paths.
- `packages/core/src/lib/animation/evaluate.ts`: activation snapshots, recursive sampling, transaction-local output reads, boundary crossings, markers, repeats, and stepper state.
- `packages/core/src/lib/animation/writer-leases.ts`: atomic whole-run output reservation, conflict replacement, write authorization, and ownership counters.
- `packages/core/src/lib/animation/playback.ts`: queued command processing, active-run timing, scheduler registration, staged metadata, terminal handling, and isolated errors.
- `packages/core/src/lib/hooks/crc-playback.ts`: stable component-owned public handle, successful-render option adoption, autoplay, callbacks, and disposal.
- `packages/core/src/lib/hooks/crc-transition.ts`: focused target-change producer over one private output signal and playback run.
- `packages/scenarios/src/animation-lab.example.tsx` and `packages/scenarios/src/animation-lab.ts`: deterministic public playback laboratory.
- `packages/scenarios/src/learning/composition/signals-and-animation.example.tsx`: approachable transition and event-triggered sequence lesson.
- Root exports, type tests, package consumers, Studio declarations, current contracts, guide, trust scripts, and field notes: complete public and verification surfaces.

## Timing and ordering model

For a host frame with logical time `L`, every accepted command is applied in
global invocation order during Begin. Active runs then sample in playback
registration order during Advance. Within one program, ties use source order.
All staged values commit together, computed consumers validate, retained child
work precedes ancestor composition, and only then do milestones publish.

Program duration uses this private classification:

```ts
type ProgramDuration =
  | { readonly kind: "finite"; readonly milliseconds: number }
  | { readonly kind: "infinite" }
  | { readonly kind: "unresolved-stepper" };
```

An unresolved stepper can eventually reveal a finite terminal time through its
`done` callback. Until then it cannot start in reverse or be explicitly
finished. A stepper without `done` is statically infinite.

---

### Task 1: Easing, tween, keyframe, and custom seekable definitions

**Files:**

- Create: `packages/core/src/lib/animation/types.ts`
- Create: `packages/core/src/lib/animation/easing.ts`
- Create: `packages/core/src/lib/animation/easing.test.ts`
- Create: `packages/core/src/lib/animation/definition.ts`
- Create: `packages/core/src/lib/animation/definition.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `CRCEasing`, `CRCInterpolator<T>`, `CRCAnimationDefinition<T>`, `easing`, `tween`, `keyframes`, `defineAnimation`, and `stepper` construction.
- Produces private immutable definition metadata and `sampleSeekableDefinition`.
- `stepper` is validated and normalized here; its stateful execution is Task 5.

- [ ] **Step 1: Write failing easing tests**

Lock exact built-ins: `linear`, CSS-compatible `easeIn` as
`cubicBezier(0.42, 0, 1, 1)`, `easeOut` as
`cubicBezier(0, 0, 0.58, 1)`, and `easeInOut` as
`cubicBezier(0.42, 0, 0.58, 1)`. Sample `0`, `0.25`, `0.5`, `0.75`, and `1`
with tight numeric tolerances.

For cubic bezier, require finite inputs and `x1/x2` in `[0, 1]`, permit finite
overshooting `y` values, return exact endpoints, and solve x with bounded
Newton iterations followed by bisection. For `steps`, require a positive integer
count, default position to `end`, and assert exact boundary behavior for start
and end positions.

- [ ] **Step 2: Write failing definition validation and sampling tests**

Cover:

- finite nonnegative duration and immutable caller snapshots;
- zero-duration tween/custom behavior;
- numeric default interpolation and explicit object interpolation;
- omitted `from` resolved from the activation value;
- custom easing output passed unclamped to the interpolator;
- two-or-more keyframe values, generated offsets, explicit offset validation,
  per-segment easing-list length, and equal-offset jumps;
- custom sampler inputs `{ initialValue, localTime, progress }`;
- no guessed interpolation for strings/objects;
- contextual debug names and no exposed public sampler.

At offsets `[0, 0.5, 0.5, 1]`, sampling exactly `0.5` selects the later declared
keyframe at that offset; samples on either side use the adjacent segments.

- [ ] **Step 3: Run focused tests and confirm missing modules**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/easing.test.ts packages/core/src/lib/animation/definition.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the animation definition modules do not exist.

- [ ] **Step 4: Implement immutable easing functions**

Freeze the exported `easing` object. Clamp input progress to `[0, 1]` inside
built-in easing functions, but never clamp the easing result before
interpolation. Use a bounded solver with deterministic iteration counts; do not
depend on browser CSS timing APIs.

- [ ] **Step 5: Implement opaque definition records**

Store runtime records in a private `WeakMap<CRCAnimationDefinition<unknown>,
DefinitionRecord<unknown>>`; expose only a frozen nominal token object. Copy and
freeze keyframe values, offsets, and easing arrays. Normalize omitted offsets
once. Validate static fields at construction.

On track activation, resolve omitted `from`. If both endpoints are numbers,
use linear interpolation. Otherwise require the captured definition's explicit
interpolator and report failure before the run retains a writer lease.

Run custom easing, interpolation, and sampler callbacks under
`withSignalWriteForbidden`. Reject nonfinite sampled values when the returned
value is a number; arbitrary nonnumeric values remain the interpolator/sampler's
responsibility.

- [ ] **Step 6: Run focused tests and typecheck**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/easing.test.ts packages/core/src/lib/animation/definition.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: all selected tests PASS and typecheck PASS.

- [ ] **Step 7: Commit seekable definition foundations**

```bash
git add packages/core/src/lib/animation/types.ts packages/core/src/lib/animation/easing.ts packages/core/src/lib/animation/easing.test.ts packages/core/src/lib/animation/definition.ts packages/core/src/lib/animation/definition.test.ts packages/core/src/index.ts
git commit -m "feat(core): define seekable animation values"
```

### Task 2: Analytic one-dimensional spring

**Files:**

- Create: `packages/core/src/lib/animation/spring.ts`
- Create: `packages/core/src/lib/animation/spring.test.ts`
- Modify: `packages/core/src/lib/animation/definition.ts`
- Modify: `packages/core/src/lib/animation/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `spring(options): CRCAnimationDefinition<number>`.
- Produces private `sampleSpring(record, seconds)` returning position and velocity plus `resolveSpringDuration(record)`.

- [ ] **Step 1: Write failing validation and default tests**

Assert defaults exactly:

```ts
{
  mass: 1,
  stiffness: 170,
  damping: 26,
  initialVelocity: 0,
  restSpeed: 0.01,
  restDelta: 0.001,
  maxDuration: 10_000,
}
```

Reject nonfinite values, nonpositive mass/stiffness/maxDuration, and negative
damping/rest thresholds. Prove caller mutation cannot alter the normalized
record.

- [ ] **Step 2: Write failing analytic sampling tests**

Use known initial position/velocity values for underdamped, critically damped,
and overdamped parameters. Assert position and velocity at zero and several
fixed millisecond samples. For every regime, compare a direct seek at `t` with
the value obtained after arbitrary display-frame timestamps ending at `t`.

Assert exact `to` at resolved settlement and at `maxDuration`, including a
zero-distance spring with nonzero initial velocity.

- [ ] **Step 3: Run focused tests and confirm the missing spring**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/spring.test.ts packages/core/src/lib/animation/definition.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `spring` and analytic sampling are absent.

- [ ] **Step 4: Implement the three closed-form regimes**

Let displacement be `x0 = from - to`, natural frequency
`w0 = sqrt(stiffness / mass)`, and damping ratio
`zeta = damping / (2 * sqrt(stiffness * mass))`.

- Underdamped: use `wd = w0 * sqrt(1 - zeta²)` and the exponentially decaying sine/cosine solution.
- Critical: use `(A + B*t) * exp(-w0*t)` with `A = x0` and `B = initialVelocity + w0*x0`.
- Overdamped: use the two real roots and coefficients derived from `x(0)` and `v(0)`.

Return `to + displacement` plus analytic velocity. Treat ratios within a small
documented normalization epsilon of one as critical so nearly critical input
does not divide by a vanishing term.

- [ ] **Step 5: Derive a frame-independent settlement time**

Build a conservative future envelope for both absolute displacement and
absolute velocity in each regime. Derive the last possible envelope peak from
the closed-form coefficients, start on the monotonically decreasing side, use
exponentially growing deterministic brackets up to `maxDuration`, then bisect
the first passing bracket with a fixed iteration count. The chosen time is the
earliest candidate in that monotone interval whose future envelopes are both
below `restDelta` and `restSpeed`; if none exists, use `maxDuration`. This keeps
construction logarithmic in the time range instead of scanning every
millisecond.

Store the derived finite duration in the immutable definition record. Samples
at or after it return exact `to` and zero velocity. Never discover settlement
from whichever display frames happened to execute.

- [ ] **Step 6: Run focused and determinism tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/spring.test.ts packages/core/src/lib/animation/definition.test.ts --browser.headless --browser.ui=false
```

Expected: all regimes, direct seeks, defaults, and terminal assertions PASS.

- [ ] **Step 7: Commit analytic springs**

```bash
git add packages/core/src/lib/animation/spring.ts packages/core/src/lib/animation/spring.test.ts packages/core/src/lib/animation/definition.ts packages/core/src/lib/animation/types.ts packages/core/src/index.ts
git commit -m "feat(core): add analytic spring animations"
```

### Task 3: Immutable program composition and static writer validation

**Files:**

- Create: `packages/core/src/lib/animation/program.ts`
- Create: `packages/core/src/lib/animation/program.test.ts`
- Modify: `packages/core/src/lib/animation/types.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `CRCAnimationProgram`, `track`, `sequence`, `parallel`, `wait`, `marker`, and `repeat`.
- Produces private program records, duration classification, writer spans, stable paths, and reachable output sets.

- [ ] **Step 1: Write failing constructor and immutability tests**

Cover nominal program values, copied/frozen child arrays, finite nonnegative
waits, nonempty marker names, empty sequence/parallel, total repeat iterations,
the four directions, finite integer or positive-infinity iteration validation,
and rejection of foreign definition/program objects.

- [ ] **Step 2: Write failing duration and reachability tests**

Assert sequence sums finite children, parallel takes the maximum, finite repeat
multiplies, and an infinite repeat remains infinite. A stepper without `done`
is infinite; a stepper with `done` is unresolved. Reject a statically infinite
child before any later reachable sequence child. Preserve an unresolved stepper
before later content for forward discovery, but mark the whole duration
unresolved.

- [ ] **Step 3: Write failing overlap tests**

Generate normalized writer spans `{ output, start, end, path }` for finite
structure. Sequential tracks targeting one signal are valid. Parallel tracks
with intersecting inclusive local intervals are rejected with both paths and
debug names. Parallel children whose waits make their writer intervals strictly
disjoint are valid. Repeated intervals are compared without expanding an
infinite list: use one-iteration spans plus period/direction analysis.

- [ ] **Step 4: Run the focused test and confirm missing program APIs**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/program.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the program module is absent.

- [ ] **Step 5: Implement a private immutable program tree**

Use a private `WeakMap<CRCAnimationProgram, ProgramRecord>`. Every constructor
returns a frozen opaque token. Store child-index paths as frozen numeric arrays;
root path is empty. `track` is the only user-output writer node.

Compute writer intervals using source-order local offsets. Treat zero-duration
writers as closed points. In sequence, same-signal overlap at adjacent
boundaries is explicitly permitted because sequence evaluation owns their
source order. In parallel/repeat interaction, an inclusive intersection is a
static conflict.

- [ ] **Step 6: Run program tests and typecheck**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/program.test.ts packages/core/src/lib/animation/definition.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: program and definition suites PASS.

- [ ] **Step 7: Commit program composition**

```bash
git add packages/core/src/lib/animation/program.ts packages/core/src/lib/animation/program.test.ts packages/core/src/lib/animation/types.ts packages/core/src/index.ts
git commit -m "feat(core): compose immutable animation programs"
```

### Task 4: Seekable program evaluator and transaction-local sequencing

**Files:**

- Create: `packages/core/src/lib/animation/evaluate.ts`
- Create: `packages/core/src/lib/animation/evaluate.test.ts`
- Modify: `packages/core/src/lib/animation/definition.ts`
- Modify: `packages/core/src/lib/animation/program.ts`

**Interfaces:**

- Consumes: normalized definitions/programs and foundation `SignalCommitBatch`.
- Produces private activation snapshots, seekable evaluation, crossed milestones, terminal state, and resolved per-track starts.

- [ ] **Step 1: Write failing activation-snapshot tests**

Use two sequential omitted-`from` tracks writing the same signal. At activation,
the first captures the committed output. When a large advance crosses into the
second, the second captures the first track's transaction-local terminal value,
not the still-public pre-Commit signal:

```ts
const x = signal(0);
const program = sequence(
  track(x, tween({ to: 10, duration: 100 })),
  track(x, tween({ to: 30, duration: 100 })),
);

const result = evaluateAt(activation(program), 150);
expect(result.batch.read(x)).toBe(20);
expect(x.get()).toBe(0);
```

After batch commit, assert `x.get() === 20` and only one outward invalidation.

- [ ] **Step 2: Write failing recursive sampling tests**

Table-test exact start/middle/end values for sequence, parallel, wait, empty
groups, zero-duration tracks, and finite repeats in every direction. Prove a
large jump resolves completed children in source order and leaves finished
parallel child outputs at their terminal values.

For repeated reversed iterations, assert local time mapping at iteration
boundaries and zero-based iteration indexes.

- [ ] **Step 3: Write failing marker crossing tests**

Evaluate an interval that crosses several markers and repeat boundaries. Return
milestone records with frozen program paths and zero-based iterations. Traversal
direction controls crossing order; events at identical logical time use program
source order. A direct sample at a time does not execute callbacks—the evaluator
only returns data for playback Complete.

- [ ] **Step 4: Run the focused test and confirm missing evaluator behavior**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/evaluate.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because activation/evaluation are absent.

- [ ] **Step 5: Implement activation and recursive evaluation**

Activation snapshots the program token, committed output values, registration
identity, and an initially empty map of track-path starts. Each track resolves
its start the first time its local interval activates by reading the batch,
which sees earlier staged same-frame values. Cache that start for all later
seeks in the run.

Recursive evaluation receives previous and destination program time, direction,
frame identity, writer token, and batch. It stages only the active/final value
needed at the destination; it never commits. Return milestones and terminal
facts separately.

- [ ] **Step 6: Make direct seeking reproducible**

For finite seekable content, seeking to `t` rebuilds track activation snapshots
in deterministic source order from the run's original output snapshot, then
samples `t`. Compare direct seek results with forward advances across multiple
frame cadences for tween, keyframes, spring, wait, marker, sequence, parallel,
and repeat.

- [ ] **Step 7: Run evaluator, program, and graph tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/animation/program.test.ts packages/core/src/lib/signals/render-consumer.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 8: Commit seekable evaluation**

```bash
git add packages/core/src/lib/animation/evaluate.ts packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/animation/definition.ts packages/core/src/lib/animation/program.ts
git commit -m "feat(core): evaluate animation programs"
```

### Task 5: Stateful fixed-step execution and replay

**Files:**

- Modify: `packages/core/src/lib/animation/evaluate.ts`
- Modify: `packages/core/src/lib/animation/evaluate.test.ts`
- Create: `packages/core/src/lib/animation/stepper.test.ts`
- Modify: `packages/core/src/lib/animation/definition.ts`

**Interfaces:**

- Consumes: normalized stepper definitions and active-run state maps.
- Produces exact per-track state, accumulator, discarded-gap accounting, terminal discovery, and replay seeking.

- [ ] **Step 1: Write failing fixed-step accumulation tests**

Create a velocity/position state with `stepMilliseconds: 10` and
`maxElapsedMilliseconds: 100`. Advance with deltas `6`, `9`, `35`, and `250`.
Assert whole-step counts `0`, `1`, `4`, and `10`; retain the correct fractional
remainder; record exactly `150` discarded milliseconds for the final gap; and
call `read` once for each sampled frame after all whole steps.

- [ ] **Step 2: Write failing ownership, done, and callback tests**

Assert `initial` once per track activation, isolated state for two runs of the
same program, `done` terminal discovery, exact state release at track/run end,
and contextual cancellation on `initial`, `step`, `read`, or `done` failure.
Run every callback under the signal write guard.

- [ ] **Step 3: Write failing replay-seek tests**

Seek a paused stepper backward and forward. Each seek resets from the original
activation snapshot and applies exact whole fixed steps; compare the result to a
fresh forward replay with a documented tolerance. A stepper with undiscovered
terminal time rejects reverse-from-idle and finish. After `done` discovers the
terminal step/time, both controls may use that known endpoint.

- [ ] **Step 4: Run focused tests and observe unsupported stateful evaluation**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/stepper.test.ts packages/core/src/lib/animation/evaluate.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on stateful execution and replay.

- [ ] **Step 5: Add per-run stepper records**

Key state by immutable program path and repeat iteration. Each record owns the
activation input, current state, whole-step count, fractional remainder,
applied elapsed, discarded elapsed, and discovered terminal step/time. Drop a
record when the track is permanently left, the run is canceled/replaced, or the
owner is disposed.

Clamp each host-frame contribution before adding to the accumulator; direct
seek replay uses target logical time and exact fixed steps, not the host-gap
clamp. Stage the result of `read` once after stepping.

- [ ] **Step 6: Add trace facts without application callbacks**

Return applied steps, retained remainder, clamped contribution, discarded gap,
and terminal discovery as immutable internal trace records. The realm scheduler
may record these; no public per-frame event is emitted.

- [ ] **Step 7: Run stateful, seekable, and failure tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/stepper.test.ts packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: all selected tests PASS.

- [ ] **Step 8: Commit fixed-step execution**

```bash
git add packages/core/src/lib/animation/evaluate.ts packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/animation/stepper.test.ts packages/core/src/lib/animation/definition.ts
git commit -m "feat(core): run deterministic animation steppers"
```

### Task 6: Whole-run writer leases and explicit replacement

**Files:**

- Create: `packages/core/src/lib/animation/writer-leases.ts`
- Create: `packages/core/src/lib/animation/writer-leases.test.ts`
- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/signals/graph.test.ts`
- Modify: `packages/core/src/lib/animation/evaluate.ts`

**Interfaces:**

- Consumes: program reachable outputs, private writable nodes, and run writer tokens.
- Produces atomic output reservation, direct-write rejection, authorized Commit writes, replacement cancellation, and exact lease snapshots.

- [ ] **Step 1: Write failing atomic reservation tests**

Reserve a two-output program, then attempt a second program overlapping only
its second output. Assert the second acquires nothing and the first retains both
leases. Sequential tracks on one output require one lease. Finish, cancel,
failure, replacement, and disposal each release exactly once.

- [ ] **Step 2: Write failing direct-write and replacement tests**

While leased, public `set` and `update` throw a diagnostic naming the signal and
active playback when debug names exist. Authorized staged Commit from the
owning writer succeeds. With `conflict: "replace"`, gather all distinct
conflicting runs in registration order, cancel each once, then acquire every
new output before sampling. Cancellation retains committed signal values.

- [ ] **Step 3: Write failing preflight validation tests**

For an omitted-`from` nonnumeric track without an interpolator, attempt play
against a currently leased output. Validate the captured value first and assert
no new lease or staged write survives. For replacement, preflight the current
committed snapshots, cancel old owners, recapture the same unchanged values,
then reserve atomically.

- [ ] **Step 4: Run focused tests and confirm missing lease behavior**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/writer-leases.test.ts packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because writable nodes do not enforce animation ownership.

- [ ] **Step 5: Implement explicit lease ownership**

Use an iterable private `Map<WritableNode<unknown>, WriterLease>` only while
leased. Never rely on a weak reference for release. A lease stores the run token,
run registration order, diagnostic label, and one idempotent release closure.

Public signal writes carry no writer token and reject an occupied lease.
`SignalCommitBatch.stage` retains the writer token and Commit verifies it still
owns the lease; a stale/replaced run cannot write through a queued batch.

- [ ] **Step 6: Expose test-only ownership counts**

Track active, acquired, released, duplicate-release, conflict, and replacement
counts. Snapshot output names only for tests/diagnostics and never use debug
names as identity.

- [ ] **Step 7: Run lease, evaluator, and graph tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/writer-leases.test.ts packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 8: Commit deterministic writer ownership**

```bash
git add packages/core/src/lib/animation/writer-leases.ts packages/core/src/lib/animation/writer-leases.test.ts packages/core/src/lib/signals/graph.ts packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/animation/evaluate.ts
git commit -m "feat(core): reserve animation outputs"
```

### Task 7: Scheduler-integrated playback core and controls

**Files:**

- Create: `packages/core/src/lib/animation/playback.ts`
- Create: `packages/core/src/lib/animation/playback.test.ts`
- Modify: `packages/core/src/lib/animation/types.ts`
- Modify: `packages/core/src/lib/scheduler/types.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.ts`
- Modify: `packages/core/src/lib/scheduler/testing.ts`

**Interfaces:**

- Consumes: Begin command queue, Advance registration, shared SignalCommitBatch, evaluator, and writer leases.
- Produces internal playback controller/run, all public control semantics, staged metadata signals, completion milestones, and trace records.
- Does not yet expose the component hook.

- [ ] **Step 1: Write failing phase and batched-visibility tests**

Create two controllers and two roots with the manual scheduler. Queue play in
invocation order, flush logical time zero, then a later timestamp. Assert:

```text
Begin commands
Advance playback 1
Advance playback 2
Commit user values and metadata
Plan consumers
Render root 1
Render root 2
Complete milestones
```

Every component sees both playbacks' new values. Status/currentTime remain at
their old public values until Commit. Several changed outputs cause one render
per affected root.

- [ ] **Step 2: Write failing command-state table tests**

Exercise every command from every relevant status:

- `play` starts/restarts from committed outputs;
- `pause` freezes time and retains leases without requesting continuous frames;
- `resume` reanchors logical time without a jump;
- `seek` clamps finite programs and leaves fresh idle/cancelled/finished runs paused;
- `reverse` preserves current position and changes direction;
- `setPlaybackRate` requires finite positive values and preserves position;
- `finish` samples known finite terminal state;
- `cancel` retains user values and releases the run;
- stale commands after disposal are inert.

Assert infinite and unresolved-stateful reverse/finish errors exactly as the
spec requires.

- [ ] **Step 3: Write failing dropped-frame and deferral tests**

Advance a tween at logical times `0`, `16`, and `1_000`; assert its final value
comes directly from logical time. Queue a command from Advance, Render, and
Complete test callbacks and prove all three run no earlier than the next Begin.
For a stepper, prove the same gap is clamped and traced rather than sampled as a
time function.

- [ ] **Step 4: Run focused tests and confirm playback is absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/playback.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because playback controllers and Begin commands do not exist.

- [ ] **Step 5: Implement globally ordered command acceptance**

Each control method appends an immutable command with a realm sequence number
and requests the shared host frame. Begin drains the frozen prefix in sequence
order. A play preflights definition/program activation, resolves conflicts,
acquires leases, snapshots the current program, registers Advance work, and
stages `scheduled` then `running` metadata for that frame.

Keep each active run's position, direction, playback rate, last logical anchor,
activation data, stepper records, writer token, status, and registration order
private. A new play invalidates queued work from the previous generation.

- [ ] **Step 6: Implement Advance, Commit, and terminal handling**

Advance calculates destination program time from the current logical timestamp,
direction, and rate. It calls the evaluator, stages user outputs plus
`currentTime`/status, queues milestones, and marks terminal work. On definition
failure, call `batch.discardWriter(run.token)`, stage cancellation metadata, and
queue the error for Complete.

Complete releases terminal registrations, stepper state, and leases before
callbacks. A paused run unregisters continuous Advance work but retains its
leases; any later control schedules one Begin frame.

- [ ] **Step 7: Extend deterministic trace records**

Record frame/logical times, accepted commands, playback registration/path/time,
staged and equality-suppressed writes, markers/iterations/terminal facts,
stepper clamp records, and isolated errors. Keep traces bounded to the explicit
source-only diagnostic collector; production does not retain unbounded history.

- [ ] **Step 8: Run playback, scheduler, evaluator, and lease tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/animation/playback.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/animation/evaluate.test.ts packages/core/src/lib/animation/writer-leases.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 9: Commit centralized playback execution**

```bash
git add packages/core/src/lib/animation/playback.ts packages/core/src/lib/animation/playback.test.ts packages/core/src/lib/animation/types.ts packages/core/src/lib/scheduler/types.ts packages/core/src/lib/scheduler/realm-scheduler.ts packages/core/src/lib/scheduler/testing.ts
git commit -m "feat(core): run playback in scheduler phases"
```

### Task 8: Component-owned `crcPlayback`, milestones, and error isolation

**Files:**

- Create: `packages/core/src/lib/hooks/crc-playback.ts`
- Create: `packages/core/src/lib/hooks/crc-playback.test.tsx`
- Modify: `packages/core/src/lib/animation/types.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `CRCPlaybackStatus`, `CRCPlaybackEvent`, `CRCPlayback`, `CRCPlaybackOptions`, and `crcPlayback`.
- Consumes the latest successfully rendered program/options for future runs while active runs retain their snapshot.

- [ ] **Step 1: Write failing stable-handle and render-adoption tests**

Render the hook repeatedly with freshly constructed equivalent programs and
assert one handle identity. Start a run, render with a different program, and
prove the active run continues its snapshot. After finish, the next `play`
uses the latest successfully rendered program. A render that later fails does
not adopt its program or callbacks.

- [ ] **Step 2: Write failing autoplay and teardown tests**

Autoplay queues once only after the mounting root render transaction succeeds.
It does not restart on later program identity changes. Remove the component
while scheduled, running, paused, and with a queued milestone. Assert one
disposal, no stale callback delivery, released leases/registrations/state, and
inert saved methods. Add `crcPlayback` to the standard hook-misuse test.

- [ ] **Step 3: Write failing milestone-order tests**

Use a program with nested repeats and same-time markers. Assert exact public
events:

```ts
expect(events).toEqual([
  { type: "start", logicalTime: 0, frameId: 1, programPath: [], iteration: 0 },
  {
    type: "marker",
    logicalTime: 100,
    frameId: 2,
    programPath: [1, 0],
    iteration: 0,
    marker: "arrived",
  },
  {
    type: "finish",
    logicalTime: 200,
    frameId: 3,
    programPath: [],
    iteration: 0,
  },
]);
```

Use actual resolved frame identities/times in the final test fixture. Prove
callbacks observe rendered committed values, same-time ties use program source
then playback registration order, and a command/write from a handler affects
only the next frame.

- [ ] **Step 4: Write failing callback/error isolation tests**

Throw from one sampler, `onEvent`, and `onError`. Assert the failing playback's
current staged user writes are discarded, its run cancels, unrelated playbacks
and roots complete, later milestone callbacks run, and unhandled errors reach
the scheduler's post-Complete host reporting path.

- [ ] **Step 5: Run focused tests and confirm the hook is absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-playback.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `crcPlayback` is missing.

- [ ] **Step 6: Implement one hook slot and successful-render adoption**

Create one internal controller on mount and follow the component teardown. On
every render, register a callback with the inherited `CRCRenderTransaction`;
only `success === true` installs the latest program/options. Mount success also
queues autoplay once. Event/error delivery reads the latest callbacks from the
still-live slot, but checks controller generation and component identity before
invocation.

Return one frozen public handle whose methods delegate to the live controller
and whose `status`/`currentTime` are readonly signals.

- [ ] **Step 7: Run hook, playback, failure, and lifecycle suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-playback.test.tsx packages/core/src/lib/animation/playback.test.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/lifecycle-ownership.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 8: Commit public playback ownership**

```bash
git add packages/core/src/lib/hooks/crc-playback.ts packages/core/src/lib/hooks/crc-playback.test.tsx packages/core/src/lib/animation/types.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/index.ts
git commit -m "feat(core): add component-owned playback"
```

### Task 9: Update-driven `crcTransition`

**Files:**

- Create: `packages/core/src/lib/hooks/crc-transition.ts`
- Create: `packages/core/src/lib/hooks/crc-transition.test.tsx`
- Modify: `packages/core/src/lib/animation/types.ts`
- Modify: `packages/core/src/lib/animation/playback.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `CRCTweenTransitionOptions<T>`, `CRCSpringTransitionOptions`, and both `crcTransition` overloads.
- Uses one component-owned internal transition slot and the same scheduler/playback engine.

- [ ] **Step 1: Write failing mount and retarget tests**

For omitted `initial`, assert the mounting render presents target and schedules
no entrance animation. For explicit different `initial`, assert the mounting
render presents initial and queues target only after successful render.

On later target changes, assert retargeting starts from the last committed
presented value. Several successful target changes before Begin coalesce to the
latest. Failed renders do not adopt targets. Custom equality suppresses a
retarget.

- [ ] **Step 2: Write failing spring continuity tests**

Advance a spring to a fixed logical time, render a new target, and assert the
new analytic spring starts at the current position with the current analytic
velocity. Compare the immediate next sample against a restart with zero
velocity and prove they differ in the expected direction. Tween retargeting
restarts the configured duration without carrying velocity.

- [ ] **Step 3: Write failing type and lifecycle tests**

Prove spring accepts only numbers, tween supports arbitrary `T` with an
interpolator, and the returned type is readonly `Signal<T>`. Remove the
component while a retarget is queued/running and assert exact controller, lease,
consumer, and signal-edge release. Add the hook to the standard misuse probe.

- [ ] **Step 4: Run focused tests and confirm missing transition behavior**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-transition.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because `crcTransition` is absent.

- [ ] **Step 5: Implement the focused transition slot**

Capture normalized options and the initial output signal on mount. Register
target adoption with the current render transaction. After success, queue one
internal retarget command if equality says the last successful target changed;
replace any still-pending retarget for that slot.

Create an internal one-track program against the private writable output and
run it through the normal playback/lease/scheduler path. Expose only
`output.asReadonly()`. For spring retargets, ask the current run for its last
committed analytic position/velocity snapshot and pass both into the new spring.

- [ ] **Step 6: Run transition, playback, and render tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/crc-transition.test.tsx packages/core/src/lib/hooks/crc-playback.test.tsx packages/core/src/lib/animation/playback.test.ts packages/core/src/lib/runtime-contract.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS.

- [ ] **Step 7: Commit update-driven transitions**

```bash
git add packages/core/src/lib/hooks/crc-transition.ts packages/core/src/lib/hooks/crc-transition.test.tsx packages/core/src/lib/animation/types.ts packages/core/src/lib/animation/playback.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/index.ts
git commit -m "feat(core): add signal-driven transitions"
```

### Task 10: Integrate animation with roots, Layers, filters, and failures

**Files:**

- Create: `packages/core/test/animation-rendering.test.tsx`
- Modify: `packages/core/src/lib/components/layer.test.ts`
- Modify: `packages/core/src/lib/filter/filter-integration.test.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.test.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`

**Interfaces:**

- Consumes: only public animation APIs for end-to-end tests, plus source-only scheduler control for exact timestamps.
- Produces renderer-neutral batched animation evidence across Canvas roots and retained boundaries.

- [ ] **Step 1: Write failing shared-root transaction tests**

One playback writes `x` observed by two top-level canvases and `opacity`
observed by only one. At exact logical timestamps, assert all writes commit
before either root renders, root order is stable, and each affected root
traverses once. Add a second simultaneous playback and prove it shares the same
host callback and Commit.

- [ ] **Step 2: Write failing Layer locality tests**

Animate a signal read only inside Layer A. Assert Layer A repaints before parent
composition, Layer B retains its bitmap, and the top-level root still traverses
once. Then animate a signal read only in Layer A's parent transform/opacity and
assert A's child execution count remains unchanged while its bitmap is
re-composited.

- [ ] **Step 3: Preserve filters, geometry, events, and focus**

At frozen logical times, animate supported Group transform, Rectangle geometry,
filter amount, and layout input. Assert original hit/focus geometry rules,
root-logical coordinates, source paint order, filter-insensitive hit bounds,
and current layout resolution. Use semantic geometry assertions before selected
pixels.

- [ ] **Step 4: Isolate root and playback failures**

Make one animated root throw after Commit while a second root succeeds. Assert
committed signal values are not rolled back, the failed component-owned
playback cancels through fail-closed teardown, unrelated playback survives, and
the next valid mount recovers. A custom callback failure must discard that
playback's current staged writes before Commit.

- [ ] **Step 5: Run integration regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/animation-rendering.test.tsx packages/core/src/lib/components/layer.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/test/focus-navigation.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: animation integration and all selected current contracts PASS.

- [ ] **Step 6: Commit renderer integration evidence**

```bash
git add packages/core/test/animation-rendering.test.tsx packages/core/src/lib/components/layer.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/runtime-contract.test.ts
git commit -m "test(core): integrate animation rendering"
```

### Task 11: Public learning example and deterministic animation laboratory

**Files:**

- Create: `packages/scenarios/src/learning/composition/signals-and-animation.example.tsx`
- Create: `packages/scenarios/src/animation-lab.example.tsx`
- Create: `packages/scenarios/src/animation-lab.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/animation-lab.test.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Create: `packages/core/test/visual-baselines/first-class-animation.expected.png`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: only root `@crc/core` public imports in scenario/example source.
- Produces learning route `#/examples/composition/signals-and-animation` and lab route `#/testing/animation`.
- Produces actions `play`, `pause`, `step`, `seek-start`, `seek-middle`, `seek-end`, `reverse`, `retarget`, `repeat`, `simulate`, `show-layer`, `show-shared-roots`, `cancel`, `remove-owner`, and `reset`.

- [ ] **Step 1: Add failing catalog and public-source tests**

Expect both routes, exact action IDs, source identifiers, public imports, and no
`@crc/core/internal`, `lib`, or source imports. Add the learning slug to the
composition-section expectations.

- [ ] **Step 2: Run catalog tests and confirm missing sources**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/animation-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the animation sources and catalog records do not exist.

- [ ] **Step 3: Build one readable learning example**

Use `crcSignal` for position/opacity, `crcTransition` for a target scale, and an
event-triggered `crcPlayback` program containing a parallel entrance followed
by `marker("arrived")` and a spring scale track. Explicit `.get()` calls appear
where values enter style. Keep supported current style fields only. Metadata
explains definitions, programs, playback ownership, central scheduling, and why
style receives numbers rather than signal objects.

- [ ] **Step 4: Build the deterministic laboratory**

Expose semantic state for status, current time, position, opacity, transition
target/presented value, iteration, marker trace, stepper state, render counts,
Layer child/composite counts, shared-root counts, and last action. `step` pauses
then uses public `seek(currentTime.get() + 16.6666666667)`; seek controls use
fixed program times. The test harness installs the source-only manual scheduler
outside the public scenario and supplies exact frame timestamps.

- [ ] **Step 5: Drive every mode headlessly**

Assert values/status/events/render counts after each action, including retarget
continuity, repeat direction, fixed-step tolerance, Layer cache reuse, shared
root Commit visibility, cancel value retention, and inert stale handle after
owner removal. Assert trace ordering from public milestone events; keep internal
scheduler trace assertions in unit/integration suites.

- [ ] **Step 6: Add a frozen-time visual baseline**

Seek the laboratory to one exact finite logical time and capture only stable
Canvas relationships that add information beyond semantic assertions. Inspect
expected, actual, and diff before accepting the baseline; use no mask for
author-controlled geometry and only a narrow documented mask for existing
browser-owned font/filter pixels. Rerun twice.

- [ ] **Step 7: Generate the index and run public scenario evidence**

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/animation-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: catalogs/index validate and two consecutive animation-lab runs PASS.

- [ ] **Step 8: Commit public animation evidence**

```bash
git add packages/scenarios/src/learning/composition/signals-and-animation.example.tsx packages/scenarios/src/animation-lab.example.tsx packages/scenarios/src/animation-lab.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/core/test/animation-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts packages/core/test/visual-baselines/first-class-animation.expected.png docs/scenario-index.md
git commit -m "test(core): prove animation through public scenarios"
```

### Task 12: Align package consumers, Studio declarations, and implemented contracts

**Files:**

- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `tooling/crc-studio-runtime-entry.ts`
- Modify: `tooling/verify-studio-types.mjs`
- Create: `docs/design/animation-contract.md`
- Modify: `docs/design/signals-and-scheduling-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Create: `docs/guides/signals-and-animation.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-09-first-class-signals-and-animation-design.md`

**Interfaces:**

- Consumes: completed behavior from Tasks 1-11.
- Produces matching source, built, packed, Bundler, NodeNext, Studio, current-contract, and user-guidance surfaces.

- [ ] **Step 1: Add failing type and runtime package assertions**

Import every animation type and runtime value from `@crc/core`. Add positive
inference for number tween/spring, object tween with interpolator, keyframes,
program composition, playback, and both transitions. Include deliberate
failures:

```ts
// @ts-expect-error spring values are number-only
spring({ to: "done" });
const objectOutput = signal({ x: 0 });
const numberDefinition = tween({ to: 10, duration: 100 });
// @ts-expect-error a numeric definition cannot write an object signal
track(objectOutput, numberDefinition);
type CoreExports = typeof import("@crc/core");
// @ts-expect-error no free playback function is exported
type FreePlay = CoreExports["play"];
```

Because the public generic definition permits runtime-captured `from`, the type
system does not attempt to prove interpolation availability. Add an object tween
positive fixture with a complete interpolator and a runtime test that reports a
missing interpolator before play retains a lease. Update the runtime inventory
for `easing`, all definition/program constructors, `crcPlayback`, and
`crcTransition`.

- [ ] **Step 2: Run package and Studio checks and confirm stale surfaces**

```bash
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer
node tooling/verify-studio-types.mjs
```

Expected before declaration/runtime-entry updates: one or more checks FAIL on
the new public names.

- [ ] **Step 3: Update Studio declarations and runtime entries**

Regenerate/copy the built declarations into the marked Studio modules. Add all
public animation type names and runtime values to the exact manifests and
runtime entry. Add an editor fixture containing explicit `.get()` reads,
`crcTransition`, and an event-triggered `crcPlayback` program.

- [ ] **Step 4: Write current contracts and the user guide**

Document:

- all definition defaults/validation/interpolation and spring regimes;
- program duration, overlap, repeat, marker, and transaction-local rules;
- writer leases and explicit replacement;
- playback statuses, controls, command ordering, callback timing, and teardown;
- transition mount/retarget/velocity behavior;
- scheduler phases, trace tiers, Canvas/Layer invalidation, and WebGL friend expectations;
- deterministic logical values versus platform-owned Canvas/GPU pixels;
- ownership rows and failure isolation;
- examples for reusable program factories and explicit style reads;
- deliberate non-goals and performance guidance for explicit Layer use.

Update `AGENTS.md` and library status only to shipped behavior backed by fresh
tests.

- [ ] **Step 5: Mark the approved design as implemented**

After all runtime and documentation checks pass, change only its historical
banner/status preface to:

```text
> **Historical status: IMPLEMENTED DESIGN RECORD.** Original approved wording below is preserved; current behavior lives in the linked design contracts and API reference.
```

Keep the approved design body intact.

- [ ] **Step 6: Run documentation, package, and Studio checks**

```bash
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer:packed
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: all seven checks PASS.

- [ ] **Step 7: Commit the public surface and contracts**

```bash
git add packages/core/type-tests/final-public-vocabulary.tsx playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/src/crc-editor-types.txt tooling/crc-studio-runtime-entry.ts tooling/verify-studio-types.mjs docs/design/animation-contract.md docs/design/signals-and-scheduling-contract.md docs/design/runtime-hooks-contract.md docs/design/runtime-resource-ownership.md docs/guides/signals-and-animation.md docs/api-reference.md docs/library-status.md AGENTS.md docs/superpowers/specs/2026-09-09-first-class-signals-and-animation-design.md
git commit -m "docs: publish animation contracts"
```

### Task 13: Lock animation ownership, structural cost, and final trust evidence

**Files:**

- Create: `packages/core/test/animation-ownership.test.ts`
- Create: `packages/core/test/animation-performance.test.ts`
- Modify: `package.json`
- Modify: `docs/testing/trust-gate.md`
- Create: `docs/testing/field-notes/2026-09-09-first-class-animation.md`
- Modify: `docs/superpowers/plans/2026-09-09-first-class-animation-engine-implementation.md`

**Interfaces:**

- Consumes: every prior task, the completed foundation, and the aggregate trust contract.
- Produces exact lifecycle/cost evidence and the final implementation record.

- [ ] **Step 1: Write failing ownership stress tests**

Repeat mount, autoplay, pause, seek, reverse, replacement, custom failure,
owner removal, root failure, abort, disposal, and fresh remount. Assert exact
active/acquired/released counts for playback registrations, output leases,
stepper states, Begin commands, Complete callbacks, signal consumers/edges,
root registrations, and host frames. End with:

```ts
expect(animationOwnershipSnapshot()).toMatchObject({
  activePlaybacks: 0,
  activeWriterLeases: 0,
  activeStepperStates: 0,
  queuedCommands: 0,
  queuedMilestones: 0,
});
expect(snapshotRealmScheduler().pendingHostFrames).toBe(0);
```

Do not use garbage collection as an oracle.

- [ ] **Step 2: Write failing structural-performance tests**

Prove with exact counters:

- 1,000 numeric tracks use one realm host callback per presented frame;
- each active playback samples once per frame and stages at most one value per output;
- 1,000 writes observed by one root cause one root traversal;
- equality-suppressed outputs cause no render;
- 100 sequential same-signal tracks retain one writer lease;
- a ten-keyframe definition allocates no per-frame array;
- analytic springs do no display-frame integration loop;
- a fixed-step gap runs at most `maxElapsedMilliseconds / stepMilliseconds` steps;
- animation adds no offscreen allocation or pixel readback;
- Layer presentation-only animation preserves child cache hits.

Keep wall-clock measurements optional and diagnostic.

- [ ] **Step 3: Run lifecycle and structural suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/animation-ownership.test.ts packages/core/test/animation-performance.test.ts packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/signal-scheduler-performance.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/test/event-performance.test.ts packages/core/test/filter-performance.test.ts --browser.headless --browser.ui=false
```

Expected: all exact ownership and structural assertions PASS.

- [ ] **Step 4: Add animation evidence to trust sub-gates**

Append `animation-ownership.test.ts` to `test:lifecycle` and
`animation-performance.test.ts` to `test:performance`. Update the trust guide
with logical-time determinism, fixed-step tolerances, structural scheduler/write
counts, frozen-time visual evidence, and the explicit exclusion of browser/GPU
pixel identity and uncontrolled wall-clock thresholds.

- [ ] **Step 5: Review the complete implementation diff**

```bash
git status --short
git diff --check
git diff --stat 71f9dd6..HEAD
rg -n "requestAnimationFrame|setInterval|setTimeout" packages/core/src/lib/animation packages/core/src/lib/scheduler
rg -n "getImageData|putImageData|transferToImageBitmap" packages/core/src/lib/animation
```

Confirm only the realm scheduler owns `requestAnimationFrame`, animation owns no
timer, production animation performs no pixel work, no public free `play` or
effect/subscription/batch API exists, and every new public value has package,
Studio, scenario, lifecycle, and documentation evidence.

- [ ] **Step 6: Run the aggregate trust gate**

```bash
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

Expected: Node reports 24.15 or newer, pnpm reports 11.21.0, and the complete
aggregate gate exits zero.

- [ ] **Step 7: Diagnose failures without weakening the contract**

Rerun the focused failing command, inspect expected/actual/diff for visual
failures, and fix implementation or evidence. Never rewrite a baseline merely
to obtain green output, widen timing tolerances without a numerical reason,
remove an ownership assertion, or add a second scheduler as a workaround.
Repeat the aggregate gate after recovery.

- [ ] **Step 8: Record fresh evidence and mark this plan implemented**

Write the field note with date, environment, exact focused/aggregate commands,
results, structural counts, stepper tolerances, visual inspection decision, and
remaining deliberate boundaries. Change this plan's first status banner to:

```text
> **Historical status: IMPLEMENTED PLAN.** Current behavior lives in the signals/scheduling and animation contracts plus the API reference.
```

- [ ] **Step 9: Commit closure and request final code review**

```bash
git add packages/core/test/animation-ownership.test.ts packages/core/test/animation-performance.test.ts package.json docs/testing/trust-gate.md docs/testing/field-notes/2026-09-09-first-class-animation.md docs/superpowers/plans/2026-09-09-first-class-animation-engine-implementation.md
git commit -m "test: close first-class animation evidence"
```

Invoke `superpowers:requesting-code-review` against the complete implementation
range beginning after design-approval commit `71f9dd6`. Resolve correctness
findings with focused tests, rerun the aggregate gate after any production or
evidence change, and report the final commit range plus fresh verification.
