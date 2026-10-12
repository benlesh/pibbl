# Pibbl signals and scheduling contract

Status: current implemented contract, updated for Signals-centric authoring on
2026-09-24.

This document defines Pibbl's first-class synchronous signals and the one
realm-wide frame scheduler shared by every mounted root and managed `Layer` in
that loaded runtime. The [animation contract](./animation-contract.md) defines
the definitions, programs, playback, transitions, and staged animation work
that now use this graph and scheduler.

## Public signal surface

```ts
type SignalEquals<T> = (previous: T, next: T) => boolean;

declare const signalBrand: unique symbol;

interface SignalOptions<T> {
  equals?: SignalEquals<T>;
  debugName?: string;
}

interface Signal<T> {
  readonly [signalBrand]: T;
  get(): T;
}

interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(updater: (current: T) => T): void;
  asReadonly(): Signal<T>;
}

type SignalValue<T> = T | Signal<T>;

declare function signal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T>;
declare function computed<T>(
  compute: () => T,
  options?: SignalOptions<T>,
): Signal<T>;
declare function untracked<T>(read: () => T): T;
declare function isSignal(value: unknown): value is Signal<unknown>;
declare function resolveSignalValue<T>(value: SignalValue<T>): T;
declare function batch<T>(callback: () => T): T;
declare function useSignal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T>;
```

Signals are containers. Application code reads them explicitly, while
Pibbl-provided components resolve them at declared reactive input positions:

```tsx
const count = signal(0);
const doubled = computed(() => count.get() * 2);

function Counter() {
  return <Text>{doubled}</Text>;
}
```

Passing `doubled` makes `Text` the consumer. Passing `doubled.get()` remains
valid and intentionally makes `Counter` the consumer. Resolution is shallow
and schema-declared, never a recursive JSX-runtime walk through arbitrary
application objects. An exact API that asks for `Signal<T>` or
`WritableSignal<T>` receives the signal object without resolving it.

## Writable signals

`signal(initialValue, options?)` creates one writable cell. `Object.is` is the
default equality function. A supplied `equals` function and `debugName` are
captured at construction. An equal candidate publishes nothing, advances no
revision, and notifies no consumer.

`set(value)` always treats `value` as data, including when `T` is a function.
`update(updater)` invokes the updater exactly once with the current value. If
the updater or equality function throws, the previous value remains current.
`asReadonly()` returns one cached readonly view over the same cell;
`isSignal()` recognizes both views without adding a structural false positive.
`batch(callback)` groups synchronous writes. Values are readable immediately,
nested batches share the outer batch, and each affected observer is notified at
most once when the outer callback exits. If the callback throws, completed
writes remain committed, notification flushes, and the original error is
rethrown. Pibbl event dispatch creates the same outer batch automatically.

## Computed signals and untracked reads

`computed(compute, options?)` is lazy, synchronous, cached, and readonly. It
records only signal reads made synchronously while `compute` runs. Dependencies
are dynamic and are replaced after each successful evaluation. Nested computed
values validate dependency-first. Equality suppresses a computed revision and
downstream invalidation when the next value is equivalent.

Thrown computations are cached until a dependency changes. Cycles throw a
deterministic path using available `debugName` values, cache that exact error,
and never install the cycle-closing source edge. A guarded computation can
therefore recover when one of its retained noncyclic dependencies changes.
Promise continuations do not inherit read tracking. `untracked(read)` suppresses
dependency collection only for the synchronous callback and restores the
previous collector in `finally`; it does not relax any write guard.

Computed-to-source observer edges are held only while the computed is observed.
The first observer recursively acquires those leases and the final observer
recursively releases them. An unobserved computed retains dependency identities
and version snapshots without remaining in source observer sets, so a later
explicit `get()` can validate the retained graph correctly.

When an observed computed first becomes pending, its Plan work requests and
coalesces the realm host frame without prematurely dirtying a renderer. Plan
validates the graph dependency-first. An equal result ends after Plan with zero
renderer traversals; a changed result dirties the exact consumers and may render
them in that same frame. Reading the computed explicitly also validates it
immediately.

## Component consumers, signal inputs, and `useSignal`

