# CRC runtime resource ownership

Status: current implemented contract, updated for first-class signals,
animation, the realm scheduler, and external render-layer ownership on
2026-09-28.

This contract extends the [event resource ownership contract](./event-resource-ownership.md) to every current non-event runtime resource. It defines deterministic ownership and release conditions; garbage collection is supporting evidence only and is never the cleanup oracle.

## Ownership table

| Resource                                  | Acquisition                                      | Sole owner                                       | Release trigger                                                                            | Required postcondition                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teardown entry                            | `Teardowns.add()`                                | One teardown collection                          | Explicit removal or the collection's first execution                                       | It runs at most once; later execution is inert.                                                                                                                   |
| Follower link                             | `child.follow(parent)`                           | Child collection                                 | Child or parent execution                                                                  | The child closes once and detaches from the parent.                                                                                                               |
| Root instance and refs                    | First `crc()` mount and render                   | Identity-guarded controller                      | Abort or controller disposal                                                               | The exact map entry and every owned component ref are absent; a remount is untouched.                                                                             |
| Component refs                            | First render of one component path/key           | Component teardown collection                    | Key, subtree, or root replacement; instance disposal                                       | The ref leaves the instance map after its teardown closes.                                                                                                        |
| `useReaction` generation                  | Successful render adopts setup; Complete runs it | Exact mounted reaction hook slot                 | Source/dependency invalidation, replacement, component teardown, or disposal               | Setup runs only after successful render; exact cleanup runs before replacement and once on final release; stale work cannot run.                                  |
| `useComputed` formula generation          | Successful render of its hook slot               | Exact mounted computed hook slot                 | Successful replacement or component/root teardown                                          | Failed candidates roll back; a retained computed keeps the last committed formula without scheduling a removed owner.                                             |
| `useConst` value                          | First successful mount evaluation                | Exact component hook slot                        | Component/root teardown                                                                    | The direct untracked value is never recreated for ordinary renders and owns no implicit cleanup.                                                                  |
| Realm host frame                          | First pending realm work                         | Scheduler singleton for the loaded runtime       | Host callback completion, or cancellation after no registered work remains                 | At most one host frame is pending; stale callbacks cannot publish work for removed owners.                                                                        |
| Image load/error handlers                 | Current `Image` source generation                | That image hook generation                       | Load, error, source change, component removal, or disposal                                 | Both handlers detach, the request source is released, and late callbacks cannot publish state.                                                                    |
| Loaded image state                        | Current `Image` component refs                   | Source-tagged state slot                         | Source change, component removal, or disposal                                              | Only an image tagged with the currently rendered source can draw.                                                                                                 |
| Layer instance and paint entry            | `Layer` mount/render slot                        | Layer component refs                             | Layer, ancestor, or root removal                                                           | Parent paint entry, child refs/frames, and nested layer instances release recursively.                                                                            |
| Render-layer surface/resources            | Mounted `defineRenderLayer` component identity   | Exact render-layer controller and component refs | Layer/ancestor removal, render-failure teardown, or root disposal                          | Surface, callbacks, scheduled work, committed generations, and resolver references release; optional application `dispose` runs once.                             |
| Render-layer candidate bitmap/interaction | Completed external render and bitmap transfer    | Current uncommitted layer transaction            | Successful parent Canvas composite/commit, or any transfer/composite failure               | Bitmap and interaction metadata commit together; an uncommitted bitmap closes and its metadata is discarded.                                                      |
| Render-layer committed generation         | Successful parent Canvas composition             | Owning layer generation                          | Successful replacement, layer removal, invalidation that discards output, or disposal      | Visible bitmap and selectable/focus metadata always describe the same generation; replaced bitmap closes once.                                                    |
| Three renderer/input bridge               | Mounted `defineThreeLayer` component             | Exact Three adapter resources                    | Layer removal, failure teardown, or disposal                                               | Adapter listeners and bridge state detach, renderer disposes, stale callbacks become inert, and application resources release through the definition's `dispose`. |
| Native filter scratch pool                | First active native-filter boundary              | Optional service on that CRC instance            | Last service release or instance main teardown                                             | Every reusable source/result canvas and context reference is released; a remount receives a distinct pool.                                                        |
| Filter surface-pair lease                 | Start of one active nonempty filter boundary     | Current synchronous boundary                     | Boundary `finally`, including validation/render/composite failure, or owning pool disposal | Source and result slots return together in strict LIFO order; no active pair or user reference survives.                                                          |
| Root surface observers                    | First root mount                                 | Root instance main teardown                      | Abort, controller disposal, or failed mount                                                | Resize, window-resize, and resolution-query listeners are detached; stale notifications cannot schedule the replacement.                                          |
| Intrinsic-size stabilization              | Backing resize that changes CSS size             | Root surface state                               | Root disposal while CRC still owns the inline value                                        | The prior inline width/height is restored without overwriting a later external style change.                                                                      |
| Temporary render globals                  | `executeRender()` entry                          | Current synchronous render                       | `finally` on success or failure                                                            | Canvas, refs, instance, contexts, seen/unseen sets, hook index, mounting flag, and clip stack return to the prior baseline.                                       |

