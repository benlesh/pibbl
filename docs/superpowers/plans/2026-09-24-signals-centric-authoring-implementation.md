# Signals-centric CRC Authoring Implementation Plan

> **Historical status: APPROVED DESIGN; IMPLEMENTATION IN PROGRESS.** This dated
> execution record implements the approved Signals-centric authoring design and
> remains subordinate to the current contracts and code once the work ships.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CRC's dual hook state model with one optimized Signals-centric
model and make declared CRC component inputs accept plain values or signals with
receiver-owned dependencies across core and official packages.

**Architecture:** Preserve CRC's immediate-mode renderer and explicit `Layer`
pixel boundaries. First replace allocation-heavy graph collections with reusable
intrusive edges and lazy consumers, then build batching, declared shallow input
resolution, receiver-attributed layout provisions, component-owned computed and
reaction hooks, and the repository-wide breaking migration on that foundation.
JSX remains construction-only; runtime resolution is bounded by primitive or
custom-component schemas and never walks arbitrary application data.

**Tech Stack:** TypeScript 7, pnpm 11.21.0, Node 24.15+ LTS, Vitest browser mode,
Playwright Chromium, Canvas 2D, OffscreenCanvas Layers, WebGL2 official backend,
Markdown Studio documentation, packed Bundler and NodeNext consumers.

**Spec:**
`docs/superpowers/specs/2026-09-23-signals-centric-authoring-design.md`

## Global Constraints

- Use Node 24.15 or newer on the Node 24 LTS line and pnpm 11.21.0.
- Write an observable failing test before every production behavior change and
  read the expected failure before editing production code.
- Preserve immediate-mode full traversal for a dirty ordinary Canvas instance;
  do not add component bitmap caches, inferred Layers, display lists, or a
  retained scene graph.
- Keep JSX and `createElement` construction-only; signal reads belong to the
  receiving component or an explicit receiver-token provision.
- Resolve only declared positions. Never recursively inspect arbitrary rows,
  `custom`, tags, handles, immutable definitions, or application payloads.
- Plain inputs create no wrapper signal, persistent graph allocation,
  receiver provision, or resolved-props/style copy.
- Preserve signal equality, computed barriers, render-write guards, scheduler
  phase ordering, Layer isolation, renderer ownership, and fail-closed cleanup.
- Keep exact `Signal<T>` and `WritableSignal<T>` API positions as signal objects.
- Public behavior must agree across source and built packages, Studio editor
  declarations, Bundler and NodeNext consumers, packed consumers, examples, and
  current documentation.
- Record controlled performance evidence before and after production changes.
  Ordinary non-equal local updates and plain-input rendering may not regress
  more than 5% in repeatable median or p95 measurements; at least two
  equality/batching/computed/reaction workloads must improve by at least 20% in
  median active time or allocation traffic.
- Commit each completed task independently and preserve unrelated user changes.

## Review Focus

1. A whole-style signal whose current style contains direct field signals must
   create one deduplicated receiver generation, not parent edges or duplicate
   notifications; Task 5 adds the runtime and ownership test.
2. A signal hidden in chart rows, `style.custom`, a physics handle, or an exact
   writable-signal prop must remain opaque; Tasks 5 and 9 add negative tests.
3. Layout measurement that resolves a child signal before child evaluation must
   transfer the edge to the child's receiver and roll it back on render failure;
   Task 6 tests Absolute, Flow, Grid, Text measurement, and failure cleanup.
4. A signal-selected callback must update registration without being invoked
   during resolution, while accessor-returned signals are resolved only by APIs
   that explicitly opt in; Tasks 5 and 9 cover both boundaries.
5. Shared fan-out across ordinary siblings and explicit Layers must reuse one
   edge per receiver after warmup and request only the existing affected
   root/Layer paths; Tasks 2, 3, 6, and 12 measure this directly.

---

### Task 1: Freeze Baselines and Expand Structural Diagnostics

**Files:**

- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/signals/render-consumer.ts`
- Modify: `packages/core/test/signal-scheduler-performance.test.ts`
- Modify: `packages/core/test/performance-characterization.test.ts`
- Create:
  `docs/testing/field-notes/2026-09-24-signals-centric-authoring-baseline.md`

**Interfaces:**

- Consumes: existing `signalGraphSnapshot()` and scheduler diagnostics.
- Produces: counters for input resolution, shallow copies, receiver provisions,
  batched invalidations, lazy consumers, and edge reuse; a fixed pre-change
  workload matrix used again in Task 12.

- [ ] **Step 1: Add failing structural diagnostics tests**

  Add literal expectations for the new counter keys before adding them:

  ```ts
  expect(signalGraphSnapshot()).toMatchObject({
    lazyRendererConsumers: 0,
    reusedRendererEdges: 0,
    plainInputResolutions: 0,
    signalInputResolutions: 0,
    shallowInputCopies: 0,
    receiverInputProvisions: 0,
    adoptedReceiverInputProvisions: 0,
    rolledBackReceiverInputProvisions: 0,
    batchedObserverInvalidations: 0,
  });
  ```

- [ ] **Step 2: Run the focused performance tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/test/signal-scheduler-performance.test.ts packages/core/test/performance-characterization.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL because the new snapshot fields are absent.

- [ ] **Step 3: Add zero-cost diagnostic counters and fixed workloads**

  Extend `SignalGraphSnapshot` with numeric fields backed by module counters and
  internal increment functions. Add matched workloads for current `useState`,
  current `useSignal` plus `.get()`, plain props/styles, explicit-get geometry,
  explicit-get text/data, and fan-out sizes 1/10/100/1,000. Diagnostics must be
  direct integers; do not allocate event records in hot paths.

- [ ] **Step 4: Run and record the pre-change baseline**

  Run the focused command from Step 2 with
  `VITE_CRC_REPORT_PERF=1` and record Node, Chromium, viewport, DPR, commit,
  medians, p95 values, allocation counters, and structural counts in the field
  note. The note must say direct signal-valued inputs are not yet supported and
  therefore have no fabricated pre-change timing.

- [ ] **Step 5: Verify and commit**

  Run the focused command without the reporting flag and
  `node tooling/verify-docs-mutations.mjs`.

  Expected: both exit 0.

  Commit: `test: baseline signals-centric performance`

### Task 2: Replace Graph Collections with Reusable Intrusive Edges

**Files:**

- Create: `packages/core/src/lib/signals/edge.ts`
- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/signals/render-consumer.ts`
- Modify: `packages/core/src/lib/signals/graph.test.ts`
- Modify: `packages/core/src/lib/signals/render-consumer.test.ts`
- Modify: `packages/core/test/signal-scheduler-ownership.test.ts`
- Modify: `packages/core/test/signal-scheduler-performance.test.ts`

