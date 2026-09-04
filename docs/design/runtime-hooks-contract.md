# CRC runtime and hook contract

Status: current implemented contract, updated for JSX-era authoring on
2026-09-03.

This document defines element construction, traversal, identity, updates,
hooks, recovery, and disposal. The [resource ownership
contract](./runtime-resource-ownership.md) defines exact release rules and the
[Canvas surface contract](./canvas-surface-contract.md) defines root geometry.

## Element and component protocol

`CRCElement` is an opaque immutable description branded at runtime with
`Symbol.for("@crc/core.element")` and nominally in TypeScript. It contains a
component type, shallow-readonly props, and an optional key normalized to a
string. JSX and `createElement(type, props, ...children)` use the same internal
constructor and create indistinguishable descriptors. Element creation is
side-effect free.

Ordinary components are synchronous functions:

```ts
type CRCComponent<P> = (props: P) => CRCNode | void;
```

No definition wrapper, base class, or registration step is required. The
function value is runtime identity. Platform components defined by
`definePrimitive` use the same public element protocol while retaining private
style-resolution and measurement capabilities.

`key` accepts a string or number, is removed from delivered props, and does not
act like a React element ref. Compiler-supplied children live in props.
Development `jsxDEV` descriptors retain source filename, line, and column for
diagnostics; production descriptors do not.

`CRCNode` is recursive: a branded element, an empty value, a readonly array, or
a finite synchronous iterable. Arrays and unkeyed fragments flatten
transparently. Empty values are `false`, `true`, `null`, `undefined`, the empty
string, and numeric zero. Non-empty raw strings, nonzero numbers, Promises,
async iterables, functions, symbols, foreign elements, and unsupported objects
are contextual errors. `Text` has its separate recursive scalar-content
contract in the [drawing contract](./drawing-components-contract.md).

`crc(canvas, root, config?)` accepts a complete `CRCNode`, so a collection,
fragment, or empty root is valid. The first call owns the mount configuration
and returns a stable controller. Later calls queue root replacement on that
same mount and return the controller.

## Traversal and identity

On a scheduled frame CRC:

1. prepares the root's recursive synchronous node structure;
2. resolves sibling identity;
3. saves Canvas and temporary runtime state;
4. establishes hooks, local allocation, events, clips, policies, and render
   context;
5. invokes a plain component or primitive renderer;
6. traverses returned nodes in source order;
7. finalizes slots and restores state;
8. after successful traversal, removes unseen identities and their resources.

Synchronous iterables are materialized once at a receiving render or
measurement boundary. They must be finite.

Identity is resolved within one parent scope:

| Tree form                     | Identity rule                          | Consequence                                                                                               |
| ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Explicit `key`                | Component function plus normalized key | Same-parent keyed reorder/insertion preserves surviving state. Reusing the key for another type remounts. |
| Unkeyed same-type sibling     | Occurrence among that type             | Inserting before it transfers the slot by position; use keys for semantic identity.                       |
| Distinct same-named functions | Function object identity               | They never share refs or hooks.                                                                           |
| Array or unkeyed `Fragment`   | Transparent                            | It creates no parent boundary or slot.                                                                    |
| Keyed `Fragment`              | One keyed parent scope                 | Its descendants keep identity within that fragment boundary.                                              |
| Empty node                    | No slot                                | Toggling it cannot shift a real sibling.                                                                  |

Keys must be unique after transparent flattening in their sibling scope.
Reparenting or adding a component/keyed-fragment wrapper creates a different
scope; a key does not preserve identity across parents.

Source traversal is paint order. Coordinate targeting searches the shared
paint ledger in reverse. Policy values `FocusManagement` and
`KeyboardNavigation` are identity-transparent preparation boundaries and do
not add component or hook scopes.

## Scheduling

Normal work coalesces on `requestAnimationFrame`. Several state/root/resize/
density/parent-layer requests share the pending frame. The latest explicit
root wins; a state request cannot erase it, and parent-update intent is
OR-preserved. Rendering remains one full synchronous Canvas traversal with no
DOM reconciliation, background work, retained drawing commands, or async
component continuation.

