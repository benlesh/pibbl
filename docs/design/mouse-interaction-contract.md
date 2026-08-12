# CRC mouse interaction contract

Status: approved and implemented as of 2026-08-11. TFC-04 verified the root-Canvas rules; TFC-05 verified intrinsic coordinates, transforms, clip intersections, and global layer paint order.

This document defines the behavior implemented and verified by TFC-03 through TFC-05. The executable source of truth for sequence examples is `MOUSE_CONTRACT_CASES` in `packages/scenarios/src/mouse-contract.ts`; the manual explorer and headless contract suite consume that same table.

## Evidence and interpretation

CRC regions are synthetic targets inside one DOM Canvas. Native browser behavior therefore supplies user expectations for event order, hit selection, mutation, and activation, but cannot supply Canvas-only rules such as layer paint order or clipping.

Evidence priority:

1. traces measured in the TFC-01 native Chromium reference;
2. current W3C Pointer Events, UI Events algorithms, CSSOM View, and WHATWG DOM;
3. the smallest explicit CRC rule needed where no DOM analogue exists.

The platform evidence is consistent on the important shape: mouse events target the deepest/topmost hit, boundary transitions precede the associated move, differing down/up targets click their nearest common inclusive DOM ancestor, removed targets do not receive later activation events, and listener dispatch isolates thrown exceptions. CRC intentionally adopts the coherent subset its current event type can express.

## Terms

- **Interactive region:** a CRC path registration with at least one mouse handler or cursor style. Its identity is the owning mounted component plus that interaction-path slot, not a particular handler function.
- **Logical target:** the one interactive region selected for a native mouse event.
- **Paint order:** the order in which CRC composites interactive paths, including layers. Later paint is visually above earlier paint.
- **Live target:** a region still owned by the current rendered tree with the handler generation selected for dispatch.
- **Root coordinates:** coordinates in the intrinsic Canvas width/height space exposed as `CRCMouseEvent.x/y`.
- **Boundary transition:** logical `mouseover` or `mouseout` between CRC regions. These names do not imply DOM bubbling.

## Target selection

CRC resolves exactly one logical target for each native event. Region identity is independent of the native event type: an upper region with only `onClick` still occludes a lower region with `onMouseMove`. Replacing handlers without replacing the keyed/tree-slot component preserves identity.

1. Enumerate interactive candidates in reverse paint order.
2. Apply the complete rendered transform and require the point to pass every active ancestor clip.
3. A filled path hits through `isPointInPath`; a stroked path hits through its configured `lineInteractionWidth`.
4. The first hit wins. Earlier overlapping siblings do not receive the event.
5. A later layer participates in the same paint order and may win over root or earlier-layer content.
6. Nested groups do not create implicit event ancestors. The deepest painted interactive child is the target.
7. Cursor selection uses this same target. It must not run a separate “first cursor handler to write” policy.

Purely visual paths with no handler or cursor do not become synthetic targets. Conversely, hit eligibility follows the configured interaction geometry rather than rendered opacity: a configured transparent fill is still a fill hit area, and `alpha: 0` does not disable an interaction. A path with neither a fill hit area nor a positive stroke interaction width is not hittable. `lineInteractionWidth` changes only stroke geometry, never candidate priority.

The public `crcEvent` hook with no path is explicitly a Canvas-wide observer, not another geometric region. It runs once for its matching native event after any target-bound callback plan and does not affect logical target or cursor selection. Multiple no-path observers retain registration order. This preserves the existing whole-Canvas use case without turning overlap into implicit propagation.

Likewise, `crcCursor` with no path is a Canvas-wide fallback rather than a geometric target. The last live default wins when no targeted region supplies a cursor. Entering a targeted cursor region temporarily overrides it; leaving or removing that region restores the current fallback. CRC clears only the exact inline style it owns, so an external style change is not overwritten. Pointer-presence state is tracked independently from CSS ownership so fallback replacement during a settled rerender reconciles immediately even when the registry is briefly empty.

DOM ancestors learn about child input through a separate propagation model. CRC has no `target`, `currentTarget`, phase, or propagation-control API, so invoking every geometric hit would not be a faithful approximation. Capture, bubbling, `stopPropagation`, `preventDefault`, and pointer capture are explicit non-goals.

## TFC-04 implementation boundary

One stable interaction-region slot owns all eight mouse handlers and its optional cursor for a rendered path. Rerender mutates that slot in place, then refreshes its reverse-paint-order position without changing logical identity. Removing the component or its last interactive property releases the region and any hover, activation, or cursor state it owns.

