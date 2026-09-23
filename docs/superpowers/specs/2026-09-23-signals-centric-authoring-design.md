# Signals-centric hook and reactive authoring design

> **Status: WRITTEN SPECIFICATION FOR REVIEW.** The architecture, public-model
> direction, scheduler lifecycle, and explicit-render-boundary strategy were
> approved in conversation on 2026-09-23. This document is the complete written
> specification awaiting final review before an implementation plan is written.

Date: 2026-09-23

## Summary

CRC will adopt one public reactive-state model centered on synchronous signals.
`useSignal` becomes the only writable component-state hook. Public `useState`,
`StateUpdater`, `useMemo`, and `useWhenChanged` are removed without compatibility
aliases. CRC adds `batch`, `useComputed`, `useConst`, and `useReaction`:

- `batch` groups synchronous signal writes into one deduplicated notification
  wave;
- `useComputed` owns one stable lazy computed signal for a component hook slot;
- `useConst` constructs one non-reactive value for a component lifetime; and
- `useReaction` owns signal-driven imperative setup and exact cleanup without
  making its signal reads component-render dependencies.

`useRef` remains the mutable non-reactive cell. Specialized hooks remain because
they own resources, event registrations, scheduler participants, render
transactions, or backend state rather than merely storing values.

The implementation will optimize the graph before migrating the public surface.
Stable reactive edges will use reusable intrusive ownership records rather than
allocating `Set` and `Map` collections during every component evaluation. A
component that reads no signals will acquire no reactive consumer or dependency
storage. The common component-owned signal with one consumer will not pay for a
general-purpose observer collection. Readonly signal views will remain lazy.

Signals make scheduling, derivation, and non-rendering reactions fine grained;
they do not make arbitrary immediate-mode Canvas pixels independently
repaintable. Ordinary invalidated Canvas instances still clear and traverse
their complete immediate-mode tree. Persistent pixel isolation remains explicit
through `Layer`, WebGL, and official renderer boundaries.

CRC will not automatically cache components as images, create an
`OffscreenCanvas` per component, infer implicit Layers, retain arbitrary Canvas
drawing commands, or introduce a DOM-like scene graph. The author has already
tested per-component OffscreenCanvas caching and found its construction and
surface churn prohibitively expensive. That evidence agrees with the runtime
model: a reusable transient pool cannot preserve cached component pixels, while
persistent per-component surfaces add memory, clearing, copying, and compositing
cost even when replaying simple primitives would be cheaper.

This is a breaking authoring change. Current active code, tests, examples,
Studio declarations, API pages, guides, catalog metadata, package consumers, and
official sibling packages will migrate together. Historical design and field
records remain historical evidence and are not rewritten into false current
state.

## Intent and success criteria

The primary purpose is performance, with API coherence as a supporting benefit.
The change succeeds only if measured runtime work improves in the cases signals
can optimize and does not materially regress the unavoidable full-repaint case.

The design succeeds when:

- authors have one writable state primitive inside and outside components;
- equal writes schedule no work;
- several synchronous writes can notify each affected consumer once;
- computed equality prevents downstream component invalidation before Render;
- signal-driven imperative synchronization can run without Canvas traversal;
- stable reactive dependencies produce no per-render collection churn;
- components without signal reads pay no live-consumer or dependency-edge cost;
- one component-owned signal and one reader use the graph's cheapest ownership
  representation and promote safely when sharing appears;
- ordinary non-equal state changes are no materially slower than current
  `useState` on equivalent workloads;
- existing Layer isolation and official-renderer invalidation become neither
  broader nor more expensive;
- the current immediate-mode, identity, hook-order, failure, and teardown
  contracts remain intact except where this specification explicitly changes
  public hook behavior; and
- the migration leaves no current supported surface teaching or exporting the
  removed APIs.

## Non-goals

- Automatic per-component bitmap caching or Layer promotion.
- A retained Canvas display list, virtual DOM, scene graph, or reconciled host
  node tree.
- Arbitrary component-level pixel repaint inside one immediate-mode surface.
- Implicit signal unwrapping in JSX, styles, props, or text.
- Making ordinary props into signals.
- Asynchronous signals, Promise tracking, Suspense, server components, or a
  worker-owned graph.
- Deep structural equality by default.
- A general public subscription API in this change.
- Replacing specialized resource-owning hooks with generic signals.
- Renaming every hook merely to make the vocabulary uniform.
- Preserving source compatibility with `useState`, `StateUpdater`, `useMemo`, or
  `useWhenChanged`.

## Current-state audit

### Public hook and signal surface

The current root package exports:

- graph primitives `signal`, `computed`, `untracked`, and `isSignal`;
- state hooks `useState` and `useSignal`;
- cache and cell hooks `useMemo` and `useRef`;
- synchronous lifecycle hook `useWhenChanged`;
- animation ownership hooks `usePlayback` and `useTransition`;
- path hooks `useRectPath`, `useLinePath`, and `useSvgPath`;
- event/focus hooks `useEvent`, `useEventTarget`, `useEventListener`, and
  `useCursor`; and
- render-context accessors `useLayoutBox` and `useCanvasContext`.

Official sibling packages add `useAnimationFrame`, `useOrbitCamera`,
`useGLTF`, and `useParticleSystem`. Physics exposes component-owned world and
body endpoints under its deliberate `crcPhysicsWorld*` and
`crcPhysicsBody*` vocabulary. Those endpoints already expose field state as
readonly signals.

### Current `useState`

`useState` owns a value and stable setter in one hook slot. Each accepted call
mutates the stored value and requests the complete owning CRC instance through
the scheduler. It has no equality suppression. Setting the current value still
requests a frame. Function values are ambiguous because a function passed to the
setter is always treated as an updater. A stale setter becomes inert after its
exact component or mount starts teardown.

### Current `useSignal`

`useSignal` creates one ordinary writable signal in a hook slot. `set()` treats
functions as values, `update()` is the explicit updater operation, and
`Object.is` is the default equality. A retained hook signal remains writable
after owner removal, but detached render edges mean those writes schedule no
work for the removed owner.

