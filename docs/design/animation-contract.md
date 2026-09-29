# CRC animation contract

Status: current implemented contract, updated for external render-layer frames
on 2026-09-28.

This document defines CRC's first-class animation definitions, programs,
component-owned playback, transitions, and their integration with the shared
realm scheduler. The [signals and scheduling
contract](./signals-and-scheduling-contract.md) remains authoritative for the
signal graph and general phase-admission rules.

## Public model

Animation has three explicit layers:

```text
definitions describe typed values over local time
programs bind definitions to writable signals and compose them
component-owned playback advances a program through the realm scheduler
```

Definitions and programs are nominal, opaque, immutable values. They contain no
component identity or independent clock. A program becomes stateful only when
`usePlayback` or `useTransition` creates a run owned by a mounted hook slot.
There is no free `play(program)` function.

The root `@crc/core` entry exports the runtime values `easing`, `tween`,
`keyframes`, `spring`, `defineAnimation`, `stepper`, `track`, `sequence`,
`parallel`, `wait`, `marker`, `repeat`, `usePlayback`, and `useTransition`, plus
their named public types. Private definition samplers, activation records,
program records, playback controllers, scheduler drivers, and trace collectors
are not public APIs.

## Definitions and interpolation

`tween`, `keyframes`, and `defineAnimation` require a finite nonnegative
duration in milliseconds. Sampling clamps local time to the definition's
interval. A zero-duration definition samples once at local time `0` and
completed progress `1`. A numeric sample result, easing result, spring input,
or interpolated result must be finite.

The frozen `easing` object contains `linear`, CSS-style `easeIn`, `easeOut`, and
`easeInOut` cubic curves, plus `cubicBezier(x1, y1, x2, y2)` and
`steps(count, position?)`. Cubic-bezier x controls must be within `[0, 1]`; y
controls may overshoot. `steps` requires a positive integer and defaults to
`"end"`. Custom easing output is passed to interpolation without another clamp.

`tween({ from?, to, duration, easing?, interpolate?, debugName? })` defaults to
linear easing. When `from` is absent, each track captures its output's
transaction-local value when that occurrence activates. Numbers have built-in
linear interpolation. Every nonnumeric value requires an explicit
`CRCInterpolator<T>`; this is checked when the concrete start and end values are
known. A missing interpolator for an omitted nonnumeric start is reported while
accepting play, before a competing run is cancelled and before any writer lease
survives.

`keyframes({ values, offsets?, duration, easing?, interpolate?, debugName? })`
requires at least two values. Omitted offsets are evenly spaced. Explicit
offsets must match the values length, begin at `0`, end at `1`, remain within
`[0, 1]`, and be nondecreasing. Equal adjacent offsets select the later value
at the boundary. One easing may serve every segment, or a list must contain
exactly one function per segment. Keyframes use the same interpolation rules as
tweens.

`defineAnimation({ duration, sample, debugName? })` is the custom seekable
extension point. Its synchronous sampler receives a frozen
`{ initialValue, localTime, progress }` input. Seeking calls it only for the
requested destination. It must not write signals or invoke hooks.

Definition option containers, program child arrays, ordinary arrays, plain
objects, and reconstructable built-in values are snapshotted and protected from
later caller mutation. Functions, accessor/private-state instances, weak
collections, promises, and opaque host objects retain identity because CRC
cannot clone them without changing semantics. Mutating state hidden behind such
an identity is application-owned nondeterminism; portable opaque values require
application discipline and an explicit interpolator.

## Analytic springs

`spring` is a seekable one-dimensional damped oscillator, not a frame-integrated
simulation. Defaults are `mass: 1`, `stiffness: 170`, `damping: 26`,
`initialVelocity: 0`, `restSpeed: 0.01`, `restDelta: 0.001`, and
`maxDuration: 10_000` milliseconds. Omitted `from` captures the output at track
activation. Mass, stiffness, and maximum duration must be finite and positive;
damping and rest thresholds must be finite and nonnegative; endpoints and
initial velocity must be finite.

CRC uses stable analytic solutions for underdamped, critical, and overdamped
regimes and derives a deterministic settlement duration. Velocity is measured
in logical units per second. At settlement or `maxDuration`, the sample is the
exact target with zero velocity. Sampling depends on activation state and
logical time, not display-frame cadence.

## Stateful steppers

