---
id: api-hook-crc-canvas-context
title: crcCanvasContext
summary: Returns the current component's isolated Canvas 2D context.
kind: api
slug: crc-canvas-context
apiCategory: hook
symbols: [crcCanvasContext]
relatedTypes: [Canvas, RenderingContext2D]
---

# crcCanvasContext

```ts
import { crcCanvasContext } from "@crc/core";
```

`crcCanvasContext()` returns [`RenderingContext2D`](#/api/types/canvas-runtime#renderingcontext2d) and is render-only: call it synchronously
from a CRC component while it is rendering, never from pure measurement or an
event callback. CRC isolates [`Canvas`](#/api/types/canvas-runtime#canvas) state around component traversal; do not
retain the context for later work.

```tsx
function Marker() {
  const context = crcCanvasContext();
  context.fillRect(0, 0, 8, 8);
}
```

Use a public drawing component where possible; custom Canvas work belongs in a
custom component or primitive.
