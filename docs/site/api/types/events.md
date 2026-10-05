---
id: api-types-events
title: Event types
summary: Logical event facades, target contracts, and focus-navigation options.
kind: api
slug: events
apiCategory: types
typeDomain: events
symbols:
  [
    PibblClipboardEvent,
    PibblCompositionEvent,
    PibblDragEvent,
    PibblDragHandleProps,
    PibblDragHandleStyle,
    PibblEvent,
    PibblEventCapturePropName,
    PibblEventHandler,
    PibblEventHandlers,
    PibblEventMap,
    PibblEventParticipationOptions,
    PibblEventPhase,
    PibblEventPropName,
    PibblEventTarget,
    PibblEventTargetOptions,
    PibblEventTargetSnapshot,
    PibblEventType,
    PibblFocusEvent,
    PibblInputEvent,
    PibblKeyboardEvent,
    PibblKeyboardNavigationOptions,
    PibblLogicalMouseEvent,
    PibblManipulableProps,
    PibblManipulationActive,
    PibblManipulationBox,
    PibblManipulationCancelEvent,
    PibblManipulationCancelReason,
    PibblManipulationCommitEvent,
    PibblManipulationController,
    PibblManipulationEvent,
    PibblManipulationFrameProps,
    PibblManipulationGeometry,
    PibblManipulationMoveInput,
    PibblManipulationOperation,
    PibblManipulationOptions,
    PibblManipulationPoint,
    PibblManipulationReadoutStateStyle,
    PibblManipulationReadoutStyle,
    PibblManipulationResizeInput,
    PibblManipulationRotateInput,
    PibblManipulationSnapshot,
    PibblManipulationWhen,
    PibblPointerEvent,
    PibblPointerEvents,
    PibblResizeHandleProps,
    PibblResizeHandlesProps,
    PibblResizeHandleStyle,
    PibblResizePosition,
    PibblRotationArcStyle,
    PibblRotationConnectorStyle,
    PibblRotationHandleProps,
    PibblRotationHandleStyle,
    PibblTouchEvent,
    PibblWheelEvent,
  ]
keywords: [events, pointer, focus, keyboard, propagation]
---

# Event types

## PibblClipboardEvent

`PibblClipboardEvent` is the logical facade for clipboard events and carries the
same cancellation and propagation controls as the base Pibbl event.

## PibblCompositionEvent

`PibblCompositionEvent` is the logical facade for composition lifecycle events.

## PibblDragEvent

`PibblDragEvent` is the logical facade for drag-and-drop events.

## PibblDragHandleProps

Supplies a controller, optional children, and a position formatter receiving applied `left` and `top`. Descendant hit areas determine where dragging can begin.

## PibblDragHandleStyle

Ordinary Group-like presentation and layout participation, plus optional `readout` styling. Width and height do not manufacture an interaction rectangle.

## PibblEvent

`PibblEvent` is the base logical event facade. It exposes propagation phase,
target/current target, cancellation, and logical related-target information.

## PibblEventCapturePropName

`PibblEventCapturePropName` is the typed union of supported `onXCapture` prop
names for capture-phase listeners.

## PibblEventHandler

`PibblEventHandler` is the generic callback contract for a selected event facade.

## PibblEventHandlers

`PibblEventHandlers` maps every supported `onX` and `onXCapture` property to its
specific logical event-handler type.

## PibblEventMap

`PibblEventMap` maps supported event-type strings to their corresponding facade
types for generic event code.

## PibblEventParticipationOptions

`PibblEventParticipationOptions` supplies the shared optional `pointerEvents`
property used by drawing primitives and external render layers.

## PibblEventPhase

`PibblEventPhase` represents the capture, target, and bubble phases of Pibbl's
logical propagation path.

## PibblEventPropName

`PibblEventPropName` is the typed union of supported bubbling `onX` prop names.

## PibblEventTarget

`PibblEventTarget` is Pibbl's opaque logical-target interface, distinct from a DOM
`EventTarget` and derived from Pibbl's geometric paint ledger.

## PibblEventTargetOptions

`PibblEventTargetOptions` configures path, fill/stroke hit geometry, cursor,
focus behavior, and optional navigation bounds for a logical target.

## PibblEventTargetSnapshot

`PibblEventTargetSnapshot` exposes the current logical focus state returned by
`useEventTarget` during render.

## PibblEventType

`PibblEventType` is the union of supported logical event-type strings.

## PibblFocusEvent

`PibblFocusEvent` is the logical facade for focus and blur transitions. It is
available only when a `FocusManagement` policy is active.

## PibblInputEvent

`PibblInputEvent` is the logical facade for input events on an eligible target.

## PibblKeyboardEvent

`PibblKeyboardEvent` is the logical facade for keyboard events delivered through
the Canvas focus host and logical focus target.

## PibblKeyboardNavigationOptions

`PibblKeyboardNavigationOptions` configures the supported directional keyboard
navigation policy. Its mode is exactly `"directional"` and it requires focus
management.

## PibblLogicalMouseEvent

`PibblLogicalMouseEvent` is the geometry-targeted mouse facade with root-logical
coordinates.

## PibblManipulableProps

