# CRC mouse interaction contract

Status: current geometry, coordinates, cursor, and observer contract, updated
for WebGL lighting, orbit-camera, and genuine-shadow behavior on 2026-09-15.
The DOM-aligned [user-event contract](./user-events-contract.md)
superseded this document's mouse-only non-propagation, hidden related-target,
no-cancellation, no-capture, and sibling no-activation clauses on 2026-08-29.
Optional press focus and keyboard activation now defer to the implemented
[focus and keyboard-navigation contract](./focus-and-keyboard-navigation-contract.md).
The root-Canvas, `Group`, `Clip`, global-`Layer`, layout-placement, and overflow
rules continue to operate in one logical coordinate space across fitting and
device density.

This document defines the behavior implemented and verified by TFC-03 through TFC-05. The executable source of truth for sequence examples is `MOUSE_CONTRACT_CASES` in `packages/scenarios/src/mouse-contract.ts`; the manual explorer and headless contract suite consume that same table.

## Evidence and interpretation

CRC regions are synthetic targets inside one DOM Canvas. Native browser behavior therefore supplies user expectations for event order, hit selection, mutation, and activation, but cannot supply Canvas-only rules such as layer paint order or clipping.

Evidence priority:

1. traces measured in the TFC-01 native Chromium reference;
2. current W3C Pointer Events, UI Events algorithms, CSSOM View, and WHATWG DOM;
3. the smallest explicit CRC rule needed where no DOM analogue exists.

The platform evidence is consistent on the important shape: mouse events target the deepest/topmost hit, boundary transitions precede the associated move, differing down/up targets click their nearest common inclusive DOM ancestor, removed targets do not receive later activation events, and listener dispatch isolates thrown exceptions. CRC intentionally adopts the coherent subset its current event type can express.

## Terms

- **Paint target:** a default-participating Canvas path, geometry-backed WebGL object, or explicit Canvas target registration. Its identity is the owning mounted component plus that target slot, not a particular handler function.
- **Logical target:** the one live paint/custom target selected for a native mouse event.
- **Paint order:** the order in which CRC composites interactive paths, including layers. Later paint is visually above earlier paint.
- **Live target:** a region still owned by the current rendered tree with the target generation selected for dispatch.
- **Root coordinates:** coordinates in the mounted logical viewport exposed as `CRCMouseEvent.x/y`.
- **Boundary transition:** logical over/out and enter/leave events derived from
  movement between CRC targets. Over/out bubble; enter/leave do not.

## Target selection

CRC resolves at most one logical target for each native event. Target identity
is independent of the native event type: a passive upper drawing or one with
only `onClick` occludes a lower target with `onMouseMove`. Replacing handlers
without replacing the keyed/tree-slot component preserves identity.

1. Enumerate paint candidates in reverse paint order.
2. Apply the complete rendered transform and require the point to pass every active ancestor clip.
3. A filled path hits through `isPointInPath`; a stroked path hits through its configured `lineInteractionWidth`.
4. A candidate reports fixed-shape miss, block, or target. Miss continues;
   block stops without a leaf; target stops with that leaf.
5. The first non-miss result wins. Earlier overlapping siblings do not receive
   the event.
6. A later layer participates in the same paint order and may win over root or earlier-layer content.
7. Nested groups do not create implicit geometric targets. Explicit listener
   registrations on mounted ancestors can participate in propagation while the
   deepest painted interactive child remains the hit target.
8. Cursor selection uses this same target. It must not run a separate “first cursor handler to write” policy.

Canvas and WebGL drawing primitives participate by default even without a
handler or cursor. `pointerEvents="none"` releases one leaf from coordinate and
focus participation while leaving paint unchanged. Hit eligibility follows
declared geometry rather than rendered opacity: a configured transparent fill
is still a fill hit area, and zero opacity does not disable interaction. A
Canvas path with neither a fill hit area nor a positive stroke interaction
width remains a miss.

The public `useEvent` hook with no path is explicitly a Canvas-wide observer, not another geometric region. It runs once for its matching native event after any target-bound callback plan and does not affect logical target or cursor selection. Multiple no-path observers retain registration order. This preserves the existing whole-Canvas use case without turning overlap into implicit propagation.

