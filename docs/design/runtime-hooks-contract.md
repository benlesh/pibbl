# CRC runtime and hook contract

Status: current implemented contract, updated for first-class signals and the
realm scheduler on 2026-09-10.

This document defines element construction, traversal, identity, updates,
hooks, recovery, and disposal. The [resource ownership
contract](./runtime-resource-ownership.md) defines exact release rules and the
[Canvas surface contract](./canvas-surface-contract.md) defines root geometry.

## Component and tree identity

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
same mount and return the controller. Later calls cannot change the initial
viewport, fit, pixel ratio, or abort signal.

The controller return is additive: callers may ignore it and retain the same
mounted behavior. Retaining it enables explicit idempotent disposal without
keeping a disposed scene instance alive.

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
Ordinary traversal rejects duplicates during recursive child preflight with the
public diagnostic `<Receiver> received duplicate CRC key "<key>" as a CRC child.`
At the root, `<Receiver>` is `CRC root`; for a component result it is the
component display name plus JSX development source location when available. A
lower-level prepared-identity guard retains
`Duplicate CRC key "<key>" under "<parent>"` as an internal fallback. Removing a
component, changing its key or type, replacing its root type, or disposing the
instance releases that identity and every hook resource it owns.

Source traversal is paint order. Coordinate targeting searches the shared
paint ledger in reverse. Policy values `FocusManagement` and
`KeyboardNavigation` are identity-transparent preparation boundaries and do
not add component or hook scopes.

## Scheduling

Normal work from every root and managed Layer in one loaded runtime coalesces
onto one realm-wide `requestAnimationFrame`. Each frame runs Begin, Advance,
Commit, Plan, Render, and Complete in order. The latest explicit root wins. A
state request cannot erase it. A signal request cannot erase it, and
nested-instance requests mark their ancestor composition path so parent-update
intent remains OR-preserved.
Rendering remains synchronous Canvas
traversal with no DOM reconciliation, background work, retained drawing
commands, or async component continuation. The [signals and scheduling
contract](./signals-and-scheduling-contract.md) defines phase admission,
revision, computed-validation, Layer, failure-isolation, and friend-renderer
rules.

## Hook sequence invariant

Hooks run only synchronously while CRC invokes a mounted component. Ordinary
hooks outside render report:

```text
CRC hooks can only be called while rendering a component.
```

Each component owns ordered, typed slots. Every successful update must call
the same number and kinds in the same order. CRC reports a changed kind, added
slot, or fewer hooks deterministically. Before reporting fewer hooks, CRC
releases the abandoned slots' owned resources. A
failed render closes the instance's component refs, clears the partial tree,
and restores temporary globals. This is a fail-closed reset, not pixel rollback;
a later explicit render remounts cleanly.

## Public hook contracts

