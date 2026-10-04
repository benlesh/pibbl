# CRC user-event contract

Status: current implemented contract, updated for external render-layer and
Three.js interaction on 2026-09-28.
Focus integration is governed by the implemented
[focus and keyboard-navigation contract](./focus-and-keyboard-navigation-contract.md).

This document defines the public event behavior shared by built-in drawing
components, `useEventTarget`, `useEventListener`, and the legacy `useEvent`
hook. The executable public integration oracle is the
`interaction-trace-lab` scenario; focused event suites retain exhaustive
family, geometry, mutation, and ownership matrices.

This contract supersedes the old mouse-only statements that CRC had no event
path, propagation control, logical related targets, cancellation, pointer
capture, or common-ancestor activation. The target geometry, root-logical
coordinate, cursor, layer paint-order, and pathless-observer rules retained in
the [mouse interaction contract](./mouse-interaction-contract.md) still apply.

## Public registration model

Canvas drawing components (`Rectangle`, `Circle`, `Ellipse`, `Arc`, `Wedge`,
`Polygon`, `RegularPolygon`, `Star`, `Path`, `Line`, `HorizontalLine`,
`VerticalLine`, `SvgPath`, `Text`, and `Image`) accept DOM-style `onX` and
`onXCapture` props. Each owns one logical target whose path is its explicit
interaction geometry when `pointerEvents` is `"auto"`, including when it has no
handler, cursor, or focus option. A passive painted object can therefore
occlude a target underneath. `pointerEvents="none"` removes it from coordinate
resolution while leaving paint unchanged.

An external render layer publishes one committed nested resolver.
`pointerEvents="none"` disables that complete resolver. Its interaction
snapshot distinguishes a registered logical target, a blocking visual hit, and
a miss; a renderer-specific object becomes a CRC target only when the snapshot
registers it.

`useEventTarget(handlers, options)` creates one grouped custom target. Its
required `Path2D`, fill/stroke hit options, captured render transform, clips,
and paint-ledger position are explicit; CRC never infers a custom component's
geometry from its returned descendants. Rerender replaces handlers and
geometry in the same hook slot without replacing target identity.

`useEventListener(handlers)` creates one propagation participant on the
current component. It owns no geometry, never wins hit testing, and never
becomes a focus candidate merely by listening. A listener can nevertheless be
the logical target of common-ancestor activation or pointer capture, matching
its role on a derived event path.

Authors construct these descriptive component values with JSX or
`createElement`; platform values are not callable factories. All three event
surfaces use public exports from `@crc/core`. Internal source or
`@crc/core/lib/*` imports are unsupported. CRC does not inspect arbitrary
custom-component props, hoist descendant handlers, create a widget
abstraction, or retain drawing commands.

The child-bearing `Group`, `Clip`, `Layer`, `Absolute`, `Overlay`, `Flow`,
`Flex`, and `Grid` built-ins accept handler props with `useEventListener`
semantics. These structural values add listener ancestry only: they have no
independent rectangle or conceptual-bounds target, and empty space does not
select them. A render layer can explicitly make empty space target its own
handlers with `missBehavior="target-layer"`.

## Event vocabulary

CRC supports the following ordered families:

- pointer: `pointerover`, `pointerenter`, `pointerdown`, `pointermove`,
  `pointerrawupdate`, `pointerup`, `pointercancel`, `pointerout`,
  `pointerleave`, `gotpointercapture`, `lostpointercapture`;
- mouse and activation: `click`, `dblclick`, `auxclick`, `contextmenu`,
  `mouseover`, `mouseenter`, `mousedown`, `mousemove`, `mouseup`, `mouseout`,
  `mouseleave`;
- touch: `touchstart`, `touchmove`, `touchend`, `touchcancel`;
- wheel: `wheel`;
- keyboard/focus: `keydown`, `keyup`, `focus`, `blur`, `focusin`, `focusout`;
- editing/composition: `beforeinput`, `input`, `change`, `compositionstart`,
  `compositionupdate`, `compositionend`, `select`, `selectionchange`;
- clipboard: `copy`, `cut`, `paste`;
- drag/drop: `dragstart`, `drag`, `dragend`, `dragenter`, `dragleave`,
  `dragover`, `drop`.