**Interfaces:**

- Consumes: Task 1 graph counters.
- Produces: `ReactiveEdge`, source-linked observer traversal,
  consumer-generation recollection, computed observation leases, and bounded
  consumer-local edge reuse. Public `Signal` identity and methods do not change.

- [ ] **Step 1: Add failing zero/one/many edge and reuse tests**

  Add tests that mount zero-, one-, and three-source consumers, dynamically drop
  and restore dependencies, and assert literal live/created/reused/released
  counts. Include an observer that throws and prove later observers still run.

- [ ] **Step 2: Run graph and ownership tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/signals/render-consumer.test.ts packages/core/test/signal-scheduler-ownership.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL on reuse and collection-allocation assertions.

- [ ] **Step 3: Implement the intrusive edge primitive**

  Define the private record and list operations:

  ```ts
  export interface ReactiveEdge {
    source: SignalNode<unknown>;
    consumer: SignalDependencyConsumer;
    sourcePrevious?: ReactiveEdge;
    sourceNext?: ReactiveEdge;
    consumerPrevious?: ReactiveEdge;
    consumerNext?: ReactiveEdge;
    collectionGeneration: number;
    observedVersion: number;
    releaseObservation?: () => void;
  }

  export interface SignalDependencyConsumer {
    dependencyHead?: ReactiveEdge;
    collectionGeneration: number;
    addDependency(node: SignalNode<unknown>): void;
  }
  ```

  Add constant-time link/unlink helpers and source observer traversal that stores
  callbacks on consumers rather than in a `Set` per signal.

- [ ] **Step 4: Migrate writable, computed, and render consumers**

  Replace `SignalNode.observers`, computed dependency maps, and render-consumer
  maps/next sets with edge lists and generation marks. Keep dependency-first
  validation, cycle diagnostics, observation-aware computed leases, error
  aggregation, and dynamic release semantics unchanged. Reuse removed edges only
  from the owning consumer's bounded high-water free list.

- [ ] **Step 5: Verify and commit**

  Run the Step 2 command plus
  `packages/core/src/lib/scheduler/realm-scheduler.test.ts`.

  Expected: all focused tests pass and stable recollection increments reuse but
  not created-edge counts.

  Commit: `perf(core): reuse reactive graph edges`

### Task 3: Make Component Render Consumers Lazy

**Files:**

- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/lib/signals/render-consumer.ts`
- Modify: `packages/core/src/lib/signals/render-consumer.test.ts`
- Modify: `packages/core/src/lib/component-dispatch.test.tsx`
- Modify: `packages/core/test/signal-scheduler-ownership.test.ts`
- Modify: `packages/core/test/signal-scheduler-performance.test.ts`

**Interfaces:**

- Consumes: Task 2 `ReactiveEdge` collection.
- Produces: a lightweight render collector that materializes
  `CRCComponentRefs.signalConsumer` on the first actual tracked read and keeps
  zero-read components consumer-free.

- [ ] **Step 1: Add failing lazy-consumer lifecycle tests**

  Render a 1,000-component plain tree and assert zero consumers/edges; rerender
  one component with a read and assert one consumer/edge; rerender it without the
  read and assert release; fail and dispose roots and assert exact zero totals.

- [ ] **Step 2: Run the focused tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/render-consumer.test.ts packages/core/src/lib/component-dispatch.test.tsx packages/core/test/signal-scheduler-ownership.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL because every non-fragment component currently creates a
  consumer eagerly.

- [ ] **Step 3: Add lazy render collection**

  Change render collection to accept refs and create the consumer from the first
  `addDependency` call:

  ```ts
  collectComponentSignalReads(componentRefs, invalidate, (commit) => {
    // component body, declared inputs, and result materialization
    commit();
  });
  ```

  A successful generation with no dependencies releases an older consumer; a
  failed generation publishes neither a new consumer nor new edges.

- [ ] **Step 4: Remove eager mount allocation and preserve invalidation**

  Delete consumer construction from `prepareComponentScope`; keep the exact
  mounted-ref/current-instance checks in the lazily installed invalidator and
  attach disposal to component teardowns only after materialization.

- [ ] **Step 5: Verify and commit**

  Run the Step 2 command plus the signal performance test.

  Expected: all pass; the plain 1,000-component workload owns zero consumers.

  Commit: `perf(core): create render consumers on first read`

### Task 4: Add Public Batching and Automatic Event Dispatch Batches

**Files:**

- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/lib/interaction-dispatch.ts`
- Modify: `packages/core/src/lib/events/dispatch.ts`
- Modify: `packages/core/src/lib/signals/graph.test.ts`
- Modify: `packages/core/src/lib/interaction-dispatch.test.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.test.ts`
- Modify: `packages/core/test/signal-scheduler-performance.test.ts`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: Task 2 source-edge notification and Task 3 renderer invalidation.
- Produces: public `batch<T>(callback: () => T): T` and one automatic outer
  batch around a complete logical CRC event dispatch.

