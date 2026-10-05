---
id: api-component-arc
title: Arc
summary: Draws an open circular stroke sweep.
kind: api
slug: arc
apiCategory: component
symbols: [Arc]
relatedTypes: [ArcProps, ArcStyle]
---

# Arc

```ts
import { Arc } from "@pibbl/core";
```

`Arc` draws an open circular sweep. Its props are [`ArcProps`](#/api/types/elements-components#arcprops); its local style
is [`ArcStyle`](#/api/types/styles#arcstyle), which requires `radius`, `startAngle`, and `endAngle` in radians.
It is stroke-only and rejects children. Invalid or indefinite geometry reports
a contextual layout diagnostic.

```tsx
<Arc
  style={{
    cx: 80,
    cy: 80,
    radius: 48,
    startAngle: 0,
    endAngle: Math.PI,
    stroke: "#2563eb",
    strokeWidth: 8,
  }}
/>
```

See the [Arc live example](#/examples/drawing/arc).
