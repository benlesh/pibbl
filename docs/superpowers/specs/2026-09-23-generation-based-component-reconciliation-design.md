# Generation-based component reconciliation design

> **Historical status: APPROVED DESIGN RECORD.** This document records the
> approved optimization design; current shipped behavior remains governed by
> `docs/design/` and executable tests until implementation lands.

Status: design and written specification approved in conversation on
2026-09-23.

Date: 2026-09-23

## Summary

Pibbl will replace its per-render copy-and-delete component reconciliation with
an instance-owned generation check. Every `PibblInstance` will increment one
monotonic reconciliation generation when a render begins. Every visited
`PibblComponentRefs` will record that generation. After successful traversal,
Pibbl will scan the instance's retained refs once and tear down only entries that
were not visited in the current generation.

The change preserves Pibbl's public API, component identity, hook lifetime,
signal-consumer ownership, removal timing, failure cleanup, nested Layer
isolation, backend behavior, and complete immediate-mode traversal. It removes
one full-size `Set` allocation, one insertion per previously retained
component, and one deletion per live component from every render.

The same slice will exclude `.worktrees/**` from Vitest discovery. Nested
worktrees currently make explicit test-file invocations discover stale copies
of those files, mix incompatible source revisions through root aliases, and
contaminate controlled performance runs.

## Intent and success criteria

This is the first vertical slice of the framework-wide performance and
ownership audit. The audit treats public APIs and observable contracts as hard
constraints by default. A later slice may put a contract change on the table
only when an internal design cannot meet the need or measured evidence shows a
substantial advantage worth explicit review.

This slice succeeds when:

- successful renders no longer clone the complete `PibblInstance.refs` keyset;
- live components perform no stale-set deletion during traversal;
- one instance-owned generation distinguishes live from removed refs;
- duplicate-key and same-type sibling identity remain unchanged;
- removed refs execute teardown exactly once and are deleted after successful
  traversal;
- a failed render retains the current all-ref cleanup behavior;
- nested instances do not share reconciliation generations or scratch sets;
- pure measurement does not observe or mutate reconciliation state;
- identity scratch sets are reused across successful renders and cleared after
  use;
- focused correctness, lifecycle, scheduler, Layer, and backend tests pass;
- controlled performance runs execute only the current checkout; and
- the existing sparse-1,000 rerender reference workload shows a material
  improvement, with the existing 5 ms median and 8 ms p95 guard remaining the
  acceptance target rather than being relaxed.

## Current cost

`executeRender()` currently copies every retained component ID before every
component traversal:

```ts
GLOBAL_STATE.unseenIds = new Set(GLOBAL_STATE.currentPibblInstance.refs.keys());
GLOBAL_STATE.seenIds = new Set();
GLOBAL_STATE.seenKeys = new Set();
```

Every visited component then drains its ID from that copy:

```ts
GLOBAL_STATE.unseenIds!.delete(id);
GLOBAL_STATE.seenIds!.add(id);
```

After traversal, the remaining copied IDs identify removals:

```ts
for (const id of GLOBAL_STATE.unseenIds) {
  GLOBAL_STATE.currentPibblInstance.refs.get(id)?.teardowns.execute();
  GLOBAL_STATE.currentPibblInstance.refs.delete(id);
}
```

For an unchanged `n`-component render, this performs `n` copied-key insertions,
`n` successful stale-set deletions, allocates fresh backing storage for three
sets, and later makes that storage garbage-collection work. The final stale
component decision needs one linear pass, but the copy and per-live-component
deletion do not carry unique semantic information.

A clean Chromium diagnostic run on 2026-09-23 measured the existing
sparse-1,000 rerender workload at roughly 9.8 ms median. Three subsequent
controlled guard runs each failed the existing 5 ms median budget, reporting
9.5-9.7 ms. These measurements establish a current regression signal; they do
not claim that reconciliation is the only cost in the complete primitive
render.

## Constraints

- Preserve the recursive `PibblNode` and branded `PibblElement` protocols.
- Preserve parent-path, component-function, key, and occurrence identity.
- Preserve the rule that removal teardown occurs only after a successful
  traversal; failed traversal tears down every ref owned by that instance.
- Preserve complete immediate-mode component traversal for an invalidated
  instance. This slice does not add component memoization or a retained scene
  graph.
- Preserve exact component hook order, signal dependency replacement, backend
  component entry/exit, enhancer cleanup, event/focus ownership, and Layer
  composition.
- Do not add public API, public types, compatibility aliases, dependencies, or
  runtime feature detection.
- Do not weaken or rewrite the existing performance budgets.
- Preserve unrelated working-tree changes and untracked files.

## Selected design

### Instance-owned state

`PibblInstance` gains three internal fields:

```ts
renderGeneration: number;
renderSeenIds: Set<string>;
renderSeenKeys: Set<string>;
```