- [ ] **Step 1: Add failing batch semantics tests**

  Cover nested batches, synchronous read-your-writes, one notification per
  consumer, final-value equality collapse, computed reads inside a batch,
  callback throw with flush-before-rethrow, observer aggregation, and one host
  frame for capture/target/bubble writes.

- [ ] **Step 2: Run graph, dispatch, and scheduler tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/signals/graph.test.ts packages/core/src/lib/interaction-dispatch.test.ts packages/core/src/lib/scheduler/realm-scheduler.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL because `batch` is absent and writes notify immediately.

- [ ] **Step 3: Implement nested synchronous batch publication**

  Maintain one module-local outer batch with a source-keyed entry containing its
  entry value and latest value. Writes remain immediately readable. At outer
  exit, compare entry/final values with each source's equality, publish changed
  versions once, notify each affected consumer once, then rethrow callback or
  observer failures in deterministic aggregate order.

- [ ] **Step 4: Batch complete logical event dispatch**

  Wrap the public dispatch boundary—not individual listeners—in `batch(() =>
dispatch...)`. Preserve propagation, cancellation, pointer capture, focus
  defaults, and error cleanup.

- [ ] **Step 5: Export, typecheck, verify, and commit**

  Add the package-consumer assertion:

  ```ts
  const batchedResult: number = batch(() => 42);
  ```

  Run the Step 2 command and `corepack pnpm@11.21.0 typecheck`.

  Expected: all pass.

  Commit: `feat(core): batch signal writes`

### Task 5: Ship the Direct Signal-valued Primitive Input Slice

**Files:**

- Create: `packages/core/src/lib/signals/resolve-signal-value.ts`
- Create: `packages/core/src/lib/element/resolve-primitive-inputs.ts`
- Create: `packages/core/src/lib/element/resolve-primitive-inputs.test.tsx`
- Modify: `packages/core/src/lib/signals/types.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/backend/types.ts`
- Modify: `packages/core/src/lib/define-primitive.ts`
- Modify: `packages/core/src/lib/element/metadata.ts`
- Modify: `packages/core/src/lib/style/resolve-dispatch.ts`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/internal.ts`
- Modify: `packages/core/src/lib/define-primitive.test.tsx`
- Modify: `packages/core/src/lib/style/resolve-dispatch.test.ts`
- Modify: `packages/core/src/lib/components/event-integration.test.ts`
- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: Task 3 active receiver collector.
- Produces: public `SignalValue<T>`, `resolveSignalValue<T>()`, generated
  signal-valued primitive input/style types, bounded runtime schemas, exact
  signal preservation, and the first runnable `<Rectangle style={{ x,
fill }}>` slice.

- [ ] **Step 1: Add failing public type tests**

  Add supported examples for whole styles, direct style fields, program props,
  event handlers, and custom components; add `@ts-expect-error` cases for nested
  padding fields, `style.custom`, and signal-of-signal exact positions:

  ```tsx
  const x = signal(10);
  const fill = signal("red");
  const handler = signal<CRCEventHandler<"click">>(() => {});
  <Rectangle style={{ x, fill, width: 20, height: 20 }} onClick={handler} />;

  function Gauge(props: { value: SignalValue<number> }) {
    return <Text>{resolveSignalValue(props.value)}</Text>;
  }
  ```

- [ ] **Step 2: Run typecheck and confirm RED**

  Run: `corepack pnpm@11.21.0 typecheck`

  Expected: FAIL because the helper/types and signal-valued built-in positions
  do not exist.

- [ ] **Step 3: Add failing runtime ownership and opacity tests**

  Prove direct `x` creates only a Rectangle edge, `x.get()` creates only the
  enclosing-component edge, whole style plus a direct field deduplicates, plain
  props create no copy/provision, a handler is selected but not called during
  resolution, and signals inside data/custom/exact positions stay unread.

- [ ] **Step 4: Run the new runtime test and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/resolve-primitive-inputs.test.tsx --browser.headless --browser.ui=false`

  Expected: FAIL on the first direct signal-valued Rectangle input.

- [ ] **Step 5: Implement public one-level resolution and input types**

  Add:

  ```ts
  export type SignalValue<T> = T | Signal<T>;

  export function resolveSignalValue<T>(value: SignalValue<T>): T {
    return isSignal(value) ? (value.get() as T) : value;
  }

  export type SignalStyle<S> = Readonly<{
    [K in keyof S]: K extends "custom" ? S[K] : SignalValue<S[K]>;
  }>;
  ```

  Update `PrimitiveInput` so `style` is
  `SignalValue<SignalStyle<SpecifiedStyle<S>>>` and direct program props are
  `SignalValue` unless their declared type is already `Signal` or
  `WritableSignal`.

- [ ] **Step 6: Implement bounded primitive schemas and copy-on-signal**

  Extend capabilities with compile-time-checked `preserveSignalProps` and a
  child grammar marker. Resolve whole style, direct non-`custom` style fields,
  and direct non-preserved program props while the receiver collector is active.
  Return the original props/style objects when no actual signal is found; clone
  only on the first resolved signal. Feed ordinary values to style normalization,
  measurement, event wiring, primitive programs, and backend drivers.

