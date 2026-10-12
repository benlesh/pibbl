# First-Class Signals and Central Scheduler Foundation Implementation Plan

> **Historical status: IMPLEMENTED PLAN.** The animation engine remains tracked by the dependency-ordered follow-up plan.

> **Final-review closure (2026-09-10):** Five Important foundation defects and
> one Minor WebGL-plan wording defect found after the initial implementation
> were repaired test-first. The final behavior includes live computed-only Plan
> scheduling, repeatable cached-cycle recovery, non-fail-fast validation,
> observation-scoped computed source edges, and staged-only Advance mutation
> with explicit phase admission. Fresh evidence is recorded in the delivery
> field note; the original task sequence below remains the historical execution
> plan rather than a claim that its first implementation passed final review.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Pibbl's general-purpose signal graph, explicit component signal reads, renderer-consumer invalidation, and one realm-wide six-phase frame scheduler while preserving the current immediate-mode Canvas 2D, Layer, lifecycle, and event contracts.

**Architecture:** Mount-independent writable and computed signals own a synchronous dependency graph. A component-scoped renderer consumer records successful `.get()` reads and translates relevant changes into work for the exact Pibbl instance that read them. A realm scheduler replaces per-instance animation-frame ownership, snapshots all top-level root work once, validates observed computed values, and renders affected roots in stable mount order. Ordinary Canvas 2D remains full-root immediate mode; explicit Layer instances remain the retained boundary and use revisioned dirty propagation so a signal read inside a Layer repaints that surface before ancestor composition.

**Tech Stack:** TypeScript, HTML Canvas 2D, `OffscreenCanvas`, `requestAnimationFrame`, Pibbl's synchronous JSX/createElement runtime and hook slots, Vitest Browser with Playwright Chromium, pnpm 11.21.0.

**Spec:** `docs/superpowers/specs/2026-09-09-first-class-signals-and-animation-design.md`

**Next plan:** `docs/superpowers/plans/2026-09-09-first-class-animation-engine-implementation.md` depends on this plan's signal graph, staged commit transaction, centralized frame phases, and lifecycle seams.

**Cross-plan order:** Complete this foundation before executing Task 4 or Task 11 of `docs/superpowers/plans/2026-09-09-webgl-islands-implementation.md`. Those WebGL tasks must extend this plan's existing friend entry and route `useAnimationFrame` through the realm scheduler; they must not restore per-instance host-frame ownership.

## Global Constraints

- Preserve unrelated working-tree changes and untracked files; stage only files named by the active task.
- Add a failing test before each production behavior change.
- Keep `signal`, `computed`, and `untracked` usable without mounting Pibbl.
- Keep signal reads explicit as `value.get()`. Do not make signals callable and do not interpret signal objects placed directly in `style`.
- Keep signals mount-independent. A disposed consumer detaches its graph edges; disposal does not destroy a signal retained by application code.
- Export no public `subscribe`, `effect`, watcher, resource, store/proxy, or `batch` API.
- Reject signal writes while evaluating a computed callback or rendering a Pibbl component/primitive. Do not change the separate `useState` setter contract.
- Preserve lazy, memoized computed evaluation, dynamic dependencies, cached errors, and `Object.is` equality by default.
- One JavaScript realm owns at most one pending Pibbl host animation frame. Top-level roots are render participants; Layer child instances never own a host frame.
- Preserve latest-root coalescing, state scheduling, resize/density/image/focus/event requests, source paint order, root-logical events, identity, hook order, fail-closed render teardown, and current Canvas pixel behavior.
- An ordinary Canvas 2D signal invalidation clears and traverses the affected top-level root. Do not add automatic subtree caching, a retained display list, or hidden offscreen surfaces.
- A Layer-internal signal read dirties that Layer and every retained ancestor needed to reach it. A parent-only Layer presentation read must continue to reuse the child bitmap.
- Keep every scheduler collection and ownership release explicit. Correctness must not depend on `WeakRef`, finalizers, or garbage-collection timing.
- The internal manual driver and trace are test/diagnostic seams, not a public clock API.
- The WebGL implementation may extend `@pibbl/core/internal`, but it must preserve the one scheduler singleton and the scheduler/consumer capabilities established here.
- Use Node 24.15 or newer, pnpm 11.21.0, and Playwright Chromium for final evidence.

## File and responsibility map

- `packages/core/src/lib/signals/types.ts`: public nominal `Signal`, `WritableSignal`, equality, and options types.
- `packages/core/src/lib/signals/graph.ts`: writable/computed nodes, synchronous tracking stack, dynamic graph edges, equality, error caching, internal renderer consumers, and commit batches.
- `packages/core/src/lib/signals/graph.test.ts`: pure graph behavior with no Pibbl mount.
- `packages/core/src/lib/scheduler/types.ts`: private frame phases, snapshots, root jobs, advance registrations, completion work, traces, and driver types.
- `packages/core/src/lib/scheduler/realm-scheduler.ts`: one realm registry, one host-frame owner, stable work ordering, six phases, staged signal commit, error isolation, and exact cancellation.
- `packages/core/src/lib/scheduler/testing.ts`: source-only controlled driver, trace snapshots, and structural counters.
- `packages/core/src/lib/scheduler/realm-scheduler.test.ts`: controlled multi-root and phase-order contract.
- `packages/core/src/lib/signals/render-consumer.ts`: component/resource consumer ownership and revisioned invalidation adapters.
- `packages/core/src/lib/hooks/use-signal.ts`: one stable writable signal per mounted hook slot.
- `packages/core/src/lib/{mount-pibbl.ts,update.ts,execute-render.ts,render.ts,global-state.ts,types.ts}`: scheduler registration, render jobs, dependency collection, write guard, and teardown.
- `packages/core/src/lib/components/layer.ts`: retained-child dirty-revision checks before cache reuse.
- `packages/core/src/internal.ts`: version-coupled official-package friend entry for the scheduler/consumer slice only.
- `packages/scenarios/src/signals-lab.example.tsx` and `packages/scenarios/src/signals-lab.ts`: deterministic public signal laboratory.
- `packages/scenarios/src/learning/start/signals.example.tsx`: focused explicit-read lesson.
- Root exports, package consumers, Studio declarations, design contracts, API reference, status tables, trust scripts, and field notes: one consistent public and verification surface.

