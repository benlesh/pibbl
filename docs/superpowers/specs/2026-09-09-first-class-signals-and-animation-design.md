# First-class signals and animation design

> **Historical status: PROPOSED DESIGN FOR REVIEW.** This dated document records the candidate contract; current shipped behavior remains in `docs/design/` and the public code.

Status: proposed for final review on 2026-09-09.

## Summary

CRC will add a small general-purpose signal graph and build animation on top of
it. Signals are not animation-specific motion values. They are explicit,
mount-independent reactive values that CRC components, cached layers, official
renderer integrations, and future framework facilities can observe.

Animation is a producer of signal values. Immutable definitions describe how a
value changes; immutable programs bind definitions to writable signals and
compose work in time; stateful playback objects connect programs to one
centralized scheduler. Every animation in the same JavaScript realm advances
through the same ordered frame phases before any CRC root renders.

CRC remains an immediate-mode renderer. A signal change identifies the exact
consumer and the explicit composition boundary containing it, but ordinary
Canvas 2D content still receives a full root traversal and repaint. `Layer` and
the anticipated `WebGLLayer` are the retained boundaries at which CRC can skip
subtree work, repaint an offscreen surface, update a GPU resource, or merely
re-composite an existing bitmap. CRC may diagnose expensive stable content and
recommend a boundary, but never inserts one automatically.

The main-thread implementation is authoritative. Its value sampling is kept
separate from rendering so built-in numeric work can later move to a worker,
WASM, or packed-array kernel without changing the public model. Such an
optimization must preserve scheduler phases, logical results, lifecycle, and
the main-thread fallback.

## Goals

- Provide one small signal primitive useful throughout CRC, independent of
  animation and component mounts.
- Make every reactive read visible as `.get()` for human and agent readers.
- Support update-driven transitions, event-triggered playback, tweens,
  keyframes, springs, authored sequences, parallel work, delays, markers,
  finite repetition, looping, and custom fixed-step simulations.
- Advance all animations through one centralized, ordered frame transaction.
- Keep animation definitions portable and playback ownership explicit.
- Make seekable animations reproducible from logical time and stateful
  simulations replayable from recorded fixed-step inputs within documented
  numeric tolerances.
- Preserve CRC's immediate-mode Canvas 2D model, source paint order, component
  identity, events, layout, focus behavior, and exact resource ownership.
- Let renderer-specific consumers choose the narrowest valid invalidation,
  including future WebGL uniform, buffer, texture, draw, and composition work.
- Make animation state, scheduling, ownership, and performance behavior visible
  to diagnostics and deterministic tests.
- Leave a clean internal seam for future packed numeric execution without
  requiring workers, WASM, WebGL, or a retained scene graph initially.

## Non-goals

- Implementing the Web Animations API, CSS transitions, CSS animations, or CSS
  keyframe syntax.
- Accepting signals, animation definitions, or symbol-branded animation objects
  directly as ordinary `style` values.
- Automatically animating arbitrary prop or style changes without an explicit
  `crcTransition` or playback.
- Turning CRC into a retained scene graph or retaining arbitrary Canvas drawing
  commands.
- Automatically rendering stable components to offscreen canvases or silently
  promoting content to the GPU.
- A general physics, collision, constraint, particle, or rigid-body engine.
- Exact cross-engine floating-point identity for simulations, exact
  cross-browser Canvas pixels, or exact cross-GPU WebGL pixels.
- Worker or WASM execution in the first implementation.
- Transparent cross-thread signal objects or synchronous GPU-to-CPU state
  mirroring.
- Timeline labels, mutable timeline builders, arbitrary callback nodes, audio
  synchronization, network synchronization, or persistent serialized playback
  sessions in the initial surface.
- A public general-purpose effect/subscription API, resource API, store/proxy
  abstraction, or asynchronous computed signal.
- Automatically interpreting accessibility preferences or deciding which
  motion is essential. Applications remain responsible for selecting reduced
  or alternate animation definitions.

## Approved principles

The design follows these approved rules:

1. **Signal first.** Animation writes ordinary signals; renderers observe them.
2. **Explicit reads.** Application code reads `value.get()`. CRC style remains a
   language of resolved values, not live containers.
3. **Central scheduling.** Playback never owns `requestAnimationFrame` and
   never advances itself.
4. **One frame transaction.** All animation sampling and signal commits finish
   before any affected root renders.
5. **Renderer-neutral values, renderer-specific invalidation.** A signal does
   not intrinsically mean “rerender this component.”
6. **Immediate-mode by default.** Ordinary Canvas 2D invalidation repaints its
   root; explicit composition boundaries enable retained work.
7. **Deterministic execution; intelligent advice; explicit performance
   boundaries.** CRC may explain likely improvements but does not silently
   change rendering strategy.
8. **Definitions are portable; playback is owned.** Reusable descriptions have
   no component identity or clock. Running state always has a clock and owner.
9. **Sparse facts are events; continuous state is signals.** Per-frame state is
   not copied through an event bus.
10. **Strong logical determinism, bounded platform promises.** Replay concerns
    logical time, values, commands, and events rather than browser-owned pixels.

## Prior-art decisions

CRC adopts ideas without adopting another framework's rendering or ownership
model.