`keypress`, semantic-control events, and non-input lifecycle/media/network
events are not part of this dispatcher. CRC forwards native pointer and mouse
compatibility sequences independently; it neither synthesizes a duplicate
mouse sequence nor suppresses one supplied by the browser.

## Target resolution and temporary path

Coordinate events convert the Canvas content-box position into root-logical
`x`/`y`, then search the shared Canvas paint ledger in reverse order.
Every candidate writes one reusable fixed-shape result as miss, block, or
target. Miss continues behind; block stops with no logical leaf; target stops
with a live logical leaf. Canvas paths, nested Canvas instances, and backend
resolvers share this protocol. A Canvas candidate must pass its accumulated
transforms, every active clip/layer bound, and configured fill or positive
stroke interaction width. Pointer capture and retained touch ownership override
fresh coordinate hit testing as described below.

Built-in drawing normally returns target on a geometry hit, including passive
drawing. Block is reserved for an official composition resolver that knows a
point is occluded but cannot identify a finer logical target. Every resolver
resets both disposition and target before use; borrowed input/output scratch has
only synchronous resolution lifetime and cannot be retained.

A render layer is one nested resolver at its exact Canvas composite position.
It first rejects outer clips and layer bounds, maps through the inverse outer
world transform to layer-local coordinates, then delegates to the
bitmap-matched committed interaction snapshot. A `target` result selects the
registered target, `block` occludes lower Canvas content without inventing a
target, and `miss` follows the layer's `pass-through`, `block`, or
`target-layer` miss policy. The Three adapter's default picker uses ordinary
Three raycasting and performs no pixel readback or hidden GPU ID pass.

For one logical dispatch, CRC walks the target's mounted-component ancestry,
including explicit Canvas and render-layer parent bridges, and snapshots the
live listener nodes already present on that route. A registered external target
therefore propagates through the render layer into Canvas ancestors. Listener
registration order within a component is source/hook order. The path is
temporary and is not retained after dispatch.

The exact phase order is:

```text
root capture -> ancestor capture -> target capture -> target handler
             -> ancestor bubble -> root bubble
phase 1          phase 1            phase 2          phase 3
```

Target capture runs before target non-capture and both report phase `2`.
`focus`, `blur`, `pointerenter`, `pointerleave`, `mouseenter`, `mouseleave`,
and `selectionchange` do not bubble. They may still run capture and target
phases. All other declared events bubble according to the definition table.

`composedPath()` is an immutable snapshot of opaque logical CRC targets from
root to target. These values are not DOM nodes or component refs. They expose
only pointer-capture operations; there is no imperative `focus()` method.

## Boundaries, related targets, and activation

Mouse and pointer movement compares old and new temporary ancestry paths.
`mouseout`/`pointerout` dispatch first from the old leaf and bubble. Exclusive
`mouseleave`/`pointerleave` events then run leaf toward the common ancestor.
`mouseover`/`pointerover` dispatch next from the new leaf and bubble. Exclusive
`mouseenter`/`pointerenter` events then run common ancestor toward the new
leaf. The final movement event runs last. Shared ancestors are not falsely
left and re-entered.

Drag movement uses the same ancestry difference: exited nodes receive
`dragleave` before entered nodes receive `dragenter`, followed by `dragover`.
The opposite live logical leaf is exposed as `relatedTarget`; root background
or outside-root relationships are `null`. Native `originalEvent.relatedTarget`
remains unchanged and can therefore differ from the logical relationship.

Mouse down and up resolve independently. Browser-supplied `click` or
`auxclick` activates the deepest still-live node shared by the saved down and
up paths only when that node is also on the activation event's current
coordinate path. Matching leaves activate that leaf; sibling leaves can
activate an explicitly registered common ancestor. Removed nodes are filtered
or cancel the saved activation. Primary and auxiliary button histories are
independent. `dblclick` requires two successful clicks on the same live target
and retains native browser order and hysteresis.

## Pointer capture, touch, wheel, and drag ownership