`stepper` is the custom extension point for acceleration, velocity, constraints,
and other stateful integrations. It requires synchronous `initial`, `step`, and
`read` callbacks, a finite positive `stepMilliseconds`, and an optional `done`
callback. `maxElapsedMilliseconds` is finite and positive and defaults to
`100`.

Each run and track occurrence owns its stepper state. CRC applies only complete
fixed steps, retains a fractional remainder, and clamps one host gap before
accumulation. Discarded elapsed time is visible only in the internal diagnostic
trace. Seek and replay rebuild from the activation snapshot by replaying fixed
steps, so they may be expensive. Custom callback state is identity-preserved;
callbacks must return fresh or safely immutable state when rollback isolation
matters.

A `done` callback can reveal a finite endpoint only after deterministic forward
execution reaches it for that exact activation input. A stepper without `done`
is statically infinite. CRC never probes an unbounded callback domain to invent
an endpoint: fresh reverse or finish rejects when the required terminal is not
already known.

Instantly completed work shares one deterministic 512-occurrence budget per
evaluation across nesting, parallel branches, seeks, and replay. The budget
counts both opaque stateful occurrences and stateless zero-duration repeat
occurrences whose exact milestones must be retained. The 512th occurrence is allowed; work that would enter the 513th fails before another callback or
milestone is constructed. This bounds synchronous callback and milestone
growth without silently dropping accepted events.

## Programs and duration

`track(output, definition)` is the only ordinary program node that writes a user
signal. `sequence(...children)` runs children in source order;
`parallel(...children)` gives children one local origin and ends at the longest
child; empty groups complete immediately. `wait(duration)` adds finite
nonnegative time. `marker(name)` requires a nonempty name and contributes a
zero-time milestone without executing application code during sampling.

`repeat(child, { iterations, direction? })` counts total iterations. Iterations
must be an integer at least one or positive infinity. Direction is `normal`,
`reverse`, `alternate`, or `alternate-reverse`, defaulting to `normal`. Repeat
milestones use zero-based numeric iteration identities. Counts above
`Number.MAX_SAFE_INTEGER` remain accepted, but adjacent numeric identities can
alias at astronomical values even while duration and value selection remain
symbolic.

Finite program duration is the sum of a sequence and the maximum of parallel
children. A nonterminating stepper or infinite repeat is infinite and cannot
precede later reachable sequence work. A `done`-bounded stepper is unresolved
until its terminal is discovered. Infinite and unresolved programs cannot be
finished; unresolved programs cannot start in reverse without a known endpoint.

Programs reject tracks that can write the same signal at an inclusive
overlapping logical time. Sequential same-output tracks are valid and read
earlier transaction-local stages. Repeat schedules are represented symbolically
rather than expanded. Exact nested overlap proof has one shared 512-descent
construction budget and fails closed with a contextual recommendation when the
budget is exhausted; unusually deep but valid compositions may require simpler
sequences or separate outputs.

Evaluation snapshots activation starts, stepper records, repeat frontiers, and
discovered endpoints. Sampling forks that state and adopts it only after the
shared Commit applies, so a rejected Commit can retry from the last committed
activation without skipping steps or milestones.

## Writer leases and replacement

An accepted run atomically reserves every distinct writable signal reachable
from its program before sampling. The run holds those leases through waits and
sequential stages until finish, cancel, error, explicit replacement, or owner
teardown. Direct public `set` or `update` on a leased output throws. Cancellation
and failure retain the last committed user values; CRC does not restore a
pre-animation snapshot.

The default conflict policy is `"error"`. `play({ conflict: "replace" })` or a
playback-level replacement option explicitly cancels displaced owners in stable
registration order. Acquisition preflights every output and every
activation-dependent interpolation requirement before visible cancellation.
The handoff is provisional until Commit: if any staged equality/authorization
check rejects, prior runs, paused state, Advance registration, and leases are
restored atomically. A disposed displaced owner is never resurrected.

## Component-owned playback

`usePlayback(program, options?)` returns one stable `CRCPlayback` for its mounted
hook slot. Options are `autoplay`, `conflict`, `debugName`, `onEvent`, and
`onError`; autoplay defaults false and conflict defaults to `"error"`.
Candidate program/options validation occurs synchronously during Render. Only a
successful render adopts them. A running activation keeps its program snapshot;
the newest successful program is used by a future play, while event and error
delivery uses the newest successful callbacks.

The readonly `status` signal is `idle`, `scheduled`, `running`, `paused`,
`finished`, `cancelled`, or `disposed`; `currentTime` is another readonly
signal. Accepted metadata and output changes are staged together. `scheduled`
may be staged in Begin and superseded by `running` in the same transaction, so
components do not require a separately rendered scheduled frame.