## Foundation invariants

The implementation must retain these distinctions:

| Concern                       | Owner                                         | Observable consequence                                                 |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Signal value and source edges | Signal graph node                             | Survives mount disposal when application code retains it               |
| Component read edges          | Exact `PibblComponentRefs` consumer           | Replaced after its next successful evaluation and detached on teardown |
| Pending host callback         | Realm scheduler                               | One callback regardless of root count                                  |
| Root replacement              | Exact mounted instance                        | Latest value captured for the next Begin snapshot                      |
| Layer dirty work              | Nested Layer instance plus retained ancestors | Child surface updates before parent composite                          |
| Render pixels                 | Existing immediate-mode renderer              | Full affected root traversal outside explicit retained boundaries      |

Every frame follows `Begin -> Advance -> Commit -> Plan -> Render -> Complete`, even before public animation exists. In this foundation, Advance accepts internal test/friend registrations and Commit applies their staged values. The second plan adds playback as the normal producer.

---

### Task 1: Public writable signal value and explicit read surface

**Files:**

- Create: `packages/core/src/lib/signals/types.ts`
- Create: `packages/core/src/lib/signals/graph.ts`
- Create: `packages/core/src/lib/signals/graph.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Produces public `SignalEquals<T>`, `SignalOptions<T>`, `Signal<T>`, `WritableSignal<T>`, `signal`, `untracked`, and `isSignal`.
- Produces private `getSignalNode(value)` and a synchronous tracking/write-policy stack used by later tasks.
- Does not yet produce `computed` or `useSignal`.

- [ ] **Step 1: Write failing public writable-signal tests**

Cover explicit synchronous reads, `set`, functional `update`, stable readonly
views, runtime detection, `Object.is`, custom equality, function-valued data,
and caller option immutability:

```ts
const point = signal(
  { x: 1 },
  {
    debugName: "point",
    equals: (previous, next) => previous.x === next.x,
  },
);
const readonlyPoint = point.asReadonly();

expect(point.get()).toEqual({ x: 1 });
expect(readonlyPoint).toBe(point.asReadonly());
expect(isSignal(point)).toBe(true);
expect(isSignal(readonlyPoint)).toBe(true);
expect(isSignal({ get: () => 1 })).toBe(false);

point.set({ x: 1 });
expect(point.get()).toEqual({ x: 1 });
point.update((current) => ({ x: current.x + 1 }));
expect(point.get()).toEqual({ x: 2 });
```

Assert `update` runs once. If `equals` or the update callback throws, assert the
old value remains and no internal invalidation counter advances. Prove `NaN`
equals `NaN` and `0` differs from `-0` under the default.

- [ ] **Step 2: Run the focused test and confirm missing exports**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the signal module and public exports do not exist.

- [ ] **Step 3: Define the nominal public contract**

Use the spec shape exactly:

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
```

Keep the nominal key declaration private to the type module. Use a private
`WeakSet<object>` or equivalent unforgeable registry for `isSignal`; do not add
an enumerable public brand property.

- [ ] **Step 4: Implement writable nodes without Pibbl coupling**

Normalize `equals` and `debugName` once at construction. `get()` calls the
innermost synchronous dependency collector when one exists. `set()` evaluates
equality before replacing the value and notifies internal observers only after
a successful change. `update()` reads the current value once without creating
a dependency, invokes the callback once, and delegates to `set()`.

Implement `asReadonly()` as one cached object exposing only `get()`. Make
`untracked` push a tracking-suppression frame in `try/finally` and return or
throw exactly as its callback does.

- [ ] **Step 5: Run tests and typecheck**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: focused tests PASS and typecheck PASS.

- [ ] **Step 6: Commit the writable signal surface**

```bash
git add packages/core/src/lib/signals/types.ts packages/core/src/lib/signals/graph.ts packages/core/src/lib/signals/graph.test.ts packages/core/src/index.ts
git commit -m "feat(core): add explicit writable signals"
```

### Task 2: Lazy computed signals and dynamic dependency pruning

**Files:**

- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/signals/graph.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: Task 1 graph nodes and tracking stack.
- Produces public `computed<T>(compute, options): Signal<T>`.
- Produces private observed-computed validation queues for the scheduler's Plan phase.

- [ ] **Step 1: Write failing computed-semantics tests**

Cover laziness, memoization, nested computed values, dynamic dependencies,
custom equality, cached errors, recovery after a dependency change, direct and
indirect cycles, and synchronous-only tracking:

```ts
const chooseLeft = signal(true);
const left = signal(2);
const right = signal(20);
let evaluations = 0;
const selected = computed(() => {
  evaluations += 1;
  return chooseLeft.get() ? left.get() : right.get();
});

expect(evaluations).toBe(0);
expect(selected.get()).toBe(2);
expect(selected.get()).toBe(2);
expect(evaluations).toBe(1);

chooseLeft.set(false);
expect(selected.get()).toBe(20);
left.set(3);
expect(selected.get()).toBe(20);
expect(evaluations).toBe(2);
```

For a throwing computed, capture the exact `Error` object and prove repeated
reads rethrow that object without re-executing. After a live dependency changes,
prove the next read evaluates again. Use a promise continuation to prove reads
after `await` are not assigned to the prior computation.