Mount initializes the generation to zero and constructs each scratch set once.
Each instance, including a managed Layer or official backend child, owns its
own fields. A parent and child therefore cannot clear or advance each other's
reconciliation state during nested synchronous rendering.

`PibblComponentRefs` gains one internal field:

```ts
renderGeneration: number;
```

This number is the most recent generation in which that exact ref was visited.
It has no public meaning and is not exposed from `@pibbl/core`.

The generation uses ordinary monotonic JavaScript number addition. Reaching
`Number.MAX_SAFE_INTEGER` would require millions of years of uninterrupted
60-Hz rendering. Wraparound machinery would add hot-path branches for no
credible runtime lifetime and is deliberately omitted.

### Render start

After a backend frame begins and before component traversal, `executeRender()`
increments the active instance's generation, clears its reusable identity
sets, and installs those sets into the existing render-global identity slots:

```ts
const renderGeneration = ++pibblInstance.renderGeneration;
const seenIds = pibblInstance.renderSeenIds;
const seenKeys = pibblInstance.renderSeenKeys;

seenIds.clear();
seenKeys.clear();

GLOBAL_STATE.seenIds = seenIds;
GLOBAL_STATE.seenKeys = seenKeys;
seenIds.add("root");
```

`seenIds` continues to detect and suffix colliding unkeyed component IDs.
`seenKeys` continues to reject duplicate explicit keys under one parent. The
identity algorithm and resulting ID strings do not change.

`GLOBAL_STATE.unseenIds` is removed. It no longer represents any runtime
state, and measurement isolation no longer needs to snapshot or clear it.

### Component visit

`prepareComponentScope()` continues to calculate the same type name and unique
ID. It looks up that ID once, creates a ref only on mount, then updates the
shared live fields after the branch:

```ts
const instance = GLOBAL_STATE.currentPibblInstance!;
let componentRefs = instance.refs.get(id) as PibblComponentRefs<P> | undefined;

GLOBAL_STATE.componentIsMounting = componentRefs === undefined;

if (componentRefs === undefined) {
  componentRefs = {
    id,
    parent,
    element,
    refs: [],
    hooks: [],
    signalConsumer: undefined,
    teardowns,
    onAfterRender: undefined,
    renderGeneration: instance.renderGeneration,
  };

  // Existing signal-consumer construction and teardown remain unchanged.
  instance.refs.set(id, componentRefs);
}

componentRefs.parent = parent;
componentRefs.element = element;
componentRefs.renderGeneration = instance.renderGeneration;
return componentRefs;
```

The implementation will preserve the existing signal-consumer construction
inside the mount branch rather than factor it into a new single-use helper.
The former `unseenIds.delete(id)` operation disappears. `seenIds.add(id)`
remains because later sibling identity depends on it during the same traversal.

### Successful removal reconciliation

After component traversal succeeds, `executeRender()` scans the retained map
once:

```ts
for (const [id, componentRefs] of pibblInstance.refs) {
  if (componentRefs.renderGeneration === renderGeneration) continue;
  componentRefs.teardowns.execute();
  pibblInstance.refs.delete(id);
}
```

Deleting the current entry during JavaScript `Map` iteration is defined and
does not skip later entries. `Teardowns.execute()` is idempotent and contains
individual teardown failures, so one removed component cannot prevent later
stale refs from being released.

Newly mounted refs are marked with the current generation before insertion.
Existing refs are marked before their component program runs. If a later part
of traversal fails, the instance follows the failure path below and does not
attempt partial stale reconciliation.

### Failure behavior

The existing catch path remains authoritative:

```ts
for (const refs of pibblInstance.refs.values()) {
  refs.teardowns.execute();
}
pibblInstance.refs.clear();
```

Generation writes made before a failure require no rollback because every ref
is released and removed. Backend `finishFrame(frame, false)`, render transaction
failure, global-state restoration, and later fresh remount behavior remain
unchanged.

### Scratch release and nested renders

The active instance's `renderSeenIds` and `renderSeenKeys` sets are cleared in
the outer `finally` path after traversal cleanup and before the render returns.
The existing saved global values are then restored. A nested instance installs
and clears only its own sets; restoration resumes the outer instance's still
active sets.

Clearing after use avoids retaining dynamic ID strings while allowing the
engine to reuse set backing capacity. Ref IDs that remain live are already
retained by the refs map.

Same-instance reentrant rendering is not a supported public operation:
`executeRender()` is internal, signal writes are forbidden during traversal,
and official nested backends own distinct instances. This design does not add
cost to support an unavailable reentrant entry.

### Pure measurement

`measureElement()` does not mount components or participate in identity
reconciliation. Its isolated global-state snapshot continues to protect the
active render's `seenIds` and `seenKeys`; the removed `unseenIds` field simply
disappears from that snapshot. Measurement cannot increment an instance
generation because no current instance is installed inside the isolated
scope.

## Test discovery isolation

Vitest's root configuration adds `.worktrees/**` to its exclude list:

