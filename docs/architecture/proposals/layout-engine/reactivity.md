# Reactive layout and scheduling design

Status: proposed, 2026-10-21. This document makes the user's requirement for deep
reactivity integration a release requirement. It extends, rather than replaces,
the [existing signal and scheduler contract](../../../design/signals-and-scheduling-contract.md).
See the [architecture](./design.md) and [integration plan](../../../project-plans/layout-engine-rework-proposal.md).

## What efficiency means here

The best opportunity is to avoid work before trying to make that work faster.
The target update path is:

```text
changed signal
  → validate dependent computed values
  → resolve affected receiver inputs
  → compare normalized values
  → stage only changed layout/measurement fields
  → solve only invalidated layout dependencies
  → publish only changed geometry
  → repaint only the existing necessary Canvas/Layer boundaries
```

An unchanged computed result stops before receiver work. A changed style object
whose normalized geometry fields are equivalent stops before WASM. A changed
layout input whose resulting geometry is unchanged stops geometry propagation.
A paint-only update skips layout but still paints the affected immediate root or
explicit Layer. A text change can require paint even when its measured dimensions
are unchanged. These are different forms of equality and must not share one
undifferentiated dirty flag.

Do not promise that changing one leaf is always O(1). A leaf's intrinsic size can
change its parent's size, wrap later siblings, change ancestor constraints, and
resize an external layer. The objective is to visit the **actual dependency cone**
and stop at proven boundaries, not to assume every subtree is isolated.

## Reuse the existing reactive graph

Pibbl already has lazy consumers, reusable dependency edges, dynamic computed
dependencies, synchronous batching, and receiver-input provisions. Build on
`signals/edge.ts`, `signals/render-consumer.ts`, and `signals/input-provision.ts`.
Do not mirror signals in WASM, attach a separate observer for every style property,
or invent a second computed/observer API.

Extend the exact receiver's internal consumer so an edge records which input
groups read it. One source/receiver pair has one subscription with a combined
role mask; the same signal used for both width and fill does not acquire two
independent source leases. The role metadata is replaced with successful
dependency collection and rolled back on failure along with the edges.

| Input group         | Examples                                                        | Initial invalidation                 | Downstream work after comparison                                                            |
| ------------------- | --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Structure           | Conditional children, keyed child list, pure layout description | Re-evaluate the owning description   | Reconcile affected topology; solve changed regions; paint as needed.                        |
| Layout              | Width, basis, margins, direction, gaps, track definitions       | Mark receiver layout inputs pending  | Resolve changed fields, invalidate layout dependencies, solve.                              |
| Measurement         | Text, font, wrap rules, image natural size                      | Advance measurement-content revision | Remeasure demanded constraints; propagate changed intrinsic contributions; repaint content. |
| Paint               | Fill, stroke color, opacity, filter parameters                  | Mark receiver presentation pending   | Paint/composite without solver work unless a documented field also affects geometry.        |
| Placement/transform | Translation, rotation, parent placement                         | Mark transform/ledger inputs pending | Update composition and targeting; reuse layout and eligible bitmaps.                        |
| Interaction         | Handler, cursor, pointer policy                                 | Mark event metadata pending          | Update via the existing publication path; avoid solving geometry.                           |

This table is schema-driven. A custom primitive's unclassified input conservatively
invalidates its declared measurement and rendering; authors may declare narrower
effects through typed capability metadata once the built-in implementation proves
the model. Unknown application objects are not recursively scanned for signals.

Some properties have multiple roles. Stroke width may affect a particular
primitive's measured ink; it still is not universally a layout border. A text
alignment input may affect painting but not its advance width. The declaring
primitive, not a global name heuristic, supplies the classification.

### Receiver ownership and adoption

When a parent prepares a child's style before the child evaluates, it collects
dependencies under that child's stable receiver identity and records a staged
binding. On success, the receiver adopts the bindings once. On abort, removal,
or an unclaimed prepared description, the provision is released. Parent layout
depends on the child's **numeric intrinsic contribution**, not on taking ownership
of all the child's signal reads.

Existing plain values still allocate no signal consumer, source edge, wrapper
signal, or per-field reactive object. A static node may require a layout record,
but that is not a reason to allocate a reactive subscriber.

Explicit application `.get()` remains significant:

```tsx
// Fine-grained declared input: Flex owns this width binding.
<Flex style={{ width: sidebarWidth }} />

// Ordinary function owns the explicit read and must evaluate normally.
<Flex style={{ width: sidebarWidth.get() }} />
```

Do not rewrite the second form or silently memoize an arbitrary component because
its previous return value looked declarative. Direct Canvas drawing and hook
behavior remain valid.

### Whole-object and responsive inputs

A signal holding an entire style object marks that receiver's style pending.
Resolve the supported shallow schema, compare normalized fields, and emit only
actual changes. Do not treat a new object identity as proof that every layout
field changed. Conversely, do not assume an in-place mutated plain object is
unchanged when its owning component explicitly renders again.

