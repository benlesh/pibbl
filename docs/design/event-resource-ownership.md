# Pibbl event resource ownership

Status: current implemented contract, updated for event-registration masks on
2026-09-23.

This contract assigns every event-related resource to one owner and one
idempotent release path. It supplements the [user-event
contract](./user-events-contract.md) and [mouse interaction
contract](./mouse-interaction-contract.md): this document governs lifetime and
failure isolation, while those documents govern dispatch and geometry.

## Public lifetime

`pibbl(canvas, scene, config)` accepts a branded recursive `PibblNode` and returns a
stable `PibblController` for the active mount:

```ts
interface PibblController {
  dispose(): void;
}
```

- Updating an already-mounted Canvas returns the same controller.
- `config.signal` is a mount option: only the signal supplied when the Canvas is first mounted owns that lifetime. A signal supplied on an update is ignored. Viewport, fit, and pixel ratio follow the same mount-only rule.
- `dispose()` is synchronous and idempotent.
- `config.signal` and `dispose()` enter the same central disposal path.
- A controller or signal from an old mount cannot dispose a newer mount on the same Canvas.
- An already-aborted signal produces an immediately disposed controller and schedules no render.
- Omitting `signal` is supported; the controller still owns and removes all native listeners.

JSX and `createElement` produce the same descriptors. Existing callers may
ignore the additive controller return value. Retaining a controller does not
keep its disposed scene instance alive; its closure releases that ownership
after the first cleanup request.

## Ownership table

| Resource                         | Sole owner                                                          | Acquisition                                                    | Release trigger                                                                        | Required postcondition                                                                                                |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Root instance-map entry          | Mount/controller identity                                           | First `pibbl()` for a Canvas                                   | Matching signal/controller disposal                                                    | The entry is absent; a newer identity is untouched.                                                                   |
| Abort subscription               | Root instance main teardown                                         | Mount with a signal                                            | Any disposal path                                                                      | The abort listener is detached and later abort is harmless.                                                           |
| Per-type native Canvas listener  | Root event hub                                                      | First live requester for that type                             | Last requester release or root disposal                                                | At most one native listener exists for the type; removal uses the matching capture option.                            |
| Grouped event target             | Built-in paint-target slot or `useEventTarget` hook                 | Default-participating drawing, or explicit target registration | `pointerEvents="none"`, last explicit property removed, component removal, or disposal | Target, paint entry, native requests, captures, contacts, drag hover, focus, and cursor references are absent.        |
| Propagation listener             | One `useEventListener` hook slot                                    | Render with at least one handler                               | Last handler removed, component removal, or disposal                                   | The exact component bucket member and native requests are absent.                                                     |
| Logical pointer capture          | Capturing live event node and root capture state                    | Successful native `setPointerCapture` request                  | Transfer, release, cancel, native loss, node removal, or disposal                      | Per-pointer active/provisional/pending-transfer/pending-loss records and prerequisite native requests settle to zero. |
| Retained touch contact           | Root dispatcher, keyed by identifier                                | Hit-resolved `touchstart`                                      | `touchend`, `touchcancel`, target removal, or disposal                                 | No identifier refers to a dead logical target.                                                                        |
| Drag hover target                | Root dispatcher                                                     | Drag boundary reconciliation                                   | Root leave, drop, drag end, target removal, or disposal                                | No drag boundary state refers to a dead logical target.                                                               |
| Pending animation frame          | Pibbl instance                                                      | Each update                                                    | Replacement, callback completion, or disposal                                          | The exact frame identity is canceled/completed; a stale callback is a no-op.                                          |
| Component/main follower          | Mounted component                                                   | First component render                                         | Component removal or instance disposal                                                 | Component teardown closes once and detaches from its parent.                                                          |
| Interaction region               | One persistent component path slot                                  | Render with a handler or cursor                                | Last interactive prop removed, component removal, or disposal                          | The owner-local region and paint entry are absent; root state no longer references it.                                |
| Hover/activation state           | Root interaction dispatcher                                         | Native pointer/activation input                                | Target removal, completed activation, root exit, or disposal                           | Every referenced leaf region remains live, or the state is cleared synchronously.                                     |
| Canvas cursor style              | Cursor hook slot                                                    | That slot successfully sets the cursor                         | Rerender, pointer exit, component removal, or disposal                                 | Only the cursor owned by that slot is cleared.                                                                        |
| Pathless observer/default        | Hook slot, registered on root instance                              | Render without an interaction path                             | Rerender, component removal, layer removal, or disposal                                | The exact root Set member is deleted once, including when declared inside a layer.                                    |
| Layer composition paint entry    | Owning `Layer` component                                            | Layer draw slot                                                | Layer/ancestor removal or root disposal                                                | The parent paint entry is absent and cannot resolve a child target.                                                   |
| Offscreen layer instance         | Owning `Layer` component                                            | Layer mount                                                    | Layer/ancestor removal or root disposal                                                | Child map entry, components, frames, regions, and nested layers are released recursively.                             |
| Render-layer target record       | One committed interaction generation and registered external target | Successful Canvas composite and generation commit              | Opt-out, generation replacement, layer removal, failure, or root disposal              | No committed resolver, focus entry, or dispatcher state refers to a stale target generation.                          |
| Render-layer nested resolver     | Owning `defineRenderLayer` component                                | Successful Canvas composite and generation commit              | Opt-out, generation replacement, layer removal, failure, or root disposal              | The global paint ledger cannot invoke a stale picker or mismatched focus generation.                                  |
| Render-layer event-parent bridge | Owning external-renderer mount                                      | Layer mount                                                    | Layer removal, failure, or root disposal                                               | Temporary paths cannot retain the removed external target or its Canvas parent.                                       |
| Three input bridge               | Owning `defineThreeLayer` adapter                                   | Layer creation                                                 | Layer removal, failure, or root disposal                                               | Control listeners and capture state detach; retained input callbacks cannot dispatch or schedule work.                |
| Component refs                   | Pibbl instance                                                      | Render                                                         | Component removal or instance disposal                                                 | Removed refs run teardown and become unreachable.                                                                     |

