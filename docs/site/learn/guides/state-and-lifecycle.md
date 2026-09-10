---
id: guide-state-lifecycle
title: Manage state and lifecycle
summary: Understand scheduled rendering, hook slots, identity, cleanup, and CRC's differences from React.
kind: guide
slug: state-and-lifecycle
order: 60
keywords: [state, lifecycle, cleanup, identity, hooks]
---

# Manage state and lifecycle

CRC borrows functional composition and familiar dependency arrays, but it is
an immediate Canvas runtime rather than a React renderer.

## The render cycle

`crc(canvas, root, config?)` creates at most one live mount for a Canvas and
returns a stable controller. A later `crc()` call on that Canvas queues a root
replacement and returns the same controller. State, root, resize, density, and
parent-layer requests coalesce onto the next animation frame; the latest
explicit root wins.

When the frame runs, CRC clears the Canvas and synchronously traverses the full
current component tree. Components paint immediately or return more CRC nodes.
There is no virtual DOM, DOM reconciliation, retained drawing-command graph,
background rendering, async component continuation, Suspense, or server
component model.

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

| Concern       | CRC                                                 | React                                |
| ------------- | --------------------------------------------------- | ------------------------------------ |
| Output        | Immediate Canvas 2D paint and CRC node traversal    | Host-renderer reconciliation         |
| Scheduling    | Animation-frame-coalesced full traversal            | React scheduler/reconciler           |
| Components    | Synchronous functions returning `CRCNode` or `void` | React component contract             |
| State APIs    | `crcState`, `crcMemo`, `crcRef`, `crcWhenChanged`   | Different runtime-owned hooks        |
| Effects       | `crcWhenChanged` is synchronous during render       | React effects are not CRC lifecycle  |
| Element brand | `Symbol.for("@crc/core.element")`                   | Foreign React brands are rejected    |
| Host nodes    | One author-owned Canvas                             | Typically a renderer-owned host tree |
| Accessibility | Application supplies semantic DOM                   | Depends on the React host renderer   |

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
contract](../../../design/runtime-hooks-contract.md) and [resource ownership
contract](../../../design/runtime-resource-ownership.md).
