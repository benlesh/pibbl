---
id: api-function-create-rectangle-path
title: createRectanglePath
summary: Creates a fresh numeric rectangular Path2D.
kind: api
slug: create-rectangle-path
apiCategory: function
symbols: [createRectanglePath]
relatedTypes: [Canvas, RectanglePathOptions]
---

# createRectanglePath

```ts
import { Clip, createRectanglePath, Rectangle } from "@pibbl/core";
```

[`RectanglePathOptions`](#/api/types/elements-components#rectanglepathoptions) is accepted by `createRectanglePath(options): Path2D`, which creates a fresh
rectangle from numeric width, height, optional position, and optional numeric
corner radii. Width and height remain signed, matching [`Canvas`](#/api/types/canvas-runtime#canvas) rectangle
semantics. It owns no render state.

```tsx
<Clip
  style={{
    d: createRectanglePath({
      x: 0,
      y: 0,
      width: 180,
      height: 100,
      cornerRadius: 12,
    }),
  }}
>
  <Rectangle style={{ width: 180, height: 100, fill: "#2563eb" }} />
</Clip>
```

Try the [Rectangle live example](#/examples/drawing/rectangle).