- [ ] **Step 2: Run the focused test and verify missing computed behavior**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on the new `computed` import and assertions.

- [ ] **Step 3: Implement lazy computed nodes**

Model a computed with `clean`, `check`, `evaluating`, and cached
`value | error` states. A source invalidation changes `clean` to `check`; it does
not call the computation. `get()` validates dependencies by source version,
re-evaluates only when required, and records the computed itself against the
outer collector.

During evaluation, collect a fresh dependency set. On success or failure,
replace old edges with the fresh set in `finally`, cache the outcome, and use
the configured equality to decide whether the outward version changed. If
equality throws, retain the previous successful value and cache the thrown
evaluation result without half-replacing graph state.

Detect `evaluating` re-entry and throw a deterministic error containing the
available debug-name path, for example:

```text
Pibbl computed cycle: viewport scale -> fitted width -> viewport scale
```

- [ ] **Step 4: Add observed-computed validation without public subscription**

Give internal observers a way to mark a computed as observed. When an observed
computed becomes `check`, enqueue it once for Plan validation. Export only the
private graph operation:

```ts
export function flushPendingComputedValidations(): void;
```

Processing must be stable, dependency-first, and reentrant-safe. Unobserved
computed values remain fully lazy and are removed from the pending set when
their final observer detaches.

- [ ] **Step 5: Run graph tests and typecheck**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
```

Expected: all graph tests PASS and typecheck PASS.

- [ ] **Step 6: Commit computed signals**

```bash
git add packages/core/src/lib/signals/graph.ts packages/core/src/lib/signals/graph.test.ts packages/core/src/index.ts
git commit -m "feat(core): add lazy computed signals"
```

### Task 3: Internal renderer consumers and atomic signal commit batches

**Files:**

- Create: `packages/core/src/lib/signals/render-consumer.ts`
- Create: `packages/core/src/lib/signals/render-consumer.test.ts`
- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/signals/graph.test.ts`

**Interfaces:**

- Consumes: Task 2 graph observation and validation.
- Produces private `SignalRenderConsumer`, `createSignalRenderConsumer`, `collectSignalReads`, `disposeSignalRenderConsumer`, and `SignalCommitBatch`.
- Produces private `withSignalWriteForbidden(reason, callback)` for computed and render phases.
- Keeps batching and consumer registration out of the public root entry.

- [ ] **Step 1: Write failing consumer replacement and teardown tests**

Create two writable sources, one computed selector, and an owned test consumer.
Collect `selector.get()`, switch the selector dependency, validate in a simulated
Plan phase, and assert only the live source can invalidate the consumer. Then
dispose it and prove neither source can retain or call it.

Assert failed collection does not replace the last successful dependency set:

```ts
const consumer = createSignalRenderConsumer({
  debugName: "test consumer",
  invalidate: invalidated,
});

collectSignalReads(consumer, () => right.get());
consumer.markClean();

expect(() =>
  collectSignalReads(consumer, () => {
    left.get();
    throw new Error("failed render");
  }),
).toThrow("failed render");

left.set(3);
flushPendingComputedValidations();
expect(invalidated).not.toHaveBeenCalled();

right.set(21);
flushPendingComputedValidations();
expect(invalidated).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Write failing batch visibility tests**

Stage writes to two signals and prove public reads retain old values until one
commit. A computed observed by one consumer must evaluate against both new
values, invalidate at most once, and stay quiet when its final derived value is
equal. Assert a discarded batch changes nothing.

- [ ] **Step 3: Run focused tests and confirm missing internals**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/render-consumer.test.ts packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because renderer consumers and commit batches are absent.

- [ ] **Step 4: Implement transactional collection**

`collectSignalReads` creates a temporary dependency set, invokes the callback,
and installs the new edges only after success. A thrown callback drops the
temporary reads. Consumer invalidation is edge-triggered: one invalidation
marks it dirty and calls its owner callback once until the owner acknowledges a
successful render with `consumer.markClean()`.

Disposal removes every committed edge, clears temporary state, prevents future
callbacks, and increments a test-visible release counter exactly once.

- [ ] **Step 5: Implement one staged value per output**

Use a `Map` keyed by the private writable node. Later stages for the same node
replace its candidate while retaining deterministic first-insertion order.
Expose this private shape:

```ts
export interface SignalCommitBatch {
  read<T>(signal: WritableSignal<T>): T;
  stage<T>(signal: WritableSignal<T>, value: T, writer: object): void;
  discardWriter(writer: object): void;
  commit(): void;
  clear(): void;
}
```

`read` returns a staged value when present, enabling later sequence stages in
the animation plan. `commit` applies every equality check before graph
notification, removes equality-suppressed candidates, then notifies changed
sources as one graph batch. If a writer's callback failed, `discardWriter`
removes all of its current-frame candidates before commit.

- [ ] **Step 6: Centralize write guards**

Computed evaluation calls
`withSignalWriteForbidden(computedWriteErrorLabel(node), evaluate)`; Pibbl render
uses the same primitive in Task 5. Public `set` and `update`, internal staged
writes, and later animation control paths consult the shared stack and report
contextual deterministic errors.

- [ ] **Step 7: Run focused tests and commit**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/render-consumer.test.ts packages/core/src/lib/signals/graph.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
git add packages/core/src/lib/signals/graph.ts packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/signals/render-consumer.ts packages/core/src/lib/signals/render-consumer.test.ts
git commit -m "feat(core): add signal consumers and commit batches"
```

### Task 4: Replace per-instance frames with one realm scheduler

**Files:**

