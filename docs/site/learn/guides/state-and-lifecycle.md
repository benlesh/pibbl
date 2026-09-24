---
id: guide-state-lifecycle
title: Manage state and lifecycle
summary: Use signals, computed barriers, reactions, stable values, hook identity, and exact cleanup.
kind: guide
slug: state-and-lifecycle
order: 60
keywords: [signals, state, lifecycle, reaction, cleanup, identity, hooks]
---

# Manage state and lifecycle

CRC uses one Signals-centric state model. Component-owned writable state is a
`useSignal()` cell, derived state is a `computed()` or `useComputed()` signal,
and imperative synchronization belongs in `useReaction()`. CRC remains an
immediate Canvas runtime rather than a React renderer.

## The render cycle

`crc(canvas, root, config?)` creates at most one live mount for a Canvas and
returns a stable controller. A later `crc()` call on that Canvas queues a root
replacement and returns the same controller. All roots and managed Layers in
one loaded runtime share one realm scheduler and at most one pending animation
frame. Signal, root, resize, density, animation, and Layer requests coalesce.

A frame runs Begin, Advance, Commit, Plan, Render, and Complete. Components are
synchronous. CRC does not retain DOM-like drawing nodes or cache components as
bitmaps; ordinary Canvas paint still traverses the affected root. Explicit
`Layer` boundaries retain their existing offscreen bitmaps and repaint only
dirty layer paths.

## Component-owned state and direct inputs

```tsx
import { Group, Rectangle, Text, batch, useSignal } from "@crc/core";

function Counter() {
  const count = useSignal(0);
  const color = useSignal("#2563eb");

  return (
    <Group>
      <Rectangle
        style={{ width: 160, height: 72, fill: color }}
        onClick={() => {
          batch(() => {
            count.update((value) => value + 1);
            color.set("#7c3aed");
          });
        }}
      />
      <Text>{count}</Text>
    </Group>
  );
}
```

CRC-provided components accept signals at declared reactive input positions.
The receiving component performs the read and owns the dependency. Passing
`count.get()` is also valid, but intentionally makes `Counter` the consumer.
There is no recursive search through arbitrary application data.

`Signal<T>` exposes `get()`. `WritableSignal<T>` also exposes `set(value)`,
`update(updater)`, and `asReadonly()`. `set()` treats functions as data;
`update()` is the explicit functional update. `batch()` groups synchronous
writes into one notification wave. CRC event dispatch already supplies an
outer batch, so an event with several writes schedules affected work once.

Writes are rejected during component, primitive-render, and computed
evaluation, including equality no-ops. Direct writes are also rejected during
Advance; sanctioned Advance producers stage changes for Commit. `untracked()`
suppresses dependency collection but does not relax write guards.

## Hooks

Keep every hook call in the same order and count on every successful render.
Conditional, reordered, added, or omitted hook slots are deterministic errors.

- `useSignal(initial, options?)` owns one stable writable signal. The initial
  value and options are mount-only.
- `useComputed(compute, dependencies?, options?)` owns a lazy readonly signal.
  Signal dependencies are tracked dynamically; the dependency array names only
  captured non-signal values.
- `useConst(create)` owns one direct mount-lifetime value. Its factory runs
  untracked once and creates no graph node or cleanup.
- `useReaction(setup, dependencies?, options?)` owns imperative setup and
  optional cleanup. It runs in Complete after a successful render. Signals read
  by setup invalidate the reaction, not the component render.
- `useRef(initial?)` returns one stable mutable `{ current }` object. Mutating it
  never schedules work; it is appropriate for pointer sessions, handles, and
  other imperative identity.
- `useRectPath`, `useLinePath`, and `useSvgPath` own specialized path caches.
- Event, cursor, layout, animation, particle, physics, and renderer hooks retain
  specialized ownership and teardown that a general signal cannot replace.

## Computed barriers

Use `computed()` for an independently retained derivation and `useComputed()`
when the formula captures component props or other non-signal render values:

```tsx
import { Text, useComputed, useSignal } from "@crc/core";

function Summary({ suffix }: { suffix: string }) {
  const count = useSignal(0);
  const label = useComputed(() => `${count.get()} ${suffix}`, [suffix]);
  return <Text>{label}</Text>;
}
```

Computed values are lazy, cached, dynamically dependent, dependency-first,
and equality-aware. Invalidating an observed computed requests Plan validation.
An equal result stops there; a changed result invalidates its exact consumers
for the same frame. This equality barrier—not bitmap caching—is the principal
way to eliminate work downstream.

## Reactions and cleanup

```tsx
import { useReaction, type Signal } from "@crc/core";

function MirrorTitle({ title }: { title: Signal<string> }) {
  useReaction(() => {
    const previous = document.title;
    document.title = title.get();
    return () => {
      document.title = previous;
    };
  });
  return null;
}
```

Setup runs in Complete only after a successful render. Before replacement or
final release, CRC invokes the exact current cleanup once. Signal reads inside
setup belong to the reaction and do not add a render dependency. Setup and
cleanup may synchronize external resources but may not write signals.

## `useConst`, `useRef`, and specialized ownership

`useConst(() => value)` is for mount-lifetime values such as typed arrays,
immutable geometry descriptors, or helpers whose construction is expensive.
It is not reactive. In particular,
`useConst(() => someSignal.get())` captures one untracked snapshot for the
entire mount; later writes neither replace the value nor schedule the owner.

Use `useRef` when the stable mutable box itself is useful. Keep specialized
hooks when they own registrations, scheduler participation, Canvas paths,
animation leases, physics handles, or exact teardown. Those lifecycles are more
than cached values and should not be disguised as signals.

## Identity, failure, and disposal

Identity combines parent scope, component-function identity, optional key, and
same-type occurrence. Keyed same-parent reorder preserves state. Keys do not
preserve identity across parents.

Signal edges, computed formulas, reaction generations, and hook candidates are
transactional: a failed render keeps the last successful generation and leaves
no provisional dependency behind. CRC releases runtime-owned resources and
component refs on failure or removal. Pixels painted before a thrown render are
not rolled back.

`controller.dispose()` is idempotent. Abort and controller disposal enter the
same identity-guarded cleanup; a stale controller cannot dispose a replacement
mount.

## React comparison

| Concern       | CRC                                              | React                          |
| ------------- | ------------------------------------------------ | ------------------------------ |
| Output        | Immediate Canvas paint and CRC node traversal    | Host-renderer reconciliation   |
| State         | Signals, direct signal inputs, computed barriers | React-owned state model        |
| Effects       | Complete-phase signal-driven reactions           | React effects                  |
| Stable values | `useConst`, `useRef`, specialized owner hooks    | React hook vocabulary          |
| Host nodes    | One author-owned Canvas plus explicit Layers     | Typically a retained host tree |

Never import React hooks into a CRC scene or CRC hooks into a React component.
See the [signal-valued input types](#/api/types/signal-inputs),
[`useReaction`](#/api/hooks/use-reaction), and the
[signals/scheduling contract](../../../design/signals-and-scheduling-contract.md)
for the exact graph and scheduler rules.