Every non-fragment component currently creates a render consumer eagerly.
Every component evaluation creates a new dependency `Set`; successful
evaluation reconciles that set against a dependency `Map`. Each signal node owns
an observer `Set`, and computed nodes additionally own dependency and observation
maps. This is general and correct but allocation-heavy for the overwhelmingly
common zero-, one-, and few-edge cases.

### Current computed scheduling

`computed` is already lazy, cached, dynamically dependent, equality-aware, and
observation-aware. An observed invalidation requests Plan work without dirtying
a renderer. Plan validates dependency-first; an equal result ends with no
component traversal. Component reads of a computed attach to the computed node,
while its source reads belong to the computed's nested collector.

This propagation barrier is the material semantic advantage over `useMemo`.
`useMemo` caches a plain value only while the component is already evaluating;
it cannot prevent that component from becoming dirty when a directly-read
source changes.

### Current renderer granularity

Signal reads are owned by exact component consumers, but an invalidated
component requests its complete owning CRC instance. An ordinary Canvas root
then clears and traverses the full tree. A managed `Layer` is a distinct private
instance backed by one persistent OffscreenCanvas, so a child-only signal can
dirty that Layer while clean sibling Layer surfaces retain their pixels.

This separation is intentional. Exact component edges support equality
suppression, diagnostics, ownership, and renderer-specific work; they do not
authorize skipping Canvas paint whose overlap and source-order dependencies
have not been retained.

### Current migration surface

The removed vocabulary appears in:

- root exports and public types;
- hook and runtime contract tests;
- drawing, layout, focus, event, Layer, WebGL, GLTF, Three, particles, and
  physics tests;
- the core `Image` implementation;
- particles and physics production code that currently uses `useMemo`;
- learning examples, the complete diagram-editor tutorial, deterministic
  laboratories, and catalog/search metadata;
- current Learn and API documentation;
- Studio editor declarations and package-consumer programs; and
- runtime export enumerations and public-vocabulary type tests.

The migration is therefore one repository-wide public pivot, not a local hook
file deletion.

### Audit verification

The focused current-state audit ran the hook contract, state ownership, signal
hook, and signal scheduler performance suites in Chromium through the checked-in
Vitest binary. All 41 focused tests passed. This verifies the present behavior
being replaced; it is not evidence for the future implementation.

## Design principles

1. **Signals are the state model.** Writable values use signals; derived values
   use computed signals.
2. **Reads remain explicit.** A signal container never becomes its value merely
   because a receiving API accepts the contained type.
3. **Equality avoids work before scheduling paint.** It is better not to dirty a
   renderer than to discover unchanged output during Render.
4. **Imperative synchronization is not rendering.** A reaction owns its own
   graph consumer and must not make the component a renderer consumer.
5. **Ownership remains explicit.** Hooks that own resources or scheduler
   participation remain specialized.
6. **The cheap case shapes the graph.** Zero- and one-edge consumers must not pay
   for collection objects designed for large shared graphs.
7. **Pixels are retained only at explicit surfaces.** A `Layer` or renderer
   boundary is an application-visible performance decision.
8. **Failure cannot publish half a hook candidate.** New computed formulas,
   dependency arrays, reaction callbacks, and reaction setups follow render or
   Complete transaction rules.
9. **Performance claims require workload evidence.** API uniformity alone does
   not justify removing a cheaper primitive.

## Final public model

### Removed exports

The root package removes:

```ts
useState;
StateUpdater;
useMemo;
useWhenChanged;
```

No compatibility exports, aliases, deprecated wrappers, or alternate subpaths
retain them.

### Added exports

```ts
export interface CRCReactionOptions {
  readonly debugName?: string;
}

export function batch<T>(callback: () => T): T;

export function useConst<T>(create: () => T): T;

export function useComputed<T>(
  compute: () => T,
  dependencies?: readonly unknown[],
  options?: SignalOptions<T>,
): Signal<T>;

export function useReaction(
  setup: () => void | (() => void),
  dependencies?: readonly unknown[],
  options?: CRCReactionOptions,
): void;
```

### Retained core exports

The following remain public with their existing purpose:

```ts
signal;
computed;
untracked;
isSignal;
useSignal;
useRef;
usePlayback;
useTransition;
useRectPath;
useLinePath;
useSvgPath;
useEvent;
useEventTarget;
useEventListener;
useCursor;
useLayoutBox;
useCanvasContext;
```

Specialized package hooks and component-owned endpoints also remain.

## Authoring before and after

### Writable component state

Before:

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  return <Text onClick={() => setCount((value) => value + 1)}>{count}</Text>;
}
```

After:

```tsx
function Counter() {
  const count = useSignal(0);

  return (
    <Text onClick={() => count.update((value) => value + 1)}>
      {count.get()}
    </Text>
  );
}
```

`set(value)` always treats a function as data. `update(updater)` is the only
updater spelling:

```ts
const callback = useSignal<() => void>(() => {});

callback.set(nextCallback);
callback.update((previous) => wrap(previous));
```

### Derived reactive values

Before, a component either calculates directly and subscribes to every source,
or awkwardly constructs a computed through `useMemo`:

```tsx
const doubled = useMemo(() => computed(() => count.get() * 2), []);
```

After:

```tsx
const doubled = useComputed(() => count.get() * 2);
```

The component that reads `doubled.get()` subscribes to `doubled`, not directly
to `count`. Equal computed output blocks downstream invalidation during Plan.

### Plain render inputs

`useComputed` accepts explicit dependencies for values that are not signals:

```tsx
function Shape({ pathData }: { pathData: string }) {
  const path = useComputed(() => new Path2D(pathData), [pathData]);

  return <Path style={{ d: path.get() }} />;
}
```

Signal reads inside the formula remain automatic; the array lists only captured
non-signal inputs whose changes must invalidate the formula.

### Mount-lifetime constants

Before:

```ts
const scratch = useMemo(() => new Float32Array(1_024), []);
```

After:

```ts
const scratch = useConst(() => new Float32Array(1_024));
```

`useConst` returns the direct value and creates no signal node or graph edge.

### Mutable non-rendering state

`useRef` remains the correct tool for mutable state that must not schedule work:

```ts
const dragSession = useRef<DragSession | null>(null);
```

This state represents an in-progress imperative session, not visual state.

### Setup and cleanup

Before:

```tsx
useWhenChanged(() => {
  const subscription = subscribe(channelId);
  return () => subscription.unsubscribe();
}, [channelId]);
```

After for a plain prop:

```tsx
useReaction(() => {
  const subscription = subscribe(channelId);
  return () => subscription.unsubscribe();
}, [channelId]);
```

After for a signal-driven resource:

```tsx
useReaction(() => {
  const subscription = subscribe(channelId.get());
  return () => subscription.unsubscribe();
});
```

The signal read belongs to the reaction consumer. Changing `channelId` can
clean and recreate the subscription without traversing Canvas.

### Batched writes

CRC logical event dispatch batches automatically:

```tsx
<Rectangle
  onClick={() => {
    x.set(20);
    y.set(40);
    selected.set(true);
  }}