```ts
exclude: [
  ...configDefaults.exclude,
  '.pnpm-store/**',
  '.superpowers/**',
  '.worktrees/**',
],
```

The repository currently contains nested worktrees with historical copies of
the same test paths. Without this exclusion, an explicit focused invocation can
run those copies, resolve their package imports through the current checkout's
root aliases, fail on incompatible exports, and add concurrent browser work to
timing samples. Worktree isolation changes test discovery only; it does not
change package or runtime behavior.

## Alternatives considered

### Selected: generation mark plus one retained-map scan

This retains the smallest state needed to distinguish visited and removed
components. It removes the copy and per-live deletion while preserving simple,
deterministic cleanup after successful traversal.

### Rejected: pool the existing `unseenIds` set

Reusing one set would avoid repeated backing-store allocation but still insert
every retained ID before traversal and delete every live ID during traversal.
It preserves the largest avoidable portion of the current work.

### Rejected: delete removed subtrees during traversal

An intrusive retained child tree could identify some removals without a final
map scan. It would introduce a second tree structure, require transactional
sibling and parent bookkeeping, complicate reparenting and failure cleanup,
and retain more memory. Pibbl's current flat identity map needs only one numeric
comparison per entry.

### Rejected: weak or finalization-based ownership

Garbage collection cannot provide deterministic hook, listener, signal,
backend, and Layer teardown timing. Pibbl's explicit ownership model remains the
correct contract.

### Deferred: replace `seenIds` with per-parent occurrence tables

An occurrence table might reduce full-ID set membership checks and string work,
but it changes the most delicate part of component identity. It will be audited
separately with its own before/after evidence after this reconciliation cost is
isolated.

## Verification design

### Focused red evidence

A focused runtime test will instrument the mounted instance's refs map and
prove that an unchanged rerender does not call `refs.keys()` to construct a
full key snapshot. It will also observe one retained-map iteration for stale
reconciliation, stable ref identity, and reuse of the same instance-owned
scratch-set objects.

The test fails against the current implementation because
`new Set(instance.refs.keys())` invokes the instrumented `keys()` method.

### Correctness and ownership matrix

Focused tests will cover:

- unchanged rerender preserves component refs, hook state, and signal
  consumers;
- removing one keyed component tears it down and deletes it exactly once;
- removing a parent releases its complete descendant ownership;
- re-adding a removed key mounts fresh state;
- replacing the root reconciles the old tree after the new traversal succeeds;
- duplicate keys still fail with the existing diagnostic;
- same-type unkeyed siblings keep occurrence-order identity;
- a component or primitive failure clears every ref and permits a fresh render;
- a nested Layer uses a distinct generation and scratch-set pair; and
- pure measurement leaves an active render's reconciliation state unchanged.

Existing lifecycle and scheduler suites remain required evidence. No visual
baseline change is expected.

### Performance evidence

After focused correctness passes:

1. Run the sparse-1,000 rerender diagnostic with timing reporting and nested
   worktrees excluded by configuration.
2. Record before/after median and p95 values from the same Chromium workload.
3. Run the controlled reference guard three consecutive times, as required by
   `docs/testing/trust-gate.md`.
4. Do not alter a budget to make a result pass.

If the rerender remains above budget, retain this optimization only when the
structural proof and repeatable timing show a material improvement. Profile the
remaining traversal before selecting the next optimization; do not attribute
all primitive-render cost to reconciliation.

### Proportional final checks

The slice's final checks are:

- focused reconciliation/runtime contract tests;
- focused Layer, backend-dispatch, hook, signal-consumer, and failure-cleanup
  tests affected by the changed state;
- `packages/core/test/runtime-cleanup-stress.test.ts`;
- `packages/core/test/signal-scheduler-performance.test.ts`;
- `packages/core/test/event-performance.test.ts` in ordinary structural mode;
- TypeScript typechecking and changed-file lint/format checks; and
- the three controlled reference runs described above.

The repository-wide aggregate trust gate remains feature-completion evidence,
not a prerequisite for presenting this first optimization slice for hands-on
review.

## Expected file scope

- `vitest.config.ts`: exclude nested worktrees.
- `packages/core/src/lib/types.ts`: add instance and ref reconciliation state.
- `packages/core/src/lib/mount-pibbl.ts`: initialize instance-owned state.
- `packages/core/src/lib/global-state.ts`: remove `unseenIds`.
- `packages/core/src/lib/execute-render.ts`: install scratch state, increment the
  generation, and reconcile stale refs.
- `packages/core/src/lib/render.ts`: mark visited refs by generation.
- `packages/core/src/lib/layout/measure.ts`: remove obsolete `unseenIds`
  isolation.
- Focused core tests: establish structure, identity, teardown, nesting,
  failure, and measurement behavior.

No public export, declaration, package manifest, Studio declaration, scenario,
guide, or normative behavior contract should change in this slice.