- The [TC39 Signals proposal](https://github.com/tc39/proposal-signals) informs
  the explicit `.get()` read, state/computed separation, dynamic dependency
  tracking, lazy computed evaluation, cached computed errors, and the decision
  to keep watcher machinery framework-facing rather than make effects part of
  the small application surface. The proposal remains in progress, so CRC
  adopts semantics rather than depending on a native implementation.
- [Angular Signals](https://angular.dev/guide/signals) informs writable versus
  readonly views, `set`, `update`, custom equality, lazy memoized computed
  values, `untracked`, and component dependency tracking. CRC deliberately uses
  `.get()` instead of Angular's callable getter because explicit method syntax
  is easier to identify in code.
- [Web Animations](https://www.w3.org/TR/web-animations-1/) informs the
  separation between a stateless timing/value definition and stateful playback
  connected to a timeline. CRC keeps seekable definitions as functions of
  logical time and layers pause, seek, direction, rate, and finish state on top.
- [Flutter's animation architecture](https://docs.flutter.dev/ui/animations/overview)
  informs the separation between typed values, immutable tweens/curves,
  stateful controllers, centralized tickers, and simulations with explicit
  lifecycle ownership.
- [GSAP timelines](https://gsap.com/docs/v3/GSAP/Timeline/) inform sequence,
  parallel composition, whole-program playback control, and nested programs.
  CRC initially omits a mutable builder, labels, and arbitrary callback nodes.
- [D3 transitions](https://d3js.org/d3-transition) inform explicit duration,
  delay, easing, custom interpolation, and update-driven transitions. CRC does
  not bind animation to a retained selection or DOM property.
- [React Native Reanimated shared values](https://docs.swmansion.com/react-native-reanimated/docs/2.x/fundamentals/shared-values/)
  demonstrate the performance value of a reactive graph feeding a renderer and
  the complexity introduced by cross-thread value ownership. CRC keeps signals
  synchronous and main-realm in the initial design; a future worker receives
  explicit frame inputs and returns explicit output buffers.

## Architecture and ownership

```text
immutable definitions
(tween, keyframes, spring, custom, stepper)
                    │
                    ▼
immutable programs
(track, sequence, parallel, wait, marker, repeat)
                    │
                    ▼
owned playback instances
(time, direction, rate, status, resolved starts, stepper state)
                    │ stage writes
                    ▼
signal graph and computed values
                    │ notify
                    ▼
renderer consumer scopes
(component, Layer, WebGLLayer, future official backend)
                    │ request work
                    ▼
realm scheduler and root render participants
```

### Signal ownership

A signal is not owned by a CRC mount. It can be created in module or
application code, passed through props, shared between components, observed by
multiple canvases, and retained after a mount is disposed. A signal owns its
current value and graph relationships only.

`crcSignal` is a component hook that creates one stable signal for a mounted
hook slot. Component removal detaches every CRC consumer from that signal, but
the signal remains an ordinary usable value if application code retained it.
Writing that detached value schedules no CRC work.

Signal graph edges to CRC consumers have exact owners. A successful render
replaces a consumer's previous dependency set with the reads from that render.
An unsuccessful render tears down the failed component and its edges. Component,
Layer, WebGL-resource, root, and mount teardown each detach their exact edges;
signals never keep disposed roots alive.

### Definition and program ownership

An animation definition is immutable and unbound. It describes how one value
is produced and contains no clock, scheduler registration, component identity,
or writable signal.

An animation program is also immutable, but `track` binds a definition to one
writable signal. Programs can be nested and reused when sharing those exact
outputs is intentional. A reusable component animation is normally a function
that accepts writable signals and returns a newly bound program.

Caller-owned option objects, keyframe arrays, and program child arrays are
normalized into immutable internal snapshots. Later caller mutation cannot
change a running or future playback.

### Playback ownership

`crcPlayback` creates one stable component-owned playback handle. Its hook slot
owns scheduler registration, output leases, status values, queued milestones,
and custom stepper state. Removing the component cancels the playback exactly
once and makes stale control methods inert.

An active run snapshots the current program when `play()` is accepted. A later
component render may supply a different program to the same hook for the next
run, but it does not mutate or restart the active run. This makes inline
immutable program construction safe.

There is no free-standing `play(program)` function in the initial API because
it would have ambiguous lifetime and clock ownership. A future root-controller
playback API may add explicitly root-owned animations when a concrete use case
requires animations to survive component removal.

### Scheduler and root ownership

One scheduler coordinates all top-level CRC roots in the same JavaScript realm
and uses one `requestAnimationFrame` callback for ordinary browser-driven work.
Top-level roots register as render participants in mount order. Nested Layer
instances do not schedule independent frames; they participate in their
top-level root's work graph.

Playback still belongs to the component that created it. The realm scheduler
only owns the active registration and host callback. When it has no queued work
and no running playback, it owns no pending animation frame.

A writable signal can be observed by several roots. A playback in root A may
write it and invalidate roots A and B, but root A remains the single playback
clock owner. All affected roots see the same committed value before any of them
render.

## Public signal API

The root `@crc/core` entry exports:

```ts
export type SignalEquals<T> = (previous: T, next: T) => boolean;

declare const signalBrand: unique symbol;

export interface SignalOptions<T> {
  equals?: SignalEquals<T>;
  debugName?: string;
}

export interface Signal<T> {
  readonly [signalBrand]: T;
  get(): T;
}

export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(update: (current: T) => T): void;
  asReadonly(): Signal<T>;
}

export function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T>;

export function computed<T>(
  compute: () => T,
  options?: SignalOptions<T>,
): Signal<T>;

export function untracked<T>(read: () => T): T;

export function isSignal(value: unknown): value is Signal<unknown>;

export function crcSignal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T>;
```

`signal` and `computed` work outside CRC. `crcSignal` follows CRC hook order and
must run synchronously during component rendering. Its initial value is a value,
not a lazy initializer; a function-valued signal is therefore unambiguous.

### Signal semantics

- `get()` returns synchronously and records the signal against the innermost
  active computed or CRC renderer consumer.
- Reads outside a tracked context are valid and establish no dependency.
- `untracked(callback)` suppresses dependency collection only for synchronous
  reads performed by that callback. It returns or throws exactly as the
  callback does.
- `set(value)` changes immediately. `update(callback)` synchronously reads the
  current value once, calls the callback once, and passes its result to `set`.
- If `equals` or an `update` callback throws, the signal retains its previous
  value and schedules no renderer work before rethrowing.
- Equality defaults to `Object.is`. When `equals(previous, next)` returns true,
  the current value, version, computed graph, and renderer work remain
  unchanged.
- `asReadonly()` returns one stable readonly view. It prevents writes through
  the public type and surface, but does not make an object value deeply
  immutable.
- Computed dependencies are dynamic. Each successful evaluation replaces the
  previous dependency set.
- Computed values are lazy and memoized. A source change marks them as needing
  validation; it does not eagerly execute the computation.
- A computed exception is cached and rethrown by subsequent `get()` calls until
  a dependency change makes another evaluation necessary.
- Direct or indirect computed cycles report a deterministic contextual error.
- Signal tracking is synchronous. Reads after an asynchronous boundary are not
  attributed to an earlier context.
- Writes from inside a computed callback or while a CRC component/primitive is
  rendering are rejected. Render is a read phase; events, playback commands,
  and other application callbacks are write phases.

There is no public `subscribe`, watcher, effect, or `batch` initially. CRC's
renderer consumers are internal watchers. Scheduler animation commits use an
internal batch, and ordinary application writes already coalesce renderer work
through the frame scheduler. `crcWhenChanged` retains its existing explicit
lifecycle contract rather than silently becoming a signal effect.

### Explicit style reads

Style fields continue to accept resolved style-language values only:

```tsx
function MovingRectangle() {
  const x = crcSignal(0, { debugName: "rectangle x" });

  return (
    <Rectangle
      style={{
        x: x.get(),
        y: 20,
        width: 80,
        height: 50,
        fill: "royalblue",
      }}
    />
  );
}
```

`style={{ x }}` is a type error and receives no runtime animation meaning.
The `.get()` call is the visible observation point. The active CRC render
context determines which component and render boundary depend on it.

A read must occur while CRC is evaluating a component or renderer consumer to
be reactive. Reading a signal while constructing a root element before
`crc(...)` merely snapshots its current value and establishes no dependency.
Applications place live reads in a component function:

```tsx
const x = signal(0);

function Scene() {
  return (
    <Rectangle
      style={{ x: x.get(), y: 20, width: 80, height: 50, fill: "royalblue" }}
    />
  );
}

crc(canvas, <Scene />);
```

An official specialized renderer API may accept a signal directly when the API
names the binding, such as a future `webglUniform(x)`. That is an explicit
renderer resource binding, not an exception for ordinary style.

## Animation value definitions

All durations and local times are finite nonnegative milliseconds unless a
specific program contract admits positive infinity. Public definitions are
nominally branded and cannot be forged accidentally by plain objects.

The root entry exports the following normative surface. Declaration overloads
may improve generic inference without changing these contracts:

```ts
export type CRCEasing = (progress: number) => number;

export type CRCInterpolator<T> = (from: T, to: T, progress: number) => T;

declare const animationDefinitionBrand: unique symbol;

export interface CRCAnimationDefinition<T> {
  readonly [animationDefinitionBrand]: T;
}

export function tween<T>(options: {
  from?: T;
  to: T;
  duration: number;
  easing?: CRCEasing;
  interpolate?: CRCInterpolator<T>;
  debugName?: string;
}): CRCAnimationDefinition<T>;

export function keyframes<T>(options: {
  values: readonly [T, T, ...T[]];
  offsets?: readonly number[];
  duration: number;
  easing?: CRCEasing | readonly CRCEasing[];
  interpolate?: CRCInterpolator<T>;
  debugName?: string;
}): CRCAnimationDefinition<T>;

export function spring(options: {
  from?: number;
  to: number;
  mass?: number;
  stiffness?: number;
  damping?: number;
  initialVelocity?: number;
  restSpeed?: number;
  restDelta?: number;
  maxDuration?: number;
  debugName?: string;
}): CRCAnimationDefinition<number>;

export function defineAnimation<T>(definition: {
  duration: number;
  sample(input: { initialValue: T; localTime: number; progress: number }): T;
  debugName?: string;
}): CRCAnimationDefinition<T>;

export function stepper<State, T>(definition: {
  stepMilliseconds: number;
  maxElapsedMilliseconds?: number;
  initial(currentValue: T): State;
  step(state: State, deltaMilliseconds: number): State;
  read(state: State): T;
  done?(state: State): boolean;
  debugName?: string;
}): CRCAnimationDefinition<T>;

export const easing: {
  readonly linear: CRCEasing;
  readonly easeIn: CRCEasing;
  readonly easeOut: CRCEasing;
  readonly easeInOut: CRCEasing;
  cubicBezier(x1: number, y1: number, x2: number, y2: number): CRCEasing;
  steps(count: number, position?: "start" | "end"): CRCEasing;
};
```

The public `CRCAnimationDefinition<T>` exposes no callable sampler. Definitions
are consumed by animation programs, which lets CRC validate and evolve the
execution protocol without turning an internal callback shape into a permanent
extension interface. `defineAnimation` and `stepper` are the deliberate custom
extension points.

### Tween and interpolation

`tween` maps clamped local progress through its easing function and then its
interpolator. If `from` is omitted, each track captures the output signal's
value when that track becomes active. This supports interruption and later
sequence stages without constructing definitions during an event.

Easing defaults to `linear`. A zero-duration tween commits `to` and completes
when activated.

Activation reads the transaction-local value for the output. That includes an
earlier staged write from a preceding track in the same program, even though
the public signal graph does not expose staged values until Commit. A sequence
that crosses several zero-duration or completed tracks in one Advance phase
therefore composes in source order without exposing partial state.

Numbers use built-in linear interpolation when `interpolate` is omitted. Every
other value type requires an interpolator. CRC does not guess how to interpolate
CSS color strings, gradients, patterns, paths, matrices, arbitrary objects, or
user classes. Applications may supply reusable typed interpolators, and CRC may
add separately specified built-ins later.

Easing receives normalized progress. Built-in easing functions are immutable
and deterministic. Custom easing must be synchronous and must not write
signals. Overshooting easings may return values outside `[0, 1]`; interpolation
receives that result without an additional clamp.

### Keyframes

Keyframes contain at least two explicit values. Omitted offsets are evenly
spaced. Supplied offsets must have the same length as `values`, begin at `0`,
end at `1`, be finite, and be nondecreasing. Equal adjacent offsets create a
discrete jump in declaration order.

One easing function applies to every segment. An easing list must contain
exactly `values.length - 1` functions. Keyframes share tween interpolation
rules.

### Spring

The built-in spring is a one-dimensional analytic damped oscillator, not a
frame-integrated simulation. It uses seconds internally and exposes velocity in
logical units per second. Omitted values are `mass: 1`, `stiffness: 170`,
`damping: 26`, `initialVelocity: 0`, `restSpeed: 0.01`, `restDelta: 0.001`, and
`maxDuration: 10_000` milliseconds.

If `from` is omitted, the track captures its output when activated. CRC derives
a stable settlement duration from the oscillator and thresholds independently
of display refresh rate. At settlement or `maxDuration`, the spring commits the
exact `to` value. This makes a spring seekable and allows it to participate in
sequence duration without depending on which host frames happened to arrive.

Mass and stiffness must be finite and greater than zero. Damping, thresholds,
and maximum duration must be finite and nonnegative, with a positive maximum
duration. Invalid definitions fail at construction rather than during a later
frame.

### Custom seekable definitions

`defineAnimation` is for values that are a pure function of local time. The
callback may return any `T`, but is synchronous, receives no renderer or
scheduler object, and cannot write signals or invoke CRC hooks. Seeking samples
it directly at the requested time.

For a zero-duration custom definition, `localTime` is `0` and `progress` is
`1` on its only sample.

A custom definition is opaque and main-thread-only. It is not assumed to be
serializable or eligible for a future built-in worker/WASM kernel.

### Stateful steppers

`stepper` covers acceleration, velocity, constraints, procedural systems, and
other numerical integrations that require prior state. Each playback owns its
state. `initial` runs once when a track activates; `step` advances by the exact
fixed `stepMilliseconds`; `read` projects state to the output; and optional
`done` ends the track.

The scheduler accumulates elapsed logical time and performs only whole fixed
steps. `stepMilliseconds` and `maxElapsedMilliseconds` must be finite and
positive. To prevent an unbounded catch-up spiral after a stalled or
backgrounded page, one host-frame delta contributes at most
`maxElapsedMilliseconds`, defaulting to `100`. Discarded elapsed time is
recorded in the diagnostic trace. Any fractional remainder is retained for the
next frame.

Stepper seeking and replay reset to the activation snapshot and replay fixed
steps. They are therefore deterministic for the same definition, initial
state, commands, and applied elapsed sequence, but not constant-time. Custom
state and callbacks are application-owned code; cross-engine comparisons use
documented tolerances rather than bitwise equality.

Stepper callbacks must not mutate state retained outside the playback, write
signals, use CRC hooks, or depend on wall-clock time, randomness, the Canvas,
or WebGL if deterministic replay is expected. CRC cannot prove callback purity,
but diagnostics identify the failing definition when a callback throws.

## Animation programs

```ts
declare const animationProgramBrand: unique symbol;

export interface CRCAnimationProgram {
  readonly [animationProgramBrand]: true;
}

export function track<T>(
  output: WritableSignal<T>,
  definition: CRCAnimationDefinition<T>,
): CRCAnimationProgram;

export function sequence(
  ...children: CRCAnimationProgram[]
): CRCAnimationProgram;

export function parallel(
  ...children: CRCAnimationProgram[]
): CRCAnimationProgram;

export function wait(duration: number): CRCAnimationProgram;

export function marker(name: string): CRCAnimationProgram;

export function repeat(
  child: CRCAnimationProgram,
  options: {
    iterations: number;
    direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  },
): CRCAnimationProgram;
```

- `track` is the only ordinary node that writes a user signal.
- `sequence` activates children in argument order. A large seek or elapsed jump
  resolves every crossed boundary in source order and commits the active value
  for the destination time.
- `parallel` gives each child the same local origin and completes when its
  longest child completes. Finished children leave their final signal values
  unchanged.
- Empty `sequence()` and `parallel()` complete immediately.
- `wait` has finite nonnegative time but no output.
- `marker` requires a nonempty name, has zero duration, and queues one named
  playback milestone. It does not execute arbitrary code during sampling.
- `repeat` requires an integer `iterations >= 1` or positive infinity. The
  number is total iterations, not additional repeats. Direction applies to the
  child's local time on each iteration and defaults to `normal`.
- A program containing a nonterminating stepper or infinite repeat has infinite
  duration. It cannot be placed before a later reachable sequence child and
  cannot be explicitly finished.

Programs reject overlapping tracks that can write the same signal at the same
logical time. Sequential writes to the same signal are valid.

When a play command is accepted, the run acquires one writer lease for every
writable signal reachable in its program, before sampling any track. It holds
those leases through waits and sequential stages until finish, cancellation,
replacement, failure, or teardown. Reserving outputs for the whole run makes a
conflict fail at a predictable Begin phase rather than halfway through a
sequence.

Starting another playback against an already leased output reports a
deterministic conflict by default. A caller may explicitly request replacement,
which cancels the previous owner before the new run captures its initial value.
Direct `set` or `update` of an animation-leased signal is also rejected; the
author must cancel the player first. This avoids invisible last-writer-wins
behavior.

Example:

```tsx
function Card() {
  const x = crcSignal(-40, { debugName: "card x" });
  const opacity = crcSignal(0, { debugName: "card opacity" });
  const scale = crcSignal(0.9, { debugName: "card scale" });

  const entrance = sequence(
    parallel(
      track(x, tween({ to: 0, duration: 240, easing: easing.easeOut })),
      track(opacity, tween({ to: 1, duration: 180 })),
    ),
    marker("arrived"),
    track(scale, spring({ to: 1 })),
  );

  crcPlayback(entrance, { autoplay: true });

  return (
    <Group
      style={{
        translateX: x.get(),
        scaleX: scale.get(),
        scaleY: scale.get(),
      }}
    >
      <Rectangle
        style={{
          x: 0,
          y: 0,
          width: 120,
          height: 72,
          fill: "royalblue",
          opacity: opacity.get(),
        }}
      />
    </Group>
  );
}
```

The exact style fields in examples remain governed by each component's current
style contract; animation does not add otherwise unsupported style properties.

## Playback API and lifecycle

```ts
export type CRCPlaybackStatus =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "finished"
  | "cancelled"
  | "disposed";

export interface CRCPlaybackEvent {
  readonly type: "start" | "iteration" | "marker" | "finish" | "cancel";
  readonly logicalTime: number;
  readonly frameId: number;
  readonly programPath: readonly number[];
  readonly iteration: number;
  readonly marker?: string;
}

export interface CRCPlayback {
  readonly status: Signal<CRCPlaybackStatus>;
  readonly currentTime: Signal<number>;

  play(options?: { conflict?: "error" | "replace" }): void;
  pause(): void;
  resume(): void;
  cancel(): void;
  finish(): void;
  seek(milliseconds: number): void;
  reverse(): void;
  setPlaybackRate(rate: number): void;
}

export interface CRCPlaybackOptions {
  autoplay?: boolean;
  conflict?: "error" | "replace";
  debugName?: string;
  onEvent?(event: CRCPlaybackEvent): void;
  onError?(error: unknown): void;
}

export function crcPlayback(
  program: CRCAnimationProgram,
  options?: CRCPlaybackOptions,
): CRCPlayback;
```

The handle is stable for its mounted hook slot. The latest successfully
rendered program becomes the input for the next run. An active run retains its
program snapshot, while milestone and error delivery use the latest callbacks
from the still-mounted hook slot, matching CRC's live event-handler model.
Replacing a callback does not replay an earlier event. `autoplay` queues one
play after the mounting render succeeds; it does not replay merely because a
later program object has different identity. `autoplay` defaults to `false`,
and conflict handling defaults to `error`.

Control methods enqueue commands for the scheduler's next Begin phase and
schedule the shared host frame. Playback metadata changes, including the move
to `scheduled`, are staged and become visible in Commit with all other
animation writes. A new `play` on the same running handle restarts that handle
and resolves omitted track starts from the currently committed outputs.
`pause`, `resume`, `seek`, `reverse`, and rate changes preserve the same active
run and output leases.

Commands are processed in invocation order. `seek` on an idle, cancelled, or
finished handle resolves a fresh activation snapshot, acquires its outputs,
samples the requested time, and leaves the run paused. `reverse` on an idle
handle starts a finite seekable program from its terminal time. A stateful
program whose terminal time has not yet been discovered cannot start in reverse
or be finished; it reports a contextual control error instead.

Playback rate must be finite and greater than zero. `reverse` changes direction
while preserving the currently presented local time. `seek` clamps finite
programs to their active interval. A stepper seek replays fixed steps from its
activation snapshot and may therefore be expensive. `finish` samples the
terminal state and rejects infinite or unresolved-stateful programs. `cancel`
retains currently committed user signal values; CRC does not silently restore
pre-animation values.

Playback status and current time are signals, so observing them is explicit and
only their actual consumers are invalidated. A completed program retains its
final user values and `finished` status until replayed or disposed.

Milestones are queued during Advance and delivered after the frame's successful
render work. A marker or finish handler therefore observes the values and tree
state committed for that frame. Commands and signal writes issued by a
milestone handler schedule the next frame transaction and cannot re-enter the
current one. Same-time events use program source order, then playback
registration order.

`programPath` is the immutable child-index path within the active program
snapshot. It is empty for playback-wide start, finish, and cancel events and
identifies the relevant repeat or marker node otherwise. `iteration` is
zero-based. `marker` is present only for marker events.

On component removal, a component-owned playback releases output leases,
custom state, callbacks, and scheduler registration. It becomes `disposed`;
saved control methods are inert and cannot affect a replacement mount. Any
milestone still queued for that removed owner is discarded.

## Update-driven transitions

`crcTransition` is the explicit convenience for “when this target changes,
animate the presented value from where it is now.” It is implemented as a
component-owned playback producer and uses the same scheduler phases.

```ts
export interface CRCTweenTransitionOptions<T> {
  type: "tween";
  duration: number;
  easing?: CRCEasing;
  interpolate?: CRCInterpolator<T>;
  equals?: SignalEquals<T>;
  initial?: T;
  debugName?: string;
}

export interface CRCSpringTransitionOptions {
  type: "spring";
  mass?: number;
  stiffness?: number;
  damping?: number;
  initialVelocity?: number;
  restSpeed?: number;
  restDelta?: number;
  maxDuration?: number;
  equals?: SignalEquals<number>;
  initial?: number;
  debugName?: string;
}

export function crcTransition(
  target: number,
  options: CRCSpringTransitionOptions,
): Signal<number>;

export function crcTransition<T>(
  target: T,
  options: CRCTweenTransitionOptions<T>,
): Signal<T>;
```

The spring overload is available only for `number`. On mount, omitted `initial`
uses `target` and performs no entrance animation. Supplying a different
`initial` presents that value on the mounting render and queues a transition to
`target` after the render succeeds.

On later successful renders, a target that differs according to `equals`
retargets from the last committed presented value. Tween retargeting restarts
its duration. Spring retargeting carries the current analytic velocity into the
new spring. Several target changes before the next Begin phase coalesce to the
latest successful target.

The returned readonly signal is read explicitly:

```tsx
function Indicator({ targetX }: { targetX: number }) {
  const x = crcTransition(targetX, {
    type: "spring",
    stiffness: 210,
    damping: 28,
  });

  return (
    <Circle style={{ cx: x.get(), cy: 20, radius: 10, fill: "royalblue" }} />
  );
}
```

Transitions do not expose a second scheduler, implicitly observe arbitrary
props, or make style itself reactive. They are a focused hook over the same
signal/playback machinery.

## Central scheduler and frame phases

The centralized realm scheduler is the only owner of
`requestAnimationFrame`. Normal CRC state, root replacement, resize, density,
focus, image, Layer, WebGL, and animation requests all enter the same pending
work set.

Each host frame executes these phases:

```text
1. Begin
   capture one host timestamp, logical timestamp, and monotonically increasing
   frame identity; snapshot pending roots and drain accepted playback commands

2. Advance
   sample every active definition and fixed-step simulation in stable order;
   stage user-output, playback-status, and playback-time writes; queue markers
   and terminal milestones without invoking application callbacks

3. Commit
   apply all staged signal values as one graph batch; no renderer or callback
   observes a partially advanced animation set

4. Plan
   validate lazy computed dependencies, discard unchanged derived results,
   aggregate dirty consumers to explicit render/resource boundaries, and order
   retained child-surface work before parent composition

5. Render
   execute planned Canvas 2D roots, Layer surfaces, WebGL resource updates and
   draws, and parent composition; every renderer observes the same committed
   signal graph and logical timestamp

6. Complete
   finish render transactions, release ended registrations and output leases,
   publish playback milestones and renderer semantic events, report isolated
   errors, and schedule another host frame only when work remains
```

All active playback advances before any root starts rendering. Roots render in
stable mount order after required retained descendants. No playback, component,
Layer, or renderer integration can create an independent animation loop.

Work requested during Begin before its snapshot may participate in that frame.
Work requested during Advance through Complete is deferred to the next frame,
except internal descendant rendering already present in the frozen render plan.
This rule prevents phase reentrancy and makes traces replayable.

Time-based definitions sample the frame's logical timestamp rather than adding
host deltas. Dropped frames therefore jump to the correct tween, keyframe, or
analytic-spring value. Stateful steppers alone consume the clamped, recorded
elapsed sequence described above.

## Rendering and invalidation

### Consumer scopes

CRC installs a tracked consumer while synchronously evaluating a component,
resolving its style, and running a primitive. A computed temporarily becomes
the innermost consumer while it evaluates. Renderer integrations may install
narrower friend-API consumers for named resources.

Conceptually, signal invalidation can result in:

| Consumer                                             | Narrowest valid work                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Ordinary Canvas 2D component                         | Repaint its top-level immediate-mode root                                       |
| Component inside `Layer`                             | Repaint that Layer surface, then repaint/re-composite ancestors                 |
| `Layer` placement, alpha, transform, or outer filter | Reuse its bitmap when its retained child input is unchanged and re-composite it |
| WebGL uniform binding                                | Upload the uniform and redraw its `WebGLLayer`                                  |
| WebGL buffer or texture binding                      | Update that resource and redraw its `WebGLLayer`                                |
| `WebGLLayer` placement or outer presentation         | Reuse its drawing buffer and re-composite it                                    |
| Untracked application code                           | No rendering work                                                               |

Exact component dependencies remain useful for diagnostics and future
optimizations, but they do not authorize skipping immediate-mode Canvas draws.
Outside an explicit retained boundary, CRC clears and traverses the full root
as it does today.

### Layer behavior

A signal read only inside a `Layer` belongs to that nested Layer instance. A
change marks the Layer dirty and the scheduler orders its repaint before the
top-level root composites the new bitmap. Other unchanged Layer subtrees retain
their existing cache behavior.

A signal read in the parent while calculating only the Layer's placement or
outer presentation dirties the parent root, not the Layer child. The parent
traversal may therefore reuse the child's cached bitmap. Existing tree,
dimension, density, focus, filter, interaction, and teardown rules remain
authoritative.

### No automatic caching

CRC does not infer that an unchanged component should become an offscreen
surface. Allocating, resizing, copying, and compositing a bitmap can be more
expensive than repainting simple geometry and consumes persistent memory.

Development diagnostics may report stable subtrees that are repeatedly
painted, estimated pixel area, draw counts, Layer cache hit/miss counts, and
whether an animation changes only presentation. Recommendations may suggest a
`Layer`, but the author must add or remove the boundary explicitly.

The baseline remains simple: update numbers in one signal batch, then repaint
the affected immediate-mode roots. More granular resource work is permitted
only where an explicit renderer or composition boundary gives it correct
semantics.

## WebGL integration

The anticipated `@crc/webgl` package consumes this design through the official
`@crc/core/internal` friend surface. This specification does not define the
public WebGL component API, picking model, or package release contract.

The friend surface must allow an official renderer to:

- register a signal consumer with a named invalidation category;
- request frame work through the realm scheduler;
- receive the current logical time and frame identity;
- stage or consume values without creating a separate `requestAnimationFrame`;
- order resource updates, draw work, and composition in the Render phase;
- release consumer edges and frame registrations through exact ownership;
- enqueue sparse semantic or context lifecycle events for Complete.

Ordinary cross-renderer animation shares signals. For example, one program may
track a signal observed by a Canvas 2D component and another observed by a
WebGL uniform; both values commit before either renderer runs.

`WebGLLayer` should not emit per-frame state events to coordinate animation.
Frame demand is an internal scheduler request, continuous state is a signal,
and start/iteration/marker/finish/cancel are playback milestones. Sparse scene
facts such as collision, selection, asset readiness, and context loss may be
typed semantic events. Events produced during WebGL work are queued for
Complete with logical time and frame identity; handlers can affect only a later
frame.

GPU-originated readback events are asynchronous and belong to the weaker
determinism tier. Cross-renderer state that must be reproduced should remain
CPU/signal-owned. On WebGL context loss, playback continues by default while
the renderer consumer is suspended; restoration draws the latest committed
values. An application may explicitly pause its player in a context event.

## Determinism, seeking, and replay

CRC promises determinism in tiers.

### Seekable definitions

Tween, keyframe, analytic spring, wait, marker, repeat of finite seekable
content, and custom `defineAnimation` output are functions of a resolved
activation snapshot and logical time. Given the same normalized definition,
initial signal values, accepted commands, and logical time, they produce the
same logical result within the same implementation.

They support direct seeking. Refresh rate changes which intermediate frames are
presented, not the value associated with a particular logical time.

### Stateful steppers

Steppers replay their fixed applied steps from the same activation state. CRC
records applied elapsed time, discarded gap time, step size, accepted commands,
and event ordering. Numeric comparisons use definition-appropriate tolerances;
CRC does not promise bit-identical floating point across JavaScript engines or
user callbacks.

### Renderer output

Canvas path behavior, font measurement/rasterization, decoded images, native
filters, color management, WebGL shaders, drivers, and GPU floating point
remain platform-authoritative. A logical replay may produce equivalent state
without pixel-identical output on another engine or GPU.

### Manual clock and traces

The scheduler has an injectable internal clock driver from the first
implementation. Test and diagnostic tooling can disable the browser driver and
advance one realm transaction to an exact logical timestamp. The production
public surface initially exposes playback `seek`; a separately designed public
manual-clock API may follow once testing proves the correct ownership boundary.

The trace seam records:

- frame and logical timestamps;
- accepted playback commands and their stable order;
- active playbacks and sampled local times;
- staged and equality-suppressed signal writes;
- invalidated computed values and renderer consumers;
- planned and completed boundary work;
- milestones, semantic events, clamped stepper elapsed time, and errors.

This seam supports browser laboratories and future developer tooling. It does
not retain a scene graph or make component identities public.

## Error handling and phase isolation

- Invalid definitions and statically conflicting programs throw during
  construction with the definition/program path and `debugName` when present.
  Validation that depends on an omitted `from` value, including a missing
  interpolator for a nonnumeric captured value, fails while accepting the play
  command before any output lease or staged write survives.
- A custom easing, interpolator, sampler, or stepper exception cancels only the
  failing playback. Writes staged by that playback for the current frame are
  discarded; other playback continues.
- `onError`, when supplied, receives the error during Complete. Otherwise CRC
  reports it through its ordinary host error-reporting path after other frame
  work has had a chance to complete.
- One root render failure retains CRC's current fail-closed component/resource
  teardown and non-rollback pixel behavior. The scheduler isolates the root so
  other roots can still render from the committed signal graph.
- Signal values committed before a render failure are not rolled back.
  Component-owned playback removed by fail-closed teardown is cancelled;
  unrelated playback survives.
- Computed errors remain attached to the computed value and enter ordinary
  render recovery only when a renderer reads them.
- Milestone and semantic-event listener errors use event-style isolation: later
  queued callbacks still run, then errors are reported.
- A disposed root, component, playback, renderer resource, or signal consumer
  cannot schedule work for a replacement identity.

## Performance architecture

The initial implementation prioritizes structural efficiency that can be
proved deterministically:

- one pending host animation frame for the realm, regardless of active root or
  playback count;
- stable registries with exact add/remove ownership;
- active playback only in the Advance set;
- one staged write per output per frame and one graph invalidation batch;
- equality suppression before renderer planning;
- lazy computed evaluation and dynamic edge pruning;
- no per-tick offscreen-surface allocation;
- no pixel readback;
- no rerender when all sampled outputs and observed playback metadata compare
  equal;
- Layer cache reuse and WebGL resource invalidation remain visible separately
  from root traversal counts.

Wall-clock performance thresholds are informative and controlled, not default
correctness gates. Structural counters prove scheduler callbacks, sampled
players, steps, writes, computations, root traversals, Layer repaints,
composites, WebGL updates, allocations, and release counts.

### Future packed execution

Built-in numeric definitions must keep normalized data separate from renderer
objects and application callbacks. Internally, the scheduler may later compile
eligible tracks into structure-of-arrays buffers containing definition kind,
time parameters, numeric state, and output slots.

A future worker or WASM kernel would receive a frame identity, logical time,
command snapshot, and input buffers, then return staged output buffers. The
main scheduler would not enter Commit until the matching result is accepted.
Late or stale results could not mutate a replacement run. Custom functions and
nonserializable values would stay on the main thread in the same Advance phase.

No such optimization may introduce a second observable clock, asynchronous
signal reads, different conflict semantics, or renderer access from the numeric
kernel.

## Resource ownership

The runtime ownership ledger gains explicit rows for:

| Resource                      | Created by                     | Owner                             | Released by                                                  |
| ----------------------------- | ------------------------------ | --------------------------------- | ------------------------------------------------------------ |
| CRC render-consumer edge      | Successful tracked read        | Exact component/resource consumer | Next successful dependency replacement or owner teardown     |
| Component signal hook slot    | `crcSignal` mount              | Exact component refs              | Component teardown; retained signal merely becomes detached  |
| Computed source edges         | Successful computed evaluation | Computed node while observed      | Dependency replacement or loss of final observer             |
| Playback registration         | Accepted `play`/autoplay       | Exact playback hook slot          | Finish, cancel, error, or component teardown                 |
| Output writer lease           | Accepted run before sampling   | Exact active playback run         | Finish, cancel, error, replacement, or teardown              |
| Stepper state and accumulator | Stepper activation             | Exact active playback run         | Track end, cancel, error, or teardown                        |
| Realm host frame              | First pending work             | Realm scheduler                   | Host callback start or cancellation when all work disappears |
| Root render participation     | Root mount                     | Exact CRC controller              | Controller disposal, abort, or failed mount                  |

Release is driven by explicit lifecycle counters rather than garbage collection
timing. Weak references may be an implementation optimization but are not the
correctness mechanism.

## Validation and diagnostics

Development diagnostics should identify:

- illegal signal writes during computed evaluation or render;
- computed cycles;
- stale or disposed playback control;
- nonfinite durations, offsets, rates, spring parameters, steps, or sampled
  numeric outputs;
- keyframe length/order mismatches;
- a missing interpolator for nonnumeric values;
- program paths containing overlapping signal writers;
- active output lease conflicts and the explicit replacement option;
- infinite content before a later sequence child;
- attempts to finish an infinite program;
- custom callback failures with definition, program, playback, frame, and local
  time context;
- retained boundaries with repeated cache misses;
- hot stable subtrees where an explicit Layer might help, without automatically
  changing behavior;
- stepper elapsed time discarded by its gap clamp.

Debug names improve traces but do not become runtime identity. Production
behavior, ownership, ordering, and errors cannot depend on a debug name.

## Testing and evidence

### Signal graph

Focused unit tests cover `.get`, `set`, `update`, `asReadonly`, `Object.is` and
custom equality, dynamic dependencies, nested computed values, laziness,
memoization, cached errors, cycles, `untracked`, synchronous tracking only,
illegal writes, and edge release after dependency change and teardown.

### Scheduler and playback

Controlled-clock tests prove one host frame across multiple roots, exact phase
order, stable playback and root ordering, batched visibility, command deferral,
pause/resume/reverse/rate/seek/finish/cancel, same-frame markers, conflict
handling, stale handles, exception isolation, and zero pending frames after the
last owner releases.

### Definitions and composition

Table-driven tests sample boundary and intermediate times for every easing,
tween, keyframe offset, spring damping regime, sequence, parallel group, wait,
marker, direction, repeat count, infinite program rejection, custom sampler,
and fixed-step accumulator. Seek results are compared with forward playback;
stepper replay uses explicit tolerances.

### Rendering integration

Public-API tests prove:

- explicit signal reads schedule ordinary root repaint;
- several animation writes produce one root render;
- shared signals commit before two top-level canvases render;
- Layer-internal reads repaint the Layer before parent composition;
- presentation-only Layer changes reuse its bitmap;
- unchanged computed output suppresses renderer work;
- filters, layout, transforms, clipping, events, focus, and source paint order
  retain their current semantics during animation;
- render failure releases consumers and component-owned playback while another
  root continues.

The later `@crc/webgl` implementation supplies equivalent public evidence for
uniform, resource, draw, composition, context loss, delegated events, and
cross-renderer signal commits. Core uses a private fake renderer participant to
prove the friend scheduler protocol before WebGL ships.

### Scenarios and trust gate

One learning example introduces signals, update-driven transition, and
event-triggered playback. A separate deterministic animation laboratory exposes
play, pause, step, seek, reverse, retarget, repeat, simulation, Layer, shared
root, and trace controls. Headless tests drive the same laboratory with a
controlled clock and assert semantic values and render counts before visual
evidence.

New exports must agree across source and built browser modes, root declarations,
Bundler and NodeNext consumers, packed package consumers, `@crc/core` API docs,
and Studio editor declarations. Lifecycle stress repeats mount, play, replace,
cancel, remove, and dispose while asserting exact graph, playback, writer,
frame, Layer, and instance counts.

Visual baselines freeze logical time and cover only relationships for which
pixels add evidence. They are never updated merely because an uncontrolled
animation frame differs.

## Compatibility and migration

This is additive public API, but centralized scheduling changes an internal
contract. Existing `crcState`, root replacement, resize, density, image, focus,
event, and Layer updates continue to coalesce on the next animation frame. The
observable improvement is that every root and animation shares one realm
callback and one phase order.

`crcState` remains supported and does not become an alias for `crcSignal`:

- `crcState` is hook-local snapshot state whose setter schedules its exact
  mounted instance under the existing stale-setter rules.
- `crcSignal` returns a shareable reactive object with explicit reads and
  renderer dependency tracking.

The implementation may reuse graph machinery internally only if current public
state identity, hook ordering, update order, error recovery, and teardown
contracts remain unchanged.

Current `CRCInstance.animationFrameId` ownership moves to the realm scheduler.
Layer child instances stop owning independent pending frames. Existing direct
render entry points used by tests and nested composition must enter or inherit
the current scheduler/render transaction rather than cancel unrelated realm
work.

## Final boundaries

This design establishes a general reactive value graph, a centralized animation
engine, and renderer-aware invalidation. It does not promise that every
animation avoids full Canvas repaint, that every custom simulation is portable
to another thread, or that rendering is pixel-identical across platforms.

The intended rule is simple enough to read directly in application code:

```text
definitions describe values
programs bind values to writable signals
playback owns running state
the scheduler advances everything together
.get() declares who consumes the result
explicit boundaries decide how narrowly CRC can render it
```