During component evaluation, Pibbl collects that component's explicit reads and
declared input resolutions. Primitive prop/style resolution and render
callbacks belong to the primitive consumer that performs those reads; a
child's reads do not become parent dependencies. A successful evaluation
replaces the old dependency set.
Removal, failed-render cleanup, and root disposal detach all consumer edges.
`resolveSignalValue(value)` returns a plain value unchanged or reads exactly one
signal. It does not inspect arrays, objects, functions, or a signal returned by
another signal. Built-ins apply equivalent resolution only at their declared
input schema: whole props/style values, opted-in shallow fields, and the
recursive structural or Text child grammars. Event handlers are selected as
values and never invoked by resolution.
Mounted layout and measurement may inspect a child's declared style before
that child evaluates. Such a signal read creates a transaction-local provision
keyed by the receiving primitive token. Successful receiver evaluation adopts
and deduplicates the provision; failure, abort, removal, or an unclaimed
provision releases it. Pure `measureElement()` resolves untracked and creates no
persistent consumer. Plain values create no provision, consumer, wrapper
signal, or resolved-input copy.

When a dependency changes, each clean component consumer becomes dirty once
and requests its owning instance. Multiple changes coalesce. `useSignal()` is
an ordered hook slot that creates its writable signal on mount; its initial
value and options are mount-only. Removing its owner detaches render
dependencies. A retained hook signal remains a usable signal cell, but is inert
with respect to the removed owner.

Signal writes are forbidden during component traversal, primitive render, and
computed evaluation, including writes that would be equality no-ops. The guard
is checked before invoking an updater or equality function. Direct `set()` and
`update()` calls are also forbidden inside scheduler Advance participants;
those participants may mutate signals only through their provided staging
batch. Event handlers and other code outside protected scopes may write
normally.

## One realm scheduler

One scheduler singleton belongs to one loaded `@pibbl/core` runtime in one
JavaScript realm. All roots, managed Layers, signal consumers, and official
friend renderers using that runtime share at most one pending
`requestAnimationFrame`. Work requested while a frame is running is retained
for a later frame unless its documented phase admits it to the current frame.

Each frame has six ordered active phases:

| Phase    | Contract                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Begin    | Capture the frame's dirty jobs, Advance registrations, and ordinary completions. Registrations made after this point wait for the next frame.                                                                                  |
| Advance  | Run captured participants in registration order. Each participant may mutate signals only through its staging batch; a throwing participant loses only its staged writes and does not stop later participants.                 |
| Commit   | Publish changed staged values, then notify all affected consumers after publication. Dirtiness produced by this sanctioned admission scope may join the current plan.                                                          |
| Plan     | Drain eligible computed validation dependency-first without fail-fast behavior, capture resulting component dirtiness, and determine eligible root, Layer, and friend-renderer work. Admitted dirtiness may render this frame. |
| Render   | Render roots in registration order and nested instances deepest-first. For a dirty external render layer, its update/resize/render and interaction settlement precede ancestor Canvas composition.                             |
| Complete | Commit successful root transactions, run captured ordinary and eligible renderer completions, restore idle state, and request any required follow-up frame.                                                                    |

Outside a frame the scheduler phase is `idle`. `logicalTime` is the scheduler's
frame time and is distinct from any host callback timestamp.

## Revisions, roots, and Layers

Every render request receives a monotonically increasing realm revision. A
request for a nested instance marks that instance and its ancestors so the
updated bitmap can be composited to the root. Managed Layers are scheduler
instances, never separately registered top-level roots. Dirty nested Layers
render deepest-first before ancestor composition; clean sibling Layer trees
retain their cached bitmaps. A parent placement-only change may reuse a clean
child bitmap.

An instance's completed revision advances only after its successful work.
Arbitrary state, root, renderer, or completion requests raised during Advance,
Render, or Complete are deferred to a later frame. Signal notifications from
Commit and computed-result dirtiness from Plan are the sanctioned scopes that
may join the current plan. An explicit root replacement remains latest-wins and
cannot be erased by another kind of request.

## Error isolation and completion

Errors are isolated to the narrowest scheduled participant or render
transaction. One failed Advance participant does not block other participants.
One failed root does not block later roots or captured ordinary completions;
ordinary Pibbl failure remains fail-closed and requires later explicit work.
Errors are collected and thrown singly or as an aggregate only after Complete.