- [ ] **Step 7: Verify the public slice and commit**

  Run the runtime test, `packages/core/src/lib/define-primitive.test.tsx`,
  `packages/core/src/lib/style/resolve-dispatch.test.ts`,
  `packages/core/src/lib/components/event-integration.test.ts`, and typecheck.

  Expected: all pass and diagnostics show no plain-input copies.

  Commit: `feat(core): accept signals in declared primitive inputs`

### Task 6: Add Signal-valued Text, Structural Children, and Layout Provisions

**Files:**

- Create: `packages/core/src/lib/signals/input-provision.ts`
- Create: `packages/core/src/lib/signals/input-provision.test.ts`
- Modify: `packages/core/src/lib/element/types.ts`
- Modify: `packages/core/src/lib/types.ts`
- Modify: `packages/core/src/lib/element/children.ts`
- Modify: `packages/core/src/lib/element/children.test.ts`
- Modify: `packages/core/src/lib/element/fragment.ts`
- Modify: `packages/core/src/lib/components/text.ts`
- Modify: `packages/core/src/lib/components/text.test.ts`
- Modify: `packages/core/src/lib/components/text-layout.test.ts`
- Modify: `packages/core/src/lib/layout/measure.ts`
- Modify: `packages/core/src/lib/layout/absolute.ts`
- Modify: `packages/core/src/lib/layout/flow.ts`
- Modify: `packages/core/src/lib/layout/flex.ts`
- Modify: `packages/core/src/lib/layout/grid.ts`
- Modify: `packages/core/src/lib/layout/overlay.ts`
- Modify: `packages/core/src/lib/layout/place-child.ts`
- Modify: `packages/core/src/lib/layout/measure.test.ts`
- Modify: `packages/core/src/lib/layout/layout-jsx.test.tsx`
- Modify: `packages/core/src/lib/render.ts`
- Modify: `packages/core/test/signal-scheduler-ownership.test.ts`

**Interfaces:**

- Consumes: Task 5 primitive schema resolution and existing receiver tokens.
- Produces: `CRCNodeInput`, `CRCTextInput`, signal-aware declared structural
  traversal, keyed-Fragment ownership, and transaction-local receiver provisions
  adopted into the eventual component generation.

- [ ] **Step 1: Add failing child grammar tests**

  Cover `<Text>{label}</Text>`, arrays/iterables containing signals, a signal
  selecting one resolved node structure, keyed and unkeyed Fragments, nested
  signal rejection, cyclic structures, and the unsupported bare signal passed to
  `crc()`.

- [ ] **Step 2: Add failing layout attribution tests**

  For Absolute, Flow, Flex, Grid, Overlay, and intrinsic Text measurement, prove
  a child style signal creates only the child receiver edge. Add a failed-render
  case that leaves no provision or edge and a pure `measureElement` case that
  performs an untracked snapshot with no subscription.

