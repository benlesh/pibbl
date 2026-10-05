---
id: api-component-grid
title: Grid
summary: Places direct children in Pibbl's explicit Grid subset.
kind: api
slug: grid
apiCategory: component
symbols: [Grid]
relatedTypes: [PibblNode, GridItemStyle, GridProps, GridStyle]
---

# Grid

```ts
import { Grid, Rectangle } from "@pibbl/core";
```

`Grid` uses [`GridProps`](#/api/types/layout#gridprops) and [`GridStyle`](#/api/types/layout#gridstyle); children may provide [`GridItemStyle`](#/api/types/layout#griditemstyle).
It accepts recursive [`PibblNode`](#/api/types/elements-components#pibblnode) children and places explicit tracks with finite
allocation. CSS auto-placement, advanced intrinsic sizing, and scrolling are
not supported.

```tsx
<Grid
  style={{
    width: 240,
    height: 120,
    gridTemplateColumns: ["1fr", "1fr"],
    gridTemplateRows: ["1fr"],
  }}
>
  <Rectangle style={{ width: "auto", height: "auto", fill: "#2563eb" }} />
  <Rectangle style={{ width: "auto", height: "auto", fill: "#f59e0b" }} />
</Grid>
```

Explore the [Grid live example](#/examples/layout/grid).
