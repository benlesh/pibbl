# CRC runtime resource ownership

Status: current implemented contract, updated for WebGL islands on 2026-09-10.

This contract extends the [event resource ownership contract](./event-resource-ownership.md) to every current non-event runtime resource. It defines deterministic ownership and release conditions; garbage collection is supporting evidence only and is never the cleanup oracle.

## Ownership table

| Resource                       | Acquisition                                   | Sole owner                                   | Release trigger                                                                                               | Required postcondition                                                                                                      |
| ------------------------------ | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Teardown entry                 | `Teardowns.add()`                             | One teardown collection                      | Explicit removal or the collection's first execution                                                          | It runs at most once; later execution is inert.                                                                             |
| Follower link                  | `child.follow(parent)`                        | Child collection                             | Child or parent execution                                                                                     | The child closes once and detaches from the parent.                                                                         |
| Root instance and refs         | First `crc()` mount and render                | Identity-guarded controller                  | Abort or controller disposal                                                                                  | The exact map entry and every owned component ref are absent; a remount is untouched.                                       |
| Component refs                 | First render of one component path/key        | Component teardown collection                | Key, subtree, or root replacement; instance disposal                                                          | The ref leaves the instance map after its teardown closes.                                                                  |
| `crcWhenChanged` cleanup       | Current dependency-generation callback return | That hook slot in the component collection   | Dependency change or component teardown                                                                       | The previous generation cleans before the next setup and can never clean twice.                                             |
| `crcState` setter              | Hook mount                                    | Exact CRC instance plus exact component refs | Component/main teardown closure or either identity changing                                                   | A stale setter is a no-op and cannot mutate or schedule a frame on a replacement mount.                                     |
| Animation frame                | `update()`                                    | Exact instance and frame ID                  | Replacement, callback completion, or disposal                                                                 | The exact frame completes or is canceled; an already-dequeued stale callback is inert.                                      |
| Image load/error handlers      | Current `Image` source generation             | That image hook generation                   | Load, error, source change, component removal, or disposal                                                    | Both handlers detach, the request source is released, and late callbacks cannot publish state.                              |
| Loaded image state             | Current `Image` component refs                | Source-tagged state slot                     | Source change, component removal, or disposal                                                                 | Only an image tagged with the currently rendered source can draw.                                                           |
| Layer instance and paint entry | `Layer` mount/render slot                     | Layer component refs                         | Layer, ancestor, or root removal                                                                              | Parent paint entry, child refs/frames, and nested layer instances release recursively.                                      |
| WebGL child instance/surface   | `WebGLLayer` mount slot                       | That `WebGLLayer` component refs             | Layer/ancestor removal, render failure teardown, or root disposal                                             | Private refs, frames, event bridge, context listeners, picker, cache, and surface references release recursively.           |
| WebGL context generation       | Successful WebGL2 context acquisition         | Owning `WebGLLayer` controller               | Context loss, layer removal, failure teardown, or disposal                                                    | No GPU handle, pick entry, or restore callback can publish through the dead generation.                                     |
| WebGL candidate bitmap/ledger  | Completed child traversal and bitmap transfer | Current uncommitted layer transaction        | Successful parent composition/commit, or any transfer/composition failure                                     | Bitmap and pick ledger commit together; an uncommitted candidate bitmap closes and its ledger is discarded.                 |
| WebGL committed bitmap/ledger  | Successful parent Canvas composition          | Owning layer generation                      | Successful replacement, context loss, layer removal, invalidation that discards output, or disposal           | Visible bitmap and selectable pick state always describe the same completed generation; replaced bitmap closes once.        |
| WebGL GPU resource/cache lease | Primitive `resources.use` or built-in cache   | Component resource slot in one context       | Dependency/context generation change, last cache release, component/layer removal, loss, failure, or disposal | The exact handle generation is released/deleted once and never crosses contexts.                                            |
| WebGL continuing-frame hook    | `crcAnimationFrame()` render                  | That component hook slot                     | Component removal, hook teardown, child/layer disposal, or root disposal                                      | Its request is released once; stale callbacks cannot schedule a replacement mount.                                          |
| WebGL transient frame state    | Start of one required island render           | Current synchronous WebGL transaction        | Transaction `finally` on success or failure                                                                   | Draw/pick ledgers, model/camera/resource scopes, backend globals, and framework GL baseline return to their entering state. |
| Filter scratch pool            | CRC instance construction                     | That CRC instance                            | Instance main teardown                                                                                        | Every reusable source/result canvas and context reference is released; a remount receives a distinct pool.                  |
| Filter surface-pair lease      | Start of one active nonempty filter boundary  | Current synchronous boundary                 | Boundary `finally`, including validation/render/composite failure, or owning pool disposal                    | Source and result slots return together in strict LIFO order; no active pair or user reference survives.                    |
| Root surface observers         | First root mount                              | Root instance main teardown                  | Abort, controller disposal, or failed mount                                                                   | Resize, window-resize, and resolution-query listeners are detached; stale notifications cannot schedule the replacement.    |
| Intrinsic-size stabilization   | Backing resize that changes CSS size          | Root surface state                           | Root disposal while CRC still owns the inline value                                                           | The prior inline width/height is restored without overwriting a later external style change.                                |
| Temporary render globals       | `executeRender()` entry                       | Current synchronous render                   | `finally` on success or failure                                                                               | Canvas, refs, instance, contexts, seen/unseen sets, hook index, mounting flag, and clip stack return to the prior baseline. |

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

