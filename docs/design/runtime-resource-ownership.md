# CRC runtime resource ownership

Status: implemented by TFC-07 on 2026-08-11.

This contract extends the [event resource ownership contract](./event-resource-ownership.md) to every current non-event runtime resource. It defines deterministic ownership and release conditions; garbage collection is supporting evidence only and is never the cleanup oracle.

## Ownership table

| Resource                       | Acquisition                                   | Sole owner                                   | Release trigger                                             | Required postcondition                                                                                                      |
| ------------------------------ | --------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Teardown entry                 | `Teardowns.add()`                             | One teardown collection                      | Explicit removal or the collection's first execution        | It runs at most once; later execution is inert.                                                                             |
| Follower link                  | `child.follow(parent)`                        | Child collection                             | Child or parent execution                                   | The child closes once and detaches from the parent.                                                                         |
| Root instance and refs         | First `crc()` mount and render                | Identity-guarded controller                  | Abort or controller disposal                                | The exact map entry and every owned component ref are absent; a remount is untouched.                                       |
| Component refs                 | First render of one component path/key        | Component teardown collection                | Key, subtree, or root replacement; instance disposal        | The ref leaves the instance map after its teardown closes.                                                                  |
| `crcWhenChanged` cleanup       | Current dependency-generation callback return | That hook slot in the component collection   | Dependency change or component teardown                     | The previous generation cleans before the next setup and can never clean twice.                                             |
| `crcState` setter              | Hook mount                                    | Exact CRC instance plus exact component refs | Component/main teardown closure or either identity changing | A stale setter is a no-op and cannot mutate or schedule a frame on a replacement mount.                                     |
| Animation frame                | `update()`                                    | Exact instance and frame ID                  | Replacement, callback completion, or disposal               | The exact frame completes or is canceled; an already-dequeued stale callback is inert.                                      |
| Image load/error handlers      | Current `img` source generation               | That image hook generation                   | Load, error, source change, component removal, or disposal  | Both handlers detach, the request source is released, and late callbacks cannot publish state.                              |
| Loaded image state             | Current `img` component refs                  | Source-tagged state slot                     | Source change, component removal, or disposal               | Only an image tagged with the currently rendered source can draw.                                                           |
| Layer instance and paint entry | `Layer` mount/render slot                     | Layer component refs                         | Layer, ancestor, or root removal                            | Parent paint entry, child refs/frames, and nested layer instances release recursively.                                      |
| Temporary render globals       | `executeRender()` entry                       | Current synchronous render                   | `finally` on success or failure                             | Canvas, refs, instance, contexts, seen/unseen sets, hook index, mounting flag, and clip stack return to the prior baseline. |

## Collection semantics

`Teardowns.execute()` closes before it invokes a stable snapshot. Duplicate adds collapse to one Set member, removal before execution prevents invocation, reentrant execution is inert, and a teardown added after closure runs immediately. A throwing entry is reported without preventing the remaining entries from running. Closing either side of a follower relationship closes the child once and leaves no live parent link.

Component collections already follow their instance's main collection. Hook cleanups therefore register only with their component collection; adding the same cleanup to the main collection would create two owners and a double-release path.

## Async capability rules

A state setter is a capability belonging to the exact instance and exact component-ref object that created it. Before mutating, it verifies both identities and verifies that neither teardown collection is closing or closed. This matters during component removal: teardown executes before the refs-map deletion, so map identity by itself is not sufficient.

Each `img` source change creates a new generation. Its load and error handlers self-detach on settlement and are detached again idempotently on change/removal/disposal. Loaded state carries the source string; render ignores a loaded element whose source does not equal the current prop. The state-setter identity guard is a second line of defense, not the image handler's primary cleanup mechanism.

## Deterministic evidence

The shared `runtime-cleanup-stress` scenario drives the same public controls manually and headlessly. Its focused suite proves:

- pending frames are canceled by abort and atomic pending-frame disposal;
- primary and secondary data images render their exact pixels, while broken, removed, superseded, and deliberately late images remain absent;
- single and nested layer removal returns instance, paint-entry, pixel, and ownership snapshots to the root baseline;
- dependency, key, component, root, abort, and disposal boundaries pair every hook setup with exactly one cleanup;
- 1,000 fully rendered mount/dispose cycles acquire 1,002 instances and release 1,001 back to one live baseline, then final disposal releases the last instance;
- the same run acquires/releases component refs exactly, completes 2,004 requested frames with none pending, and leaves eight of 8,016 native listeners live until final disposal;
- after the stress run and after final disposal, every temporary render-global slot and clip stack is at its exact baseline.

Focused unit tests additionally preserve removal-before-execution, duplicate-add, reentrant, closed-follower, cleanup-to-void, thrown-cleanup, stale-setter, source-race, error, and saved-late-callback behavior.

## Deliberate boundaries

- Browser fetch/decode internals are not exposed as a deterministic resource count. CRC owns and detaches its handlers, clears the element source, source-tags published state, and proves that late completion cannot schedule or draw.
- Heap snapshots are optional diagnostics, not a pass condition.
- TFC-08 completed the full component type/key/hook-order identity semantics. TFC-07 proves cleanup for an explicit key change and for replacement by two distinct root component identities; the runtime/hook contract proves the remaining identity matrix.