- [ ] **Step 3: Run child and layout tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/element/children.test.ts packages/core/src/lib/components/text.test.ts packages/core/src/lib/layout/measure.test.ts packages/core/src/lib/layout/layout-jsx.test.tsx --browser.headless --browser.ui=false`

  Expected: FAIL on signal children and receiver attribution.

- [ ] **Step 4: Add authoring child types and one-level diagnostics**

  Define the public authoring grammar:

  ```ts
  export type CRCNodeInput =
    SignalValue<CRCNode> | readonly CRCNodeInput[] | Iterable<CRCNodeInput>;
  export type CRCTextInput =
    | SignalValue<CRCTextChild>
    | readonly CRCTextInput[]
    | Iterable<CRCTextInput>;
  export type CRCContainerChild = CRCNodeInput;
  export type CRCRenderResult = CRCNodeInput | void;
  ```

  Resolve signals only at grammar positions and reject a resolved signal,
  signal-containing resolved structure, Promise, async iterable, cycle, or
  foreign element with receiver-specific diagnostics.

- [ ] **Step 5: Implement receiver-token provisions**

  When a mounted layout/measurement prepass encounters a signal outside the
  child collector, collect source nodes into a transaction-local provision keyed
  by `getPrimitiveReceiverToken(element)`. Adopt and deduplicate that provision
  when the receiver collector starts. Discard unclaimed, failed, removed,
  aborted, or disposed provisions. Pure measurement wraps resolution in
  `untracked` and never creates a provision.

- [ ] **Step 6: Move component-result materialization before edge commit**

  Materialize declared result signals while the component collector is active,
  then commit its complete generation. Traverse the materialized child elements
  under `untracked` so child component reads remain isolated.

- [ ] **Step 7: Verify and commit**

  Run the Step 3 command plus Absolute, Flow, Flex, Grid, Overlay, placement,
  signal ownership, and typecheck suites.

  Expected: all pass; provision counters return to zero after every failure and
  disposal case.

  Commit: `feat(core): resolve signal children and layout inputs`

### Task 7: Add `useConst` and Transactional `useComputed`

**Files:**

- Create: `packages/core/src/lib/hooks/use-const.ts`
- Create: `packages/core/src/lib/hooks/use-const.test.tsx`
- Create: `packages/core/src/lib/hooks/use-computed.ts`
- Create: `packages/core/src/lib/hooks/use-computed.test.tsx`
- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: optimized computed graph from Task 2 and render transactions.
- Produces: public `useConst<T>(() => T): T` and stable
  `useComputed<T>(compute, dependencies?, options?): Signal<T>`.

- [ ] **Step 1: Add failing `useConst` behavior tests**

  Prove the factory runs once per mount, ignores later callback identity, remounts
  after removal, has its own hook kind, and does not track a signal read inside
  the factory as a continuing dependency.

- [ ] **Step 2: Add failing `useComputed` contract tests**

  Prove stable signal identity, lazy formula execution, dynamic source edges,
  `Object.is` dependency slots, explicit dependency refresh, custom result
  equality, candidate rollback on failed render, cycle/error recovery, retained
  readonly value after owner teardown, and an equal derived output that prevents
  receiver invalidation.

- [ ] **Step 3: Run hook tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/use-const.test.tsx packages/core/src/lib/hooks/use-computed.test.tsx packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL because both hooks are absent.

- [ ] **Step 4: Implement the hook slots**

  Implement `useConst` as a `const` hook slot. Implement `useComputed` as one
  stable computed node whose committed formula record contains the latest
  successful callback, dependency snapshot, and options. A changed candidate is
  staged on the active render transaction; success publishes and invalidates the
  formula node, failure keeps the previous record. Formula execution uses the
  standalone computed write guard and source collector.

- [ ] **Step 5: Export, typecheck, verify, and commit**

  Run the Step 3 command, graph tests, signal scheduler ownership, and typecheck.

  Expected: all pass.

  Commit: `feat(core): add const and computed hooks`

### Task 8: Add Complete-phase `useReaction`

**Files:**

- Create: `packages/core/src/lib/hooks/use-reaction.ts`
- Create: `packages/core/src/lib/hooks/use-reaction.test.tsx`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.ts`
- Modify: `packages/core/src/lib/scheduler/types.ts`
- Modify: `packages/core/src/lib/scheduler/realm-scheduler.test.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: `packages/core/src/lib/signals/graph.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/type-tests/final-public-vocabulary.tsx`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: Task 2 independent graph consumers and existing scheduler Complete.
- Produces: `CRCReactionOptions` and public `useReaction(setup,
dependencies?, options?)`, with its own consumer and exact cleanup generation.

- [ ] **Step 1: Add failing reaction lifecycle tests**

  Cover mount-after-success timing, no setup after failed render, tracked dynamic
  signals, explicit non-signal dependencies, latest callback adoption, cleanup
  before replacement, final cleanup, setup/cleanup errors, removal/abort/dispose,
  forbidden setup/cleanup writes, and reaction-only frames with zero Canvas
  traversal.

- [ ] **Step 2: Run hook and scheduler tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/use-reaction.test.tsx packages/core/src/lib/scheduler/realm-scheduler.test.ts --browser.headless --browser.ui=false`

  Expected: FAIL because `useReaction` and reaction scheduler work are absent.

- [ ] **Step 3: Implement the reaction consumer and scheduler queue**

  Give each hook slot one independent signal consumer, pending generation,
  latest successful setup callback, explicit dependency snapshot, and cleanup.
  Signal invalidation requests Plan/Complete work without dirtying a renderer.
  Complete clears old cleanup ownership before invoking cleanup, evaluates setup
  under the reaction collector and write guard, then owns the returned cleanup.

- [ ] **Step 4: Make render adoption transactional**

  Register the new callback/dependency candidate on the current render
  transaction. Only success makes it eligible for Complete; failure leaves the
  previous successful generation intact until fail-closed teardown releases it.
  Deduplicate repeated invalidations and defer Complete-produced work to a later
  frame.

- [ ] **Step 5: Export, typecheck, verify, and commit**

  Run the Step 2 command, signal graph tests, runtime cleanup stress, and
  typecheck.

  Expected: all pass and reaction-only updates report zero renderer traversal.

  Commit: `feat(core): add signal-driven reactions`

### Task 9: Apply Signal Inputs to Animation and Official Package Components

**Files:**

- Modify: `packages/core/src/lib/hooks/use-playback.ts`
- Modify: `packages/core/src/lib/hooks/use-playback.test.tsx`
- Modify: `packages/core/src/lib/hooks/use-transition.ts`
- Modify: `packages/core/src/lib/hooks/use-transition.test.tsx`
- Modify: `packages/webgl/src/lib/components/*.ts`
- Modify: `packages/webgl/src/lib/components/*.test.tsx`
- Modify: `packages/webgl/src/lib/hooks/use-orbit-camera.ts`
- Modify: `packages/webgl/src/lib/hooks/use-orbit-camera.test.tsx`
- Modify: `packages/particles/src/lib/canvas/component.ts`
- Modify: `packages/particles/src/lib/webgl/component.ts`
- Modify: `packages/particles/src/lib/system/hook.ts`
- Modify: `packages/particles/src/lib/**/*.test.tsx`
- Modify: `packages/physics/src/lib/2d/runtime/world-component.ts`
- Modify: `packages/physics/src/lib/3d/runtime/world-component.ts`
- Modify: `packages/physics/src/lib/3d/webgl/components.ts`
- Modify: `packages/physics/src/lib/**/*test.tsx`
- Modify: `packages/core/src/internal.ts`
- Modify: `playground/package-consumer/index.ts`

**Interfaces:**

- Consumes: Tasks 5-6 declared input schemas/helper and Task 7 computed hook.
- Produces: the shared core contract across official Canvas/WebGL/particles/
  physics component inputs, signal-valued playback/transition candidates, and a
  package-consumer visualization fixture demonstrating `data={dataSignal}` and
  `domain={domainSignal}` without package-specific resolution.