Pathless observers remain ordered per-type Sets outside the target registry. A public `crc()` rerender requested by a handler settles on the next animation frame, so the current dispatch plan completes before the new tree is visible. Narrow dispatcher tests separately prove the synchronous rule for direct live-registry mutation: removed callbacks/targets are skipped, newly added callbacks wait for the next native event, and a reported exception does not stop the remaining plan.

## TFC-05 composition boundary

One root dispatcher owns interaction state across the root Canvas and every nested layer. Each Canvas instance retains local paint entries; layer entries compose their child entries into the root order at the exact `drawImage` position. Target resolution walks that composition in reverse paint order, applies every accumulated transform, clip, and layer bound, and returns the stable leaf-region identity. Layers therefore do not double-dispatch, create independent hover state, or compete for the cursor.

## Movement and boundary order

One native `mousemove` performs one target resolution, compares it with the previous live target, and emits:

| Previous target     | New target              | Approved CRC sequence                                                           |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------- |
| none                | A                       | `mouseover(A, logicalRelated=canvas-background) → mousemove(A)`                 |
| A                   | A                       | `mousemove(A)`                                                                  |
| A                   | B                       | `mouseout(A, logicalRelated=B) → mouseover(B, logicalRelated=A) → mousemove(B)` |
| A                   | Canvas background       | `mouseout(A, logicalRelated=canvas-background)`                                 |
| A                   | outside the root Canvas | `mouseout(A, logicalRelated=outside-root)` once, then clear target              |
| none after re-entry | A                       | `mouseover(A, logicalRelated=outside-root) → mousemove(A)`                      |

Exit always precedes entry, and every boundary transition precedes movement. Moving between overlapping shapes still targets only the topmost winner.

`CRCMouseEvent.originalEvent.relatedTarget` is the DOM Canvas relationship and cannot represent intra-Canvas regions. The oracle records `logicalRelatedTarget` as diagnostic route metadata, but approved public CRC traces leave related target unobservable. This plan does not expand the public event type; public related-target support remains a future API decision.

### Decision on the four disputed ordering expectations

The historical untracked event test named by the plan is no longer present. The baseline recorded four failing instances of the same entry-order disagreement—current CRC emitted movement before entry—across fill/stroke/interaction-width geometry variants. The exact deleted cases cannot be reconstructed more strongly. The approved oracle therefore covers fill, stroke, and expanded interaction-width hits explicitly and requires `mouseover → mousemove` for each. TFC-01 independently proves the same defect on entry and region switching. These are implementation defects for TFC-04, not reasons to weaken this contract.

## Buttons and activation

### Down and up

`mousedown` and `mouseup` independently target the topmost live region at their own coordinates. Button and buttons values come from the native event unchanged.

### Primary click

A trusted native click invokes a CRC region's `onClick` only when:

- the preceding primary down resolved to that region;
- the corresponding primary up resolved to the same still-live region; and
- the click event still resolves to that region.

The browser determines normal click hysteresis. In the executable reference Chromium fixture, leaving A for Canvas background and re-entering A before release still produces `click(A)` when down, up, and the generated click all resolve to that same live target. CRC preserves that measured behavior; it does not make every intermediate `mouseout` an independent cancellation signal. Down on A/up on sibling B still produces no CRC region click. Native DOM may click the siblings' nearest common ancestor, but CRC has no region-propagation ancestor to receive it.

If the down target is removed, up targets whatever is now topmost and no click is delivered to the removed region. Programmatic or keyboard-dispatched Canvas clicks without the trusted down/up sequence are not a supported region-activation path in this plan.

### Double click

The reference sequence is:

`down(A) → up(A) → click(A) → down(A) → up(A) → click(A) → dblclick(A)`.

`onDblClick` requires two successful clicks on the same still-live region.

### Secondary/context menu

Each native `mousedown`, `contextmenu`, and `mouseup` independently targets the topmost live region at that event's coordinate. Reference Chromium on macOS measured `mousedown(button=2) → contextmenu → mouseup`; that sequence is reference evidence, not a universal approved CRC order. The platform permits browser/OS differences, so CRC preserves the native sequence it receives rather than synthesizing or accepting only one universal sequence.

## Mutation and errors during dispatch

For each native event, CRC resolves the geometric target and builds the ordered logical-event sequence. Immediately before each logical `mouseout`, `mouseover`, or primary event dispatch, it snapshots the current handlers for the intended still-live target. This is intentionally per logical event, matching DOM listener invocation more closely than one snapshot for an entire native-move plan.

