---
id: api-function-create-line-path
title: createLinePath
summary: Creates a fresh numeric polyline Path2D.
kind: api
slug: create-line-path
apiCategory: function
symbols: [createLinePath]
---

# createLinePath

```ts
import { createLinePath } from "@crc/core";
```

`createLinePath(options: LinePathOptions): Path2D` creates a fresh path from
finite numeric coordinate pairs and optional `closePath`. It is pure, and does
not attach paint, events, or caching.

```tsx
<Path
  d={createLinePath({
    coords: [
      [0, 0],
      [80, 40],
      [160, 0],
    ],
  })}
  style={{ stroke: "#2563eb" }}
/>
```

Try [Lines].
