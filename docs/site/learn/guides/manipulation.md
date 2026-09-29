---
id: guide-manipulation
title: Move, resize, and rotate components
summary: Bind a writable box signal to explicit handles for drag, resize, rotation, snapping, and cancellation.
kind: guide
slug: manipulation
order: 58
keywords: [drag, resize, rotate, handles, snapping, pointer capture, geometry]
---

# Move, resize, and rotate components

Manipulation writes ordinary application signals. Keep one writable box with
`left`, `top`, `width`, and `height`; use a separate writable radians signal
when rotation is enabled. `ManipulationFrame` binds that geometry and lets
children use its finite local allocation.

```tsx
import {
  DragHandle,
  ManipulationFrame,
  Rectangle,
  ResizeHandles,
  RotationHandle,
  Text,
  degrees,
  useManipulation,
  useSignal,
} from "@crc/core";

function Card() {
  const box = useSignal({ left: 96, top: 120, width: 320, height: 224 });
  const rotation = useSignal(0);
  const manipulation = useManipulation({
    box,
    rotation,
    move: { snap: { step: 16, when: "shift" } },
    resize: {
      minWidth: 224,
      minHeight: 176,
      snap: { step: 8, when: "shift" },
      aspectRatio: { value: "initial", when: "alt" },
    },
    rotate: { snap: { step: degrees(15), when: "shift" } },
  });

  return (
    <ManipulationFrame {...manipulation.frameProps}>
      <Rectangle style={{ width: 320, height: 224, fill: "#e2e8f0" }} />
      <DragHandle controller={manipulation} style={{ width: 320, height: 36 }}>
        <Text style={{ left: 16, top: 10, fill: "#0f172a" }}>
          Drag this title
        </Text>
      </DragHandle>
      <ResizeHandles controller={manipulation} />
      <RotationHandle controller={manipulation} />
    </ManipulationFrame>
  );
}
```

Drag the title, resize a corner, or use the top control to rotate. Hold Shift
to snap movement, size, and rotation. Hold Alt while resizing to preserve the
initial aspect ratio. The live
[manipulation example](#/examples/events-and-interaction/manipulation) also displays the
current geometry, rotation, operation, and completed changes.

## Placement and layout

The box is free placement in the frame parent’s coordinates. Use `left` and
`top`; `Rectangle`, `Text`, and `Image` no longer accept positioning-style
`x`/`y`. A `ManipulationFrame` may contain `Flex`, `Flow`, or `Grid`; omitted
container dimensions consume its current allocation and reflow when resizing.

Do not attach a freely positioned frame directly to `Flex`, `Flow`, or `Grid`.
Those parents own direct-child placement and ignore `left`/`top` in production
while development and test execution report the ignored fields. Put the frame
under a free-placement parent or make it content inside a separately positioned
component.

## Custom handles and cancellation

Use `useManipulation` with `ManipulationFrame` for a custom composition.
`DragHandle` owns only its local target, `ResizeHandle` accepts a `position`,
and `RotationHandle` is explicit. Resize and rotation controls have a 24 CSS
pixel hit target by default, including under zoom and device-density changes.
Custom children of those handles use CSS-pixel local coordinates at the handle
anchor.

Pointer capture keeps an active gesture routed to its handle outside its
original geometry. Movement below three CSS pixels remains an ordinary press.
Call `manipulation.cancel()` to restore the starting owned geometry. Escape
cancels when focus management is installed and the handle is focused. A newer
external write ends the gesture and remains authoritative, so cancellation does
not overwrite application state.

## Snapping and bounds

Move snaps `left`/`top` on a parent-space lattice. Size resize snaps width and
height. Use `target: "grid"` when the moving resize edge must land on a
parent-space grid; grid resize requires an unrotated frame and aligned parent
mapping. Bounds, minimum/maximum dimensions, and an active aspect ratio take
priority over snapping, so a legal constrained result can be off-grid.

Rotation values are radians and stay continuous across turns. Use `degrees()`
for readable option values. Existing `Group.rotationDegrees` remains degrees.