Any live target or propagation-listener `currentTarget` may call
`setPointerCapture(pointerId)`. CRC asks the root HTML Canvas for native
capture and records the logical owner only if native capture succeeds.
Capture is per pointer ID. Subsequent coordinate pointer events route to that
owner until explicit release, `pointercancel`, native loss, target removal, or
root disposal. `gotpointercapture` observes active ownership;
`lostpointercapture` observes ownership already cleared. Release retains only
the minimal pending owner needed to route a native loss notification. An
unmounted target receives no ghost loss callback.

Changing one pointer's logical capture from A to B on the same Canvas records a
pending logical transfer without changing the native DOM capture element.
Immediately before the next non-capture pointer event, A receives exactly one
`lostpointercapture`, then B receives exactly one `gotpointercapture`; public
capture state already identifies B during both callbacks. A later native loss
routes to B. A second successful request before processing replaces the pending
owner, and transfer state remains isolated per pointer ID.

Each changed touch identifier resolves a target at `touchstart` and retains
that target through move and terminal events even when coordinates leave its
geometry. Multi-contact native lists remain the original `TouchList` objects;
changed contacts are grouped once per retained logical target. `touchend` and
`touchcancel` release their identifiers, and target teardown removes all
contacts it owned.

`wheel` resolves the current coordinate target and preserves deltas and
modifier/mouse fields. Calling logical `preventDefault()` makes the native
cancelable wheel event default-prevented. Wheel and cancellable touch native
listeners are installed with non-passive options.

The `@crc/three` input bridge uses these same rules. Controls receive routed
pointer, wheel, context-menu, and click input only after the committed layer
resolver participates, and their pointer-capture requests map back to CRC. An
input change schedules another frame only when the application or control calls
the layer's invalidation capability; the bridge starts no independent loop.

Drag/drop preserves root-logical coordinates, modifiers, and the native
`dataTransfer`. Root-local drag hover is cleared by root leave, drop, drag end,
target removal, or disposal. As a deliberate Canvas divergence, `drag` and
`dragend` resolve the current coordinate target rather than retaining a DOM
drag-source target.

## Non-coordinate transport

Keyboard, logical focus, editing, composition, and clipboard facades preserve
their family fields. CRC's internal dispatcher transports them to a known
target. A plain Canvas supplies no logical descendant for native
non-coordinate input by itself. When an application installs
`FocusManagement`, the optional focus policy chooses the current explicit
target and supplies the implemented keyboard, focus, activation, and navigation
behavior defined by the
[focus and keyboard-navigation contract](./focus-and-keyboard-navigation-contract.md).
Without that policy, native Canvas events in these families remain targetless
and target handlers do not run. CRC exposes no separate public event-injection
adapter or hidden editable DOM.

Registering handlers alone does not install `tabindex`, focus policy, or
keyboard activation. The `keyboardFocusable` and `keyboardNavigationBounds`
target options remain inert without the optional focus policy, and
`useEventTarget` snapshots then report `isFocused: false` and
`isFocusVisible: false`. Exact focus ownership, traversal, defaults, snapshots,
layer invalidation, and teardown defer to the focus contract.

## Event facade and cancellation

Every logical event exposes `type`, opaque `target`/`currentTarget`, logical
`relatedTarget`, `eventPhase`, `bubbles`, `cancelable`, `defaultPrevented`,
`timeStamp`, `originalEvent`, optional `sourceEvent`, `composedPath()`,
`preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()`.
Coordinate families expose root-logical `x`/`y`; family interfaces project the
documented pointer, mouse, touch, wheel, keyboard, input, composition,
clipboard, and drag fields. `originalEvent` remains authoritative for uncommon
browser fields.

The facade is cancelable only when both its logical definition and source event
are cancelable. `preventDefault()` sets the logical flag and forwards only under
that same conjunction; calling it on synthesized `pointerenter`/`pointerleave`,
`mouseenter`/`mouseleave`, or `dragleave` is a no-op and does not cancel the
movement source. `stopPropagation()` completes the remaining handlers on
the current node, suppresses later nodes/phases, and forwards to the native
event. `stopImmediatePropagation()` also suppresses the remaining handler on
the current target/phase and forwards natively. A native listener outside CRC
that already ran is not undone.

## Mutation, errors, and scheduling

