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
    CRCClipboardEvent,
    CRCCompositionEvent,
    CRCDragEvent,
    CRCDragHandleProps,
    CRCDragHandleStyle,
    CRCEvent,
    CRCEventCapturePropName,
    CRCEventHandler,
    CRCEventHandlers,
    CRCEventMap,
    CRCEventParticipationOptions,
    CRCEventPhase,
    CRCEventPropName,
    CRCEventTarget,
    CRCEventTargetOptions,
    CRCEventTargetSnapshot,
    CRCEventType,
    CRCFocusEvent,
    CRCInputEvent,
    CRCKeyboardEvent,
    CRCKeyboardNavigationOptions,
    CRCLogicalMouseEvent,
    CRCManipulableProps,
    CRCManipulationActive,
    CRCManipulationBox,
    CRCManipulationCancelEvent,
    CRCManipulationCancelReason,
    CRCManipulationCommitEvent,
    CRCManipulationController,
    CRCManipulationEvent,
    CRCManipulationFrameProps,
    CRCManipulationGeometry,
    CRCManipulationMoveInput,
    CRCManipulationOperation,
    CRCManipulationOptions,
    CRCManipulationPoint,
    CRCManipulationReadoutStateStyle,
    CRCManipulationReadoutStyle,
    CRCManipulationResizeInput,
    CRCManipulationRotateInput,
    CRCManipulationSnapshot,
    CRCManipulationWhen,
    CRCMouseEvent,
    CRCMouseEventListener,
    CRCPointerEvent,
    CRCPointerEvents,
    CRCResizeHandleProps,
    CRCResizeHandlesProps,
    CRCResizeHandleStyle,
    CRCResizePosition,
    CRCRotationArcStyle,
    CRCRotationConnectorStyle,
    CRCRotationHandleProps,
    CRCRotationHandleStyle,
    CRCTouchEvent,
    CRCWheelEvent,
  ]
keywords: [events, pointer, focus, keyboard, propagation]
---

# Event types

## CRCClipboardEvent

`CRCClipboardEvent` is the logical facade for clipboard events and carries the
same cancellation and propagation controls as the base CRC event.

## CRCCompositionEvent

`CRCCompositionEvent` is the logical facade for composition lifecycle events.

## CRCDragEvent

`CRCDragEvent` is the logical facade for drag-and-drop events.

## CRCDragHandleProps

Supplies a controller, optional children, and a position formatter receiving applied `left` and `top`. Descendant hit areas determine where dragging can begin.

## CRCDragHandleStyle

Ordinary Group-like presentation and layout participation, plus optional `readout` styling. Width and height do not manufacture an interaction rectangle.

## CRCEvent

`CRCEvent` is the base logical event facade. It exposes propagation phase,
target/current target, cancellation, and logical related-target information.

## CRCEventCapturePropName

`CRCEventCapturePropName` is the typed union of supported `onXCapture` prop
names for capture-phase listeners.

## CRCEventHandler

`CRCEventHandler` is the generic callback contract for a selected event facade.

## CRCEventHandlers

`CRCEventHandlers` maps every supported `onX` and `onXCapture` property to its
specific logical event-handler type.

## CRCEventMap

`CRCEventMap` maps supported event-type strings to their corresponding facade
types for generic event code.

## CRCEventParticipationOptions

`CRCEventParticipationOptions` supplies the shared optional `pointerEvents`
property used by drawing primitives and external render layers.

## CRCEventPhase

`CRCEventPhase` represents the capture, target, and bubble phases of CRC's
logical propagation path.

## CRCEventPropName

`CRCEventPropName` is the typed union of supported bubbling `onX` prop names.

## CRCEventTarget

`CRCEventTarget` is CRC's opaque logical-target interface, distinct from a DOM
`EventTarget` and derived from CRC's geometric paint ledger.

## CRCEventTargetOptions

`CRCEventTargetOptions` configures path, fill/stroke hit geometry, cursor,
focus behavior, and optional navigation bounds for a logical target.

## CRCEventTargetSnapshot

`CRCEventTargetSnapshot` exposes the current logical focus state returned by
`useEventTarget` during render.

## CRCEventType

`CRCEventType` is the union of supported logical event-type strings.

## CRCFocusEvent

`CRCFocusEvent` is the logical facade for focus and blur transitions. It is
available only when a `FocusManagement` policy is active.

## CRCInputEvent

`CRCInputEvent` is the logical facade for input events on an eligible target.

## CRCKeyboardEvent

`CRCKeyboardEvent` is the logical facade for keyboard events delivered through
the Canvas focus host and logical focus target.

## CRCKeyboardNavigationOptions

`CRCKeyboardNavigationOptions` configures the supported directional keyboard
navigation policy. Its mode is exactly `"directional"` and it requires focus
management.

## CRCLogicalMouseEvent

`CRCLogicalMouseEvent` is the geometry-targeted mouse facade with root-logical
coordinates.

## CRCManipulableProps

Binds writable box and optional rotation signals, operation booleans or options, resize-handle selection, lifecycle callbacks, and children for the convenience component.

## CRCManipulationActive

Reports the active operation, resize handle, and pointer identifier; the controller publishes null while idle.

## CRCManipulationBox

