# CRC event resource ownership

Status: implemented by TFC-03 on 2026-08-11.

This contract assigns every event-related resource to one owner and one idempotent release path. It supplements the [mouse interaction contract](./mouse-interaction-contract.md): this document governs lifetime and failure isolation, while TFC-04 and TFC-05 govern final target order and geometry.

## Public lifetime

`crc(canvas, scene, config)` returns a stable `CRCController` for the active mount:

```ts
interface CRCController {
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

Existing callers may ignore the additive return value. Retaining a controller does not keep its disposed scene instance alive; its closure releases that ownership after the first cleanup request.

## Ownership table

| Resource                      | Sole owner                             | Acquisition                            | Release trigger                                               | Required postcondition                                                                    |
| ----------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Root instance-map entry       | Mount/controller identity              | First `crc()` for a Canvas             | Matching signal/controller disposal                           | The entry is absent; a newer identity is untouched.                                       |
| Abort subscription            | Root instance main teardown            | Mount with a signal                    | Any disposal path                                             | The abort listener is detached and later abort is harmless.                               |
| Eight native Canvas listeners | Root instance main teardown            | Root mount                             | Any disposal path                                             | Every listener is explicitly removed once, even without a signal.                         |
| Pending animation frame       | CRC instance                           | Each update                            | Replacement, callback completion, or disposal                 | The exact frame identity is canceled/completed; a stale callback is a no-op.              |
| Component/main follower       | Mounted component                      | First component render                 | Component removal or instance disposal                        | Component teardown closes once and detaches from its parent.                              |
| Interaction region            | One persistent component path slot     | Render with a handler or cursor        | Last interactive prop removed, component removal, or disposal | The owner-local region and paint entry are absent; root state no longer references it.    |
| Hover/activation state        | Root interaction dispatcher            | Native pointer/activation input        | Target removal, completed activation, root exit, or disposal  | Every referenced leaf region remains live, or the state is cleared synchronously.         |
| Canvas cursor style           | Cursor hook slot                       | That slot successfully sets the cursor | Rerender, pointer exit, component removal, or disposal        | Only the cursor owned by that slot is cleared.                                            |
| Pathless observer/default     | Hook slot, registered on root instance | Render without an interaction path     | Rerender, component removal, layer removal, or disposal       | The exact root Set member is deleted once, including when declared inside a layer.        |
| Layer composition paint entry | Owning `Layer` component               | Layer draw slot                        | Layer/ancestor removal or root disposal                       | The parent paint entry is absent and cannot resolve a child target.                       |
| Offscreen layer instance      | Owning `Layer` component               | Layer mount                            | Layer/ancestor removal or root disposal                       | Child map entry, components, frames, regions, and nested layers are released recursively. |
| Component refs                | CRC instance                           | Render                                 | Component removal or instance disposal                        | Removed refs run teardown and become unreachable.                                         |

## Central disposal sequence

The controller first verifies that the global Canvas entry is the exact instance it owns. A matching cleanup then:

1. cancels the currently owned animation frame, including the legal frame id `0`;
2. removes the global instance entry;
3. executes the instance's stable main-teardown snapshot;
4. lets component teardown cascade through event bindings and nested layers;
5. clears registries and component refs as a final unreachable-state guarantee.

The identity check makes stale controllers harmless. Frame callbacks also check instance identity, open teardown state, and their exact frame id before rendering, so a callback already dequeued by the browser cannot resurrect a disposed mount.

## Replacement, removal, and errors

Every rendered interaction path owns one persistent region slot containing all current mouse handlers and its optional cursor. Rerender updates that region in place and refreshes its local paint position without changing logical identity. If the last interactive prop disappears, component teardown removes its owner-local region and paint entry and clears any root hover, activation, or cursor state that still references it.

The one root dispatcher snapshots each planned callback set, verifies that its intended leaf region remains live before calling it, and isolates each error with `reportError`. Removal during dispatch therefore remains effective, additions wait for the next native event, and one thrown handler cannot prevent later handlers or final cleanup. Layer target bridges no longer exist: root resolution recursively composes owner-local paint entries, transforms, clips, and layer bounds while preserving the stable leaf identity.

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

## Deliberate boundary

TFC-03 established event-resource and frame ownership. TFC-04 replaced all-hit dispatch with the topmost logical-target model, and TFC-05 replaced layer target bridges with root-owned composed resolution while preserving the same exact-release ledgers. TFC-07 still owns broader runtime stress and asynchronous resources such as image loading and the existing `crcWhenChanged` cleanup contract.

TFC-07 completed that broader proof in the [runtime resource ownership contract](./runtime-resource-ownership.md), including state-setter capability checks, single-owner change cleanups, image generations, fully rendered mount/dispose stress, and temporary render-global restoration.
