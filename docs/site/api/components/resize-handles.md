---
id: api-component-resize-handles
title: ResizeHandles
summary: Adds a conventional set of resize controls to a manipulation frame.
kind: api
slug: resize-handles
apiCategory: component
symbols: [ResizeHandles]
relatedTypes: [CRCResizeHandlesProps, CRCResizePosition]
---

# ResizeHandles

```ts
import { ResizeHandles } from "@crc/core";
```

`ResizeHandles` renders corner handles by default. Set `positions` to
`"edges-and-corners"` or provide exact [`CRCResizePosition`](#/api/types/events#crcresizeposition)
values. `hitSize` applies to every generated handle.

```tsx
<ResizeHandles controller={manipulation} positions="edges-and-corners" />
```

Related types: [CRCResizeHandlesProps](#/api/types/events#crcresizehandlesprops), [CRCResizePosition](#/api/types/events#crcresizeposition).