## Central disposal sequence

The controller first verifies that the global Canvas entry is the exact instance it owns. A matching cleanup then:

1. cancels the currently owned animation frame, including the legal frame id `0`;
2. removes the global instance entry;
3. executes the instance's stable main-teardown snapshot in registration
   order; for a root mount, the native-listener hub was registered when the
   event root was created and therefore disposes before later root resources
   and component followers;
4. lets those later component followers cascade through grouped targets,
   propagation listeners, legacy observers, pointer captures, nested Canvas
   layers, and external render-layer targets/bridges; their idempotent native release
   closures observe the already-closed hub;
5. clears pointer, touch, drag, activation, hover, cursor, registry, and
   component references as a final unreachable-state guarantee.

The identity check makes stale controllers harmless. Frame callbacks also check instance identity, open teardown state, and their exact frame id before rendering, so a callback already dequeued by the browser cannot resurrect a disposed mount.

## Replacement, removal, and errors

Every default-participating Canvas drawing, committed render-layer target, or
`useEventTarget` path owns one persistent grouped target slot containing current
event handlers and optional cursor/focus metadata. Rerender updates that target
in place and refreshes its local paint/pick position without changing logical
identity.
`useEventListener` similarly owns
one stable non-geometric registration. If the last active property disappears,
teardown removes the exact registration and clears native requests, pointer
capture, retained touch contacts, drag hover, mouse hover/activation, and cursor
state that still references it. A built-in remains a passive target without
those properties until `pointerEvents="none"` or component teardown releases
it.

### Registration signatures and native ownership

Handler normalization and native-listener ownership use private two-word
bitmask signatures over the closed `PIBBL_EVENT_DEFINITIONS` vocabulary. Bits
0-31 occupy the low word and bits 32-63 occupy the high word; module loading
fails rather than aliasing definitions if the vocabulary exceeds 64 entries.
The signed numeric representation of bit 31 is immaterial because words are
treated only as opaque 32-bit sets.

Each target/listener retains three distinct forms of state:

- a fresh normalized callback object for current bubble/capture dispatch;
- a logical handler mask pair used for handler-presence/liveness checks; and
- required and last-reconciled native mask pairs used for listener ownership.

Module initialization precomputes each author-facing event prop's normalized
key, logical bit, and complete native prerequisite mask. The render path visits
only enumerable props supplied by the handler object, ignores unknown props by
metadata lookup, copies current callback values, and ORs precomputed words.
Bubble and capture callbacks retain separate normalized keys but share the same
logical/native bits. Cursor movement/exit requirements use a separate
precomputed mask.

Equal required and reconciled pairs make ownership reconciliation two integer
equality checks with no native-hub work. Changed ownership uses
`previous & ~next` for removals and `next & ~previous` for additions, then
walks only the set bits. Removals release before additions acquire. Explicit
release resets the reconciled pair to zero, executes every exact release
closure once, and removes the registration's release map so reviving a stable
hook slot reacquires its complete current signature.

