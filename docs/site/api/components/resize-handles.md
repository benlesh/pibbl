---
id: api-component-resize-handles
title: ResizeHandles
summary: Adds a conventional set of resize controls to a manipulation frame.
kind: api
slug: resize-handles
apiCategory: component
symbols: [ResizeHandles]
relatedTypes:
  [
    CRCResizeHandleStyle,
    CRCManipulationReadoutStyle,
    CRCResizeHandlesProps,
    CRCResizePosition,
  ]
---

# ResizeHandles

```ts
import { ResizeHandles, useManipulation, useSignal } from "@crc/core";
```

`ResizeHandles` renders corner handles by default. Set `positions` to
`"edges-and-corners"` or provide exact [`CRCResizePosition`](#/api/types/events#crcresizeposition)
values. `hitSize` applies to every generated handle.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box, resize: {} });

<ResizeHandles controller={manipulation} positions="edges-and-corners" />;
```

Related types: [CRCResizeHandlesProps](#/api/types/events#crcresizehandlesprops), [CRCResizePosition](#/api/types/events#crcresizeposition).

Readout presentation uses `style.readout` with local inactive/focused/active overrides.
Use `formatReadout` for application-defined units; labels remain inside the visible canvas.
See [handle guides and readouts](#/learn/guides/manipulation#handle-guides-and-readouts).

Related presentation types: [CRCResizeHandleStyle](#/api/types/events#crcresizehandlestyle), [CRCManipulationReadoutStyle](#/api/types/events#crcmanipulationreadoutstyle).
