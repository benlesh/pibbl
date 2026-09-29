---
id: api-types-manipulation
title: Manipulation types
summary: Controller, geometry, event, move, resize, and handle contracts.
kind: api
slug: manipulation
apiCategory: types
typeDomain: manipulation
symbols:
  [
    CRCDragHandleProps,
    CRCDragHandleStyle,
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
    CRCManipulationResizeInput,
    CRCManipulationSnapshot,
    CRCManipulationWhen,
    CRCResizeHandleProps,
    CRCResizeHandlesProps,
    CRCResizePosition,
  ]
keywords: [manipulation, drag, resize, pointer]
---

# Manipulation types

## Geometry and controller

`CRCManipulationBox` is the writable `left`, `top`, `width`, and `height`
geometry. `CRCManipulationController` exposes `active`, `snapshot`,
`frameProps`, and `cancel()`. `CRCManipulationFrameProps` is the value supplied
by `controller.frameProps` for `ManipulationFrame`.

`CRCManipulationActive`, `CRCManipulationSnapshot`, and
`CRCManipulationEvent` describe the live operation, starting geometry, proposed
geometry, and applied geometry. `CRCManipulationCommitEvent` adds `changed`;
`CRCManipulationCancelEvent` adds its cancellation reason.

## Options and handles

`CRCManipulationOptions` accepts the writable box and optional move/resize
configuration. `CRCManipulationMoveInput` controls movement axis, bounds, and
grid snapping. `CRCManipulationResizeInput` controls size limits, bounds,
aspect ratio, and size or grid snapping. Their `enabled` values accept signals.

`CRCResizePosition` names the supported frame edges and corners.
`CRCDragHandleProps`, `CRCDragHandleStyle`, `CRCResizeHandleProps`, and
`CRCResizeHandlesProps` configure the public handle components.
