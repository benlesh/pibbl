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
    PibblResizeHandleStyle,
    PibblManipulationReadoutStyle,
    PibblResizeHandlesProps,
    PibblResizePosition,
  ]
---

# ResizeHandles

```ts
import { ResizeHandles, useManipulation, useSignal } from "@pibbl/core";
```

`ResizeHandles` renders corner handles by default. Set `positions` to
`"edges-and-corners"` or provide exact [`PibblResizePosition`](#/api/types/events#pibblresizeposition)
values. `hitSize` applies to every generated handle.

```tsx
const box = useSignal({ left: 40, top: 32, width: 180, height: 100 });
const manipulation = useManipulation({ box, resize: {} });

<ResizeHandles controller={manipulation} positions="edges-and-corners" />;
```

Related types: [PibblResizeHandlesProps](#/api/types/events#pibblresizehandlesprops), [PibblResizePosition](#/api/types/events#pibblresizeposition).

Readout presentation uses `style.readout` with local inactive/focused/active overrides.
Use `formatReadout` for application-defined units; labels remain inside the visible canvas.
See [handle guides and readouts](#/learn/guides/manipulation#handle-guides-and-readouts).

Related presentation types: [PibblResizeHandleStyle](#/api/types/events#pibblresizehandlestyle), [PibblManipulationReadoutStyle](#/api/types/events#pibblmanipulationreadoutstyle).