| API                               | Supported contract                                                                                                                                                                                                                                                                                                                                                                      | Direct evidence                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `crcState(init?)`                 | Returns the current value and one stable setter for the mounted slot. Direct values and functional updates apply in call order and coalesce into a frame. Identity persists across ordinary renders and resets at key/type/root removal. A setter becomes inert after its exact component or mount starts teardown. Function-valued state is not distinguished from functional updates. | `hook-contract.test.ts`, `crc-state.test.ts`, shared laboratory         |
| `crcMemo(create, deps)`           | Runs on mount and again when dependency length changes or any position compares different with strict `!==`. Equal dependencies preserve object identity. Consequently `NaN` recomputes and `+0`/`-0` compare equal. Factory errors enter fail-closed render recovery.                                                                                                                  | `hook-contract.test.ts`, shared laboratory                              |
| `crcRef(init?)`                   | Creates one stable mutable `{ current }` object for the slot. Mutating it does not schedule a render. The initializer is used only on mount; key/type/root removal creates a fresh ref.                                                                                                                                                                                                 | `crc-ref.test.ts`, `hook-contract.test.ts`, shared laboratory           |
| `crcWhenChanged(callback, deps?)` | Runs synchronously on mount and when shallow strict dependencies change. The previous cleanup runs exactly once before the next setup. With no dependencies it cleans and runs on every render. Component removal owns the final cleanup; a void or throwing replacement cannot replay an older cleanup.                                                                                | `crc-when-changed.test.ts`, `hook-contract.test.ts`, cleanup laboratory |
| `crcRectPath(...)`                | Memoizes a `Path2D` over all rectangle geometry and pixel-grid inputs. Equal effective inputs preserve identity; changed geometry creates a new path.                                                                                                                                                                                                                                   | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcLinePath(...)`                | Memoizes over every coordinate and `closePath`; changing either creates a new `Path2D`.                                                                                                                                                                                                                                                                                                 | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcSvgPath(data)`                | Memoizes exact SVG path data. Parsing is delegated to platform `Path2D`; malformed data propagates the platform error and participates in normal render recovery.                                                                                                                                                                                                                       | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcEvent(...)`                   | Owns a typed event hook slot and follows geometric-target/pathless-observer and lifecycle rules in the event and ownership contracts. Switching modes keeps hook order valid.                                                                                                                                                                                                           | `hook-contract.test.ts`, user-event laboratories                        |
| `crcEventTarget(...)`             | Groups one explicit geometric target and its focus snapshot with exact per-render ownership.                                                                                                                                                                                                                                                                                            | event-target and focus suites                                           |
| `crcEventListener(...)`           | Adds one non-geometric capture/bubble listener participant with no implicit target.                                                                                                                                                                                                                                                                                                     | propagation and ownership suites                                        |
| `crcCursor(...)`                  | Owns a typed cursor hook slot and follows target/fallback ownership rules. Switching path/global modes keeps hook order valid.                                                                                                                                                                                                                                                          | `hook-contract.test.ts`, cleanup laboratory                             |
| `crcLayoutBox()`                  | Returns the current component's stable readonly local allocation `{ x: 0, y: 0, width, height }`. Equal allocation preserves object identity. Reading does not schedule work. Unlike ordinary hooks, calling it outside a live layout context—including during pure measurement—throws `No CRC layout context is available`, not the shared hook diagnostic.                            | layout foundation and measurement-isolation suites                      |
| `crcCanvasContext()`              | Returns the current isolated Canvas 2D context without allocating a hook slot. It is unavailable outside render and during pure measurement.                                                                                                                                                                                                                                            | plain-component and measurement-isolation suites                        |

The three memoized path helpers are distinct slot kinds. Reordering them is a
hook-order error even though all return `Path2D`.

## Pure measurement boundary

`measureElement` and a `definePrimitive` `measure` capability are not render
passes. They normalize style and may recursively measure elements, but cannot
invoke render callbacks, hooks, `crcLayoutBox`, `crcCanvasContext`, paint,
register interaction, load images, or acquire resources. CRC clears and
restores temporary render state in `finally`. When measurement is nested during
an active render, that isolation prevents attempted measurement hooks from
consuming or reordering the parent component's hook slots. Direct or indirect
cycles report a contextual `LayoutDiagnostic`; a later valid measurement
remains usable.

Plain components do not expose intrinsic measurement. Allocation-dependent
primitive style requires an explicit resolver and must become finite before the
render callback.

## Canvas isolation, errors, and disposal

CRC saves/restores Canvas state around every component subtree. Component
throws release runtime ownership and refs and restore global state; pixels
already painted earlier in the frame remain. Signal writes are forbidden while
CRC evaluates components or primitive render callbacks, even for equality
no-ops, and the guard runs before an updater or equality function. The
controller's `dispose()` is idempotent, removes that root and its pending work
from the realm scheduler, releases every owned resource, and cannot affect a
replacement mount or unrelated roots. Abort uses the same guarded path.

## Public package boundary

The package exports the runtime, controller and surface types, components,
hooks, hook values, and compiler-only
`@crc/core/jsx-runtime` and `@crc/core/jsx-dev-runtime` entries. Strict Bundler,
NodeNext, built, and packed consumers verify those entries, the CRC/React type
boundary, and blocked private subpaths. The `runtime-hooks-laboratory`, JSX
authoring tests, lifecycle stress suite, and cleanup ledgers cover traversal,
identity, hook order, recovery, and disposal through public elements.

The root `@crc/core` entry also exports `Signal`, `WritableSignal`,
`SignalOptions`, `SignalEquals`, `signal`, `computed`, `untracked`, `isSignal`,
and `crcSignal`.

## Deterministic evidence

The presentation-neutral `runtime-hooks-laboratory` is loaded through the same
catalog entry by the Studio and headless Chromium. It proves exact render
counts, state/ref separation, stable and invalidated memo/path identities,
dependency setup/cleanup, keyed sibling identity across reorder/insert/remove,
key/component/root remount boundaries, every supported empty child, all
outside-render errors, recovery, text-free pixels, source-adapter identity, and
reset. Focused tests additionally prove duplicate keys, same-name functions,
unkeyed occurrence behavior, root/state update permutations,
more/fewer/reordered hooks, cleanup and factory exceptions, Canvas context
restoration, stale setters, malformed-path recovery, fragment identity, and
recursive iterable diagnostics. Public type assertions compile against built
declarations under both Bundler and NodeNext resolution.

Focused suites cover signal `get()` reads, component consumers, realm scheduler
requests, Layer invalidation, exact ownership, and isolated root render
failures.

## Deliberate boundaries

- Conditional hooks reject. Learner pages do not intentionally corrupt their
  own hook sequence; focused tests own that error path.
- Component identity is internal. Diagnostic IDs displayed by laboratories are
  not public runtime identifiers.
- `crcState` defines no separate lazy-initializer or function-as-data
  semantics; a function passed to its setter is an updater.
- A thrown render fails closed and requires a later explicit render. CRC does
  not retain or restore a transactional snapshot of the previous Canvas tree.
- Drawing, layout, events, and ownership retain their exact behavior in their
  dedicated contracts rather than being redefined here.

Completed numbered plans and dated field notes preserve the API that existed at
their recorded revisions. They are historical evidence, not this current
contract.

## First-class signal integration

`crcSignal(initialValue, options?)` returns one writable signal created for the
mounted hook slot. The initial value, equality function, and debug name are
mount-only. Explicit `get()` reads subscribe the evaluating component. Removal
detaches that owner; a retained signal remains readable and writable but cannot
schedule the removed owner. Focused `crc-signal`, signal graph,
component-consumer, scheduler, Layer, and error-isolation suites cover these
rules. `crcPlayback(program, options?)` and `crcTransition(target, options)` are
ordered render-only hook slots. The first returns a stable component-owned
handle; the second returns a stable readonly signal backed by private playback.
Only successful renders adopt candidates or queue autoplay, entrance, and
retarget work. Teardown releases registrations, writer leases, evaluator and
stepper state, queued commands and milestones, and live callbacks exactly once;
stale controls and retained transition results cannot schedule a replacement
identity. All commands enter the shared realm scheduler, outputs/status/time
publish in one Commit, and specialized behavior lives in the [animation
contract](./animation-contract.md).

`signal().set()` treats a function as data; `signal().update()` is the explicit
updater operation. Signals require explicit `get()` and are not automatically
unwrapped into styles or nodes.

`@crc/core/internal` is a separate version-coupled friend entry for official
lockstep renderer packages. It is neither re-exported at the root nor available
to ordinary Studio examples.
