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
    CRCMouseEvent,
    CRCMouseEventListener,
    CRCPointerEvent,
    CRCPointerEvents,
    CRCTouchEvent,
    CRCWheelEvent,
  ]
keywords: [events, pointer, focus, keyboard, propagation]
---

# Event types

CRC provides DOM-aligned logical event facades over Canvas geometry. Paint order,
transforms, and clips remain the source of coordinate targeting; the Canvas is
the only native focus host.

## CRCClipboardEvent

`CRCClipboardEvent` is the logical facade for clipboard events and carries the
same cancellation and propagation controls as the base CRC event.

## CRCCompositionEvent

`CRCCompositionEvent` is the logical facade for composition lifecycle events.

## CRCDragEvent

`CRCDragEvent` is the logical facade for drag-and-drop events.

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

## CRCTouchEvent

`CRCTouchEvent` is the logical facade for touch events.

## CRCWheelEvent

`CRCWheelEvent` is the logical facade for wheel events.
