# CRC component-manipulation contract

Status: current implemented contract. This document defines the public
manipulation surface in `@crc/core`; pure solver details and internal event
records are not public APIs.

## Geometry and ownership

`useManipulation(options)` is a component hook. It accepts one writable box
signal with finite `left`, `top`, `width`, and `height`, and optionally one
writable rotation signal in radians. The application signals remain the source
of truth. The hook returns a stable controller with readonly `active` and
`snapshot` signals, `cancel()`, and `frameProps`. Its geometry signal identity
cannot change for the life of the hook slot.

`ManipulationFrame` receives `frameProps`, attaches one controller to one frame
in one CRC event root, positions the frame through the box signal, and supplies
its finite local allocation to children. It converts the radians rotation to
the existing `Group.rotationDegrees` presentation value around the frame center.
The frame does not infer descendant bounds. A `DragHandle`, `ResizeHandle`,
`ResizeHandles`, or `RotationHandle` for that controller must be a descendant
of the frame. `Manipulable` composes the same frame and standard handles; it
does not introduce another controller or geometry store.

Free placement uses the shared `left`/`top` component-positioning vocabulary.
`Rectangle`, `Text`, and `Image` no longer accept positioning-style `x`/`y`.
Those names remain available where they describe geometric data, such as line
endpoints, points, and event coordinates. A direct child of `Flex`, `Flow`, or
`Grid` remains parent-positioned: authored `left`/`top` has no production
placement effect and development/test execution reports the ignored fields.
Use a freely positioned frame outside those direct layout relationships; a
nested layout inside the frame consumes the frame allocation and reflows on
resize.

## Gesture lifecycle

Only a primary-pointer press can arm an enabled operation. The handle requests
native pointer capture before a session exists; failure leaves no session. One
controller owns one pointer and its box/rotation sources at a time. A gesture
starts after movement reaches three CSS pixels. A press below that threshold
retains ordinary pointer and click behavior.

Each change solves from the press-time geometry and parent-space pointer anchor,
not from a preceding snapped or clamped result. The final pointer-up sample is
applied before one commit callback. `onCommit` reports `changed: false` when a
started gesture returns to its starting geometry. `onStart`, `onChange`,
`onCommit`, and `onCancel` receive immutable initial, proposed, and applied
geometry snapshots; cancellation has a typed reason.

An active cancellation through `cancel()`, Escape on the focused handle,
`pointercancel`, capture loss, disabling an operation, a changed ancestor
mapping, or unsatisfiable live constraints restores the press-time geometry
only while the session still owns its last published values. A newer external
box or rotation write ends the gesture and wins. Equal-value writes do not end
it. A completed drag suppresses only its corresponding click activation; it
does not suppress later ordinary clicks or another pointer.

## Handles and coordinate space

`DragHandle` is a pathless listener ancestor. Its descendants supply normal hit
geometry, including fill/stroke, transforms, clipping, and source paint order.
It never adds a rectangular target or unions descendant bounds. Empty handles,
gaps, and descendants with `pointerEvents="none"` cannot initiate movement.
Focusable child targets supply keyboard focus and bubble Escape to the handle.
Put cursor and focusability on the painted target.

`ResizeHandle` chooses
one of the four corners or four edges, and `ResizeHandles` renders corners by
default or the requested edge/corner set. `RotationHandle` sits beyond the
frame's top edge. Default visual controls are 8 CSS pixels and default hit
targets are 24 CSS pixels. Custom resize and rotation-handle children use a
CSS-pixel basis anchored at the corresponding control.

The frame uses its committed parent-to-root presentation mapping for pointer
conversion and its current frame-to-CSS mapping for handles. Zoom, device
density, rotation, and nonsingular ancestor transforms therefore preserve the
CSS-pixel target size. A singular mapping rejects activation. An ancestor
mapping change during a session cancels it; a gesture-owned box change does not
rebase the session.

Handle targets participate in normal paint and event order. A nested handle
claims a press before an enclosing drag surface. A child can call
`preventDefault()` on pointer down to decline an enclosing manipulation start.
There is no implicit z-index or descendant-bounds discovery.

## Constraints and snapping

Move, resize, and rotate are independent optional operations. `enabled` may be
a boolean or boolean signal. Snapping is inactive when omitted; present snaps
default to enabled and can activate always or while Shift, Alt, Control, or
Meta is held. Steps are positive finite values and origins are finite even when
the snap is currently inactive. Nearest lattice points win; exact half ties use
the larger lattice index.

Move snapping applies to parent-space `left`/`top`, with optional separate
origins. Resize size snapping applies to width and height from zero. Grid
resize snapping applies to moving parent-space edges and is restricted to an
unrotated frame with an aligned parent mapping. Rotation is radians about the
box center, remains continuous across turns, and may snap to an angular lattice.
`degrees(value)` converts a finite degree value for rotation options; it does
not change `Group.rotationDegrees` units.

Resize defaults to positive minimum dimensions of one. Explicit finite
minimum/maximum dimensions, parent-space bounds, a fixed opposite anchor, and
an active aspect ratio take priority over snapping. Rotated resizing preserves
the opposite edge/corner anchor in parent space. A ratio-locked corner uses the
greater relative dimension change, with width winning ties; a ratio-locked edge
changes its secondary dimension symmetrically. If hard constraints prevent a
lattice result, the legal result may be off-grid and `snapshot.snapSatisfied`
is false.

## Teardown

The controller owns pointer capture, its bounded source observations, and its
temporary session exactly until a terminal path, frame removal, component
teardown, or root disposal. Release is idempotent. Removal releases input
resources synchronously. If restoring a still-owned preview occurs under a
signal write guard, CRC queues one generation-checked Begin cleanup record;
it writes only when the sources and owner generation are unchanged. A newer
external write or a later controller ownership generation invalidates that
record. Disposed components do not receive lifecycle callbacks.

## Position readouts

A drag handle can enable `style.readout` and supply `formatReadout({ left, top })`.
Values are the frame’s applied parent-local position, in logical units, and are
never derived from the grab region or cursor position. Readouts use the shared
inactive/focused/active style overrides, outward gap, and canvas containment.
They remain decorative and introduce no input target. `Manipulable.dragHandle`
forwards the same presentation and formatter options to its content wrapper;
only participating descendants can initiate its move operation.
