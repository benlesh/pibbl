---
id: api-component-grid
title: Grid
summary: Places direct children in CRC's explicit Grid subset.
kind: api
slug: grid
apiCategory: component
symbols: [Grid]
---

# Grid

```ts
import { Grid } from "@crc/core";
```

`Grid` uses `GridProps` and `GridStyle`; children may provide `GridItemStyle`.
It accepts recursive `CRCNode` children and places explicit tracks with finite
allocation. CSS auto-placement, advanced intrinsic sizing, and scrolling are
not supported.

```tsx
<Grid
  style={{ width: 240, height: 120, columns: ["1fr", "1fr"], rows: ["1fr"] }}
>
  <Rectangle style={{ fill: "#2563eb" }} />
  <Rectangle style={{ fill: "#f59e0b" }} />
</Grid>
```

Explore [Grid layout].
