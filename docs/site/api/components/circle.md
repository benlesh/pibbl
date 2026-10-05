---
id: api-component-circle
title: Circle
summary: Draws a center-and-radius circle with local paint and interaction.
kind: api
slug: circle
apiCategory: component
symbols: [Circle]
relatedTypes: [CircleProps, CircleStyle]
---

# Circle

```ts
import { Circle } from "@pibbl/core";
```

`Circle` uses [`CircleProps`](#/api/types/elements-components#circleprops) and [`CircleStyle`](#/api/types/styles#circlestyle). `radius` is required; `cx` and
`cy` default to zero. It rejects children. Its same geometry drives paint and
coordinate targeting, and percentage radii use the smaller available axis.

```tsx
<Circle
  style={{ cx: 96, cy: 80, radius: 44, fill: "#fb7185", stroke: "#881337" }}
/>
```

Try the [Circle live example](#/examples/drawing/circle).