- [ ] **Step 1: Add failing animation input tests**

  Pass signal-valued playback programs/options and transition targets/options;
  prove direct option fields resolve only where documented, candidates commit
  transactionally, writer target signals stay exact objects, and failed renders
  do not retarget controllers.

- [ ] **Step 2: Add failing official-package type/runtime tests**

  Exercise WebGL camera/geometry/material/light/background inputs, particle
  effect inputs, physics gravity/enabled/configuration inputs, and exact physics
  body/world handles. Include opaque rows/descriptors containing signals and
  prove they create no hidden edges.

- [ ] **Step 3: Run focused package tests and confirm RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/hooks/use-playback.test.tsx packages/core/src/lib/hooks/use-transition.test.tsx packages/webgl/src/lib/components packages/particles/src/lib packages/physics/src/lib/2d/runtime packages/physics/src/lib/3d/runtime --browser.headless --browser.ui=false`

  Expected: FAIL on signal-valued candidates that are not yet accepted.

- [ ] **Step 4: Resolve render-time candidates with the shared helper**

  Update hook signatures to use `SignalValue` at declared candidate positions,
  resolve before normalization, and keep exact writer signals/handles untouched.
  Let `defineBackendPrimitive` carry the Task 5 schemas automatically; use
  `resolveSignalValue` explicitly in official function components and hooks.

- [ ] **Step 5: Add the visualization contract fixture**

  In the package consumer, define a representative custom `LineSeries` and
  `Axis` using only core's public type/helper:

  ```tsx
  function LineSeries(props: { data: SignalValue<readonly Datum[]> }) {
    const rows = resolveSignalValue(props.data);
    return <Path style={{ d: buildPath(rows) }} />;
  }
  function Axis(props: { domain: SignalValue<readonly [number, number]> }) {
    const domain = resolveSignalValue(props.domain);
    return <Text>{`${domain[0]}–${domain[1]}`}</Text>;
  }
  ```

  Assert rows remain opaque and a computed domain equality barrier prevents the
  Axis receiver from invalidating. This is the seam an eventual `@crc/viz`
  package consumes; do not create a package that is absent from this repository.

- [ ] **Step 6: Verify and commit**

  Run the Step 3 command, WebGL/particle/physics ownership suites, package
  consumer source typecheck, and root typecheck.

  Expected: all pass.

  Commit: `feat: share signal inputs across official packages`

### Task 10: Migrate Production Internals off Removed Hooks

**Files:**

- Modify: `packages/core/src/lib/components/img.ts`
- Modify: `packages/core/src/lib/components/img-async.test.ts`
- Modify: `packages/particles/src/lib/canvas/primitive.ts`
- Modify: `packages/particles/src/lib/canvas/component.test.tsx`
- Modify: `packages/physics/src/lib/3d/webgl/components.ts`
- Modify: `packages/physics/src/lib/3d/webgl/components.test.tsx`
- Modify: `packages/core/src/lib/hooks/use-line-path.ts`
- Modify: `packages/core/src/lib/hooks/use-rect-path.ts`
- Modify: `packages/core/src/lib/hooks/use-svg-path.ts`
- Modify: `packages/core/src/lib/hooks/use-path-hooks.test.ts`

**Interfaces:**

- Consumes: `useSignal`, `useConst`, `useComputed`, and `useReaction`.
- Produces: no production dependency on public `useMemo` or `useWhenChanged`;
  specialized path hooks retain direct `Path2D` return types through private
  cache slots.

- [ ] **Step 1: Add failing transactional image and cache tests**

  Prove Image listener setup happens after successful render, source changes
  clean exactly once, stale load callbacks cannot update a removed owner, and
  failed renders expose no listener. Prove particle/physics/path caches preserve
  identity and recompute only for changed ordinary inputs.

- [ ] **Step 2: Run focused tests and confirm the new expectations RED**

  Run:
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/components/img-async.test.ts packages/core/src/lib/hooks/use-path-hooks.test.ts packages/particles/src/lib/canvas/component.test.tsx packages/physics/src/lib/3d/webgl/components.test.tsx --browser.headless --browser.ui=false`

  Expected: Image setup timing fails under synchronous `useWhenChanged`.

- [ ] **Step 3: Migrate ownership and private caches**

  Use `useReaction` for Image source/listener ownership and `useSignal` for its
  loaded state. Use `useComputed` where a graph barrier benefits downstream
  inputs. Where a specialized hook must return a direct `Path2D` or immutable
  shape, keep a private `useValueMemoSlot` in the hook implementation instead of
  re-exporting a second public derivation model.

- [ ] **Step 4: Verify no production imports remain and commit**

  Run the Step 2 command, runtime cleanup stress, lifecycle ownership, and:

  `rg -n "useMemo|useWhenChanged|useState" packages/core/src packages/webgl/src packages/particles/src packages/physics/src --glob '!**/*.test.*'`

  Expected: the search finds only the old hook implementation files awaiting
  deletion in Task 11, not production consumers.

  Commit: `refactor: migrate runtime ownership to signals`

### Task 11: Complete the Breaking Public Migration

**Files:**

- Delete: `packages/core/src/lib/hooks/use-state.ts`
- Delete: `packages/core/src/lib/hooks/use-state.test.ts`
- Delete: `packages/core/src/lib/hooks/use-memo.ts`
- Delete: `packages/core/src/lib/hooks/use-when-changed.ts`
- Delete: `packages/core/src/lib/hooks/use-when-changed.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/lib/hooks/hook-contract.test.ts`
- Modify: all current tests returned by
  `rg -l "useState|useMemo|useWhenChanged|StateUpdater" packages --glob '!**/dist/**'`