Masks never encode callback identity and never replace normalized callback
lookups during propagation. Callback objects refresh on every render even when
their type signatures are equal, preserving latest-closure behavior. Masks are
transient internal values: they are not serialized, exposed publicly, or a
cross-version bit-position contract. The complete rationale and maintenance
rules live in the [event-registration hot-path design](../superpowers/specs/2026-09-23-event-registration-hot-path-design.md).

The Three input bridge owns no logical target or focus candidate merely by
connecting a control. Registered Three targets acquire ordinary Pibbl event/focus
resources only through the committed layer interaction snapshot. During a
gesture, capture remains owned by the receiving live event node and root
dispatcher; adapter teardown clears bridge-local state and makes retained
callbacks inert.

The root dispatcher snapshots one temporary ancestry route, then re-reads each
node's liveness and current handler before invocation. Removal during dispatch
therefore remains effective, route additions wait for the next event, and one
thrown handler cannot prevent later handlers or final cleanup. Layers share the
root event state and use one explicit parent-component bridge solely while
constructing temporary paths; teardown clears that bridge before recursively
disposing the child instance. External render layers use the same ownership
direction for their nested resolver and Canvas parent bridge. Only a
successfully rendered, settled, transferred, and parent-composited candidate
commits its bitmap, target records, and focus metadata together.

Native acquisition includes logical prerequisites: boundary handlers own the
movement/root-exit inputs that derive their events; click/double-click own
down/up history; touch handlers own start and terminal inputs needed to retain
and release contacts; drag boundary handlers own establishment, movement, and
terminal inputs; active pointer capture owns got/lost notifications. Cancellable
touch and wheel listeners are non-passive. Reference counts still collapse all
requesters to one actual Canvas listener per type.

A root `OffscreenCanvas` has an event root but no native DOM listener hub.
Managed offscreen Canvas layers and external render layers under an HTML Canvas
share that root's listeners and state. Root disposal clears every form without
relying on garbage collection. A render-layer generation is selectable only
after its bitmap and interaction metadata commit together; replacement or
removal clears the prior generation. External rendering, settlement,
bitmap-transfer, and Canvas-composite errors all release their uncommitted
target participation through the same idempotent candidate path; no error may
publish event state for a bitmap that did not commit.

`Teardowns.execute()` closes before invoking a stable snapshot. Every entry is attempted once; an exception is reported without stopping the remaining releases. Repeated execution and resources added after closure are safe.

## Deterministic evidence

Test-only `RuntimeDiagnostics` tracks acquired, released, live, and duplicate-release counts for native listeners and every discovered root/layer event Set. It also tracks requested, canceled, completed, and pending animation frames. The observer remains outside runtime build entries and package exports.

The TFC-03 suites prove:

- a complete settled snapshot is unchanged after 1,000 real rerenders;
- handler replacement preserves counts and invokes only the new generation;
- removed props and subtrees leave no registry entries or ghost calls;
- nested layer removal returns instances and all root-visible resources to the root baseline;
- abort and no-signal disposal release everything, including before the first frame;
- repeated and stale cleanup cannot disturb a remount;
- a thrown handler is reported while later observers and cleanup continue;
- acquired minus released always equals live, and final live/duplicate-release counts are zero.
- an update-time signal cannot dispose the existing mount, while its original mount signal still can.

TFC-04 and TFC-05 additionally prove that removing a live layer returns parent paint entries, root observers, root cursor defaults, hover/cursor state, and offscreen instances to their exact pre-layer ledgers with no ghost calls.

The DOM-aligned event suites additionally prove lazy per-type acquisition,
grouped target/listener replacement, prerequisite ownership, pointer-capture
transactions, retained touch and drag cleanup, cross-layer propagation,
pathless legacy observer ordering, and exact zero state after disposal.

Render-layer and Three integration suites additionally prove passive blocking,
registered-target acquisition, layer opt-out, bitmap/interaction generation
replacement, nested propagation, pointer capture/focus/cursor cleanup, controls
input teardown, candidate rollback, and exact target/resolver/bridge baselines
after failure, removal, and disposal.

## Deliberate boundary

TFC-03 established event-resource and frame ownership. TFC-04 replaced all-hit dispatch with the topmost logical-target model, and TFC-05 replaced layer target bridges with root-owned composed resolution while preserving the same exact-release ledgers. TFC-07 still owns broader runtime stress and asynchronous resources such as image loading; the current reaction cleanup contract lives in the runtime ownership record.

TFC-07 completed that broader proof in the [runtime resource ownership contract](./runtime-resource-ownership.md), including component capability checks, single-owner cleanups, image generations, fully rendered mount/dispose stress, and temporary render-global restoration.