- Create: `packages/core/src/lib/scheduler/types.ts`
- Create: `packages/core/src/lib/scheduler/realm-scheduler.ts`
- Create: `packages/core/src/lib/scheduler/testing.ts`
- Create: `packages/core/src/lib/scheduler/realm-scheduler.test.ts`
- Modify: `packages/core/src/lib/update.ts`
- Modify: `packages/core/src/lib/mount-pibbl.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/global-state.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/hooks/use-state.test.ts`
- Modify: `packages/core/src/lib/components/img-async.test.ts`
- Modify: `packages/core/src/lib/runtime-contract.test.ts`
- Modify: `packages/core/test/event-performance.test.ts`

**Interfaces:**

- Consumes: Task 3 `SignalCommitBatch` and `flushPendingComputedValidations`.
- Produces private `registerRootInstance`, `unregisterRootInstance`, `requestInstanceRender`, `registerAdvanceParticipant`, `queueFrameCompletion`, and `getCurrentFrameSnapshot`.
- Produces source-only `ManualSchedulerDriver`, `installSchedulerDriverForTest`, and scheduler ownership snapshots.
- Removes `PibblInstance.animationFrameId` and per-instance cancellation.

- [ ] **Step 1: Characterize current root scheduling before refactoring**

Add explicit characterization cases to `runtime-contract.test.ts` for latest-root
wins, state plus root replacement ordering, updates queued during render,
disposal before callback, render failure recovery, and nested Layer behavior.
Run the focused current suites and record that they pass before production
changes:

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/hooks/use-state.test.ts packages/core/src/lib/components/img-async.test.ts packages/core/src/lib/components/layer.test.ts --browser.headless --browser.ui=false
```

- [ ] **Step 2: Write failing one-realm-frame and stable-order tests**

Install the manual driver, mount two top-level canvases, queue several updates
on both, and assert one host request. Flush timestamp `125`, assert each root
renders once in mount order and sees the same frame identity/time, then assert
no host callback remains.

Add cases for:

- disposing one dirty root before Begin;
- one root throwing while the later root still renders;
- a request made during Render appearing only in the next flush;
- a Layer child mount never registering as a top-level participant;
- removing the final dirty root canceling the pending host callback exactly once.

- [ ] **Step 3: Define the private frame model**

Use these phases and immutable snapshot:

```ts
export type PibblFramePhase =
  "idle" | "begin" | "advance" | "commit" | "plan" | "render" | "complete";

export interface PibblFrameSnapshot {
  readonly frameId: number;
  readonly hostTime: number;
  readonly logicalTime: number;
}
```

The scheduler owns monotonically increasing `frameId`, root and advance
registration order, one pending host callback, current/next work sets, one
SignalCommitBatch, completion callbacks, and collected errors. The production
driver resolves `globalThis.requestAnimationFrame` and
`globalThis.cancelAnimationFrame` when requesting/canceling, preserving current
test interception.

- [ ] **Step 4: Move root requests behind the scheduler**

Keep `update(canvas, root?, updateParents?)` as the current private call site,
but make it validate the mount, merge the latest pending root, and delegate to
`requestInstanceRender`. Top-level `mountPibbl` registers once in mount order;
cleanup unregisters once. A child instance follows its parent canvas until the
top-level root and never enters the root registry.

Replace `animationFrameId` with revisioned fields:

```ts
requestedRenderRevision: number;
completedRenderRevision: number;
```

Every request receives a realm work revision. A successful render records only
the revision captured by Begin; a newer request made during the frame therefore
remains dirty for the next frame.

- [ ] **Step 5: Execute all six phases with isolation**

At Begin, freeze root jobs and advance registrations in stable order and drain
only commands accepted before the snapshot. Advance calls each registered
producer. Commit applies the SignalCommitBatch. Plan validates observed
computeds and allows their newly dirty consumers to join the current Render
plan. Render runs dirty top-level roots in mount order. Complete finalizes root
transactions, calls eligible completion callbacks in queue order, releases
one-shot work, and requests another frame only when current work remains.

Collect errors per producer/root/callback, continue independent work, then
throw the single error or an `AggregateError` after Complete so the browser's
ordinary host reporting remains authoritative.

- [ ] **Step 6: Remove render-time frame cancellation**

`executeRender` must neither cancel a realm callback nor recursively schedule
unrelated parents. It receives or inherits the current frame snapshot. Direct
source tests may call it outside a host frame with an isolated immutable
snapshot, but that path performs Render work only and never advances registered
producers. Nested Layer renders inherit the parent snapshot and render
transaction.

- [ ] **Step 7: Update structural assertions, not public behavior**

Replace tests that inspect `instance.animationFrameId` with scheduler ownership
snapshots such as:

```ts
expect(snapshotRealmScheduler()).toMatchObject({
  pendingHostFrames: 0,
  registeredRoots: 1,
  dirtyRoots: 0,
});
```

Keep all existing pixel, lifecycle, event, image, and state assertions intact.

- [ ] **Step 8: Run scheduler and regression suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/hooks/use-state.test.ts packages/core/src/lib/components/img-async.test.ts packages/core/src/lib/components/layer.test.ts packages/core/test/event-performance.test.ts --browser.headless --browser.ui=false
```

Expected: one-frame structural tests and all existing selected contracts PASS.

- [ ] **Step 9: Commit centralized scheduling**

```bash
git add packages/core/src/lib/scheduler packages/core/src/lib/update.ts packages/core/src/lib/mount-pibbl.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/global-state.ts packages/core/src/lib/types.ts packages/core/src/lib/hooks/use-state.test.ts packages/core/src/lib/components/img-async.test.ts packages/core/test/event-performance.test.ts
git commit -m "refactor(core): centralize frame scheduling"
```

### Task 5: Track component reads and add `useSignal`

**Files:**

- Create: `packages/core/src/lib/hooks/use-signal.ts`
- Create: `packages/core/src/lib/hooks/use-signal.test.tsx`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/execute-render.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: Task 3 renderer consumers and Task 4 `requestInstanceRender`.
- Produces public `useSignal(initialValue, options): WritableSignal<T>`.
- Gives every non-fragment `PibblComponentRefs` one exact signal consumer.

