---
id: api-function-create-regular-polygon-path
title: createRegularPolygonPath
summary: Creates a fresh generated regular-polygon Path2D.
kind: api
slug: create-regular-polygon-path
apiCategory: function
symbols: [createRegularPolygonPath]
relatedTypes: [RegularPolygonPathOptions]
---

# createRegularPolygonPath

```ts
import { createRegularPolygonPath, Path } from "@pibbl/core";
```

[`RegularPolygonPathOptions`](#/api/types/elements-components#regularpolygonpathoptions) is accepted by `createRegularPolygonPath(options): Path2D`, which requires
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
