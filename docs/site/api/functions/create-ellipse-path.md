---
id: api-function-create-ellipse-path
title: createEllipsePath
summary: Creates a fresh numeric elliptical Path2D.
kind: api
slug: create-ellipse-path
apiCategory: function
symbols: [createEllipsePath]
relatedTypes: [EllipsePathOptions]
---

# createEllipsePath

```ts
import { createEllipsePath, Path } from "@pibbl/core";
```

[`EllipsePathOptions`](#/api/types/elements-components#ellipsepathoptions) is accepted by `createEllipsePath(options): Path2D`, which creates a fresh path
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