- [ ] **Step 1: Write failing public render-invalidation tests**

Mount a component that reads `x.get()` into Rectangle style, then write `x`
outside render. Assert no synchronous render, one scheduled frame, and one
full-root traversal with the new value. Write the same value and assert no
frame. Read a signal before constructing `pibbl(canvas, root)` and prove it is a
snapshot with no reactive dependency.

Add a component with an equality-suppressing computed:

```tsx
const source = signal(1);
const parity = computed(() => source.get() % 2);

function Scene() {
  renders += 1;
  return <Rectangle style={{ x: parity.get() * 10, width: 10, height: 10 }} />;
}
```

After `source.set(3)`, flush Plan and assert no root traversal because parity
remained `1`. After `source.set(4)`, assert one traversal.

- [ ] **Step 2: Write failing ownership and write-guard tests**

Prove a conditional read replaces its old edge after a successful render,
component removal detaches all edges, a failed root leaves no consumer edges,
and a stale detached signal write schedules nothing. Assert signal `set` and
`update` throw from ordinary components, primitive style resolution, primitive
render callbacks, and computed callbacks without changing values.

- [ ] **Step 3: Write failing `useSignal` hook tests**

Assert one stable writable identity per hook slot, mount-only capture of initial
value/options, normal hook-order diagnostics, usability after external
retention, and no render work after owner removal. Add `useSignal` to the shared
hook-misuse probe and require the standard hook-context error.

- [ ] **Step 4: Run focused tests and confirm failures**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/use-signal.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/signals/render-consumer.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because components do not collect signals and `useSignal` is
missing.

- [ ] **Step 5: Install one component consumer around the read phase**

Create the consumer when `prepareComponentScope` mounts and follow
`componentRefs.teardowns`. Its invalidation callback verifies exact component
and instance identity, then calls `requestInstanceRender(pibblInstance)`.

Collect reads across the component function or, for primitives, style
resolution plus primitive callback. Commit the dependency set after that
component's own synchronous evaluation and before traversing returned children,
so child reads belong only to child consumers. If evaluation throws, discard
the temporary set; the existing fail-closed root cleanup disposes committed
consumers.

- [ ] **Step 6: Guard the complete root render against signal writes**

Invoke the existing root traversal as
`withSignalWriteForbidden("Pibbl render", renderRoot)`. Keep `useState` behavior
unchanged. Ensure cleanup, error recovery, nested Layer rendering, and
render-transaction `finally` paths restore the guard stack.

- [ ] **Step 7: Implement `useSignal` with normal hook ownership**

Use `useHookSlot("signal", () => signal(initialValue, options))`. Later renders
return the slot value without reconfiguring equality or debug name. Component
teardown disposes only its renderer consumer and playback owners added later;
it does not invalidate the retained signal object.

- [ ] **Step 8: Run focused and broad render tests**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/use-signal.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/component-dispatch.test.tsx packages/core/src/lib/filter/filter-integration.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS, including filter and component traversal
semantics.

- [ ] **Step 9: Commit renderer signal tracking**

```bash
git add packages/core/src/lib/hooks/use-signal.ts packages/core/src/lib/hooks/use-signal.test.tsx packages/core/src/lib/render.ts packages/core/src/lib/execute-render.ts packages/core/src/lib/types.ts packages/core/src/lib/hooks/hook-contract.test.ts packages/core/src/index.ts
git commit -m "feat(core): track component signal reads"
```

### Task 6: Make retained Layer invalidation exact

**Files:**

- Modify: `packages/core/src/lib/components/layer.ts`
- Modify: `packages/core/src/lib/components/layer.test.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.test.ts`
- Modify: `packages/core/src/lib/types.ts`

**Interfaces:**

- Consumes: revisioned scheduler requests and component consumers.
- Produces nested-instance dirty propagation and successful-revision acknowledgment.
- Preserves existing tree/dimension/density/focus/filter cache reasons.

- [ ] **Step 1: Write failing Layer-local invalidation tests**

Put separate counters and signals in the root, Layer A, Layer B, and a nested
Layer inside A. After first render:

- changing only A's child signal repaints A and its necessary ancestors, but not B;
- changing only the nested signal repaints the nested surface, A's surface, and the top-level composite in child-before-parent order;
- changing a signal read only by the parent for Layer translation reuses A's child bitmap;
- a shared signal read inside A and by a second top-level canvas commits before either top-level root renders.

Assert child primitive execution counts and `drawImage` composition counts,
not merely final pixels.

- [ ] **Step 2: Run Layer and scheduler tests and observe stale cache behavior**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/layer.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because current Layer reuse compares only element snapshots and
focus revision.

- [ ] **Step 3: Propagate dirty revisions through retained ancestors**

When a nested instance receives work, assign its requested revision, then walk
the `parent` canvas chain and assign the same or newer requested revision to
each retained ancestor and top-level root. Add no child instance to the realm
root registry.

In `renderLayer`, extend `shouldRender` with:

```ts
hasPendingInstanceRender(layerPibbl);
```

Capture the child's requested revision before invoking `executeRender`. Mark
that revision completed only after a successful child render. A request made
during the child render therefore remains newer and schedules another realm
frame.

- [ ] **Step 4: Preserve cache hits for parent presentation changes**

Do not transfer the parent's component consumer to the child. Signal reads in
Layer width, height, transform, opacity, outer filter, or placement remain parent
dependencies. When child input snapshots and child revisions are unchanged,
retain the current focus replay and cached bitmap path.

- [ ] **Step 5: Add failure and teardown cases**

