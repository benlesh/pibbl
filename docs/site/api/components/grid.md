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

Experimental mounted own-style resolution also accepts percentage `padding` from
the established containing-owner width, including top/bottom. A 200px owner keeps
10% at 20px when this container narrows to 160px. Upstream parent admission remains
authoritative; this does not add a pure measurement provider or infer an owner
from constraints. Try [allocated padding](#/examples/layout/wasm-flow-padding).
