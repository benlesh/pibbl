# CRC runtime resource ownership

Status: current implemented contract, updated for first-class signals and the
realm scheduler on 2026-09-10.

This contract extends the [event resource ownership contract](./event-resource-ownership.md) to every current non-event runtime resource. It defines deterministic ownership and release conditions; garbage collection is supporting evidence only and is never the cleanup oracle.

## Ownership table

| Resource                       | Acquisition                                   | Sole owner                                   | Release trigger                                                                            | Required postcondition                                                                                                      |
| ------------------------------ | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Teardown entry                 | `Teardowns.add()`                             | One teardown collection                      | Explicit removal or the collection's first execution                                       | It runs at most once; later execution is inert.                                                                             |
| Follower link                  | `child.follow(parent)`                        | Child collection                             | Child or parent execution                                                                  | The child closes once and detaches from the parent.                                                                         |
| Root instance and refs         | First `crc()` mount and render                | Identity-guarded controller                  | Abort or controller disposal                                                               | The exact map entry and every owned component ref are absent; a remount is untouched.                                       |
| Component refs                 | First render of one component path/key        | Component teardown collection                | Key, subtree, or root replacement; instance disposal                                       | The ref leaves the instance map after its teardown closes.                                                                  |
| `crcWhenChanged` cleanup       | Current dependency-generation callback return | That hook slot in the component collection   | Dependency change or component teardown                                                    | The previous generation cleans before the next setup and can never clean twice.                                             |
| `crcState` setter              | Hook mount                                    | Exact CRC instance plus exact component refs | Component/main teardown closure or either identity changing                                | A stale setter is a no-op and cannot mutate or schedule a frame on a replacement mount.                                     |
| Realm host frame               | First pending realm work                      | Scheduler singleton for the loaded runtime   | Host callback completion, or cancellation after no registered work remains                 | At most one host frame is pending; stale callbacks cannot publish work for removed owners.                                  |
| Image load/error handlers      | Current `Image` source generation             | That image hook generation                   | Load, error, source change, component removal, or disposal                                 | Both handlers detach, the request source is released, and late callbacks cannot publish state.                              |
| Loaded image state             | Current `Image` component refs                | Source-tagged state slot                     | Source change, component removal, or disposal                                              | Only an image tagged with the currently rendered source can draw.                                                           |
| Layer instance and paint entry | `Layer` mount/render slot                     | Layer component refs                         | Layer, ancestor, or root removal                                                           | Parent paint entry, child refs/frames, and nested layer instances release recursively.                                      |
| Filter scratch pool            | CRC instance construction                     | That CRC instance                            | Instance main teardown                                                                     | Every reusable source/result canvas and context reference is released; a remount receives a distinct pool.                  |
| Filter surface-pair lease      | Start of one active nonempty filter boundary  | Current synchronous boundary                 | Boundary `finally`, including validation/render/composite failure, or owning pool disposal | Source and result slots return together in strict LIFO order; no active pair or user reference survives.                    |
| Root surface observers         | First root mount                              | Root instance main teardown                  | Abort, controller disposal, or failed mount                                                | Resize, window-resize, and resolution-query listeners are detached; stale notifications cannot schedule the replacement.    |
| Intrinsic-size stabilization   | Backing resize that changes CSS size          | Root surface state                           | Root disposal while CRC still owns the inline value                                        | The prior inline width/height is restored without overwriting a later external style change.                                |
| Temporary render globals       | `executeRender()` entry                       | Current synchronous render                   | `finally` on success or failure                                                            | Canvas, refs, instance, contexts, seen/unseen sets, hook index, mounting flag, and clip stack return to the prior baseline. |

## Collection semantics

`Teardowns.execute()` closes before it invokes a stable snapshot. Duplicate adds collapse to one Set member, removal before execution prevents invocation, reentrant execution is inert, and a teardown added after closure runs immediately. A throwing entry is reported without preventing the remaining entries from running. Closing either side of a follower relationship closes the child once and leaves no live parent link.

Component collections already follow their instance's main collection. Hook cleanups therefore register only with their component collection; adding the same cleanup to the main collection would create two owners and a double-release path.

## Async capability rules

A state setter is a capability belonging to the exact instance and exact component-ref object that created it. Before mutating, it verifies both identities and verifies that neither teardown collection is closing or closed. This matters during component removal: teardown executes before the refs-map deletion, so map identity by itself is not sufficient.

Each `Image` `style.src` change creates a new generation. Its load and error
handlers self-detach on settlement and are detached again idempotently on
change/removal/disposal. Loaded state carries the source string; render ignores
a loaded element whose source does not equal the current style. The state-setter
identity guard is a second line of defense, not the image handler's primary
cleanup mechanism.