Binds writable box and optional rotation signals, operation booleans or options, resize-handle selection, lifecycle callbacks, and children for the convenience component.

## PibblManipulationActive

Reports the active operation, resize handle, and pointer identifier; the controller publishes null while idle.

## PibblManipulationBox

Readonly left, top, width, and height geometry stored in the writable box signal.

## PibblManipulationCancelEvent

A terminal cancellation snapshot with before/after geometry and a cancellation reason.

## PibblManipulationCancelReason

The closed vocabulary for explicit cancellation, input loss, disabled operations, external changes, coordinate changes, and unsatisfiable constraints.

## PibblManipulationCommitEvent

A terminal committed snapshot whose changed field indicates whether geometry differs from the start.

## PibblManipulationController

Exposes readonly active and snapshot signals, stable frameProps, and cancel().

## PibblManipulationEvent

An immutable operation snapshot with before and after geometry.

## PibblManipulationFrameProps

Binds a controller and its original writable box signal to a frame, with optional children.

## PibblManipulationGeometry

Combines a box with rotation in radians.

## PibblManipulationMoveInput

Configures movement axes, parent-space bounds, grid snapping, and optional signal-valued activation.

## PibblManipulationOperation

Names move, resize, or rotate operations.

## PibblManipulationOptions

Binds writable geometry, move/resize options, and start/change/commit/cancel callbacks.

## PibblManipulationPoint

A geometric coordinate pair used by manipulation calculations.

## PibblManipulationReadoutStateStyle

A flat readout state patch containing font, fill, stroke, strokeWidth, opacity,
visible, and gap. It cannot contain nested state branches.

## PibblManipulationReadoutStyle

Local readout presentation: font, fill, stroke, stroke width, opacity, visibility and
outward CSS-pixel `gap` (default 5),
with flat inactive, focused and active overrides. Resolve base, inactive when not
active, focused, then active. Labels stay upright and contained in the visible
canvas; formatting never changes gesture geometry.

## PibblManipulationResizeInput

Configures dimension limits, bounds, aspect ratio, size or grid snapping, and optional signal-valued activation.

## PibblManipulationRotateInput

Configures optional signal-valued rotation activation and angular snapping in radians.

## PibblManipulationSnapshot

Reports initial, proposed, and applied geometry together with requested and satisfied snapping state.

## PibblManipulationWhen

Selects always, shift, alt, ctrl, or meta activation.

## PibblPointerEvent

`PibblPointerEvent` is the logical facade for pointer events, including capture
and Pibbl root-logical coordinates.

## PibblPointerEvents

`PibblPointerEvents` is exactly `"auto" | "none"`. `"auto"` keeps the receiving
paint or external-layer target in hit resolution; `"none"` opts it and its
owned interaction bridge out without changing pixels.

## PibblResizeHandleProps

Binds one named edge or corner to a controller, with optional custom visuals and hit size.

## PibblResizeHandlesProps

Selects corners, edges-and-corners, or an explicit list of resize positions for one controller.

## PibblResizeHandleStyle

The resize control's local style includes an optional `readout` slot. Omitted
readout configuration disables the label; true enables the default active-only
label; false explicitly disables it. ResizeHandles shares this style and shows
one combined size readout.

## PibblResizePosition

Names top-left, top, top-right, right, bottom-right, bottom, bottom-left, or left.

## PibblRotationArcStyle

Rotation guide color, sweep in radians, strokeWidth and opacity.

## PibblRotationConnectorStyle

Rotation connector stroke, strokeWidth and opacity in CSS-pixel presentation.

## PibblRotationHandleProps

Binds a controller to an external rotation handle with optional custom visuals and CSS-pixel hit size.

## PibblRotationHandleStyle

Local rotation presentation includes connector, arc and readout slots. Connector
is enabled by default; arc and readout are opt-in. Each slot accepts true, false,
or its typed configuration. Connector orientation follows the displayed edge;
readout text stays upright and inside the canvas.

## PibblTouchEvent

`PibblTouchEvent` is the logical facade for touch events.

## PibblWheelEvent

`PibblWheelEvent` is the logical facade for wheel events.

**Manipulation contracts.**

`PibblManipulationBox` is the writable `left`, `top`, `width`, and `height`
geometry. `PibblManipulationController` exposes `active`, `snapshot`,
`frameProps`, and `cancel()`. `PibblManipulationFrameProps` is the value supplied
by `controller.frameProps` for `ManipulationFrame`.

`PibblManipulationActive`, `PibblManipulationSnapshot`, and
`PibblManipulationEvent` describe the live operation, starting geometry, proposed
geometry, and applied geometry. `PibblManipulationCommitEvent` adds `changed`;
`PibblManipulationCancelEvent` adds its cancellation reason.

`PibblManipulationOptions` accepts the writable box and optional move/resize
configuration. `PibblManipulationMoveInput` controls movement axis, bounds, and
grid snapping. `PibblManipulationResizeInput` controls size limits, bounds,
aspect ratio, and size or grid snapping. Their `enabled` values accept signals.

`PibblResizePosition` names the supported frame edges and corners.
`PibblDragHandleProps`, `PibblDragHandleStyle`, `PibblResizeHandleProps`, and
`PibblResizeHandlesProps` configure the public handle components.
