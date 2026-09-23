# CRC focus and keyboard-navigation contract

Status: current implemented contract, updated for WebGL lighting, orbit-camera,
and genuine-shadow behavior on 2026-09-15.

CRC provides optional logical focus and keyboard navigation for explicit event
targets. The HTML Canvas remains the only native DOM focus host. While the
Canvas owns browser focus, CRC may identify one live logical target as focused.
This facility governs keyboard interaction and rendering state; it does not
create an accessibility tree or semantic DOM descendants.

Applications opt in with the transparent policy component values
`FocusManagement` and `KeyboardNavigation`:

```tsx
<FocusManagement>
  <KeyboardNavigation mode="directional">
    <Scene />
  </KeyboardNavigation>
</FocusManagement>
```

Each policy removes empty child values and requires exactly one remaining
branded `CRCElement`. Policy preparation attaches lifecycle metadata to a clone
of that child before identity resolution. The policy does not paint, lay out,
own hooks, or change the child's type, key, identity, parentage, measurement,
paint order, or source order. `KeyboardNavigation` requires an active manager;
directional boundaries may be nested.

## Enrollment and committed order

Only a logical event-target registration can become a focus candidate.
Painted descendants, component props, propagation listeners, cursor
declarations, and returned geometry do not implicitly create candidates.

Canvas drawing leaves and geometry-backed `Mesh`, `Cube`, and `Sphere` objects
own a logical target by default even when passive. They still enroll only by the
rules below; passive paint alone is not focusable. `pointerEvents="none"`
releases the leaf from hit and focus participation. `Group`, `Clip`, `Layer`,
layout containers, `WebGLLayer`, and `Group3D` handler props are listener-only
and cannot enroll their structural allocation or conceptual bounds. Analytic
lights and `WebGLBackground` expose no event/focus props or geometry and can
never enroll, regardless of visual contribution or background opacity.

A target enrolls automatically when it has `onClick`, `onKeyDown`, or
`onKeyUp`. `keyboardFocusable: true` explicitly includes another target and
`keyboardFocusable: false` excludes an otherwise automatic target. Capture-only
handlers and pointer movement, hover, wheel, cursor, focus observation, and
drag-over handlers do not enroll a target by themselves.

Candidate identity is the mounted component identity plus the explicit target
hook slot. An ordinary rerender retains it. A keyed child retains it when
reordered under the same parent. Reparenting, remounting, or changing the key
creates a new target under the normal CRC identity rules.

Each successful render atomically replaces the candidate index. Source
traversal is the global Tab order; geometry and numeric positive `tabIndex`
values never reorder it. A failed render does not commit a partial index. When
a focused target disappears, CRC clears focus without dispatching events to the
dead target.

## Native Canvas host and logical focus events

When the committed index is nonempty, CRC makes the HTML Canvas a native Tab
stop. While CRC still owns a `tabindex` mutation, it restores the exact prior
state when that ownership ends. If the application changes `tabindex` while CRC
is active, CRC relinquishes mutation ownership and preserves the application's
new value. Focus management on a root `OffscreenCanvas` is an error because no
DOM focus host exists; offscreen layers beneath an HTML Canvas share that
Canvas's manager.

One logical transition dispatches events in this order:

```text
previous: focusout (bubbles) -> blur (does not bubble)
next:     focusin  (bubbles) -> focus (does not bubble)
```

`relatedTarget` is the other live logical target when one exists. Handlers use
the common capture, target, and bubble dispatcher. The manager then schedules
one ordinary coalesced render. Native Canvas blur dispatches the logical blur
sequence before clearing the current target and deactivating logical focus.

## Tab entry, traversal, and exit

The manager records an unprevented native Tab direction at the document while
it is installed. It adds no focus sentinels or generated siblings.

- Forward DOM entry selects the first committed candidate.
- Reverse DOM entry selects the last candidate.
- Programmatic Canvas focus without a known direction selects the first.
- Tab and Shift+Tab move through the source-order list and prevent the native
  default only when an internal next target exists.
- Tab at the last target and Shift+Tab at the first target do not wrap or cancel;
  the browser continues to the surrounding native DOM order.
- Directional-boundary membership does not affect Tab order.

Therefore row-major declaration produces row-major Tab behavior by source
order, not by geometric sorting.

## Pointer, mouse, pen, and touch focus

The event dispatcher first resolves and propagates the primary press to one
topmost logical target. If it remains unprevented, the focus default runs.
Pointer Events are authoritative when present; mouse and touch starts provide
fallbacks without duplicating a represented pointer press.

A primary mouse-, pen-, or touch-shaped press on a focusable target focuses the
Canvas and selects that target. A press on non-focusable geometry or empty
Canvas background focuses the Canvas but clears the logical target. Calling
`preventDefault()` during target or ancestor press handling suppresses that
focus default. Pointer capture controls later event routing and does not move
keyboard focus by itself.

## Dispatch precedence and activation

Keyboard handling has this fixed precedence:

```text
target and ancestor key propagation
    -> focus-manager activation default
    -> nearest directional-boundary default
```

Each later policy runs only when the event remains unprevented. A form-like or
editing target can therefore retain arrows or activation keys by handling the
key and calling `preventDefault()`.

A focusable target with `onClick` receives button-like defaults. A nonrepeating
Enter keydown produces one logical click. Space keydown prevents scrolling and
records the focused target; matching Space keyup clicks only when that same
target remains live and focused. Focus movement, blur, cancellation, handler
removal, unmount, or disposal cancels pending Space activation.

The keyboard-generated click exposes a synthetic, cancelable `MouseEvent` with
`detail: 0` as `originalEvent`, so the click handler keeps its mouse-event
contract. Its originating `KeyboardEvent` is available as `sourceEvent`.
Native clicks have no `sourceEvent`.