## Filter scratch semantics

Each instance owns one depth-indexed pool. A boundary atomically reserves the
next consecutive source/result pair in constant time; nested boundaries use the
next pair and completed siblings reuse the current pair. Capacity is exactly two
surface slots per maximum active filter depth, independent of sibling count and
the number of functions in a list. Filter capture does not create a component,
hook frame, event root, nested CRC mount, or Layer-like cache.

Fresh and resized slots are already transparent. Same-size reuse clears the
exact active source and result bitmaps, resets Canvas state and the current
path, and scrubs reference-bearing fill/stroke/filter values before the pair
becomes idle. Dimensions always match the current snapped windows rather than a
historical high-water size. Returned slots retain only their reusable canvas,
context, and target metadata—not elements, component refs, events, images,
patterns, hooks, callbacks, or user state.

Filter validation, allocation, local render-target/world-transform changes,
primitive and descendant execution, and compositing are guarded by nested
`try`/`finally` scopes. Any failure returns every acquired pair and restores
temporary renderer globals before normal render-failure teardown clears owned
component resources. Pixels painted earlier in the failing frame remain under
the general render-failure contract; the failed filter result is not composited.
The filter scopes specifically restore the current render target and world
transform to their entering values.

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

The focused filter ownership suite proves 100 sequential siblings reuse two
slots across 1,001 renders, three nested boundaries use six slots, failure
returns all active leases, disposal releases every slot, and remounting creates
a distinct pool. Structural-performance evidence proves a ten-function list
walks normalization, reverse influence, and compilation once each, executes the
primitive once, performs one filtered source-to-result draw and one
result-to-parent composite, uses no pixel readback/writeback or `ImageBitmap`,
and preserves Layer cache hits. Wall-clock thresholds and heap timing remain
diagnostic rather than correctness gates.

## Deliberate boundaries

- Browser fetch/decode internals are not exposed as a deterministic resource count. CRC owns and detaches its handlers, clears the element source, source-tags published state, and proves that late completion cannot schedule or draw.
- Heap snapshots are optional diagnostics, not a pass condition.
- TFC-08 completed the full component type/key/hook-order identity semantics. TFC-07 proves cleanup for an explicit key change and for replacement by two distinct root component identities; the runtime/hook contract proves the remaining identity matrix.

## Signal and scheduler ownership

The realm scheduler owns the host frame, not any individual Canvas. Disposing
one root removes only that root's registration and work. A nested Layer request
marks its ancestor composition path, while the requested instance retains its
own monotonically increasing revision and completes it only after successful
work. Signal dependency edges belong to exact consumer generations, never to a
global subscription bag. The [signals and scheduling
contract](./signals-and-scheduling-contract.md) defines the six phases and
failure isolation.

| Resource                    | Acquisition                                               | Sole owner                                   | Release trigger                                                                          | Required postcondition                                                                                         |
| --------------------------- | --------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Component signal consumer   | First explicit signal `get()` during component evaluation | Exact component refs and consumer generation | Successful dependency replacement, component removal, failed-render cleanup, or disposal | Every prior signal edge detaches; invalidation cannot schedule a removed generation.                           |
| `crcSignal` hook identity   | Hook mount                                                | Exact component hook slot                    | Hook/component/root teardown                                                             | Render-consumer edges detach; a retained signal cell remains independently readable and writable.              |
| Computed source edge        | First observer of an evaluated computed                   | Exact computed node while observed           | Dependency replacement or loss of the final observer                                     | Source observer leases release recursively; retained unobserved nodes validate dependency versions on `get()`. |
| Computed Plan validation    | Observed computed invalidation                            | Exact computed node                          | Successful validation or loss of every observer                                          | At most one pending validation remains; equal output does not dirty downstream consumers.                      |
| Root scheduler registration | First root mount                                          | Exact live root                              | Abort, controller disposal, or failed-mount cleanup                                      | Root and pending root work are absent without disturbing another root's registration or work.                  |
| Instance render revision    | Root or nested-instance render request                    | Exact requested instance                     | Successful completion of that revision or instance teardown                              | Completed revision advances only after success; failed friend work remains available for retry.                |
| Friend renderer owner/work  | Exact component evaluation or staged friend request       | Exact owner scope or renderer transaction    | Owner-scope `finally`; staged success, retry restoration, or renderer teardown           | Owner identity never escapes evaluation; failed work skips dependent stages and restores only its transaction. |