`play()` starts or restarts from committed outputs. `pause()` retains position
and leases; `resume()` reanchors logical time. `seek(milliseconds)` clamps a
finite program. On an idle, cancelled, or finished handle it creates a paused
run; on an active running or paused run it preserves that status, and a running
seek schedules continued advancement. `reverse()` preserves the presented
position, or starts an idle finite seekable run at its endpoint.
`setPlaybackRate(rate)` requires a finite positive rate and preserves position.
`finish()` samples a known finite terminal. `cancel()` retains committed user
values. Commands are immutable, queue for the next Begin, and run in invocation
order; commands issued during Advance through Complete wait for another frame.

Autoplay queues once only after the mounting render succeeds. A new inline
program identity on later renders does not replay it. Removal, root failure,
abort, or disposal releases the registration, run, leases, evaluator state, and
callbacks exactly once. The stable handle becomes `disposed`; stale controls
and already queued commands are inert.

## Milestones, callbacks, and errors

`onEvent` receives `start`, `iteration`, `marker`, `finish`, and `cancel` records
with logical time, frame identity, immutable program path, zero-based iteration,
and a marker name only for marker events. Sampling queues milestones without
running application code. Complete delivers them only after committed values
have been planned and rendered.

Within a playback, crossed boundaries follow chronological traversal and source
order. Across playbacks at the same logical time, registration order wins.
Commands and signal writes from a handler are deferred to the next frame. A
throwing handler cannot suppress later queued callbacks; errors are reported
after independent Complete work. Disposal during a callback suppresses later
deliveries for that owner.

Definition callback failure discards only that playback's current staged writes,
cancels that playback, and releases its resources; unrelated playback and roots
continue. Definition/program construction and hook-candidate validation throw
synchronously. `onError` receives accepted-command control/preflight and
sampling failures during Complete. Without it, CRC uses ordinary host error
reporting after the frame. One-shot acceptance errors survive an unrelated
shared-Commit rejection and are delivered exactly once.

## Update-driven transitions

`useTransition(target, options)` returns one stable readonly signal. Spring
options are number-only; tween options are generic and use the same explicit
interpolator rule. Both accept `initial`, `equals`, and `debugName`; equality
defaults to `Object.is`.

On mount, omitted `initial` presents the target and does not animate. A distinct
explicit initial value is presented by the mounting render and queues entrance
motion only after that render succeeds. Later successful unequal targets
retarget from the last committed presented value. Several changes before Begin
coalesce to the latest successful target. Tween retargeting receives a full new
duration; spring retargeting carries the currently committed analytic velocity.
Option-only changes are adopted for the next retarget and do not restart an
equal target.

Equality and option validation run under the Render write guard. Failed mount
or update renders adopt neither target nor options. Concurrent render previews
of the same transition signal settle transactionally: a failed older render
cannot overwrite a newer surviving preview. When rollback changes an effective
preview that another root may have rendered, CRC invalidates renderer consumers
for a follow-up frame without issuing ordinary signal or effect notifications;
successful provisions add no such invalidation. Teardown disposes the private
playback; a retained readonly result cannot schedule the removed component.

## Scheduler integration

Every playback shares the realm's one frame transaction:

| Phase    | Animation work                                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Begin    | Capture one logical time/frame identity and drain accepted commands in invocation order.                                                                                                                                                      |
| Advance  | Sample registered playbacks in registration order, stage outputs/status/time, and queue milestones.                                                                                                                                           |
| Commit   | Validate and publish every playback's stages with the signal graph as one atomic batch.                                                                                                                                                       |
| Plan     | Validate computed dependencies and collect the exact dirty render/resource boundaries.                                                                                                                                                        |
| Render   | Repaint planned Layer and render-layer children before ancestors and render top-level roots/friend work from the committed graph; a dirty external render layer updates, renders, and settles interaction before ancestor Canvas composition. |
| Complete | Finalize successful transactions, release ended runs/leases, deliver milestones and isolated errors, and request another frame only if work remains.                                                                                          |

Time-based definitions use stable logical-time anchors, not accumulated display
deltas. A dropped display frame jumps directly to the correct tween, keyframe,
or spring sample. Only steppers consume their clamped fixed-step elapsed input.
All animation outputs and playback metadata become visible in one Commit before
any root renders.