## Directional boundaries

`<KeyboardNavigation mode="directional">` enrolls eligible
descendants in one arrow-navigation boundary. A custom target supplies
`keyboardNavigationBounds` in component-local coordinates. CRC transforms its
four corners into a root-logical axis-aligned envelope. A focusable target
without finite bounds remains in Tab order but cannot participate in arrow
selection.

Geometry-backed `Mesh`, `Cube`, and `Sphere` targets derive navigation geometry
from the same settled geometry/model/camera submissions used by rendering and
picking. CRC clips the projected bounds to the camera frustum, maps them into
the logical `WebGLLayer`, then applies the same outer Canvas layout, transform,
and clip projection used by paint and picking. An explicit
`keyboardNavigationBounds` on a WebGL target is a layer-local 2D override.
WebGL target source traversal remains the global Tab order even when the raster
renderer groups opaque objects, renders light-space shadow depth, and sorts
transparent objects. Lighting, normals, material, emission, background, and
shadow participation do not change projected bounds or directional ranking.

`useOrbitCamera()` is independent of focus and picking. Its handlers may sit on
a focusable mesh or any ordinary listener ancestor, but the hook creates no
candidate and camera motion does not move focus ownership. An explicit
viewport-sized target is still required when empty viewport space should begin
an orbit gesture.

For each arrow, candidates outside the requested center half-plane are
discarded. Remaining candidates compare this tuple in order:

1. perpendicular-axis overlap before off-axis candidates;
2. nearest forward edge distance;
3. nearest perpendicular center distance;
4. source index as the exact tie-breaker.

The winner receives focus and the native arrow default is prevented. With no
winner, focus and default-prevention state remain unchanged. Navigation does
not wrap.

The nearest boundary exclusively owns its descendants. Its direct candidate
set excludes candidates in a nested boundary. An arrow at an inner edge stays
inside that boundary and does not escape to an outer policy. Tab still uses the
single global source-order list across every boundary.

## Render snapshots and modality

`useEventTarget` returns `{ isFocused, isFocusVisible }` for the current render.
Without a manager both values are false. Pointer focus normally sets only
`isFocused`; Tab and successful arrow navigation set both. Enter or Space does
not retroactively turn a pointer-established focus into focus-visible focus.

Applications may use `isFocused` for always-visible treatment and
`isFocusVisible` for modality-sensitive treatment. CRC introduces no focus
pseudo-style syntax. Focus visuals are ordinary Canvas drawing and should be
high contrast and not depend on color alone.

When such a snapshot is painted inside an offscreen layer, a logical focus
transition invalidates only cached layer instances containing the previous or
next target, including their nested layer ancestors. Unrelated layers and
layers rendered without focus management retain their ordinary cache behavior.

`WebGLLayer` commits and replays its projected focus metadata with the same
bitmap/pick generation. No settled/rendered candidate can publish focus
metadata before its bitmap succeeds in parent Canvas composition. A focus
revision invalidates the necessary private island and outer retained-Layer
ancestors once; an otherwise unchanged constant-time cache hit reuses committed
focus geometry without composing a scene or executing WebGL child components.

## Optionality, lifecycle, and failures

The base renderer and event dispatcher do not import focus implementation
modules. Without a used `FocusManagement` policy, CRC does not mutate `tabindex`, install
the document Tab listener, maintain an index, or run focus, activation,
focus-visible, or directional policies. Optimized package-consumer evidence
proves unused focus implementation is eliminated.

The focus manager owns its Canvas mutation, document and Canvas listeners,
committed candidates, directional memberships, current target, and pending
Space state. Policy removal, render failure, root abort, and `dispose()`
release those resources. Disposal is idempotent. It restores the prior Canvas
focusability only while CRC still owns its mutation; an application `tabindex`
change is preserved. Application handler errors remain isolated by the shared
event dispatcher.

WebGL context loss removes stale pick/focus metadata and its owned target
generation. Restoration schedules a normal frame, and new projected geometry
becomes eligible only with a successfully committed bitmap/pick generation.

The shared `focus-and-keyboard-navigation` scenario demonstrates native DOM
controls before and after the Canvas, two explicit top targets, twelve keyed
row-major directional squares, and two explicit bottom targets. Its private
controls each own their rectangular `useEventTarget` registration and their
own visual children. They are example composition, not exported CRC widgets.

The Studio's **Keyboard and focus** section separates that contract into five
editable lessons: focus enrollment/events/visuals, keyboard delivery and
Enter/Space activation, directional navigation, a visibly instrumented
directional grid nested inside another directional grid, and
editing/composition/clipboard transport. The last lesson deliberately documents
that event transport does not make Canvas an editable or semantic DOM control.

The `webgl-islands` lesson and deterministic WebGL laboratory additionally
prove projected and explicit bounds, source-order Tab, directional movement,
press focus, keyboard activation, outer transforms/clips/Layers, and focus
cache replay across the nested WebGL event-parent bridge.

The `webgl-lighting` laboratory proves that light/material/background/shadow
changes leave pick and focus geometry unchanged, zero-alpha meshes can retain
focus participation without raster or shadow depth, an opaque background does
not enroll, and orbit input leaves logical focus ownership independent.

See [Canvas accessibility guidance](./canvas-accessibility-guidance.md) for the
separate semantic responsibility.

## 3D physics presentation

An interactive physics-backed WebGL mesh remains the same logical focus target. Its committed physics presentation contributes to the one settled model shared by rasterization, depth picking, and projected focus bounds; authoritative physics queries and collision events do not create focus candidates or change keyboard order. Disabled or removed geometry follows the ordinary committed WebGL target and focus-removal rules.