Responsive branches track the signal and definite query-basis inputs actually
used by the selected branch. A branch switch atomically replaces its dependencies.
Intrinsic self-query cycles remain errors until a separate, precisely specified
containment contract is introduced. A generic “solve until stable” loop would
hide oscillation and undermine predictable performance.

## Two graphs, one set of reactive subscriptions

There are necessarily two kinds of dependency, but only one signal system:

1. The existing JavaScript signal graph determines which declared values or
   component descriptions have changed.
2. The WASM layout graph records numeric dependencies: child intrinsic size into
   parent sizing, parent constraints into child layout, baseline participation,
   percentage bases, direction, and containing-block relationships.

WASM receives values and monotonically increasing revisions, never signal objects.
It does not notify applications or schedule frames. JavaScript performs one
batched mutation submission per affected arena/solve boundary, subject to
measurement-driven continuation.

Each layout node has separate revisions for normalized style, topology,
measurement content, computed intrinsic contribution, allocated geometry, and
policy. This avoids invalidating an entire tree when one color changes and avoids
reusing a measurement solely because width and height happen to match.

Recommended cache key inputs:

- Node generation, relevant normalized style version, child sequence revision.
- Constraint values **and their modes**, owner percentage basis, resolved direction.
- Measurement content/font/shaping revision and measurement purpose.
- Baseline-provider revision where relevant.
- Solver policy/compatibility profile revision.

Keep snapping/presentation caches separate from intrinsic measurement when possible.
A device-pixel-ratio change should not remeasure logical text unless the selected
measurement provider actually depends on it.

## Dirty propagation and stopping rules

On a layout-input change, mark the node's relevant local computation invalid.
Propagate upward only through dependencies whose intrinsic contribution may change.
A fixed-size, layout-contained node can stop outward size propagation while its
own descendants still need solving. Propagate new constraints downward only when
those constraints differ from the child's cached inputs.

Do not infer containment from clipping, from `Layer`, or merely from a declared
width. Auto height, baseline, overflow reporting, percentages, and absolute
descendants can still depend on internal state. Track the relevant dependency
categories or use a conservative fallback until the narrower rule has fixtures.

After solving, compare raw geometry and intrinsic contributions. If they are
equivalent under the exact semantic representation, avoid advancing those output
revisions. Numerical tolerances belong in external comparison tests, not a broad
runtime epsilon that can swallow a series of small animated changes.

When the output of a node changes, invalidate consumers of that output, not every
consumer of its source signal. The JS adapter receives a compact list of changed
boxes plus affected overflow/baseline results. It maps these to existing placement,
Layer sizing, and event ledger owners.

## Frame lifecycle

Retain Begin, Advance, Commit, Plan, Render, Complete. The integration changes work
inside these phases and the dependency ordering within Render; it does not add a
second host frame or an asynchronous solver loop.

| Phase    | Proposed layout participation                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Begin    | Capture eligible revisions, root replacements, and resource-ready notifications.                                                                                                                                              |
| Advance  | Animation and physics stage values as today; no active layout mutation.                                                                                                                                                       |
| Commit   | Publish staged values together; deduplicate input invalidations.                                                                                                                                                              |
| Plan     | Validate computed values first, resolve pending receiver bindings whose descriptions are known, compare normalized values, and identify layout/measurement/paint work. No arbitrary component or resource callback execution. |
| Render   | Prepare safe descriptions, settle needed allocations, invoke opaque components at their actual source positions, solve newly exposed layout regions, paint dependency-ready Layers and compose in source order.               |
| Complete | Preflight and publish successful geometry/input/focus/HTML generations through the root transaction; release temporary preparation work; complete revisions only on success.                                                  |

The numeric solver is synchronous within admitted work. Measurements are synchronous
even when internally batched. A future worker protocol would need a separate design
for revision cancellation and frame latency; it is not assumed by this proposal.

### Why a universal pre-layout walk is unsafe

An ordinary component may use its final `useLayoutBox()`, draw into Canvas, and then
return children. Running it during Plan to discover those children would run
application code at a new time and potentially twice. Caching its drawing would
introduce a retained display list.

Instead, layout runs in **prepared regions** separated by opaque component
boundaries. A known declarative region is solved before painting its descendants.
An opaque child receives its settled outer allocation, executes once in source
order, then exposes its own region for preparation. Its descendants cannot
retroactively change the already-consumed outer allocation unless it supplied a
pure intrinsic description or measurement capability in the first place.

This gives nested intrinsic layout to declarative structure without making false
promises about arbitrary imperative functions. It also makes the migration cost
visible: reusable intrinsically sized layout components may opt into the proposed
`defineLayoutComponent` capability.

### Layers and external renderers

The current scheduler renders dirty nested instances before ancestor composition.
A new parent width can change a nested Layer's required raster size. Rendering that
Layer using yesterday's allocation before the parent layout is solved is incorrect.