Force a nested signal-driven child render to throw. Assert the failing child
clears its refs and consumer edges, the independent second root still renders,
all Layer surfaces remain owned/released by their existing controllers, and a
later valid child root recovers. Dispose while a nested invalidation is pending
and assert the realm callback cancels when no other work remains.

- [ ] **Step 6: Run Layer, focus, filter, and event regressions**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/layer.test.ts packages/core/src/lib/focus/layer-focus-render.test.ts packages/core/src/lib/filter/filter-integration.test.ts packages/core/test/geometry-composition.test.ts packages/core/test/interaction-dispatch.test.ts --browser.headless --browser.ui=false
```

Expected: all selected suites PASS with unchanged paint and hit order.

- [ ] **Step 7: Commit Layer-aware signal scheduling**

```bash
git add packages/core/src/lib/components/layer.ts packages/core/src/lib/components/layer.test.ts packages/core/src/lib/scheduler/realm-scheduler.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts packages/core/src/lib/types.ts
git commit -m "feat(core): invalidate signal-driven layers"
```

### Task 7: Publish the official renderer friend scheduler slice

**Files:**

- Create: `packages/core/src/internal.ts`
- Create: `packages/core/src/lib/scheduler/renderer-participant.ts`
- Create: `packages/core/src/lib/scheduler/renderer-participant.test.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Modify: `tooling/assert-built-core.ts`
- Modify: `tooling/verify-packed-consumer.mjs`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `docs/superpowers/plans/2026-09-09-webgl-islands-implementation.md`

**Interfaces:**

- Consumes: centralized frame snapshots, renderer consumers, exact teardowns, and revisioned work.
- Produces the version-coupled `@pibbl/core/internal` scheduler/consumer capabilities needed by official sibling renderers.
- Does not promise a stable third-party plugin API or expose mutable `GLOBAL_STATE`.

- [ ] **Step 1: Write failing fake-renderer phase tests**

Register a source-only fake retained renderer with named `resource`, `draw`, and
`compose` work. Track a signal into its resource consumer, mutate it in the same
frame as a Canvas signal, and assert this order:

```text
advance -> commit -> plan -> fake resource -> fake draw -> root render -> fake compose -> complete
```

If the renderer is nested, order its resource/draw work before the parent
Canvas composite. Prove several invalidations coalesce, current frame identity
is readable only during a frame, and disposal removes edges/work before the
next snapshot.

- [ ] **Step 2: Run the focused test and confirm the friend surface is absent**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/scheduler/renderer-participant.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because renderer participants and `@pibbl/core/internal` do not
exist.

- [ ] **Step 3: Add focused internal capabilities**

Expose operations through `src/internal.ts` with names prefixed
`pibblInternal*`, including:

```ts
declare const internalRenderOwnerBrand: unique symbol;

export interface PibblInternalRenderOwner {
  readonly [internalRenderOwnerBrand]: true;
}

export interface PibblInternalFrame {
  readonly frameId: number;
  readonly logicalTime: number;
}

export type PibblInternalRendererWorkKind = "resource" | "draw" | "compose";

export interface PibblInternalSignalConsumer {
  collect<T>(read: () => T): T;
  markClean(): void;
  dispose(): void;
}

export function pibblInternalCurrentRenderOwner(): PibblInternalRenderOwner;

export function pibblInternalCreateSignalConsumer(options: {
  owner: PibblInternalRenderOwner;
  debugName?: string;
  invalidate(): void;
}): PibblInternalSignalConsumer;

export function pibblInternalRequestRendererWork(
  owner: PibblInternalRenderOwner,
  request: {
    key: object;
    kind: PibblInternalRendererWorkKind;
    run(frame: PibblInternalFrame): void;
  },
): void;

export function pibblInternalCurrentFrame(): PibblInternalFrame;

export function pibblInternalQueueComplete(
  owner: PibblInternalRenderOwner,
  callback: (frame: PibblInternalFrame) => void,
): void;
```

`pibblInternalCurrentRenderOwner` is valid only while evaluating a component and
returns an opaque owner tied to its component teardown. Consumer collection
replaces dependencies only on success. Renderer work coalesces by `key` within
one owner/frame and runs in kind order while retaining stable registration order
inside a kind. Complete callbacks are one-shot and owner-checked. Keep signal
staging private to core; official renderer integrations consume committed values
during Plan/Render.

Update the WebGL execution plan's friend-entry task from creating an independent
entry to extending this entry with its backend traversal APIs. Specify that its
`requestCurrentInstanceFrame(true)` adapter delegates to
`pibblInternalRequestRendererWork`, and replace the Task 11 phrase “existing
instance rAF coalescing” with “realm scheduler coalescing.” Preserve the WebGL
plan's backend, traversal, interaction, and resource contracts.

- [ ] **Step 4: Add the package entry without duplicate core state**

Add `./internal` to `packages/core/package.json`, `src/internal.ts` to the
declaration/build entries, source aliases to root TypeScript/Vitest config, and
built-resolution validation. The bundled entry must share chunks/state with
the root entry and must not create a second scheduler singleton.

- [ ] **Step 5: Prove package boundaries**

Import the internal types/functions in `playground/package-consumer/index.ts`,
dynamically inspect their runtime presence from `runtime.mjs`, require
`dist/internal.{d.ts,mjs,mjs.map}` in packed verification, and copy the updated
consumer fixtures into the packed test. Assert source, built, and packed modes
resolve `@pibbl/core/internal` while `@pibbl/core/lib/*` and `@pibbl/core/src/*`
remain blocked. Verify the internal module contains no root public re-export and
document in its declaration comments that it is reserved for official
version-coupled packages.