Readonly left, top, width, and height geometry stored in the writable box signal.

## CRCManipulationCancelEvent

A terminal cancellation snapshot with before/after geometry and a cancellation reason.

## CRCManipulationCancelReason

The closed vocabulary for explicit cancellation, input loss, disabled operations, external changes, coordinate changes, and unsatisfiable constraints.

## CRCManipulationCommitEvent

A terminal committed snapshot whose changed field indicates whether geometry differs from the start.

## CRCManipulationController

Exposes readonly active and snapshot signals, stable frameProps, and cancel().

## CRCManipulationEvent

An immutable operation snapshot with before and after geometry.

## CRCManipulationFrameProps

Binds a controller and its original writable box signal to a frame, with optional children.

## CRCManipulationGeometry

Combines a box with rotation in radians.

## CRCManipulationMoveInput

Configures movement axes, parent-space bounds, grid snapping, and optional signal-valued activation.

## CRCManipulationOperation

Names move, resize, or rotate operations.

## CRCManipulationOptions

Binds writable geometry, move/resize options, and start/change/commit/cancel callbacks.

## CRCManipulationPoint

A geometric coordinate pair used by manipulation calculations.

## CRCManipulationReadoutStateStyle

A flat readout state patch containing font, fill, stroke, strokeWidth, opacity,
visible, and gap. It cannot contain nested state branches.

## CRCManipulationReadoutStyle

Local readout presentation: font, fill, stroke, stroke width, opacity, visibility and
outward CSS-pixel `gap` (default 5),
with flat inactive, focused and active overrides. Resolve base, inactive when not
active, focused, then active. Labels stay upright and contained in the visible
canvas; formatting never changes gesture geometry.

## CRCManipulationResizeInput

Configures dimension limits, bounds, aspect ratio, size or grid snapping, and optional signal-valued activation.

## CRCManipulationRotateInput

Configures optional signal-valued rotation activation and angular snapping in radians.

## CRCManipulationSnapshot

Reports initial, proposed, and applied geometry together with requested and satisfied snapping state.

## CRCManipulationWhen

Selects always, shift, alt, ctrl, or meta activation.

## CRCMouseEvent

`CRCMouseEvent` preserves the narrow pathless Canvas-observer mouse payload.

## CRCMouseEventListener

`CRCMouseEventListener` is the callback contract for that narrow root observer.

## CRCPointerEvent

`CRCPointerEvent` is the logical facade for pointer events, including capture
and CRC root-logical coordinates.

## CRCPointerEvents

`CRCPointerEvents` is exactly `"auto" | "none"`. `"auto"` keeps the receiving
paint or external-layer target in hit resolution; `"none"` opts it and its
owned interaction bridge out without changing pixels.

## CRCResizeHandleProps

Binds one named edge or corner to a controller, with optional custom visuals and hit size.

## CRCResizeHandlesProps

Selects corners, edges-and-corners, or an explicit list of resize positions for one controller.

## CRCResizeHandleStyle

The resize control's local style includes an optional `readout` slot. Omitted
readout configuration disables the label; true enables the default active-only
label; false explicitly disables it. ResizeHandles shares this style and shows
one combined size readout.

## CRCResizePosition

Names top-left, top, top-right, right, bottom-right, bottom, bottom-left, or left.

## CRCRotationArcStyle

Rotation guide color, sweep in radians, strokeWidth and opacity.

## CRCRotationConnectorStyle

Rotation connector stroke, strokeWidth and opacity in CSS-pixel presentation.

## CRCRotationHandleProps

Binds a controller to an external rotation handle with optional custom visuals and CSS-pixel hit size.

## CRCRotationHandleStyle

Local rotation presentation includes connector, arc and readout slots. Connector
is enabled by default; arc and readout are opt-in. Each slot accepts true, false,
or its typed configuration. Connector orientation follows the displayed edge;
readout text stays upright and inside the canvas.

## CRCTouchEvent

`CRCTouchEvent` is the logical facade for touch events.

## CRCWheelEvent

`CRCWheelEvent` is the logical facade for wheel events.

**Manipulation contracts.**

`CRCManipulationBox` is the writable `left`, `top`, `width`, and `height`
geometry. `CRCManipulationController` exposes `active`, `snapshot`,
`frameProps`, and `cancel()`. `CRCManipulationFrameProps` is the value supplied
by `controller.frameProps` for `ManipulationFrame`.

`CRCManipulationActive`, `CRCManipulationSnapshot`, and
`CRCManipulationEvent` describe the live operation, starting geometry, proposed
geometry, and applied geometry. `CRCManipulationCommitEvent` adds `changed`;
`CRCManipulationCancelEvent` adds its cancellation reason.

`CRCManipulationOptions` accepts the writable box and optional move/resize
configuration. `CRCManipulationMoveInput` controls movement axis, bounds, and
grid snapping. `CRCManipulationResizeInput` controls size limits, bounds,
aspect ratio, and size or grid snapping. Their `enabled` values accept signals.

`CRCResizePosition` names the supported frame edges and corners.
`CRCDragHandleProps`, `CRCDragHandleStyle`, `CRCResizeHandleProps`, and
`CRCResizeHandlesProps` configure the public handle components.