## Hook sequence invariant

Hooks run only synchronously while CRC invokes a mounted component. Ordinary
hooks outside render report:

```text
CRC hooks can only be called while rendering a component.
```

Each component owns ordered, typed slots. Every successful update must call
the same number and kinds in the same order. CRC reports a changed kind, added
slot, or omitted slot deterministically and releases abandoned ownership. A
failed render closes the instance's component refs, clears the partial tree,
and restores temporary globals. This is a fail-closed reset, not pixel rollback;
a later explicit render remounts cleanly.

## Public hook contracts

| API                               | Contract                                                                                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crcState(init?)`                 | Stable mounted setter; direct and functional updates apply in call order and coalesce. State follows component identity. A stale/dead setter is inert. Functions passed to the setter are updaters. |
| `crcMemo(create, deps)`           | Mount/create and strict shallow `!==` dependency comparison. Length changes recompute; `NaN` recomputes and signed zeros compare equal.                                                             |
| `crcRef(init?)`                   | Stable mutable `{ current }`; initializer is mount-only and mutation does not schedule.                                                                                                             |
| `crcWhenChanged(callback, deps?)` | Synchronous setup during render. Previous cleanup runs once before replacement and final cleanup runs on removal. Omitted dependencies mean every render.                                           |
| `crcRectPath(...)`                | Memoized rectangle `Path2D`, including geometry and pixel-grid input.                                                                                                                               |
| `crcLinePath(...)`                | Memoized polyline over every coordinate and `closePath`.                                                                                                                                            |
| `crcSvgPath(data)`                | Memoized exact SVG data with platform parsing/errors.                                                                                                                                               |
| `crcEvent(...)`                   | Typed geometric target or narrow pathless Canvas observer with exact slot ownership.                                                                                                                |
| `crcEventTarget(...)`             | Grouped explicit target and focus snapshot.                                                                                                                                                         |
| `crcEventListener(...)`           | Non-geometric capture/bubble participant.                                                                                                                                                           |
| `crcCursor(...)`                  | Target cursor or Canvas fallback with exact ownership.                                                                                                                                              |
| `crcLayoutBox()`                  | Stable readonly child-local allocation. It is render-only and throws `No CRC layout context is available` outside a live layout context.                                                            |
| `crcCanvasContext()`              | Current isolated Canvas 2D context. It allocates no hook slot and is unavailable outside render or during measurement.                                                                              |

The path helpers are distinct slot kinds even though all return `Path2D`.

## Pure measurement

`measureElement` and a `definePrimitive` `measure` capability are not render
passes. They normalize style and may recursively measure elements, but cannot
invoke render callbacks, hooks, `crcLayoutBox`, `crcCanvasContext`, paint,
register interaction, load images, or acquire resources. CRC clears and
restores temporary render state in `finally`. Direct or indirect cycles report
a contextual `LayoutDiagnostic`; a later valid measurement remains usable.

Plain components do not expose intrinsic measurement. Allocation-dependent
primitive style requires an explicit resolver and must become finite before the
render callback.

## Canvas isolation, errors, and disposal

CRC saves/restores Canvas state around every component subtree. Component
throws release runtime ownership and refs and restore global state; pixels
already painted earlier in the frame remain. The controller's `dispose()` is
idempotent, cancels the exact pending frame, releases every owned resource, and
cannot affect a replacement mount. Abort uses the same guarded path.

## Package boundary and evidence

The package exports root runtime/types plus compiler-only
`@crc/core/jsx-runtime` and `@crc/core/jsx-dev-runtime` entries. Strict Bundler,
NodeNext, built, and packed consumers verify those entries, the CRC/React type
boundary, and blocked private subpaths. The `runtime-hooks-laboratory`, JSX
authoring tests, lifecycle stress suite, and cleanup ledgers cover traversal,
identity, hook order, recovery, and disposal through public elements.

Completed numbered plans and dated field notes preserve the API that existed at
their recorded revisions. They are historical evidence, not this current
contract.