Represent the ordering explicitly:

```text
parent input resolution
  → parent allocation solve
  → child size settlement
  → child update/resize/render
  → ancestor composition
```

For already-known descriptions, schedule that dependency chain before composition.
At an opaque boundary, postpone the dependent Layer's raster until traversal has
established its allocation, then render it immediately before its bitmap is
composited. Dirty descendants still finish before their ancestor bitmap uses them.
Do not pre-render them at an old size and schedule a corrective second frame.

This requires a documented amendment to the current eager deepest-first scheduling
implementation, with nested-layer and external-renderer regression evidence. It
does not authorize executing arbitrary parent components outside source order.
Independent roots retain registration order and error isolation.

A placement-only change reuses a clean bitmap and updates composition/targeting.
A size change must apply the renderer's resize contract. If text changes but the
box does not, the bitmap still needs repainting. An invisible subtree suspends
unnecessary layout/raster work while keeping the minimal visibility dependencies
needed to reveal it correctly.

## Snapshot, feedback, and publication rules

Each solve uses a fixed input revision. No callback may mutate it, recursively
solve the same arena, or await async work. Existing signal write guards apply to
description and measurement evaluation. Writes from later event or completion
callbacks follow existing next-frame admission rules.

`useLayoutBox()` keeps its synchronous meaning: the stable, final allocation for
the current component evaluation. It does not become a live writable signal and
does not create a feedback edge into its own layout. If an inspection API later
exposes committed boxes as signals, it must publish after successful Complete and
make geometry-to-style feedback explicit; such an API is not needed for the first
release.

Stage layout output separately from committed geometry. The renderer can use the
staged generation while drawing; input dispatch and focus publication adopt it
only with the matching successful root result. Layout/measure exceptions abort
the affected transaction and release provisional dependencies and handles.

Current transaction publication invokes callbacks sequentially; it does not
provide arbitrary rollback of prior callbacks or Canvas pixels. The replacement
must add a preflight step for fallible geometry/ledger preparation and make final
geometry adoption nonthrowing. If HTML/resource publication fails, follow the
root's existing fail-closed cleanup contract and ensure no mismatched interactive
generation remains active. Do not claim atomic pixel rollback.

## Lifecycle and failure matrix

| Event                                | Required result                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| First mount                          | Allocate arena lazily; prepare bindings; solve; publish only successful generation.            |
| Equal signal/computed result         | No input patch, solve, or paint solely from that equality no-op.                               |
| Dynamic dependency switch            | Adopt new edges and release obsolete ones after successful collection.                         |
| Keyed reorder                        | Preserve existing component identity; update numeric sibling sequence once.                    |
| Removal                              | Detach edges, measurement callbacks, graph nodes, and pending requests deterministically.      |
| Root replacement                     | Latest-wins under current revision rules; discard stale prepared topology.                     |
| Measurement throws                   | Abort affected region/root transaction; retain no borrowed views or provisional subscriptions. |
| WASM trap                            | Drop affected instance; no use of partial geometry; independent roots continue.                |
| Disposal during pending work         | Cancel owner work and release exactly once; retained app signals remain usable.                |
| Font/image completion after disposal | No scheduling or callback into the disposed owner.                                             |

Allocation accounting must report active nodes/edges/callbacks separately from
reserved WASM capacity. A reusable arena retaining capacity is not an active-node
leak, but unbounded growth across repeated mounts is a release blocker.

## Required efficiency receipts

Add counters to test/inspection builds, with zero or minimal production overhead:

- Input resolutions, normalized field changes, binding subscriptions/reuses/releases.
- WASM calls and bytes transferred, node creations/reuses/removals.
- Layout nodes visited, cache hits, intrinsic computations, freeze iterations.
- Measurement requests, host callbacks, cache hits, content/font invalidations.
- Geometry changes, Layer resize/raster/composite operations, root paints.
- Scheduled frames, deferred revisions, active allocations, and arena capacity.

Acceptance scenarios must show:

1. Many writes in one event batch produce one eligible frame and a coalesced input
   update, not one solve per write.
2. A pending computed that resolves equal performs zero solves and zero paints.
3. A fill-only signal change produces zero layout-node visits and zero measurement
   calls, although its Canvas boundary repaints.
4. A final-width change remeasures wrapped text at that width, in the same frame.
5. A fixed independent sibling subtree reuses its layout and measurements when
   another subtree changes, subject to actual alignment/size dependencies.
6. Parent placement-only changes reuse clean Layer bitmaps; parent size changes
   resize dependent external layers before composition, without a stale frame.
7. Reordering keyed children does not churn node handles or subscriptions.
8. Repeated mount/update/remove/dispose returns active ownership counts to baseline.

Counters prove avoided work. Controlled browser timings prove whether those
reductions improve latency. Both are required before claiming superior efficiency.