- [ ] **Step 6: Run focused, build, and package checks**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/scheduler/renderer-participant.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer
```

Expected: phase tests, build, Bundler/NodeNext consumers, and runtime package
checks PASS.

- [ ] **Step 7: Commit the official friend seam**

```bash
git add packages/core/src/internal.ts packages/core/src/lib/scheduler/renderer-participant.ts packages/core/src/lib/scheduler/renderer-participant.test.ts packages/core/package.json packages/core/tsconfig.build.json tsconfig.json vitest.config.ts tooling/assert-built-core.ts tooling/verify-packed-consumer.mjs playground/package-consumer/index.ts playground/package-consumer/runtime.mjs docs/superpowers/plans/2026-09-09-webgl-islands-implementation.md
git commit -m "feat(core): expose renderer scheduling internals"
```

### Task 8: Add public signal scenarios and headless evidence

**Files:**

- Create: `packages/scenarios/src/learning/start/signals.example.tsx`
- Create: `packages/scenarios/src/signals-lab.example.tsx`
- Create: `packages/scenarios/src/signals-lab.ts`
- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Create: `packages/core/test/signals-lab.test.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `packages/core/test/scenario-catalog.test.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Consumes: only public `@pibbl/core` signal and rendering APIs.
- Produces learning route `#/examples/start/signals` and lab route `#/testing/signals`.
- Produces deterministic actions for direct write, equal write, computed-equal write, dependency switch, shared roots, Layer-local write, remove consumer, and reset.

- [ ] **Step 1: Add failing catalog and public-source tests**

Expect both routes, exact action IDs, source identifiers, public-package imports,
and no `internal`/`lib`/source paths. Add the learning slug to the start-section
expectations.

- [ ] **Step 2: Run catalog tests and confirm missing sources**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/signals-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the signal sources and catalog records do not exist.

- [ ] **Step 3: Build the learning example around visible `.get()` reads**

Create a module-level writable `x` and one component-local `useSignal` for
color. The component reads both explicitly into supported Rectangle styles;
clicking the rectangle uses `update` to move and recolor it. Include a computed
label or position to demonstrate derivation without presenting effects or
implicit style binding.

Metadata must explain:

- `.get()` is the dependency declaration;
- writing schedules one future Pibbl frame;
- the style object contains ordinary resolved values;
- a signal can be shared independently of a mount.

- [ ] **Step 4: Build the deterministic signal laboratory**

Expose state fields for source values, computed value/evaluations, top-level
root renders, Layer A/B child renders, composites, consumer count, and last
action. Use two canvases only through the scenario's owned mount/controller
contract; if the existing scenario type supports one primary canvas, create and
remove the second canvas inside the scenario owner and return all teardown from
`dispose`.

- [ ] **Step 5: Drive semantic and structural assertions**

Assert exact values and render counters after every action. For the shared-root
action, intercept the host scheduler and prove one callback advances both
roots. For the Layer action, prove the dirty Layer child runs before its parent
composite while the sibling Layer child counter stays unchanged. After removal,
write the retained signal and assert no pending frame.

- [ ] **Step 6: Generate the index and run public tests**

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/signals-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts --browser.headless --browser.ui=false
```

Expected: catalogs/index validate and all selected tests PASS. No visual
baseline is required because signal correctness is semantic and structural.

- [ ] **Step 7: Commit public signal evidence**

```bash
git add packages/scenarios/src/learning/start/signals.example.tsx packages/scenarios/src/signals-lab.example.tsx packages/scenarios/src/signals-lab.ts packages/scenarios/src/learning-types.ts packages/scenarios/src/learning-catalog.ts packages/scenarios/src/catalog.ts packages/scenarios/src/index.ts packages/core/test/signals-lab.test.ts packages/core/test/learning-examples.test.ts packages/core/test/scenario-catalog.test.ts docs/scenario-index.md
git commit -m "test(core): prove signals through public scenarios"
```

### Task 9: Align package consumers, Studio declarations, and current contracts

**Files:**

- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/jsx.tsx`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `playground/src/pibbl-editor-types.txt`
- Modify: `tooling/pibbl-studio-runtime-entry.ts`
- Modify: `tooling/verify-studio-types.mjs`
- Create: `docs/design/signals-and-scheduling-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/canvas-surface-contract.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/api-reference.md`
- Modify: `docs/guides/state-lifecycle-and-react-differences.md`
- Modify: `docs/library-status.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: completed public/runtime behavior from Tasks 1-8.
- Produces matching source, built, packed, Bundler, NodeNext, Studio, and documentation surfaces.

- [ ] **Step 1: Add failing type and runtime consumer assertions**

Import all signal types and runtime values from `@pibbl/core`. Prove generic
inference, readonly narrowing, function-valued signals, computed values, and
hook use. Include deliberate failures:

```ts
const x = signal(1);
const readonlyX: Signal<number> = x.asReadonly();

