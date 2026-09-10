---
id: api-function-create-polygon-path
title: createPolygonPath
summary: Creates a fresh rounded or sharp numeric polygon Path2D.
kind: api
slug: create-polygon-path
apiCategory: function
symbols: [createPolygonPath]
---

# createPolygonPath

```ts
import { createPolygonPath } from "@crc/core";
```

`createPolygonPath(options: PolygonPathOptions): Path2D` creates a fresh
closed path from finite numeric pairs, with optional numeric corner radii.
Short lists are safe empty geometry; no render state or events are owned.

```tsx
<Path
  d={createPolygonPath({
    coords: [
      [0, 80],
      [50, 0],
      [100, 80],
    ],
  })}
  style={{ fill: "#f59e0b" }}
/>
```

See [Polygons].
