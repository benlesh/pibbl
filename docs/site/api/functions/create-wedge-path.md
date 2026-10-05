---
id: api-function-create-wedge-path
title: createWedgePath
summary: Creates a fresh center-closed circular-sector Path2D.
kind: api
slug: create-wedge-path
apiCategory: function
symbols: [createWedgePath]
relatedTypes: [WedgePathOptions]
---

# createWedgePath

```ts
import { createWedgePath, Path } from "@pibbl/core";
```

[`WedgePathOptions`](#/api/types/elements-components#wedgepathoptions) is accepted by `createWedgePath(options): Path2D`, which creates a fresh numeric
circular sweep that closes to the center for partial turns. Full turns omit
radial segments. It is pure and does not accept percentages or own render state.

```tsx
<Path
  style={{
    d: createWedgePath({ radius: 56, startAngle: 0, endAngle: Math.PI / 2 }),
    fill: "#f97316",
  }}
/>
```

See the [Wedge live example](#/examples/drawing/wedge).
