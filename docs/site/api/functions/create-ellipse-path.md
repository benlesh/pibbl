---
id: api-function-create-ellipse-path
title: createEllipsePath
summary: Creates a fresh numeric elliptical Path2D.
kind: api
slug: create-ellipse-path
apiCategory: function
symbols: [createEllipsePath]
---

# createEllipsePath

```ts
import { createEllipsePath, Path } from "@crc/core";
```

`createEllipsePath(options: EllipsePathOptions): Path2D` creates a fresh path
from nonnegative numeric radii, optional center, and finite radian rotation.
It is pure and has no render lifecycle.

```tsx
<Path
  style={{
    d: createEllipsePath({ radiusX: 64, radiusY: 30, rotation: 0.4 }),
    fill: "#38bdf8",
  }}
/>
```

See the [Ellipse live example](#/examples/drawing/ellipse).