The source-only trace collector records command, sampling, write outcome,
stepper clamp, milestone, and error facts. Every emitted record carries the
applicable frame identity, logical time, run identity, or program path from its
declared trace shape; write outcomes distinguish staged from
equality-suppressed values. It retains no production history, has no semantic
effect, and disables itself if its collector throws.
CRC exposes no public scheduler clock, frame-step API,
trace history, or input-injection surface; `seek` controls one playback rather
than the realm.

## Rendering, Layers, and external renderers

Animation produces ordinary signal values. CRC-provided components accept them
directly at declared inputs:

```tsx
function MovingCard() {
  const x = useTransition(120, { type: "spring", initial: 0 });
  return <Rectangle style={{ x, width: 48, height: 32 }} />;
}
```

`Rectangle` owns that read. `x.get()` remains valid when `MovingCard`
intentionally needs to own the dependency. A signal is not an animation
descriptor and arbitrary objects are not deep-unwrapped. An ordinary Canvas 2D
dependency invalidates its top-level immediate-mode root,
which clears and traverses normally. Multiple changed values coalesce into one
root render, and unchanged values/computed results schedule no renderer work.

An explicit `Layer` is the retained optimization boundary. A signal read in its
child content can repaint that Layer before ancestor composition while clean
sibling bitmaps are reused. A parent-only placement, transform, alpha, or outer
filter change may reuse the clean Layer bitmap. CRC never automatically promotes
a stable component to an offscreen surface: allocation, bitmap memory, copying,
and compositing can cost more than redrawing simple geometry.

Use a Layer when measured repeated subtree drawing is expensive and its content
usually remains stable; keep simple or frequently changing content in the root.
Diagnostics may recommend a boundary, but adding and removing it stays explicit
and readable in application code.

External render layers and the official `@crc/three` adapter use this same
scheduler and signal graph through the public `defineRenderLayer` lifecycle.
They may request another CRC frame through `invalidate()`, but may not create a
second ordinary animation loop. Continuous shared state stays in signals;
sparse renderer facts may queue semantic events for Complete. Animation updates
props before the layer's `update` and `render` callbacks. Canvas and external
renderer work in one transaction observe the same realm logical time.

## Determinism and portability

Given the same normalized definitions/programs, activation values, accepted
commands, and logical times, seekable definitions reproduce their logical
values within the same implementation. Steppers reproduce the same applied
fixed-step inputs, subject to application callback purity and appropriate
numeric tolerances. Program paths, command order, phase order, lease ownership,
and milestone order are deterministic within their documented bounds.

CRC does not promise cross-engine bit-identical custom simulation arithmetic or
pixel identity. Canvas paths, text measurement/rasterization, decoded images,
filters, color management, shaders, GPU drivers, and GPU floating point remain
platform-owned. Debug names and traces explain execution but never determine
identity or behavior.

Definitions and programs can be passed between components, but programs retain
their exact writable-signal bindings. A reusable component animation is usually
a factory that accepts its outputs and returns a freshly bound program:

```ts
function entrance(x: WritableSignal<number>, opacity: WritableSignal<number>) {
  return parallel(
    track(
      x,
      tween({ from: -24, to: 0, duration: 180, easing: easing.easeOut }),
    ),
    track(opacity, tween({ from: 0, to: 1, duration: 140 })),
  );
}
```

## Deliberate boundaries

- CRC does not implement CSS or Web Animations syntax, implicit transitions,
  deep signal unwrapping, or a retained scene graph.
- There is no general physics/collision engine, mutable timeline builder,
  timeline label language, arbitrary program callback node, audio/network clock,
  root-owned playback, or persistent serialized playback session.
- There is no automatic caching, worker/WASM execution, cross-thread signal,
  synchronous GPU readback, public manual clock, or public retained trace.
- Future worker or WASM number crunching may use packed buffers only if Begin
  through Complete, Commit atomicity, logical results, leases, stale-result
  rejection, lifecycle, and the main-thread fallback remain observationally
  identical. Custom callbacks and nonserializable values stay on the main thread.
- Applications select reduced or alternate motion; CRC does not infer
  accessibility preferences or decide which motion is essential.

## 3D physics interoperation

Animation and physics share the realm transaction but never compete for one pose. Enabled dynamic bodies are solver-owned; kinematic position and orientation signal targets are sampled after animation staging and before solving; disabled bodies return root-pose authority to authored style or animation. Re-enabling seeds the current authored pose and an explicit zero-or-preserve velocity policy, while ordinary non-pose appearance remains animatable in every mode.