The route is snapshotted once, but each node's liveness and current handler are
read immediately before invocation:

- a removed handler, listener, target, or ancestor is skipped before its turn;
- a listener added after path construction does not join the current dispatch;
- replacing a still-live registration's handler is visible when a later phase
  reaches that registration;
- removing a planned boundary target prevents its later boundary/move event;
- one thrown application handler is reported through `reportError` and does
  not suppress unrelated handlers or corrupt cleanup.

Handlers may schedule normal CRC updates. Public `crc()` and state updates
remain animation-frame coalesced, so a requested rerender normally becomes
visible after the current native dispatch. Direct synchronous removal through
runtime teardown takes effect immediately.

## Native listeners, layers, legacy observers, and disposal

The root HTML Canvas owns at most one native listener per native event type.
Registrations acquire the native types they require and share a reference
count; the first requester installs and the last release removes the listener.
Boundary, activation, touch-retention, drag-boundary, and pointer-capture
registrations also own the native prerequisite and terminal types needed to
establish and clear their state. Every release closure and root disposal is
idempotent.

Offscreen Canvas layers and external render layers share their root HTML Canvas
event root, global paint order, paths, captures, contacts, drag hover,
listeners, and observers. A CRC mount
whose root is itself an `OffscreenCanvas` has no DOM native-event source and
therefore no native-listener hub. CRC does not pretend that such a root can
receive browser UI input and exposes no public event-injection API in this
delivery.

The singular path-bound `useEvent` remains a stable legacy geometric target.
A pathless `useEvent` remains a narrow mouse-only Canvas observer with the
shipped `{ x, y, originalEvent }` payload. Observers run after logical target
propagation, once per matching native event, in registration order. Removal is
effective before a pending observer turn, additions wait until the next native
event, and thrown observers are reported without suppressing safe peers.
Pathless observers do not affect target selection, propagation, cursor, or
activation.

Root disposal synchronously clears native listeners, logical registrations,
pointer captures and pending loss, pointer hover, touch contacts, drag hover,
mouse activation/click streaks, cursor ownership, observers, and layer bridges.
Render-layer removal or generation replacement removes stale nested resolver
targets and committed interaction state before a replacement can become
selectable. Stale controllers and repeated releases cannot affect a newer
mount.

## Evidence boundary

The Studio's **User events** section provides focused public-API lessons for
pointer events, pointer capture, Touch Events, wheel input, mouse boundaries
and auxiliary clicks, propagation/cancellation, custom event targets, and
drag/drop. Together with the existing mouse lessons, every declared coordinate
event name is present in readable example source and documentation metadata.

The shared `interaction-trace-lab` laboratory teaches one direct built-in
propagation target, one `useEventListener` ancestor, one `useEventTarget` custom
path, touch retention, wheel cancellation, and drag/drop. Its keyboard,
composition, and clipboard scenes are headless contract fixtures driven by
internal test transport; they do not claim a public adapter or manually
reachable target on a plain Canvas. The separate public focus scenario
demonstrates the opt-in keyboard path described by the focus contract.
Exhaustive event vocabulary, multi-pointer/contact, mutation, failure, geometry,
layer, and ownership matrices remain in focused tests so the learning fixture
stays readable.

The public Three.js lessons and adapter suites add empty-pixel pass-through,
Canvas/Three paint order, passive occlusion, registered targets, layer opt-out,
depth-aware default raycasting, structural propagation, pointer capture, cursor,
focus bounds, controls input, cache replay, and bitmap/interaction generation
evidence through public package imports.

CRC still does not provide semantic controls, DOM accessibility, a retained
scene graph, hidden editable DOM, pointer/touch gesture recognition, or
cross-browser normalization beyond the stated logical contracts. Optional
logical focus does not create screen-reader semantics or generated DOM
descendants.

## External 3D geometry boundary

Three coordinate events target the nearest committed visible object through the
adapter's camera-aware raycasting, or through an application-supplied picker.
Pure operations from `@crc/core/physics/3d/geometry` do not create event targets or
retain an authoritative world. Applications that combine those operations with
a Three scene explicitly derive their world-space query input and register the
corresponding Three object as a CRC target; normal event propagation and pointer
capture remain unchanged.