- Handler replacement does not affect the handler list already being invoked, but does affect the next logical event, even when that event belongs to the same native movement.
- A handler or region removed before its planned logical event is skipped. If the intended new target disappears during `mouseout`, its planned `mouseover` and `mousemove` are skipped and targeting reconciles on the next native movement.
- A region removed during `mousedown` cannot receive the later `mouseup`, `click`, or `dblclick`.
- Removing the currently hovered region clears its hover ownership. It receives no later ghost `mouseout`; the newly exposed target is reconciled no later than the next explicit movement.
- A thrown user handler is reported through the platform error channel and does not suppress the remaining planned transition/move callbacks.

This follows the useful DOM principles: dispatch works from a cloned listener list, removal remains effective, and exceptions are reported while dispatch continues. CRC does not promise DOM capture/bubble phases.

## Coordinates and geometry

Public coordinates are intrinsic root-Canvas coordinates with fractional precision. The executable oracle verifies the CSS-scaled conversion:

```text
x = (clientX - canvasRect.left) * canvas.width / canvasRect.width
y = (clientY - canvasRect.top)  * canvas.height / canvasRect.height
```

`originalEvent.clientX/Y` remain CSS viewport coordinates. CSS scaling affects this conversion. CRC render transforms affect hit testing, not the public root-coordinate values. Nested Canvas layers convert the root point through their composition transform before testing layer-local geometry.

Clips form an intersection: the point must be inside every active clip and the target path. `lineInteractionWidth` expands only that candidate's stroke hit geometry and never changes z-order. A transformed or clipped region is interactive exactly where its visible painted contract says it is.

## Approved explorer cases

The shared oracle covers:

- entry from Canvas background, stable move, sibling switch, background leave, and actual root-Canvas exit;
- overlapping siblings and nested children;
- fill, stroke, expanded interaction width, transparent/no-hit, and no-path Canvas observers;
- nested clip rejection, transformed geometry, CSS-scaled coordinates, and later-layer priority;
- same-target primary click, cross-target no-click, reference-Chromium re-entry click, and removed-down-target cancellation;
- handler replacement/removal, target removal during a move plan, and thrown-handler isolation;
- double click and a reference-browser context-menu sequence plus native-order policy.

The explorer visual target, native trace when analogous, CRC trace, gesture, and rule all come from the same data consumed by the headless suite. Canvas-specific cases are labeled instead of inventing a native comparison.

## Intentional differences from DOM

- CRC exposes one synthetic region target, not an event path.
- It does not synthesize capture/bubble phases or invoke all overlapping hits.
- A sibling down/up sequence has no CRC common-ancestor click.
- Logical related targets are diagnostic-only in this plan.
- Boundary-removal timing is normalized to stable postconditions rather than browser layout-task timing.
- No-path `crcEvent` handlers are Canvas-wide observers and run after target-bound callbacks rather than introducing a synthetic propagation phase.

## Non-goals and follow-ups

- Pointer/touch APIs, compatibility mouse suppression, pointer capture, keyboard activation, focus, and accessibility equivalents.
- Public `target`, `relatedTarget`, propagation, cancellation, or event-phase APIs.
- Cross-browser normalization of context-menu ordering.
- Performance optimization that weakens the verified contract; TFC-06 measures the implemented hot path before selecting any further optimization.

TFC-03 established resource and mutation safety. TFC-04 established ordering, topmost targeting, click identity, cursor parity, and repeatability. TFC-05 established CSS scale, transforms, clips, group/layer composition, and stroke-width geometry.

## Primary sources

- [W3C Pointer Events Level 4 — mouse event order](https://www.w3.org/TR/pointerevents/#mouse-event-order)
- [W3C Pointer Events — click/auxclick/contextmenu dispatch](https://www.w3.org/TR/pointerevents/#event-dispatch)
- [W3C Pointer Events — boundary events caused by layout changes](https://www.w3.org/TR/pointerevents/#boundary-events-caused-by-layout-changes)
- [W3C UI Events Algorithms — native mouse movement](https://www.w3.org/TR/uievents/event-algo.html#handle-native-mouse-move)
- [WHATWG DOM — listener invocation, removal, and exception isolation](https://dom.spec.whatwg.org/#concept-event-listener-invoke)
- [W3C CSSOM View — topmost-first hit-test order](https://www.w3.org/TR/cssom-view/#dom-document-elementsfrompoint)
- [W3C CSSOM View — MouseEvent coordinate extensions](https://www.w3.org/TR/cssom-view/#extensions-to-the-mouseevent-interface)
- [WHATWG HTML — Canvas paths, clipping, hit testing, and drawing images](https://html.spec.whatwg.org/multipage/canvas.html)