## Collection semantics

`Teardowns.execute()` closes before it invokes a stable snapshot. Duplicate adds collapse to one Set member, removal before execution prevents invocation, reentrant execution is inert, and a teardown added after closure runs immediately. A throwing entry is reported without preventing the remaining entries from running. Closing either side of a follower relationship closes the child once and leaves no live parent link.

Component collections already follow their instance's main collection. Hook cleanups therefore register only with their component collection; adding the same cleanup to the main collection would create two owners and a double-release path.

## Async capability rules

A state setter is a capability belonging to the exact instance and exact component-ref object that created it. Before mutating, it verifies both identities and verifies that neither teardown collection is closing or closed. This matters during component removal: teardown executes before the refs-map deletion, so map identity by itself is not sufficient.

Each `Image` `style.src` change creates a new generation. Its load and error
handlers self-detach on settlement and are detached again idempotently on
change/removal/disposal. Loaded state carries the source string; render ignores
a loaded element whose source does not equal the current style. The component
identity and source-generation guards are a second line of defense, not the
image handler's primary cleanup mechanism.

## Filter scratch semantics

Each native-filter service owns one depth-indexed pool. A boundary atomically reserves the
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
transform to their entering values. A mounted `useTexture` hook separately owns
its stable producer canvas, bounded committed/spare publication pair, optional
provisional candidate, queued messages, and scheduler participant. It adopts
matching pixels and revision before observer notification, retains the last
committed pair on a failed Commit, clears an initial failed candidate, and does
not promise rollback of an already committed pair or arbitrary recipe state.
Paint and map values borrow synchronously and never own these resources;
cross-root and disposed values reject at use time. Hook disposal clears messages,
invokes the recipe disposer once, and zeros producer and publication canvases.
The first non-identity displacement pass creates one root-tree GPU service;
nested Layers borrow it and final borrower release removes its cached map uploads,
context listeners, processor, and scratch targets. A map upload is keyed by the
borrowed resource identity and committed revision, and remains only while a
committed borrower still references that resource. Context loss releases GPU
resources and invalidates that cache without disposing the service. Context
restoration schedules one coalesced root update for its live borrowers; their
next render recreates resources and uploads their committed maps. Native-only
and zero-strength paths acquire no GPU service.

## External render-layer transaction semantics

One mounted render layer owns one persistent `OffscreenCanvas`, application
resource value, controller, optional interaction resolver, and at most one
committed bitmap/interaction generation. One dirty frame runs successful prop
update and resize adoption, external rendering, optional interaction settlement,
bitmap transfer, and parent Canvas composition.

Only successful parent composition commits the bitmap and interaction metadata
together and closes the previous bitmap. Render, settlement, transfer, or
composite failure publishes no partial generation; an uncommitted bitmap closes.
A clean layer may composite its existing generation without rerunning the
external renderer.

Core owns the surface, scheduler entry, commit transaction, and resolver. The
application owns the resource value returned by `create()`; its optional
`dispose()` callback must release renderer-specific resources. The Three
adapter additionally owns its `WebGLRenderer` and input bridge, always disposes
both, and then invokes the application's cleanup. Garbage-collection timing is
not an ownership or release mechanism. See the [render-layer and Three.js
contract](./render-layer-and-three-contract.md).

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

The focused render-layer and Three ownership suites prove exact surface,
renderer, input bridge, bitmap, interaction/focus generation, scheduled-frame,
and component-ref baselines through candidate commit/rollback, replacement,
injected failure, removal, root disposal, and remount. Structural checks cover
one lifecycle render and interaction settlement per dirty generation, one
bitmap transfer per update, constant-time clean cache hits, one Canvas
composite, no default pixel readback/ID pass, and exact bitmap/renderer closure.

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
failure isolation. Animation definitions and programs own no clock or runtime
registration. One mounted playback hook slot owns its controller, scheduler
registration, commands, milestone/error callbacks, and current evaluator or
stepper state; one accepted run owns all reachable output writer leases.
Finish, cancel, failure, explicit replacement, or teardown releases the exact
applicable owners. Replacement preflights before displacement and remains
provisional until Commit, and rejected Commit restores prior ownership without
publishing partial values or skipping replay work. The [animation
contract](./animation-contract.md) provides the complete ownership ledger and
postconditions.

