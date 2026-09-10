---
id: api-function-create-wedge-path
title: createWedgePath
summary: Creates a fresh center-closed circular-sector Path2D.
kind: api
slug: create-wedge-path
apiCategory: function
symbols: [createWedgePath]
---

# createWedgePath

```ts
import { createWedgePath } from "@crc/core";
```

`createWedgePath(options: WedgePathOptions): Path2D` creates a fresh numeric
circular sweep that closes to the center for partial turns. Full turns omit
radial segments. It is pure and does not accept percentages or own render state.

```tsx
<Path
  d={createWedgePath({ radius: 56, startAngle: 0, endAngle: Math.PI / 2 })}
  style={{ fill: "#f97316" }}
/>
```

See [Wedges].
