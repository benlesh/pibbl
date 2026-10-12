---
id: api-function-create-polygon-path
title: createPolygonPath
summary: Creates a fresh rounded or sharp numeric polygon Path2D.
kind: api
slug: create-polygon-path
apiCategory: function
symbols: [createPolygonPath]
relatedTypes: [PolygonPathOptions]
---

# createPolygonPath

```ts
import { createPolygonPath, Path } from "@pibbl/core";
```

[`PolygonPathOptions`](#/api/types/elements-components#polygonpathoptions) is accepted by `createPolygonPath(options): Path2D`, which creates a fresh
closed path from finite numeric pairs, with optional numeric corner radii.
Short lists are safe empty geometry; no render state or events are owned.

```tsx
<Path
  style={{
    d: createPolygonPath({
      coords: [
        [0, 80],
        [50, 0],
        [100, 80],
      ],
    }),
    fill: "#f59e0b",
  }}
/>
```

See the [Polygon live example](#/examples/drawing/polygon).