| Resource                              | Acquisition                                                                             | Sole owner                                                          | Release trigger                                                                                                | Required postcondition                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component signal consumer             | First explicit or declared-input signal read during component evaluation                | Exact component refs and consumer generation                        | Successful dependency replacement, component removal, failed-render cleanup, or disposal                       | Every prior signal edge detaches; invalidation cannot schedule a removed generation.                                                                                                                               |
| Receiver input provision              | Mounted pre-evaluation layout/measurement signal read                                   | Exact render transaction plus receiver token                        | Adoption into the successful receiver generation; failure, abort, removal, disposal, or unclaimed cleanup      | Provisional reads never become parent dependencies and no provision or edge survives an unsuccessful transaction.                                                                                                  |
| Reaction source edge/generation       | Complete-phase setup reads a signal                                                     | Exact mounted reaction hook slot and successful setup generation    | Source replacement, cleanup, hook/component/root teardown, or disposal                                         | Reads never dirty the rendering component; previous cleanup and edges release exactly once before replacement.                                                                                                     |
| `useSignal` hook identity             | Hook mount                                                                              | Exact component hook slot                                           | Hook/component/root teardown                                                                                   | Render-consumer edges detach; a retained signal cell remains independently readable and writable.                                                                                                                  |
| Computed source edge                  | First observer of an evaluated computed                                                 | Exact computed node while observed                                  | Dependency replacement or loss of the final observer                                                           | Source observer leases release recursively; retained unobserved nodes validate dependency versions on `get()`.                                                                                                     |
| Computed Plan validation              | Observed computed invalidation                                                          | Exact computed node                                                 | Successful validation or loss of every observer                                                                | At most one pending validation remains; equal output does not dirty downstream consumers.                                                                                                                          |
| Root scheduler registration           | First root mount                                                                        | Exact live root                                                     | Abort, controller disposal, or failed-mount cleanup                                                            | Root and pending root work are absent without disturbing another root's registration or work.                                                                                                                      |
| Instance render revision              | Root or nested-instance render request                                                  | Exact requested instance                                            | Successful completion of that revision or instance teardown                                                    | Completed revision advances only after success; failed friend work remains available for retry.                                                                                                                    |
| Friend renderer owner/work            | Exact component evaluation or staged friend request                                     | Exact owner scope or renderer transaction                           | Owner-scope `finally`; staged success, retry restoration, or renderer teardown                                 | Owner identity never escapes evaluation; failed work skips dependent stages and restores only its transaction.                                                                                                     |
| Playback command/Advance registration | A control or autoplay enqueues Begin work; an accepted active run registers for Advance | Exact mounted playback hook slot and its active run generation      | Command drain/cancellation; successful pause Commit; finish, cancel, error, committed replacement, or teardown | Each command is accepted at most once; no stale generation advances; a failed Commit restores prior registration/state and requeues the control needed for retry.                                                  |
| Playback milestone/error delivery     | Advance queues milestones; Begin/control or sampling queues contextual errors           | Exact frame delivery and still-mounted playback hook slot callbacks | Complete delivery after the applicable Commit outcome, failed-Commit discard/retry, or teardown                | No application callback runs before Complete; committed milestones deliver once in stable order, one-shot acceptance errors survive an unrelated rejected Commit exactly once, and a disposed owner receives none. |
| Output writer leases                  | Accepted run before sampling, after complete preflight                                  | Exact active playback run and writer token                          | Finish, cancel, definition failure, committed replacement, or teardown                                         | Acquisition is all-or-nothing; provisional replacement publishes no cancellation before Commit, and rejected Commit restores the displaced owner/leases while releasing the contender without partial values.      |
| Evaluator/stepper activation state    | Run creation; each Advance forks state before sampling                                  | Exact active playback run and its current-frame evaluation fork     | Track/run completion, cancel, error, replacement, teardown, or frame-fork adoption/discard                     | Applied Commit adopts the fork once; failed Commit discards it and retains the prior activation/stepper state for deterministic retry; stale state cannot schedule or write.                                       |

## Renderer-independent 3D geometry ownership

Values from `@crc/core/physics/3d/geometry` are immutable application values. The
entry owns no scheduler participant, renderer resources, component bindings, or
runtime world lifecycle.

## Editable geometry snapshots

Application-owned PathGeometry holds private typed buffers and a numeric
revision. Public native conversions are independently caller-owned. CRC's
module-local WeakMap retains only the latest successful native snapshot per
live geometry; it introduces no scheduler participant, listeners, or explicit
resource leases. Historical paint/clip records retain their own native snapshot
until replacement or normal teardown. Revisions never mutate an existing native
snapshot, and a failed conversion does not replace the last successful entry.

## Component manipulation ownership

A manipulation controller owns native pointer capture, bounded source
observations, and its temporary session until a terminal event, frame removal,
component teardown, or root disposal. Release is idempotent. Teardown restores
only a preview still owned by that session and invokes no disposed callback. If
a signal write guard prevents immediate restoration, CRC queues one
generation-checked Begin cleanup record; a newer external write or later owner
generation invalidates it. See the
[component-manipulation contract](./component-manipulation-contract.md).

## HtmlBox ownership

A configured root exclusively reserves its application-owned overlay. Component
identities own persistent DIVs and AbortControllers; the root owns SVG clipping
definitions and publication snapshots. Abort fires once before removing connected
content, including partial setup/update failure. Root disposal removes owned
nodes and listeners and releases the lease. See the [HtmlBox contract](./html-box-contract.md).
