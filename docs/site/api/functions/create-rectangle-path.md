---
id: api-function-create-rectangle-path
title: createRectanglePath
summary: Creates a fresh numeric rectangular Path2D.
kind: api
slug: create-rectangle-path
apiCategory: function
symbols: [createRectanglePath]
---

# createRectanglePath

```ts
import { createRectanglePath } from "@crc/core";
```

`createRectanglePath(options: RectanglePathOptions): Path2D` creates a fresh
rectangle from numeric width, height, optional position, and optional numeric
corner radii. Width and height remain signed, matching Canvas rectangle
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
  <Artwork />
</Clip>
```

Try [Rectangle].
