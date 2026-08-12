# CRC runtime and hook contract

Status: implemented and verified by TFC-08 on 2026-08-11.

This document defines the supported identity, update, hook, and recovery behavior of the existing CRC runtime. It complements the [runtime resource ownership contract](./runtime-resource-ownership.md) and the [mouse interaction contract](./mouse-interaction-contract.md). The shared `runtime-hooks-laboratory` scenario is the public-API integration oracle; focused tests cover misuse that would make an interactive gallery scene unsafe.

## Component and tree identity

`defineComp(render)` creates a component factory. Each call to that factory creates a new element containing the same render-function identity and the exact supplied props. Calling `crc(canvas, element)` mounts the first element and returns a stable controller; later calls for that mounted Canvas queue an update and return the same controller.

Component identity is resolved within its parent:

| Tree form                                           | Identity rule                                    | Supported consequence                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Explicit `key`                                      | Component function identity plus the encoded key | Reordering or inserting keyed siblings preserves surviving state; reusing the key for a different component type remounts.    |
| Unkeyed siblings of the same type                   | Occurrence order among that type                 | Insertion before an unkeyed sibling transfers the existing slot by position; callers needing semantic identity must use keys. |
| Distinct functions with the same JavaScript name    | Function identity, not the displayed name        | The functions never share component refs or hooks.                                                                            |
| `false`, `null`, `undefined`, `''`, or `0` children | No component slot                                | Adding or removing falsy children cannot shift a real sibling's identity.                                                     |

Explicit keys must be unique under one parent for a render. A duplicate throws `Duplicate CRC key "<key>" under "<parent>"`. Removing a component, changing its key or type, replacing its root type, or disposing the instance releases that identity and every hook resource it owns.

Root updates are frame-coalesced. If several explicit roots are queued, the latest root wins. A state update cannot erase a pending explicit root, and the request to update parent layers is OR-preserved across all work coalesced into that frame. The `signal` option belongs to the initial mount; update calls keep the mounted lifetime and controller.

## Hook sequence invariant

Hooks may run only synchronously while CRC is rendering a component. Every public hook uses the same outside-render error:

```text
CRC hooks can only be called while rendering a component.
```

Each component owns an ordered array of typed hook slots. Every successful update must call the same number and kinds of hooks in the same order as its previous successful render. CRC reports deterministic errors for a changed kind, an additional hook, or an omitted hook. Before reporting an omitted hook, CRC releases the abandoned slot's owned resources. A failed render closes all component refs in that Canvas instance and clears the partial tree, contexts, and temporary render globals. This is a fail-closed reset, not a rollback to the previous pixels or state; a later explicit render remounts a clean tree.

## Public hook contracts

| Public hook                       | Supported contract                                                                                                                                                                                                                                                                                                                                                                                               | Direct evidence                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `crcState(init)`                  | Returns the current value and one stable setter for the mounted slot. Direct values and functional updates apply in call order and coalesce into a frame. Identity persists across ordinary renders and resets at key/type/root removal. A setter becomes an inert capability after its exact component or mount starts teardown. Function-valued state is not separately distinguished from functional updates. | `hook-contract.test.ts`, `crc-state.test.ts`, shared laboratory         |
| `crcMemo(create, deps)`           | Runs on mount and again when dependency length changes or any position compares different with strict `!==`. Equal dependencies preserve object identity. Consequently `NaN` recomputes and `+0`/`-0` compare equal. Factory errors enter fail-closed render recovery.                                                                                                                                           | `hook-contract.test.ts`, shared laboratory                              |
| `crcRef(init?)`                   | Creates one stable mutable `{ current }` object for the slot. Mutating it does not schedule a render. The initializer is used only on mount; key/type/root removal creates a fresh ref.                                                                                                                                                                                                                          | `crc-ref.test.ts`, `hook-contract.test.ts`, shared laboratory           |
| `crcWhenChanged(callback, deps?)` | Runs synchronously on mount and when shallow strict dependencies change. The previous cleanup runs exactly once before the next setup. With no dependencies it cleans and runs on every render. Component removal owns the final cleanup; a void or throwing replacement cannot replay an older cleanup.                                                                                                         | `crc-when-changed.test.ts`, `hook-contract.test.ts`, cleanup laboratory |
| `crcRectPath(...)`                | Memoizes a `Path2D` over all rectangle geometry and pixel-grid inputs. Equal effective inputs preserve identity; changed geometry creates a new path.                                                                                                                                                                                                                                                            | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcLinePath(...)`                | Memoizes over every coordinate and `closePath`; changing either creates a new `Path2D`.                                                                                                                                                                                                                                                                                                                          | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcSvgPath(data)`                | Memoizes exact SVG path data. Parsing is delegated to the platform `Path2D`; malformed data propagates the platform error and participates in normal render recovery.                                                                                                                                                                                                                                            | `crc-path-hooks.test.ts`, shared laboratory                             |
| `crcEvent(...)`                   | Owns a typed event hook slot and follows the target/observer and lifecycle rules in the mouse and ownership contracts. Switching path/global modes keeps hook order valid.                                                                                                                                                                                                                                       | `hook-contract.test.ts`, TFC-04/TFC-05 laboratories                     |
| `crcCursor(...)`                  | Owns a typed cursor hook slot and follows the target/fallback ownership rules in the mouse and event ownership contracts. Switching path/global modes keeps hook order valid.                                                                                                                                                                                                                                    | `hook-contract.test.ts`, TFC-04/TFC-05 laboratories                     |

The three memoized path helpers are distinct hook kinds. Reordering them is a hook-order error even when their values would all be `Path2D` instances.

## Public package boundary

The built package exposes the runtime, controller type, components, hooks, hook value types, and `@crc/core/types` declarations through explicit export-map entries. Strict Bundler and NodeNext consumers compile the public runtime/hook matrix. Internal `@crc/core/lib/*` paths are not package exports, and the runtime export test prevents type-only names from becoming accidental JavaScript exports.

## Deterministic evidence

The presentation-neutral `runtime-hooks-laboratory` is loaded through the same catalog entry by the browser gallery and headless Chromium. It proves exact render counts, state/ref separation, stable and invalidated memo/path identities, dependency setup/cleanup, keyed sibling identity across reorder/insert/remove, key/component/root remount boundaries, five real falsy children, all nine outside-render errors, recovery, text-free pixels, source-adapter identity, and reset.

Focused tests additionally prove duplicate keys, same-name functions, unkeyed occurrence behavior, root/state update permutations, more/fewer/reordered hooks, cleanup and factory exceptions, Canvas context restoration, stale setters, and malformed path recovery. Public type assertions compile against built declarations under both Bundler and NodeNext resolution.

## Deliberate boundaries

- Conditional hooks are rejected rather than supported. The gallery does not offer a control that intentionally corrupts its own hook sequence; focused tests own that error path.
- Component identity is internal and diagnostic IDs shown by the laboratory are not public runtime identifiers.
- `crcState` does not define lazy initializer or function-as-data semantics; a function passed to the setter is an updater.
- A thrown render fails closed and requires a later explicit render. CRC does not retain or restore a transactional snapshot of the previous Canvas tree.
- Drawing-component property and pixel contracts are TFC-09 scope. Event and cursor behavior remains owned by the TFC-04/TFC-05 interaction contracts rather than duplicated here.