- Modify: all active examples returned by the same search under
  `packages/scenarios/src`
- Modify: `packages/scenarios/src/catalog.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/core/README.md`
- Modify: `playground/src/crc-editor-types.txt`
- Modify: `playground/package-consumer/index.ts`
- Modify: `playground/package-consumer/runtime.mjs`
- Modify: `tooling/verify-studio-types.mjs`
- Modify: `tooling/learning-source-contract.ts`

**Interfaces:**

- Consumes: all new APIs and migrated internals from Tasks 4-10.
- Produces: one public hook vocabulary with no compatibility alias or alternate
  import path for `useState`, `StateUpdater`, `useMemo`, or `useWhenChanged`.

- [ ] **Step 1: Add failing public-vocabulary probes**

  Update source/built/packed/Studio type fixtures to import the new APIs and to
  compile isolated negative probes showing removed named imports fail. Runtime
  export enumeration must include `batch`, `resolveSignalValue`, `useConst`,
  `useComputed`, and `useReaction`, and exclude all four removed names.

- [ ] **Step 2: Run type and runtime contract checks and confirm RED**

  Run root typecheck and
  `corepack pnpm@11.21.0 exec vitest run packages/core/src/lib/runtime-contract.test.ts packages/core/src/lib/hooks/hook-contract.test.ts --browser.headless --browser.ui=false`.

  Expected: FAIL while old exports remain and active consumers use old names.

- [ ] **Step 3: Migrate tests and examples mechanically by semantic category**

  Replace mutable state tuples with signals (`get`, `set`, `update`), mount-only
  identities with `useConst`, reactive derivation with `useComputed`, specialized
  direct caches with their existing path hooks/private cache, and lifecycle work
  with `useReaction`. Pass signals directly to declared child inputs when the
  child should own the dependency; retain `.get()` for branching, arithmetic,
  coordinated parent reads, and exact signal-object APIs.

- [ ] **Step 4: Remove old files and exports**

  Delete the implementations/tests listed above, remove root exports and
  `StateUpdater`, update Studio declarations and package consumers, and add no
  deprecated wrappers or compatibility subpaths.

- [ ] **Step 5: Run the active-vocabulary sweep and focused suites**

  Run:
  `rg -n "useState|StateUpdater|useMemo|useWhenChanged" packages playground docs/site tooling --glob '!**/dist/**'`

  Expected: only historical/work-record fixtures and tooling baselines that
  deliberately preserve historical text remain; all active code is migrated.

  Run hook, component, layout, focus, event, Layer, WebGL, particle, physics,
  learning-example, tutorial-snapshot, package-consumer, and typecheck suites.

  Expected: all pass.

- [ ] **Step 6: Commit**

  Commit: `feat!: adopt signals-centric CRC hooks`

### Task 12: Rewrite Public Documentation and Add Observable Examples

**Files:**

- Create: `docs/site/api/functions/batch.md`
- Create: `docs/site/api/functions/resolve-signal-value.md`
- Create: `docs/site/api/hooks/use-const.md`
- Create: `docs/site/api/hooks/use-computed.md`
- Create: `docs/site/api/hooks/use-reaction.md`
- Create: `docs/site/api/types/signal-inputs.md`
- Create: `docs/migrations/signals-centric-hooks.md`
- Delete: `docs/site/api/hooks/use-state.md`
- Delete: `docs/site/api/hooks/use-memo.md`
- Delete: `docs/site/api/hooks/use-when-changed.md`
- Modify: `docs/design/signals-and-scheduling-contract.md`
- Modify: `docs/design/runtime-hooks-contract.md`
- Modify: `docs/design/style-system-contract.md`
- Modify: `docs/design/layout-system-contract.md`
- Modify: `docs/design/drawing-components-contract.md`
- Modify: `docs/design/runtime-resource-ownership.md`
- Modify: `docs/site/learn/guides/state-and-lifecycle.md`
- Modify: `docs/site/learn/guides/signals-and-animation.md`
- Modify: `docs/site/learn/guides/components-props-and-children.md`
- Modify: `docs/site/learn/guides/custom-components-and-primitives.md`
- Modify: `docs/site/learn/guides/author-without-jsx.md`
- Modify: `docs/site/learn/guides/style-and-draw.md`
- Modify: `docs/site/learn/guides/compose-and-layout.md`
- Modify: `docs/site/learn/guides/webgl-islands.md`
- Modify: `docs/site/learn/guides/physics-3d.md`
- Modify: active diagram-editor tutorial pages containing removed vocabulary
- Modify: `packages/scenarios/src/learning/start/signals.example.tsx`
- Create:
  `packages/scenarios/src/learning/composition/signal-inputs.example.tsx`
- Modify: `packages/scenarios/src/signals-lab.example.tsx`
- Modify: `packages/scenarios/src/signals-lab.ts`
- Modify: Studio documentation/search checks under `tooling/studio-docs/`

**Interfaces:**

- Consumes: final public surface from Task 11.
- Produces: searchable public guidance, migration instructions, one visual
  learning example, and one deterministic laboratory driven through supported
  public APIs.

- [ ] **Step 1: Add failing documentation and scenario contract expectations**

  Update documentation metadata tests to require pages for the five new values,
  signal-input types, and migration guide; update learning catalog tests to
  require a `signal-inputs` example and lab counters for writes, resolutions,
  receiver IDs, provisions/adoptions, shallow copies, computed validations,
  reactions, traversals, Layer repaints, and composites.

