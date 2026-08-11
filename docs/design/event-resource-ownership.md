# CRC event resource ownership

Status: implemented by TFC-03 on 2026-08-11.

This contract assigns every event-related resource to one owner and one idempotent release path. It supplements the [mouse interaction contract](./mouse-interaction-contract.md): this document governs lifetime and failure isolation, while TFC-04 and TFC-05 govern final target order and geometry.

## Public lifetime

`crc(canvas, scene, options)` returns a stable `CRCController` for the active mount:

```ts
interface CRCController {
  dispose(): void;
}
```

- Updating an already-mounted Canvas returns the same controller.
- `options.signal` is a mount option: only the signal supplied when the Canvas is first mounted owns that lifetime. A signal supplied on an update is ignored.
- `dispose()` is synchronous and idempotent.
- `options.signal` and `dispose()` enter the same central disposal path.
- A controller or signal from an old mount cannot dispose a newer mount on the same Canvas.
- An already-aborted signal produces an immediately disposed controller and schedules no render.
- Omitting `signal` is supported; the controller still owns and removes all native listeners.

Existing callers may ignore the additive return value. Retaining a controller does not keep its disposed scene instance alive; its closure releases that ownership after the first cleanup request.

## Ownership table

| Resource                      | Sole owner                             | Acquisition                            | Release trigger                                              | Required postcondition                                                                       |
| ----------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Root instance-map entry       | Mount/controller identity              | First `crc()` for a Canvas             | Matching signal/controller disposal                          | The entry is absent; a newer identity is untouched.                                          |
| Abort subscription            | Root instance main teardown            | Mount with a signal                    | Any disposal path                                            | The abort listener is detached and later abort is harmless.                                  |
| Eight native Canvas listeners | Root instance main teardown            | Root mount                             | Any disposal path                                            | Every listener is explicitly removed once, even without a signal.                            |
| Pending animation frame       | CRC instance                           | Each update                            | Replacement, callback completion, or disposal                | The exact frame identity is canceled/completed; a stale callback is a no-op.                 |
| Component/main follower       | Mounted component                      | First component render                 | Component removal or instance disposal                       | Component teardown closes once and detaches from its parent.                                 |
| Event hook binding            | One persistent component hook slot     | Render with a handler                  | Next render, missing handler, component removal, or disposal | All registry adapters from that binding are absent.                                          |
| Hover state                   | Event hook slot                        | First hover/out hook render            | Handler removal, component removal, or disposal              | State is false or unreachable; no ghost transition can fire.                                 |
| Canvas cursor style           | Cursor hook slot                       | That slot successfully sets the cursor | Rerender, pointer exit, component removal, or disposal       | Only the cursor owned by that slot is cleared.                                               |
| Root/layer registry adapter   | Event binding or child-instance bridge | Render or child mount                  | Binding cleanup or child disposal                            | The exact Set member is deleted once.                                                        |
| Offscreen layer instance      | Owning `Layer` component               | Layer mount                            | Layer/ancestor removal or root disposal                      | Child map entry, components, frames, handlers, cursor, and bridges are released recursively. |
| Layer-to-parent bridges       | Child instance main teardown           | Child mount                            | Child/layer disposal                                         | Every parent registry returns to its pre-layer baseline.                                     |
| Component refs                | CRC instance                           | Render                                 | Component removal or instance disposal                       | Removed refs run teardown and become unreachable.                                            |

## Central disposal sequence

The controller first verifies that the global Canvas entry is the exact instance it owns. A matching cleanup then:

1. cancels the currently owned animation frame, including the legal frame id `0`;
2. removes the global instance entry;
3. executes the instance's stable main-teardown snapshot;
4. lets component teardown cascade through event bindings and nested layers;
5. clears registries and component refs as a final unreachable-state guarantee.

The identity check makes stale controllers harmless. Frame callbacks also check instance identity, open teardown state, and their exact frame id before rendering, so a callback already dequeued by the browser cannot resurrect a disposed mount.

## Replacement, removal, and errors

Every `crcEvent` call owns one persistent slot containing current hover state and at most one binding cleanup. Rerender executes the old binding once, then installs the new handler closure. If a handler prop disappears, the slot remains stable but owns no registry entry. Component teardown executes the same binding path, which removes non-hover handlers and both hover/out adapters without accumulating teardown closures.

Native and layer bridge dispatch clone the current Set, verify that each planned handler is still registered before calling it, and isolate each error with `reportError`. Removal during dispatch therefore remains effective, additions wait for the next native event, and one thrown handler cannot prevent later handlers or final cleanup. `mouseTransform` is restored in `finally`.

`Teardowns.execute()` closes before invoking a stable snapshot. Every entry is attempted once; an exception is reported without stopping the remaining releases. Repeated execution and resources added after closure are safe.

## Deterministic evidence

Test-only `RuntimeDiagnostics` tracks acquired, released, live, and duplicate-release counts for native listeners and every discovered root/layer event Set. It also tracks requested, canceled, completed, and pending animation frames. The observer remains outside runtime build entries and package exports.

The TFC-03 suites prove:

- a complete settled snapshot is unchanged after 1,000 real rerenders;
- handler replacement preserves counts and invokes only the new generation;
- removed props and subtrees leave no registry entries or ghost calls;
- nested layer removal returns instances and bridges to the root baseline;
- abort and no-signal disposal release everything, including before the first frame;
- repeated and stale cleanup cannot disturb a remount;
- a thrown handler is reported while later observers and cleanup continue;
- acquired minus released always equals live, and final live/duplicate-release counts are zero.
- an update-time signal cannot dispose the existing mount, while its original mount signal still can.

## Deliberate boundary

TFC-03 owns event resources, cursor state, layer event bridges, and the frame required to make event disposal safe. TFC-07 still owns broader runtime stress and asynchronous resources such as image loading and the existing `crcWhenChanged` cleanup contract. TFC-04 replaces the current all-hit dispatcher with the approved topmost logical-target model; these ownership guarantees must remain unchanged through that redesign.