## WebGL transaction and context semantics

One `WebGLLayer` owns one persistent WebGL2 `OffscreenCanvas`, context,
context-loss/restoration listener pair, private CRC child instance, and at most
one committed `ImageBitmap`/pick-ledger pair. A required render clears and
initializes framework state, traverses the child once, builds a fresh pick
ledger, and transfers one candidate bitmap. CRC composites that candidate into
the parent Canvas before publishing it. Only a successful composition commits
the bitmap and ledger together and closes the previous committed bitmap.
Transfer or composition failure closes the candidate and publishes no partial
generation; ordinary fail-closed teardown owns the previous pair thereafter.

A cache hit composites the committed bitmap and replays matching focus metadata
without reading an unpreserved WebGL buffer or executing child components.
State, retained root/props, camera, logical/backing dimensions, density,
resource/context generation, or relevant focus revision invalidates the cache.
Comparison materializes direct opaque child iterables once rather than
preflighting the component tree.

All GPU objects belong to exactly one WebGL2 context. Built-in caches use
deterministic leases, while custom primitives use
`context.resources.use(create, release, deps)`. The final release reports
whether its context generation was lost. Context loss invalidates every GPU
generation, closes/removes committed bitmap and pick state, and suppresses
stale participation. Restoration schedules one ordinary CRC frame; component
state and public descriptors recreate resources, and nothing becomes live
until a complete transaction commits. Removal/disposal detaches the listener
pair before stale restoration can schedule work.

CRC owns an explicit WebGL baseline rather than Canvas-style save/restore.
Framework setup and every custom primitive callback reinstall that baseline in
`finally`; user extension state outside the declared baseline is application
owned and must be restored by the primitive. Broad `getParameter()` snapshots,
pixel readback, and garbage-collection timing are not release mechanisms.

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

The focused WebGL ownership and performance suites prove exact context,
listener, bitmap, pick-ledger, program/shader/buffer/vertex-array, custom
resource, animation-request, backend-global, cache-lease, and component-ref
baselines through replacement, context loss/restoration, injected failure,
removal, root disposal, and remount. Structural checks cover one child traversal
and one bitmap transfer per updated island, no transfer on a cache hit, one
Canvas composite, no default pixel readback/ID pass, and exact bitmap closure.

## Deliberate boundaries

- Browser fetch/decode internals are not exposed as a deterministic resource count. CRC owns and detaches its handlers, clears the element source, source-tags published state, and proves that late completion cannot schedule or draw.
- Heap snapshots are optional diagnostics, not a pass condition.
- TFC-08 completed the full component type/key/hook-order identity semantics. TFC-07 proves cleanup for an explicit key change and for replacement by two distinct root component identities; the runtime/hook contract proves the remaining identity matrix.
