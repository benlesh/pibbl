# State, lifecycle, and React differences

CRC borrows functional composition and familiar dependency arrays, but it is
an immediate Canvas runtime rather than a React renderer.

## The render cycle

`crc(canvas, root, config?)` creates at most one live mount for a Canvas and
returns a stable controller. A later `crc()` call on that Canvas queues a root
replacement and returns the same controller. All roots and managed Layers in
one loaded runtime share one realm scheduler and at most one pending animation
frame. State, signal, root, resize, density, and Layer requests coalesce; the
latest explicit root wins.

When the frame runs, CRC clears the Canvas and synchronously traverses the full
current component tree. Components paint immediately or return more CRC nodes.
There is no virtual DOM, DOM reconciliation, retained drawing-command graph,
background rendering, async component continuation, Suspense, or server
component model. A frame runs Begin, Advance, Commit, Plan, Render, and
Complete in order.

## Hooks

```tsx
import { Path, crcMemo, crcRef, crcState, crcWhenChanged } from "@crc/core";

function Counter() {
  const [count, setCount] = crcState(0);
  const path = crcMemo(() => new Path2D("M0 0h120v60h-120z"), []);
  const renders = crcRef(0);
  renders.current = (renders.current ?? 0) + 1;

  crcWhenChanged(() => {
    const reset = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCount(0);
    };
    window.addEventListener("keydown", reset);
    return () => window.removeEventListener("keydown", reset);
  }, [count]);

  return (
    <Path
      style={{ d: path, fill: "#2563eb" }}
      onClick={() => setCount((value) => value + 1)}
    />
  );
}
```

Keep every hook call in the same order and count on every successful render.

The main lifecycle APIs are:

- `crcState` returns a stable setter and schedules the owning Canvas. A stale
  setter becomes inert after its exact component or mount is removed.
- `crcSignal` returns one writable signal for the hook slot. Its initial value
  and options are mount-only; explicit reads subscribe the current component.
- `crcMemo` compares dependency length and each value with strict `!==`.
- `crcRef` returns one stable mutable `{ current }` object and does not schedule
  on mutation.
- `crcWhenChanged` runs synchronously during rendering, not after paint. It
  cleans the previous generation before the next setup and cleans once more on
  removal.
- `crcRectPath`, `crcLinePath`, and `crcSvgPath` are memoized path hooks.
- Event, cursor, and target hooks own registrations in their exact component
  slot.
- `crcLayoutBox` and `crcCanvasContext` are render-context accessors; the latter
  deliberately does not allocate a hook slot.

Hooks may run only while CRC is rendering a component. Conditional, reordered,
added, or omitted hook slots are deterministic errors.

## `crcState` and signals

Use `crcState` when state belongs to one component slot and render-time value
access is most convenient. Its setter treats a function as an updater:

```tsx
const [count, setCount] = crcState(0);
setCount((current) => current + 1);
```

Use `signal()` for an independently retained writable value, `computed()` for
a lazy readonly derivation, and `crcSignal()` when the signal cell itself
should have hook-slot identity. Signal reads are always explicit:

```tsx
import { Text, computed, crcSignal, signal, untracked } from "@crc/core";

const greeting = signal("hello");
const loudGreeting = computed(() => greeting.get().toUpperCase());

function Greeting() {
  const visits = crcSignal(0);
  const debugSnapshot = untracked(() => visits.get());
  void debugSnapshot;
  return <Text>{`${loudGreeting.get()} ${visits.get()}`}</Text>;
}
```

`Signal<T>` exposes only `get()`. `WritableSignal<T>` also exposes
`set(value)`, `update(updater)`, and `asReadonly()`. Unlike `crcState`, a signal
`set()` treats a function as data; use `update()` for a functional update.
Signals do not unwrap in JSX or styles. Writes are rejected during component,
primitive-render, and computed evaluation—even when equality would make the
write a no-op. Direct writes are also rejected during scheduler Advance;
sanctioned Advance producers stage their changes for Commit. `untracked()`
suppresses synchronous dependency collection but does not relax either guard.

Computed values are lazy, cached, dynamically dependent, and
dependency-first. Equal results do not invalidate downstream consumers.
Invalidating an observed computed requests one coalesced realm frame for Plan
validation. An equal result renders nothing; a changed result invalidates and
renders its exact consumers in that same frame.

## Identity

Identity combines parent scope, component-function identity, optional key, and
same-type occurrence. Keyed same-parent reorder preserves state. Unkeyed
same-type siblings use occurrence order. A keyed fragment or component creates
a descendant parent scope; transparent arrays and unkeyed fragments do not.
Keys cannot preserve state across reparenting.

## Canvas isolation and failure

CRC saves and restores Canvas and temporary runtime state around each component
subtree. A thrown render fails closed: runtime-owned resources and component
refs are released, temporary globals are restored, and a later explicit render
starts clean. Pixels painted before the throw are not rolled back.

## React comparison

| Concern       | CRC                                                                  | React                                |
| ------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Output        | Immediate Canvas 2D paint and CRC node traversal                     | Host-renderer reconciliation         |
| Scheduling    | Realm-wide six-phase animation-frame scheduler and full traversal    | React scheduler/reconciler           |
| Components    | Synchronous functions returning `CRCNode` or `void`                  | React component contract             |
| State APIs    | `signal`, `computed`, `crcSignal`, `crcState`, memo/ref/change hooks | Different runtime-owned primitives   |
| Effects       | `crcWhenChanged` is synchronous during render                        | React effects are not CRC lifecycle  |
| Element brand | `Symbol.for("@crc/core.element")`                                    | Foreign React brands are rejected    |
| Host nodes    | One author-owned Canvas                                              | Typically a renderer-owned host tree |
| Accessibility | Application supplies semantic DOM                                    | Depends on the React host renderer   |

Never import React hooks into a CRC scene or CRC hooks into a React component.
The similar syntax does not make the lifecycles interchangeable.

## Disposal

```ts
const controller = crc(canvas, root, { signal: abortController.signal });

controller.dispose();
controller.dispose(); // Still safe.
```

Abort and controller disposal enter the same identity-guarded cleanup. A stale
controller cannot dispose a replacement mount. See the [runtime/hook
contract](../design/runtime-hooks-contract.md) and [resource ownership
contract](../design/runtime-resource-ownership.md). The [signals and scheduling
contract](../design/signals-and-scheduling-contract.md) defines graph,
scheduler, Layer revision, and failure-isolation details.