/>
```

For application callbacks outside CRC dispatch:

```ts
batch(() => {
  x.set(20);
  y.set(40);
  selected.set(true);
});
```

### Specialized ownership

These APIs do not collapse into `useSignal`:

```tsx
const playback = usePlayback(program);
const position = useTransition(target, options);
const camera = useOrbitCamera(options);
const particles = useParticleSystem(effect);
```

They expose or consume signals where appropriate, but their hook slots also own
commands, writer leases, scheduler registration, render candidates, backend
state, or deterministic teardown.

## `useSignal` contract

`useSignal(initialValue, options?)` returns one stable `WritableSignal<T>` for
the exact mounted hook slot.

- The initial value and options are mount-only.
- Default equality is `Object.is`.
- `set(value)` treats values, including functions, as data.
- `update(updater)` invokes the updater once with the currently visible value.
- Equal candidates advance no version, notify no consumer, and request no frame.
- Signal writes remain forbidden during component, primitive-render, computed,
  reaction setup, and reaction cleanup evaluation, including equality no-ops.
- Direct writes remain forbidden during scheduler Advance; participants use
  their staging batch.
- A retained hook signal remains an ordinary usable signal after owner removal.
  It no longer has an edge to the removed component and cannot resurrect it.

Removing `useState` deliberately removes stale-setter semantics. There is no
setter detached from its value cell; retaining the signal retains the value.

## `useComputed` contract

### Identity and ownership

`useComputed` returns one stable readonly `Signal<T>` for the mounted hook slot.
Its computed node remains lazy and is evaluated only when read or when observed
Plan validation requires it.

The hook slot owns formula updates and render-transaction candidates. The
computed node owns its cached value and, while observed, its source-edge leases.
Downstream consumers own their edges to the computed.

If application code retains the returned signal after owner removal, it remains
readable and continues to react to the last successfully committed formula's
signal dependencies. No later component render can revise that formula.

### Signal and non-signal dependencies

Signal reads inside `compute` are tracked dynamically and need not appear in the
dependency array. The dependency array exists only for captured values that are
not signals, including ordinary component props.

Dependency positions compare with `Object.is`. Length changes invalidate the
formula. Consequently repeated `NaN` is equal, while `+0` and `-0` differ. This
aligns hook dependencies with signal equality and replaces the current
strict-inequality behavior of `useMemo` and `useWhenChanged`.

Omitting `dependencies` means the formula may safely close only over signals,
module constants, `useConst` values, stable hook handles, and other mount-stable
identities. A changing ordinary prop omitted from the array is an authoring
error; CRC cannot inspect a JavaScript closure to discover it.

### Formula refresh

Every owner render supplies a candidate callback. If explicit dependencies are
unchanged, a successful render refreshes the callback used by the next genuine
signal invalidation but does not invalidate the cached value merely because an
inline function object is new.

If dependencies change, the current render receives a provisional formula
generation owned by the active root render transaction. A `.get()` anywhere
inside that transaction evaluates against the candidate formula and candidate
dependencies, so descendants receiving the signal can render the current prop
generation. The provisional result is visible to reads in that transaction but
does not notify ordinary observers.

If the candidate is evaluated, successful transaction completion commits the
formula, dependency snapshot, cached result, version, and dynamic source edges.
If the candidate is not evaluated, success commits the formula and dependency
snapshot as invalid: an unobserved computed stays lazy until its next read, and
an observed computed requests Plan validation in the next eligible frame.
Failed transaction completion restores the last committed formula, cached
result, version, and source edges in either case.

This is required because publishing a failed render's captured prop closure to
a retained computed would violate CRC's fail-closed ownership model.

### Equality and publication

`SignalOptions.equals` and `debugName` are mount-only, matching `useSignal` and
standalone `computed`. The equality function compares the last committed result
with a candidate.

When a dependency-array change occurs during an owner render:

- the owner already renders with the candidate value;
- an equal result advances no computed version and notifies no other consumer;
- a changed result commits one version and notifies other live consumers only
  after the owner transaction succeeds;
- the owner is not redundantly scheduled merely because its own successful
  render committed the changed computed.

An unread observed candidate validates in the next frame's Plan and follows the
same equality rule before any downstream renderer is dirtied. This one-frame
deferral is required because the dependency change is discovered during Render,
after the current frame's Plan phase, and because failed render transactions
must not publish their closures.

When a source signal changes outside owner render, ordinary observed-computed
Plan validation remains authoritative.

### Purity and errors

Computed callbacks are pure synchronous derivations. Signal writes and CRC
hooks are forbidden. Promise continuations do not inherit tracking.

Standalone computed error caching, dependency replacement, cycle diagnostics,
and recovery rules remain. A candidate formula failure during render enters
normal render failure recovery and cannot replace the committed formula.

## `useConst` contract

`useConst(create)` runs `create` exactly once for the mounted hook slot and
returns the same direct value on later renders.

- It has no dependency array.
- It creates no signal, observer, or computed node.
- Its factory runs untracked, so signal reads cannot accidentally make the
  component a consumer of a mount-only snapshot.
- Its factory cannot call CRC hooks.
- It does not schedule work.
- It performs no automatic cleanup.
- A factory failure enters normal render failure recovery.
- Key, type, parent, root replacement, or removal creates a fresh slot.

Resources requiring cleanup must use `useReaction` or a specialized owner hook;
`useConst` alone is not a resource-lifecycle primitive.

## `useRef` contract

`useRef` remains unchanged. It returns one stable mutable `{ current }` object
for a hook slot, uses its initializer only on mount, and schedules nothing when
mutated.

`useConst` does not replace `useRef`:

- use `useConst` for a stable value that should not be reassigned;
- use `useRef` for a mutable imperative cell whose current value changes without
  reactive notification; and
- use `useSignal` for a mutable value whose reads should participate in the
  reactive graph.

## `useReaction` contract

### Purpose and naming

`useWhenChanged` mixes dependency-array diffing, synchronous render-time side
effects, cleanup, and an every-render mode. Its name does not identify what is
owned, and signal reads inside its callback currently become component render
dependencies because the callback executes during component evaluation.

`useReaction` names the new behavior: a component-owned imperative reaction to
tracked signal changes and explicit non-signal dependencies. CRC deliberately
does not call it `useEffect`, because React effect timing and lifecycle are not
its contract.

### Setup timing

The first setup runs in Complete after the component's mounting render
transaction succeeds. A failed render never performs setup.

Later setup runs in Complete when either:

- one of its dynamically tracked signals genuinely invalidates it; or
- its explicit dependency array changes during a successful owner render.

The latest callback from the latest successful owner render is used. Callback
identity alone never reruns a reaction.

Omitting the dependency array no longer means every render. It means mount once
and thereafter rerun only for synchronously tracked signals. A callback that
reads no signals and has no explicit dependencies is a component-lifetime
setup.

### Graph ownership and renderer isolation

Signals read synchronously during setup belong to the reaction consumer, not
the component render consumer. A reaction invalidation requests realm Plan and
Complete work but does not dirty Canvas, a Layer, or a renderer.

Several invalidations before the eligible Complete phase coalesce into one
setup generation. Dynamic signal dependencies are replaced after each setup
attempt.

### Cleanup

Setup may return one cleanup callback. The exact current cleanup runs once:

- before the next setup attempt;
- when explicit dependencies change;
- when the hook is abandoned by a hook-order failure;
- when the component is removed or its identity changes; or
- when the root is aborted, fails closed, or is disposed.

Ownership is cleared before invoking cleanup, so a throwing cleanup cannot run
again. Cleanup failures are reported but cannot prevent remaining ownership
from releasing or the replacement setup from being attempted.

Cleanup runs untracked. Signal reads in cleanup do not change the next setup's
dependency set; only synchronous setup reads are reactive dependencies.

### Write and error rules

Signal writes are forbidden during setup and cleanup, including equality
no-ops. Reactions synchronize signals outward to imperative systems; they are
not a state-propagation mechanism. A resource's later asynchronous callback is
outside reaction evaluation and may write signals normally.

If setup throws:

- the previous cleanup has already been released;
- no new cleanup is installed;
- signal reads completed before the throw become the reaction's next dependency
  set so a future change can retry;
- the error is collected with Complete-phase failures and reported after
  unrelated work finishes; and
- the reaction does not spin automatically. It retries on a later tracked
  invalidation or explicit dependency change.

## `batch` contract

### Public behavior

`batch(callback)` is synchronous, nestable, and returns the callback result.
Only the outermost batch flushes notifications.

Inside a batch:

- writable signal reads observe the latest write;
- computed reads observe the latest transitive source values;
- signal equality is applied to each candidate;
- source and computed versions remain internally coherent for explicit reads;
- component, renderer, and reaction observers are not invoked until the
  outermost batch exits; and
- each affected observer is invalidated at most once by that flush.

The batch records each source's entry value. If its final value compares equal
to that entry value, direct consumers are not invalidated by intermediate
writes. Computeds that were explicitly read inside the batch may have validated
intermediate values, but their downstream notifications remain batched and only
the final committed result determines downstream invalidation.

If the callback throws, writes already performed remain committed. CRC flushes
the resulting notification wave in `finally`, then rethrows the callback error.
If notification also fails, CRC reports an `AggregateError` containing the
callback error first followed by notification failures. `batch` is notification
atomic, not a rollback transaction.

### Automatic CRC batching

One complete logical CRC event dispatch—capture, target, and bubble—is wrapped
in one batch. Writes from an earlier propagation listener are visible to later
listeners through explicit reads, but no renderer or reaction invalidation runs
until propagation finishes.

Nested dispatches and explicit user batches compose through the same outermost
depth. Async continuations are outside the synchronous batch and require their
own `batch()` if they need grouped notification.

Scheduler Advance retains its stronger staged-write transaction. Public batch
does not replace participant staging, rollback-on-participant-failure, writer
leases, or Commit publication.

## Reactive graph representation

### Current allocation problem

The current graph allocates or retains general collections at every level:

- an observer `Set` per signal node;
- a dependency `Map` per component consumer;
- a fresh next-dependency `Set` per component evaluation;
- dependency and observation maps per computed; and
- an eager readonly wrapper for every writable signal because recognition
  registration currently calls `asReadonly()` during construction.

This representation is correct but works against the project's current
hot-path optimization direction.

### Intrusive dependency edges

The new graph uses one explicit edge record per live source-consumer
relationship. Each edge links into:

- the source's observer list; and
- the consumer's dependency list.

Conceptually:

```ts
interface ReactiveEdge {
  source: SignalNode<unknown>;
  consumer: ReactiveConsumer;
  sourcePrevious: ReactiveEdge | undefined;
  sourceNext: ReactiveEdge | undefined;
  consumerPrevious: ReactiveEdge | undefined;
  consumerNext: ReactiveEdge | undefined;
  collectionGeneration: number;
  observedVersion: number;
  releaseObservation: (() => void) | undefined;
}
```

Exact private fields may be split by node kind during implementation, but the
ownership and complexity contract is fixed:

- zero edges allocate no collection object;
- one edge needs one edge record, not a set plus map entries;
- notification walks the source-linked edges directly;
- successful recollection marks and reuses existing consumer-linked edges;
- dynamic edges not seen in the successful generation unlink in O(removed);
- newly read dependencies link in O(added);
- teardown unlinks the consumer list in O(owned edges); and
- computed first-observer/final-observer leases remain exact.

Consumers may retain a small free list of their removed edges for later dynamic
dependency reuse. Pooling is consumer-local and bounded by that consumer's
historical live edge high-water mark; there is no realm-global unbounded edge
pool.

### Lazy component consumers

Mounting a component does not create a reactive consumer eagerly. Render
tracking begins with a lightweight current collector. The first signal read
materializes the component consumer and its first edge. A component whose
successful render reads no signals owns no live consumer and no dependency
list.

A component that previously read signals and later reads none releases its old
edges after successful evaluation. Failed render cleanup still releases the
complete instance generation as it does today.

### Safe sharing promotion

No signal is permanently classified as local. A hook signal may be passed to
children, another root, a reaction, animation, physics, or application code.
The observer-list representation handles one edge without an allocated
collection and adds further linked edges when sharing appears. No deoptimization
changes public identity or behavior.

### Lazy readonly views

`signal()` registers the writable object as a recognized signal without calling
`asReadonly()`. The readonly wrapper is created and registered only on the first
actual `asReadonly()` call, then cached exactly as today.

### Diagnostics

Existing deterministic consumer, renderer-edge, computed-source-edge, commit,
and Plan-validation counters remain. New counters distinguish:

- lazily created component consumers;
- live and reused edge records;
- batched writes and deduplicated observer invalidations;
- reaction consumers, runs, cleanups, and failures; and
- provisional `useComputed` formula generations and rollbacks.

Tests assert ownership counts, not garbage-collection timing.

## End-to-end scheduling lifecycle

### 1. Logical input dispatch

CRC resolves the topmost committed target and performs capture, target, and
bubble propagation. One automatic batch surrounds the complete logical
dispatch.

### 2. Signal writes

Each `set` or `update` first checks the active write guard and writer lease.
Equality compares against the latest visible batch value. Changed values become
visible synchronously to later reads; equal values do nothing.

### 3. Batch flush and graph invalidation

At outer batch exit CRC publishes one deduplicated notification wave:

- direct component consumers become dirty once;
- computeds become pending without dirtying downstream renderers;
- reactions become pending without dirtying renderers;
- official renderer consumers receive their narrow invalidation; and
- all requested work coalesces onto the realm's one pending host frame.

Unbatched writes perform the same publication immediately. Scheduler request
coalescing still limits the realm to one host callback.

### 4. Begin

Begin captures eligible dirty jobs, Advance registrations, and ordinary
completions. Work registered after capture waits for a later frame.

### 5. Advance

Animation, physics, particles, and other participants run in stable order. They
may write only through their staging batch. A throwing participant loses its
own staged candidates without preventing unrelated participants.

### 6. Commit

Commit publishes all accepted staged source values before notification. Every
consumer therefore sees one coherent frame state. Commit-produced dirtiness may
join the current Plan.

### 7. Plan

Plan validates observed computeds dependency-first. An equal result clears the
pending state without renderer invalidation. A changed result advances one
version and invalidates its exact downstream consumers.

Plan then determines dirty roots, managed Layers, official-renderer stages, and
eligible reaction work. A frame containing only reaction work proceeds to
Complete without a Canvas Render stage.

### 8. Render

Managed nested instances render deepest-first. Ordinary roots render in mount
order. A dirty immediate-mode Canvas instance clears and traverses its complete
tree.

Each component evaluation collects only its own explicit reads. A nested
computed replaces the active collector while evaluating, so its source reads do
not become direct component dependencies. Child traversal remains untracked by
the parent and establishes each child's collector separately.

Successful component evaluation commits its next edge generation and marks the
consumer clean. Removal and disposal release exact edges. Root failure retains
the current fail-closed all-ref cleanup behavior.

### 9. Complete

By the end of Render, each successful root render transaction has accepted its
hook and renderer candidates; a failed transaction has rolled them back or
released them. Successful transactions make their eligible reaction generations
available to Complete. Complete runs reaction cleanup/setup, delivers playback
and renderer milestones, restores idle scheduler state, reports collected
failures, and requests a follow-up frame only when work remains.

Signal writes requested during Complete are deferred to a later frame. Reaction
setup and cleanup specifically forbid them.

## Equality and invalidation rules

| Value or boundary              | Default equality               | Consequence of equality                               |
| ------------------------------ | ------------------------------ | ----------------------------------------------------- |
| Writable signal                | `Object.is`                    | No version, notification, or scheduler request        |
| Standalone computed            | `Object.is`                    | No downstream invalidation                            |
| `useComputed` result           | `Object.is`                    | No downstream invalidation                            |
| `useComputed` dependency slot  | `Object.is`                    | Formula cache remains valid for that non-signal input |
| `useReaction` dependency slot  | `Object.is`                    | Explicit dependency change does not queue setup       |
| Layer retained-tree properties | Existing strict identity rules | Existing child bitmap reuse remains unchanged         |
| Specialized hook candidates    | Their existing contract        | No forced conversion to generic signal equality       |

Custom equality remains available only where `SignalOptions<T>` is accepted.
Dependency arrays do not accept custom equality; authors needing semantic
comparison should expose a computed signal with the desired equality and read
it from the formula or reaction.

## Layers, renderers, and pixel isolation

### Ordinary Canvas

An invalidated ordinary Canvas instance still performs a full synchronous
traversal. Signal precision avoids entering that traversal when values are
equal, derived output is equal, or work belongs only to a reaction. It does not
make the paint inside one surface independently replayable.

### Managed `Layer`

Each Layer continues to own one persistent OffscreenCanvas for its mounted
lifetime. A signal read in the child tree belongs to that private instance.
When it changes:

1. the child instance becomes dirty;
2. scheduler revision propagation marks ancestor composition paths;
3. dirty descendants render deepest-first;
4. the parent traverses and composites the updated bitmap; and
5. clean sibling Layer bitmaps remain untouched and are reused.

A signal read only in the parent while computing Layer placement or outer
presentation dirties the parent, not the child bitmap.

### Filters

Filter surfaces remain transient depth-indexed scratch resources. Their pool is
unrelated to persistent Layer caches and cannot preserve arbitrary component
images between frames.

### Official renderers

WebGL, Three, particles, physics presentation, and future official renderers
continue to create renderer-specific signal consumers where they can perform
narrower work such as resource update, draw, or composition. The public signal
model does not broaden Canvas semantics or expose those friend internals.

### Why automatic component images are rejected

A component has no guaranteed isolated rectangle. It may paint outside declared
geometry, return multiple descendants, overlap later siblings, participate in
transforms and clips, establish filters, add interaction geometry, or paint
nothing itself.

Persistent component image caching would require retained bounds, damage and
overlap reasoning, persistent pixel memory, resizing, clearing, copying, and
additional `drawImage` operations. A transient surface pool cannot help because
cached pixels must survive until the next invalidation. Creating and discarding
surfaces instead produces the exact churn already observed experimentally.

CRC therefore keeps explicit barriers. Authors add a Layer only when the cost
and memory tradeoff make sense for that subtree.

## Fine-grained rendering without a retained scene graph

CRC can become more fine grained in four genuine ways without retaining a
DOM-like graph:

1. **Write granularity:** equality and batching avoid redundant graph work.
2. **Derivation granularity:** computed validation blocks unchanged derived
   output before renderer invalidation.
3. **Side-effect granularity:** reactions run without Canvas traversal.
4. **Surface granularity:** explicit Layers and renderer islands retain and
   update independently.

CRC cannot safely skip arbitrary primitive painting within one cleared Canvas
surface without retaining enough paint commands, pixel surfaces, or overlap
metadata to replay the omitted output. Caching only component-returned element
descriptors could skip some user function calls, but primitives, event geometry,
focus records, and drawing would still need replay. It adds a retained component
tree without solving pixel work and is excluded from this design.

Future profiling may justify a separate explicit render boundary lighter than
Layer, but it would require its own bounds, composition, memory, interaction,
and ownership design. This specification neither adds nor reserves one.

## Specialized hooks and ownership

### Hooks that remain

| Hook or endpoint                                 | Why a generic signal does not replace it                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `useRef`                                         | Stable mutable cell with deliberately no observation or scheduling                                        |
| `usePlayback`                                    | Owns playback controller, commands, writer leases, milestones, and teardown                               |
| `useTransition`                                  | Owns output signal, retargeting, provisional render value, playback, and conflict replacement             |
| `useRectPath`, `useLinePath`, `useSvgPath`       | Typed geometry caches with distinct hook kinds and direct `Path2D` results                                |
| `useEvent`, `useEventTarget`, `useEventListener` | Own event registration, geometry, native-listener demand, and exact teardown                              |
| `useCursor`                                      | Own cursor target/default registration and teardown                                                       |
| `useLayoutBox`, `useCanvasContext`               | Access active render context; they are not reactive storage                                               |
| `useAnimationFrame`                              | Own continuing-frame demand on the shared scheduler                                                       |
| `useOrbitCamera`                                 | Own spherical state, pointer session, handlers, revision signal, and transactionally adopted options      |
| `useGLTF`                                        | Own async fetch/decode generation, abort, loaded asset, revision state, and exact resource release        |
| `useParticleSystem`                              | Own controller, simulation registration, binding candidates, commands, and teardown                       |
| physics world/body endpoints                     | Own simulation participants, handles, commands, generation binding, and lazily materialized field signals |

Specialized implementations may use private constant, memo, signal, computed,
and reaction primitives. Public API coherence does not require routing a
non-reactive path cache through a public computed signal.

### Hook-order behavior

`useSignal`, `useComputed`, `useConst`, `useRef`, and `useReaction` each have a
distinct hook kind. Reordering them remains a deterministic hook-order error.
Removing an old hook slot during migration intentionally changes affected test
fixtures and current examples; it does not weaken the invariant.

## Error and failure behavior

- Signal updater or equality failure leaves the previous value current.
- Component and primitive writes remain forbidden before updater/equality work.
- `useComputed` dependency and formula candidates commit only with successful
  render transactions.
- Render failure releases partial consumers, hook resources, event/focus state,
  and component refs exactly as today.
- Standalone computed errors remain cached until a retained dependency changes.
- Reaction errors are Complete-phase failures and do not retroactively fail an
  already successful Canvas transaction.
- Reaction cleanup ownership is cleared before callback invocation.
- Batch callback failure does not roll back already visible signal writes; it
  flushes notification and then reports the callback failure.
- Observer failure cannot strand other observers, pending computed validation,
  reaction cleanup, unrelated roots, or scheduler phase restoration.

## Ownership ledger

| Resource                         | Created by                      | Sole owner                              | Release or replacement rule                                                                     |
| -------------------------------- | ------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Writable hook signal             | `useSignal` mount               | Exact hook slot                         | Slot teardown detaches owner edges; retained signal remains usable                              |
| Component render consumer        | First successful component read | Exact component refs                    | Last edge removal may collapse storage; component teardown releases all                         |
| Reactive dependency edge         | Successful tracked read         | Exact consumer-source relationship      | Successful dynamic replacement or consumer teardown                                             |
| Standalone computed source lease | First observed computed edge    | Computed while observed                 | Dynamic replacement or final observer release                                                   |
| `useComputed` formula candidate  | Owner render                    | Exact render transaction and hook slot  | Commit on success, rollback on failure                                                          |
| `useComputed` cached node        | Hook mount                      | Exact hook slot / retained signal value | Hook stops revising after teardown; retained downstream ownership may keep ordinary graph edges |
| Constant hook value              | `useConst` mount                | Exact hook slot                         | Slot teardown drops runtime reference; no automatic application cleanup                         |
| Reaction consumer                | `useReaction` successful mount  | Exact hook slot                         | Slot teardown releases graph edges and pending work                                             |
| Reaction cleanup                 | Successful setup                | Exact reaction generation               | Cleared then run before replacement, removal, failure cleanup, abort, or disposal               |
| Batch notification queue         | Outermost `batch` entry         | Synchronous batch scope                 | Flushed and released on outermost return or throw                                               |
| Layer pixel cache                | `Layer` mount                   | Exact Layer hook/component slot         | Resize replaces bitmap; removal/disposal releases instance and surface                          |
| Filter scratch surface           | First active depth lease        | CRC instance transient pool             | Returned after boundary; pool released with instance                                            |

## Migration design

### `useState` migration

Mechanical cases:

```ts
const [value, setValue] = useState(initial);
```

becomes:

```ts
const value = useSignal(initial);
```

Reads become `value.get()`. Direct writes become `value.set(next)`. Functional
updates become `value.update(update)`. Captured `StateUpdater<T>` types become
`WritableSignal<T>` when the value cell itself is passed, or an explicit
callback type when only one operation is exposed.

Code relying on a stale setter becoming inert must be redesigned around owner
cleanup or retain the signal knowingly. Code storing function values becomes
less ambiguous because `set(functionValue)` is data.

The optional empty `useState<T>()` form has no direct spelling because
`useSignal` requires an initial value. It becomes
`useSignal<T | undefined>(undefined)`.

### `useMemo` migration

Current uses split into three categories:

1. `useMemo(create, [])` for a direct mount constant becomes `useConst(create)`.
2. Reactive derived state becomes `useComputed(compute)` and consumers call
   `.get()`.
3. Expensive values derived from ordinary props become
   `useComputed(compute, dependencies)`.

Specialized direct-return hooks such as path hooks keep their public return
types and use private cache machinery. Official package internals may also use a
private value-memo slot when exposing a signal would add no scheduling value.

### `useWhenChanged` migration

`useWhenChanged(setup, deps)` becomes `useReaction(setup, deps)`. The timing
changes from synchronous render evaluation to Complete after a successful
transaction. Tests must assert that failed renders perform no setup.

An omitted dependency array changes meaning. Former every-render behavior must
be removed, expressed through an actual changing signal/dependency, or justified
by a specialized renderer hook. New omission means mount plus tracked-signal
reruns.

Signal reads formerly used to cause a component rerender solely so
`useWhenChanged` could run now belong to the reaction and must produce zero
Canvas traversal when no visual consumer exists.

### Runtime and official packages

- Core `Image` migrates its loaded state to `useSignal` and its source/listener
  ownership to `useReaction`.
- Particles Canvas target-path caching is classified as private direct value
  memoization or public `useComputed` consumption based on whether the component
  benefits from a graph barrier.
- Physics WebGL shape components make the same measured choice internally while
  preserving their public component output.
- WebGL, GLTF loading, Three, particles, and physics friend seams retain
  existing owner and scheduler contracts unless graph-edge representation
  requires version-coupled private changes.

### Tests and scenarios

All current tests using `useState`, `StateUpdater`, `useMemo`, or
`useWhenChanged` migrate to the new vocabulary. Tests whose only use of
`useState` is mount identity use `useConst`; tests forcing a render use an
explicit signal or root replacement according to the behavior under test.

Learning examples, tutorial snapshots, deterministic laboratories, scenario
catalog API tags, and search metadata migrate together. Examples must teach
`set` versus `update`, explicit reads, computed barriers, reaction-only work,
and when a Layer is worth its retained surface.

### Documentation and public consumers

Current contracts under `docs/design/` are updated together. Package READMEs
and public API pages for the removed hooks are rewritten or removed; pages for
`batch`, `useConst`, `useComputed`, and `useReaction` are added. The
state/lifecycle and signals/animation guides are rewritten around the single
model.

A breaking guide is added at:

```text
docs/migrations/signals-centric-hooks.md
```

Studio declaration snapshots, API export discovery, Bundler and NodeNext
consumers, packed runtime consumers, runtime export lists, and final public
vocabulary type tests must agree with the new surface.

Completed plans, historical specs, and dated field notes retain old names where
they accurately describe history. Their literal historical-status treatment
continues to exclude them from current-vocabulary enforcement.

## Performance design and acceptance gates

### Baselines before production changes

The implementation begins by adding controlled comparison workloads while both
old and new primitives can still be measured. Baselines record structure,
allocation sampling, and wall-clock observations for:

1. one changed local value in one component;
2. one changed local value among 1,000 mounted component state slots;
3. an equal local write;
4. 1,000 changed writes to one value in one synchronous callback;
5. changes to several signals consumed by one component;
6. an observed computed whose final result remains equal;
7. a signal used only by setup/cleanup synchronization;
8. a prop-derived expensive cache read across unrelated root renders;
9. one dirty child across 100 stable Layers; and
10. a representative interaction scenario with state, events, transforms, and
    drawing.

The baseline command, Node version, Chromium version, viewport, DPR, and
worktree state are recorded. Historical timing in existing design records is
context, not a substitute for these fresh baselines.

### Structural requirements

- An equal signal write performs zero notification, zero scheduler request, and
  zero render.
- A batch that ends at its entry value performs zero direct-consumer
  invalidation.
- Several changed signals observed by one component invalidate that component
  once per outer batch.
- One logical CRC event dispatch requests at most one host frame.
- An unchanged observed computed validates in Plan and performs zero renderer
  work.
- A reaction-only signal change performs zero root and Layer traversals.
- A stable `useComputed` dependency array performs zero formula evaluations
  across unrelated renders unless a tracked signal changed.
- A component with no signal reads owns zero live reactive consumer and edges.
- Stable component dependency sets allocate no new edge or collection records
  after warmup.
- One dirty child across 100 Layers repaints only that child, reuses every clean
  sibling bitmap, and composites through the existing ancestor path.
- No signal, computed, batch, or reaction operation creates an OffscreenCanvas,
  reads pixels, or transfers a bitmap.

### Wall-clock and allocation requirements

Across three controlled runs, the equivalent non-equal unlayered local-update
workload must not regress more than 5% in median or p95 relative to current
`useState`. The existing sparse-render 5 ms median and 8 ms p95 reference budget
is not relaxed.

At least two representative equality-, batching-, computed-, or reaction-heavy
workloads must show a repeatable material improvement: at least 20% lower median
active time or allocation traffic, in addition to their required structural
work elimination. A synthetic result caused only by renaming APIs does not
qualify.

If the optimized unified graph cannot meet the non-regression gate, the project
must not remove `useState` under a performance rationale. The implementation
returns to design review rather than weakening a budget.

### Profiling discipline

CPU and allocation profiles run in separate controlled processes. Profiles
identify remaining hot stacks after graph changes; they do not justify unrelated
refactors. Allocation sampling describes traffic, not retained heap. Persistent
ownership remains proven through explicit counters.

## Verification strategy

### Focused graph tests

Tests cover:

- `Object.is` equality, custom equality, updater failure, and function values;
- lazy readonly view creation;
- zero-, one-, and many-observer edge representation;
- dynamic dependency add/remove and edge reuse;
- nested computed equality and cycle recovery;
- nested batches, reads inside batches, computed reads inside batches, final
  equality collapse, callback failure, and observer failure;
- lazy component-consumer creation and complete teardown; and
- exact counters through repeated mount, removal, failure, abort, disposal, and
  fresh remount.

### Hook tests

Tests cover:

- `useSignal` identity and mount-only options;
- `useComputed` stable identity, signal dependencies, explicit non-signal
  dependencies, candidate publication, rollback, equality, error recovery, and
  retained post-owner behavior;
- `useConst` once-only construction and remount identity;
- `useRef` unchanged mutable-cell behavior;
- `useReaction` mount timing, callback refresh, explicit and signal dependency
  reruns, dynamic dependencies, cleanup order, setup/cleanup failure, write
  guards, no-render behavior, and teardown; and
- changed hook-order diagnostics across every new kind.

### Scheduler, Layer, and renderer tests

Tests prove the complete event-to-batch-to-Plan lifecycle, Commit admission,
reaction-only frames, nested Layer ordering, root failure isolation, and friend
renderer invalidation. Existing animation, particles, physics, focus, event,
filter, and WebGL ownership suites remain required because their hooks share the
same slots and scheduler.

### Public evidence

One learning example demonstrates local signals, a computed equality barrier,
batched event writes, and a reaction that changes an external test resource
without repainting. A deterministic laboratory exposes counts for source
writes, batch flushes, computed validations, reaction runs/cleanups, component
traversals, Layer repaints, and composites. Headless tests drive the same public
surface before any optional visual evidence.

### Packaging and documentation

Source and built Studio modes, package declarations, packed Bundler and NodeNext
consumers, compiler entries, public docs export coverage, scenario catalogs,
search, and current-vocabulary checks must all pass. Removed exports must fail
type and runtime import probes.

### Final trust gate

Focused checks are used while building vertical slices. Feature completion
requires the repository's documented Node 24.15+ / pnpm 11.21.0 / Playwright
Chromium aggregate gate:

```sh
corepack pnpm@11.21.0 trust
```

Controlled wall-clock diagnostics remain separate evidence and are recorded
with their exact environment.

## Delivery sequence

The implementation plan will turn this architecture into reviewable vertical
slices. The intended order is:

1. record current `useState`/`useSignal` comparison baselines and add structural
   counters without changing public behavior;
2. replace graph collections with lazy reusable edge ownership while preserving
   the current public surface;
3. add `batch` and automatic complete-dispatch batching with public evidence;
4. add `useConst` and transactional `useComputed`, then migrate one public
   state/derivation slice for feedback;
5. add `useReaction` and migrate one resource-owning slice, proving zero-render
   reaction work;
6. migrate core, official packages, tests, examples, Studio, docs, and package
   consumers, then remove the old exports in the same public pivot;
7. run focused ownership and performance hardening, profile remaining hot work,
   and complete the aggregate trust gate; and
8. stop for experiential review at each runnable public slice before broad
   hardening proceeds.

The detailed implementation plan is written only after this specification is
reviewed and approved.

## Alternatives considered

### Selected: optimized unified graph plus explicit surfaces

This model eliminates avoidable scheduling and graph work while retaining
Canvas replay only where pixels actually need repainting. It preserves CRC's
explicit performance boundaries and makes external reactions independent of
rendering.

### Rejected: public API swap over the current graph

Deleting `useState` and mapping every use to today's `useSignal` would simplify
the API but could add observer and edge overhead to the same full repaint. It
does not satisfy the performance purpose.

### Rejected: automatic component OffscreenCanvas caching

The author has already observed prohibitive surface churn. The design also
requires persistent rather than pooled surfaces, retained bounds, composition,
and overlap semantics. It is slower for simple content and conflicts with the
explicit Layer model.

### Rejected: retained drawing-command or component-output graph

A command graph changes the renderer architecture and ownership model. A cached
component-output tree avoids only some function calls while still replaying
primitive paint and registration. Neither is justified by current profiles.

### Rejected: keep both `useMemo` and `useComputed`

Two public derivation hooks preserve a choice the new model is intended to
remove. `useComputed` plus explicit non-signal dependencies provides caching and
an equality propagation barrier; `useConst` covers mount-only direct values.
Private specialized value caches remain available where graph participation has
no benefit.

### Rejected: component-wide automatic prop signals

Wrapping every prop in a signal would allocate and reconcile reactive cells for
ordinary immutable render inputs, complicate identity, and imply subtree
skipping CRC cannot provide. Explicit dependency arrays bridge only the values
that a component-owned computed or reaction needs.

### Rejected: synchronous render-time reactions

Running setup while rendering exposes external systems to work from a render
that may later fail, and signal reads unnecessarily dirty Canvas. Complete-phase
setup after successful render gives the resource an exact committed owner and a
non-rendering consumer.

## Final decision summary

- Remove `useState`, `StateUpdater`, `useMemo`, and `useWhenChanged`.
- Add `batch`, `useComputed`, `useConst`, and `useReaction`.
- Keep `useSignal`, `computed`, `useRef`, and specialized ownership hooks.
- Use `Object.is` consistently for signal results and hook dependency slots.
- Optimize graph ownership around lazy consumers and reusable intrusive edges.
- Batch complete CRC logical event dispatch automatically.
- Run reactions in Complete after successful ownership commits and never dirty a
  renderer solely because a reaction reads a signal.
- Preserve full immediate-mode traversal for dirty ordinary Canvas instances.
- Preserve explicit Layer and renderer boundaries as the only persistent pixel
  isolation mechanism.
- Reject automatic component image caches and retained scene architecture.
- Make removal conditional on measured non-regression and material improvement.
- Migrate the complete active repository surface in one breaking public pivot.
- Write no production implementation until this specification and its later
  implementation plan are both reviewed and approved.
