---
id: api-function-create-regular-polygon-path
title: createRegularPolygonPath
summary: Creates a fresh generated regular-polygon Path2D.
kind: api
slug: create-regular-polygon-path
apiCategory: function
symbols: [createRegularPolygonPath]
---

# createRegularPolygonPath

```ts
import { createRegularPolygonPath, Path } from "@crc/core";
```

`createRegularPolygonPath(options: RegularPolygonPathOptions): Path2D` requires
integer `sides >= 3` and exactly one numeric size field. Optional position,
rotation, and numeric corner radii produce a fresh pure path.

```tsx
<Path
  style={{
    d: createRegularPolygonPath({ sides: 6, circumradius: 48 }),
    fill: "#22c55e",
  }}
/>
```

See the [Regular polygon live example](#/examples/drawing/regular-polygon).