Likewise, `useCursor` with no path is a Canvas-wide fallback rather than a geometric target. The last live default wins when no targeted region supplies a cursor. Entering a targeted cursor region temporarily overrides it; leaving or removing that region restores the current fallback. CRC clears only the exact inline style it owns, so an external style change is not overwritten. Pointer-presence state is tracked independently from CSS ownership so fallback replacement during a settled rerender reconciles immediately even when the registry is briefly empty.

DOM ancestors learn about child input only through explicit
`useEventListener` registrations. The current facade exposes logical `target`,
`currentTarget`, `relatedTarget`, phases, cancellation, and pointer capture as
defined by the user-event contract; CRC still never invokes every overlapping
geometric hit or infers an ancestor from paint.

## TFC-04 implementation boundary

One stable paint-target slot owns the complete handler set and optional cursor
for a rendered Canvas drawing. Rerender mutates that slot in place, then
refreshes its reverse-paint-order position without changing logical identity.
Removing the component or switching to `pointerEvents="none"` releases the
target and any hover, activation, focus, or cursor state it owns.

Pathless observers remain ordered per-type Sets outside the target registry. A public `crc()` rerender requested by a handler settles on the next animation frame, so the current dispatch plan completes before the new tree is visible. Narrow dispatcher tests separately prove the synchronous rule for direct live-registry mutation: removed callbacks/targets are skipped, newly added callbacks wait for the next native event, and a reported exception does not stop the remaining plan.

## TFC-05 composition boundary

One root dispatcher owns interaction state across the root Canvas and every nested layer. Each Canvas instance retains local paint entries; layer entries compose their child entries into the root order at the exact `drawImage` position. Target resolution walks that composition in reverse paint order, applies every accumulated transform, clip, and layer bound, and returns the stable leaf-region identity. Layers therefore do not double-dispatch, create independent hover state, or compete for the cursor.

A `WebGLLayer` adds one nested resolver at its Canvas bitmap position. After
outer clip/bounds rejection, it maps the root point through the inverse Canvas
world transform to layer-local coordinates and delegates to its committed scene
picker. Uncovered background reports miss whether the clear is transparent,
alpha, or opaque. Analytic lights, materials, normals, and shadow maps add no
paint candidate or hit geometry. The picker consumes geometry,
model matrix, camera, and source index from the same settled mesh submissions as
the renderer, uses one camera ray and nearest supported WebGL depth, and chooses
the later source index for an equal-depth tie. Opaque/transparent raster queues
and transparent blend order do not change this target order. Object or
complete-island `pointerEvents="none"` permits a lower WebGL or Canvas target to
win. The picker performs no `readPixels` or hidden ID render.

Layout placement is another transform in that same composition. A region inside
Absolute, Overlay, Flow, Flex, or Grid is hit at ancestor transform × placement
× child transform × local geometry. Fractional and negative offsets retain
fractional precision. Layout `overflow: "clip"` contributes the content-box clip
to the same clip stack used for paint and hit testing; visible overflow adds no
clip. Layout inside explicit `Clip` or `Layer`, and explicit clips/layers inside
layout, therefore share identical pixel and mouse geometry.

Layout never creates an implicit interaction ancestor or z-index. Direct
children remain in source paint order, including overlapping Grid and Overlay
items; reverse source order selects the topmost target. Reflow updates geometry
while preserving keyed region identity and exact resource ownership.

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

`CRCLogicalMouseEvent.relatedTarget` is the opposite opaque logical CRC target,
or `null` for Canvas background/outside-root relationships. The native
`originalEvent.relatedTarget` remains the DOM Canvas relationship. The shipped
narrow `CRCMouseEvent` used by pathless legacy observers intentionally retains
only `{ x, y, originalEvent }`.

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

The browser determines normal click hysteresis. In the executable reference Chromium fixture, leaving A for Canvas background and re-entering A before release still produces `click(A)` when down, up, and the generated click all resolve to that same live target. CRC preserves that measured behavior; it does not make every intermediate `mouseout` an independent cancellation signal. Down on A/up on sibling B can activate their deepest shared still-live `useEventListener` when it also lies on the browser click's current coordinate path. Without an explicit shared listener, no sibling-region click is emitted.

If the down target is removed, up targets whatever is now topmost and no click
is delivered to the removed region. Keyboard-generated logical clicks do not
use this trusted pointer sequence; their target, cancellation, provenance, and
Enter/Space ordering follow the
[focus and keyboard-navigation contract](./focus-and-keyboard-navigation-contract.md).

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

