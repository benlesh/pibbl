---
id: api-component-wedge
title: Wedge
summary: Draws a filled or stroked center-closed circular sector.
kind: api
slug: wedge
apiCategory: component
symbols: [Wedge]
relatedTypes: [WedgeProps, WedgeStyle]
---

# Wedge

```ts
import { Wedge } from "@pibbl/core";
```

`Wedge` uses [`WedgeProps`](#/api/types/elements-components#wedgeprops) and [`WedgeStyle`](#/api/types/styles#wedgestyle). It shares Arc's radius and radian
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

See the [Wedge live example](#/examples/drawing/wedge).
