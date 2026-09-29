---
id: api-component-drag-handle
title: DragHandle
summary: Makes a framed subtree's box draggable.
kind: api
slug: drag-handle
apiCategory: component
symbols: [DragHandle]
relatedTypes:
  [CRCDragHandleProps, CRCDragHandleStyle, CRCManipulationController]
---

# DragHandle

```ts
import { DragHandle } from "@crc/core";
```

`DragHandle` starts a move interaction for its controller. It uses its local
box, or the enclosing frame allocation when no dimensions are supplied.

```tsx
<DragHandle controller={manipulation} style={{ cursor: "grab" }}>
  <Rectangle style={{ width: 180, height: 100, fill: "#2563eb" }} />
</DragHandle>
```

Related types: [CRCDragHandleProps](#/api/types/events#crcdraghandleprops), [CRCDragHandleStyle](#/api/types/events#crcdraghandlestyle), [CRCManipulationController](#/api/types/events#crcmanipulationcontroller).
