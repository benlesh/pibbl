# CRC focus and keyboard-navigation contract

Status: implemented on 2026-08-30.

CRC provides optional logical focus and keyboard navigation for explicit event
targets. The HTML Canvas remains the only native DOM focus host. While the
Canvas owns browser focus, CRC may identify one live logical target as focused.
This facility governs keyboard interaction and rendering state; it does not
create an accessibility tree or semantic DOM descendants.

Applications opt in with the root exports `withFocusManagement` and
`withKeyboardNavigation`. Both functions enhance an existing element without
changing its component type, key, identity, parentage, layout, measurement,
paint order, or source order. A root may have one focus-management boundary.
Directional boundaries require that manager and may be nested.

## Enrollment and committed order

Only an explicit event-target registration can become a focus candidate.
Painted descendants, component props, propagation listeners, cursor
declarations, and returned geometry do not implicitly create candidates.

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

`withKeyboardNavigation(element, { mode: "directional" })` enrolls eligible
descendants in one arrow-navigation boundary. A custom target supplies
`keyboardNavigationBounds` in component-local coordinates. CRC transforms its
four corners into a root-logical axis-aligned envelope. A focusable target
without finite bounds remains in Tab order but cannot participate in arrow
selection.

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

`crcEventTarget` returns `{ isFocused, isFocusVisible }` for the current render.
Without a manager both values are false. Pointer focus normally sets only
`isFocused`; Tab and successful arrow navigation set both. Enter or Space does
not retroactively turn a pointer-established focus into focus-visible focus.

Applications may use `isFocused` for always-visible treatment and
`isFocusVisible` for modality-sensitive treatment. CRC introduces no focus
pseudo-style syntax. Focus visuals are ordinary Canvas drawing and should be
high contrast and not depend on color alone.

## Optionality, lifecycle, and failures

The base renderer and event dispatcher do not import focus implementation
modules. Without a used focus enhancer, CRC does not mutate `tabindex`, install
the document Tab listener, maintain an index, or run focus, activation,
focus-visible, or directional policies. Optimized package-consumer evidence
proves unused focus implementation is eliminated.

The focus manager owns its Canvas mutation, document and Canvas listeners,
committed candidates, directional memberships, current target, and pending
Space state. Enhancer removal, render failure, root abort, and `dispose()`
release those resources. Disposal is idempotent. It restores the prior Canvas
focusability only while CRC still owns its mutation; an application `tabindex`
change is preserved. Application handler errors remain isolated by the shared
event dispatcher.

The shared `focus-and-keyboard-navigation` scenario demonstrates native DOM
controls before and after the Canvas, two explicit top targets, twelve keyed
row-major directional squares, and two explicit bottom targets. Its private
controls each own their rectangular `crcEventTarget` registration and their
own visual children. They are example composition, not exported CRC widgets.

See [Canvas accessibility guidance](./canvas-accessibility-guidance.md) for the
separate semantic responsibility.
