---
id: api-component-wedge
title: Wedge
summary: Draws a filled or stroked center-closed circular sector.
kind: api
slug: wedge
apiCategory: component
symbols: [Wedge]
---

# Wedge

```ts
import { Wedge } from "@crc/core";
```

`Wedge` uses `WedgeProps` and `WedgeStyle`. It shares Arc's radius and radian
sweep inputs but closes partial sweeps to the center, so their radial edges
participate in painting and targeting. Full turns avoid a seam; annular sectors
are not part of this component.

```tsx
<Wedge
  style={{
    cx: 80,
    cy: 80,
    radius: 56,
    startAngle: -1.2,
    endAngle: 1.1,
    fill: "#f97316",
  }}
/>
```

See [Wedges].
