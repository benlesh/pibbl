---
id: api-component-drag-handle
title: DragHandle
summary: Moves a frame when users drag its children's hit areas.
kind: api
slug: drag-handle
apiCategory: component
symbols: [DragHandle]
relatedTypes:
  [CRCDragHandleProps, CRCDragHandleStyle, CRCManipulationController]
---

# DragHandle

```ts
import {
  DragHandle,
  ManipulationFrame,
  Rectangle,
  useManipulation,
  useSignal,
} from "@crc/core";
```

`DragHandle` starts a move interaction for its controller. Its children provide the hit areas through normal CRC event targeting. It adds
no target of its own: empty space, gaps between children, and descendants with
`pointerEvents="none"` do not start dragging. Shapes retain their transforms,
clips, fill and stroke hit rules. Place it inside the `ManipulationFrame` attached
to the same controller.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box, move: {} });

<ManipulationFrame {...manipulation.frameProps}>
  <DragHandle controller={manipulation} style={{ readout: true }}>
    <Rectangle
      keyboardFocusable
      style={{ width: 180, height: 100, fill: "#2563eb", cursor: "grab" }}
    />
  </DragHandle>
</ManipulationFrame>;
```

Related types: [CRCDragHandleProps](#/api/types/events#crcdraghandleprops), [CRCDragHandleStyle](#/api/types/events#crcdraghandlestyle), [CRCManipulationController](#/api/types/events#crcmanipulationcontroller).

Position readouts display the frame’s applied `left` and `top`, default to active-only, and accept the same `style.readout` states, gap, and canvas containment as resize readouts. `formatReadout={({ left, top }) => ...}` can display custom document units. Put `keyboardFocusable` and cursor styling on the actual child target. Child event cancellation can reject a drag before it reaches the handle.