// @ts-expect-error readonly signals do not expose writes
readonlyX.set(2);
// @ts-expect-error Pibbl style accepts resolved numbers, not signal containers
const badStyle: RectStyle = { x, width: 10, height: 10 };
// @ts-expect-error computed values are readonly
computed(() => x.get() * 2).update((value) => value + 1);
```

Update the runtime export inventory for `signal`, `computed`, `untracked`,
`isSignal`, and `useSignal`; verify `@pibbl/core/internal` independently rather
than adding its values to the root inventory.

- [ ] **Step 2: Run package and Studio checks and confirm stale surfaces**

```bash
corepack pnpm@11.21.0 build
corepack pnpm@11.21.0 test:package-consumer
node tooling/verify-studio-types.mjs
```

Expected before declaration/runtime-entry updates: one or more checks FAIL on
the missing signal names or internal entry.

- [ ] **Step 3: Update declarations and Studio runtime entries**

Regenerate/copy built declarations into the existing marked modules in
`playground/src/pibbl-editor-types.txt`, add the five runtime values and four
public types to the exact Studio manifests, and re-export the runtime values
from `tooling/pibbl-studio-runtime-entry.ts`. Keep `@pibbl/core/internal` unavailable
to ordinary Studio examples.

- [ ] **Step 4: Write the normative implemented contracts**

Document the complete signal API and semantics, explicit read examples,
computed graph behavior, render write guard, one realm scheduler, six phases,
root/Layer invalidation rules, scheduler error isolation, friend-entry boundary,
and exact ownership rows. Update the API reference and lifecycle guide with
`useState` versus `useSignal`; update Canvas surface scheduling language from
per-root to realm-wide; update status/evidence in library status and `AGENTS.md`.

Do not mark animation shipped. The design record remains approved, and the
animation half remains pending the second plan.

- [ ] **Step 5: Run documentation, package, and Studio checks**

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

- [ ] **Step 6: Commit the public surface and current contracts**

```bash
git add packages/core/type-tests/final-public-vocabulary.tsx playground/package-consumer/index.ts playground/package-consumer/jsx.tsx playground/package-consumer/runtime.mjs playground/src/pibbl-editor-types.txt tooling/pibbl-studio-runtime-entry.ts tooling/verify-studio-types.mjs docs/design/signals-and-scheduling-contract.md docs/design/runtime-hooks-contract.md docs/design/canvas-surface-contract.md docs/design/runtime-resource-ownership.md docs/api-reference.md docs/guides/state-lifecycle-and-react-differences.md docs/library-status.md AGENTS.md
git commit -m "docs: publish signals and scheduler contracts"
```

### Task 10: Lock lifecycle, structural cost, and foundation trust evidence

**Files:**

- Create: `packages/core/test/signal-scheduler-ownership.test.ts`
- Create: `packages/core/test/signal-scheduler-performance.test.ts`
- Modify: `package.json`
- Modify: `docs/testing/trust-gate.md`
- Create: `docs/testing/field-notes/2026-09-09-signals-and-central-scheduler.md`
- Modify: `docs/superpowers/plans/2026-09-09-first-class-signals-and-central-scheduler-implementation.md`

**Interfaces:**

- Consumes: graph, scheduler, scenarios, package evidence, and repository trust contract.
- Produces exact ownership/cost checks and a completed foundation implementation record.

- [ ] **Step 1: Write failing lifecycle stress evidence**

Repeat mount, shared read, branch change, Layer removal, root replacement,
render failure, abort, disposal, and fresh remount. Use explicit test-only
snapshots to assert:

```ts
expect(signalGraphSnapshot()).toMatchObject({
  rendererConsumers: 0,
  rendererEdges: 0,
  pendingComputedValidations: 0,
});
expect(snapshotRealmScheduler()).toMatchObject({
  pendingHostFrames: 0,
  registeredRoots: 0,
  advanceParticipants: 0,
  completionCallbacks: 0,
});
```

Assert created/released consumer and root-registration totals match exactly.
Retained application signals may remain readable and are not counted as leaked
mount resources.

- [ ] **Step 2: Write failing structural-performance evidence**

For 1,000 signal writes before a frame, prove one host request and one root
traversal. For 100 roots observing one signal, prove one host request, 100
stable ordered root traversals, and one signal commit notification. For a
computed whose output is unchanged, prove one Plan validation and zero renders.
For 100 unchanged Layers, prove only the signal-owning Layer child repaints;
sibling bitmaps are reused. Keep wall-clock timing diagnostic only.

- [ ] **Step 3: Run ownership and structural suites**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/signal-scheduler-performance.test.ts packages/core/test/lifecycle-ownership.test.ts packages/core/test/runtime-cleanup-stress.test.ts packages/core/test/event-performance.test.ts packages/core/test/filter-performance.test.ts --browser.headless --browser.ui=false
```

Expected: all exact ownership and structural assertions PASS.

- [ ] **Step 4: Add focused suites to trust sub-gates**

Append `signal-scheduler-ownership.test.ts` to `test:lifecycle` and
`signal-scheduler-performance.test.ts` to `test:performance`. Update the trust
guide to explain one realm callback, graph-edge counters, Layer repaint counts,
and why no wall-clock threshold or GC oracle is used.

- [ ] **Step 5: Review the complete foundation diff**

```bash
git status --short
git diff --check
git diff --stat 71f9dd6..HEAD
rg -n "requestAnimationFrame" packages/core/src/lib
```

The remaining production `requestAnimationFrame` call must be only the realm
scheduler's host driver. Confirm no public effect/subscription/batch API, no
implicit signal style binding, no automatic cache, and no animation API landed
early.

- [ ] **Step 6: Run the aggregate trust gate**

```bash
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

Expected: Node reports 24.15 or newer, pnpm reports 11.21.0, and the aggregate
gate exits zero.

- [ ] **Step 7: Record fresh evidence and mark this plan implemented**

Write the field note with date, exact environment, aggregate result, focused
graph/scheduler/Layer results, ownership totals, and structural counts. Do not
copy historical test totals. Change this plan's first status banner to:

```text
> **Historical status: IMPLEMENTED PLAN.** The animation engine remains tracked by the dependency-ordered follow-up plan.
```

- [ ] **Step 8: Commit trust evidence and request review**

```bash
git add packages/core/test/signal-scheduler-ownership.test.ts packages/core/test/signal-scheduler-performance.test.ts package.json docs/testing/trust-gate.md docs/testing/field-notes/2026-09-09-signals-and-central-scheduler.md docs/superpowers/plans/2026-09-09-first-class-signals-and-central-scheduler-implementation.md
git commit -m "test: close signals and scheduler evidence"
```

Invoke `superpowers:requesting-code-review` against the implementation range
beginning after design-approval commit `71f9dd6`. Resolve findings with focused
tests and rerun the aggregate gate if production or evidence files change.