Plan validates every eligible observed computed in stable dependency order even
when another computed caches an error. A cached computation error remains owned
by the value and enters normal renderer or resource recovery only when that
consumer reads it; Plan does not report the same value error separately.
Observer or scheduler-infrastructure failures are collected independently and
reported once after Complete without stranding unrelated graph work.

For friend renderer work, callbacks later in the same independent stage still
run, but dependent stages for the failed transaction are skipped. Its revision
does not complete, its work is restored for retry, and only its affected
completion is deferred. Cleanup and scheduler state restoration occur in
`finally` paths.

## Version-coupled friend entry

`@pibbl/core/internal` is an explicit package entry only for official lockstep
renderer packages built against the exact same Pibbl version. It exports
`pibblInternalCreateSignalConsumer`, `pibblInternalCurrentFrame`,
`pibblInternalCurrentRenderOwner`, `pibblInternalQueueComplete`,
`pibblInternalRequestRendererWork`, and the `PibblInternalFrame`,
`PibblInternalRendererWorkKind`, `PibblInternalRenderOwner`, and
`PibblInternalSignalConsumer` types. The current render owner is available only
while Pibbl is evaluating that exact component.

The friend entry is not a stable third-party API, is not re-exported by
`@pibbl/core`, and is intentionally absent from the ordinary Studio declaration
and runtime surface. Consumers must never import `@pibbl/core/lib/*` or source
paths as a substitute.

## Ownership summary

| Resource                    | Sole owner                                             | Release or completion rule                                                                               |
| --------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Signal-to-component edge    | Exact component consumer                               | Replaced after successful evaluation; detached on removal, failure cleanup, or disposal.                 |
| `useSignal` hook cell       | Exact hook slot                                        | Owner removal detaches scheduling edges; a retained cell remains independently usable.                   |
| Computed-to-source edge     | Exact computed node while it has at least one observer | Acquired recursively on first observation; replaced with dependencies or released after final observer.  |
| Computed validation         | Exact computed node                                    | Cleared by successful validation or removed when no longer observed.                                     |
| Root scheduler registration | Exact live root                                        | Removed by abort, disposal, or failed-mount cleanup without affecting other roots.                       |
| Pending host frame          | Realm scheduler                                        | Cleared by callback completion; canceled only when no registered work remains.                           |
| Render revision             | Exact requested instance                               | Completed only by successful work; failed friend work remains pending for retry.                         |
| Friend work and owner       | Exact friend renderer transaction/component evaluation | Work completes through staged success or is restored on failure; owner scope always closes in `finally`. |

The [runtime/hook contract](./runtime-hooks-contract.md), [Canvas surface
contract](./canvas-surface-contract.md), and [resource ownership
contract](./runtime-resource-ownership.md) define the adjacent lifecycle and
surface rules. Focused signal graph, scheduler, Layer, failure-isolation,
package-consumer, and Studio declaration suites are the executable evidence.

## Deliberate boundaries

- Pibbl resolves signals only at declared component-input positions; arbitrary
  application data is never deep-unwrapped.
- Signals are synchronous; async resources and Promise-aware dependency
  tracking are not provided.
- Observed pending computed validation is Plan work; it requests only the
  coalesced realm frame and does not dirty a renderer before its result changes.
- The scheduler is not a retained scene graph, DOM reconciler, worker runtime,
  or public manual-clock/input-injection API.
- Animation values and hooks use these same reads and declared inputs, staging, frame
  phases, consumer boundaries, and ownership rules. Their specialized behavior
  lives in the [animation contract](./animation-contract.md).

## Native HTML publication

HtmlBox uses the root render transaction's optional publication stage before
finish callbacks and focus metadata adoption. Scheduled roots publish at the start
of Complete; direct private renders finish synchronously. Publication failure
notifies finish callbacks of failure and releases affected HTML while unrelated
roots complete. This adds no scheduler or animation loop. HtmlBox data remains
opaque; lifecycle setup/update/abort cleanup forbid signal writes. See the
[HtmlBox contract](./html-box-contract.md).