- [ ] **Step 2: Run docs/scenario checks and confirm RED**

  Run:
  `corepack pnpm@11.21.0 scenarios:check`

  Run: `node tooling/verify-docs-mutations.mjs`

  Expected: FAIL on missing pages/example/catalog entries.

- [ ] **Step 3: Write current contracts and migration guidance**

  Document receiver-owned direct inputs versus parent-owned `.get()`, whole
  styles, direct fields, text/children, handlers/accessors, arrays/descriptors,
  exact signal-object props, pure measurement, equality/batching/computed
  barriers, reaction cleanup, Layers, and the absence of deep unwrapping or
  automatic bitmap caching. The migration guide includes literal before/after
  patterns for all four removed exports.

- [ ] **Step 4: Add the learning example and deterministic lab**

  The example passes signals directly to Rectangle geometry/fill, Text, and a
  representative data/domain custom component; batches an event update; uses a
  computed barrier; and runs a reaction that updates an external test resource
  without repaint. The lab exposes semantic counters in stable text so headless
  tests can assert behavior before visual evidence.

- [ ] **Step 5: Verify and commit**

  Run scenarios, docs mutation checks, Studio docs checks, learning examples,
  tutorial snapshots, and Studio type verification.

  Expected: all pass with no current page teaching removed APIs.

  Commit: `docs: teach signals-centric CRC authoring`

### Task 13: Performance Characterization, Aggregate Verification, and Review

**Files:**

- Modify: `packages/core/test/signal-scheduler-performance.test.ts`
- Modify: `packages/core/test/performance-characterization.test.ts`
- Modify: `packages/core/test/signals-lab.test.ts`
- Modify:
  `docs/testing/field-notes/2026-09-24-signals-centric-authoring-baseline.md`
- Create:
  `docs/testing/field-notes/2026-09-24-signals-centric-authoring-verification.md`
- Modify: any production/test files required by Important final-review findings,
  only after a reproducing test is observed RED.

**Interfaces:**

- Consumes: completed Tasks 1-12 and their structural counters.
- Produces: matched before/after evidence, full repository trust-gate evidence,
  a fresh whole-branch review package, and a clean implementation branch.

- [ ] **Step 1: Add the post-change performance forms and structural assertions**

  Extend Task 1's fixed harness with direct signal-valued props, whole styles,
  style/layout fields, Text, data/domain, reaction-only work, computed-equal
  barriers, and fan-out across roots/Layers. Assert literal work elimination,
  zero plain persistent allocation, warmed edge reuse, and no OffscreenCanvas,
  pixel readback, or bitmap transfer caused by graph operations.

- [ ] **Step 2: Run controlled performance evidence**

  Run three isolated processes with the exact environment recorded in the field
  note. Compare median and p95 values to Task 1. Stop and return to the owning
  task if local updates or plain inputs regress more than 5%, receiver-owned
  signal inputs exceed explicit `.get()` active time by more than 5%, fan-out is
  superlinear, or fewer than two optimized workloads improve by 20%.

- [ ] **Step 3: Run focused ownership and packaging gates**

  Run `corepack pnpm@11.21.0 test:lifecycle`,
  `corepack pnpm@11.21.0 test:performance`, source/built Studio builds, packed
  Bundler/NodeNext consumers, and browser smoke.

  Expected: all exit 0.

- [ ] **Step 4: Run the aggregate trust gate**

  Run: `corepack pnpm@11.21.0 trust`

  Expected: exit 0 on Node 24.15+ with the provisioned Playwright Chromium.

- [ ] **Step 5: Create and inspect the whole-branch review package**

  Generate the executing-plans review package from the implementation merge base
  through HEAD. Dispatch one fresh reviewer using
  `superpowers:requesting-code-review`, supplying this plan, the approved spec,
  the Review Focus section, and all ledger rulings. Re-grade findings by user
  effect.

- [ ] **Step 6: Fix Critical/Important findings in one TDD pass**

  For each accepted finding, add the smallest public or ownership test, observe
  RED, implement the fix, observe GREEN, then rerun the complete affected suite
  and aggregate gate. Ledger declined findings as rulings and Minor findings as
  deferred; do not perform a second review round.

- [ ] **Step 7: Record final evidence and commit**

  Record exact commands, environment, pass counts, performance deltas, ownership
  totals, review findings, fixes, rulings, and deferred minors in the verification
  field note.

  Commit: `test: verify signals-centric CRC authoring`

## Plan Self-review Record

- **Spec coverage:** Tasks 2-4 cover graph/equality/batching; Tasks 5-6 cover
  shared input types, built-ins, styles, text, children, layout, custom helpers,
  opacity, failure, and ownership; Tasks 7-8 cover the hook model; Task 9 covers
  animation and official-package seams including the visualization contract;
  Tasks 10-12 cover internals, breaking migration, examples, declarations, and
  documentation; Task 13 covers performance and final verification.
- **Placeholder scan:** The plan contains no unresolved implementation markers.
  Every task names exact files or an exact search-derived migration set, a RED
  command, implementation interfaces, a GREEN command, and a commit.
- **Type consistency:** `SignalValue`, `SignalStyle`, `CRCNodeInput`,
  `CRCTextInput`, `resolveSignalValue`, `batch`, `useConst`, `useComputed`, and
  `useReaction` are introduced once and consumed under the same names later.
- **Review Focus coverage:** whole-style deduplication is Task 5; opaque/exact
  values are Tasks 5 and 9; layout provision rollback is Task 6; callbacks and
  accessors are Tasks 5 and 9; fan-out and Layer ownership are Tasks 2, 3, 6,
  and 13.