This follows the useful DOM principles: the route is snapshotted, current
handlers and liveness are re-read before invocation, removal remains effective,
and exceptions are reported while dispatch continues. Capture, target, and
bubble phases now follow the user-event contract.

## Coordinates and geometry

Public coordinates are root-logical coordinates with fractional precision.
CRC measures the point inside the CSS content box, converts through backing
space, and applies the inverse root surface transform:

```text
display point -> backing point -> inverse root render transform -> logical point
```

This mapping excludes borders and padding and remains correct for every fixed
fit, responsive layout, rounded backing size, and device density.
`originalEvent.clientX/Y` remain CSS viewport coordinates; the native event is
not rewritten. Component transforms and layout placements affect hit testing,
not public root-coordinate values. Nested Canvas layers convert the root point
through their composition transform before testing layer-local geometry. A
nested WebGL island then derives normalized-device coordinates and a camera ray
from its logical layer size. Selected WebGL leaves retain public root-logical
event coordinates; layer-local/NDC/ray values remain private resolver inputs. See
the [Canvas surface contract](./canvas-surface-contract.md) for the complete
projection model.

`useOrbitCamera()` consumes those root-logical pointer coordinates through its
ordinary handler bundle. At default speed each captured primary-pointer pixel
changes the matching spherical angle by `0.01` radians; its polar clamp prevents
camera flips. Authors may attach the bundle to a geometry target or a listener
ancestor, but an ancestor needs an explicit backing target to receive empty-
viewport drags. Orbit camera movement changes presentation only: committed
mesh geometry remains the source of target/focus resolution, and valid
light-space shadow depth can be reused.

Clips form an intersection: the point must be inside every active clip and the
target path. `lineInteractionWidth` expands only that candidate's stroke hit
geometry and never changes z-order. A transformed, placed, or clipped region is
interactive exactly where its visible painted contract says it is.

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

## Retained differences from DOM

- CRC exposes opaque logical targets and a temporary explicit-registration
  path, not DOM nodes or a retained event tree.
- It never invokes all overlapping hits or infers hit geometry from raster
  opacity; built-in drawing uses declared geometry by default.
- A sibling down/up sequence reaches a common ancestor only when that ancestor
  explicitly registered a matching listener.
- Boundary-removal timing is normalized to stable postconditions rather than browser layout-task timing.
- No-path `useEvent` handlers are Canvas-wide observers and run after target-bound callbacks rather than introducing a synthetic propagation phase.

## Mouse-specific non-goals and follow-ups

- Compatibility mouse suppression: CRC forwards the native pointer and mouse
  event sequences the browser supplies without duplicate synthesis. The
  optional focus policy separately deduplicates the focus default for a
  represented pointer press.
- Semantic DOM controls and accessibility equivalents remain application-owned;
  optional Canvas logical focus does not create them.
- Cross-browser normalization of context-menu ordering.
- Performance optimization that weakens the verified contract; TFC-06 measures the implemented hot path before selecting any further optimization.

TFC-03 established resource and mutation safety. TFC-04 established ordering,
topmost targeting, click identity, cursor parity, and repeatability. TFC-05
established CSS scale, transforms, clips, `Group`/`Layer` composition, and
stroke-width geometry. Current public examples construct all components with
JSX or `createElement` over branded `CRCElement` descriptors.

## Primary sources

- [W3C Pointer Events Level 4 — mouse event order](https://www.w3.org/TR/pointerevents/#mouse-event-order)
- [W3C Pointer Events — click/auxclick/contextmenu dispatch](https://www.w3.org/TR/pointerevents/#event-dispatch)
- [W3C Pointer Events — boundary events caused by layout changes](https://www.w3.org/TR/pointerevents/#boundary-events-caused-by-layout-changes)
- [W3C UI Events Algorithms — native mouse movement](https://www.w3.org/TR/uievents/event-algo.html#handle-native-mouse-move)
- [WHATWG DOM — listener invocation, removal, and exception isolation](https://dom.spec.whatwg.org/#concept-event-listener-invoke)
- [W3C CSSOM View — topmost-first hit-test order](https://www.w3.org/TR/cssom-view/#dom-document-elementsfrompoint)
- [W3C CSSOM View — MouseEvent coordinate extensions](https://www.w3.org/TR/cssom-view/#extensions-to-the-mouseevent-interface)
- [WHATWG HTML — Canvas paths, clipping, hit testing, and drawing images](https://html.spec.whatwg.org/multipage/canvas.html)
