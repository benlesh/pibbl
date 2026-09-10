---
id: api-function-create-star-path
title: createStarPath
summary: Creates a fresh alternating-tip star Path2D.
kind: api
slug: create-star-path
apiCategory: function
symbols: [createStarPath]
relatedTypes: [StarPathOptions]
---

# createStarPath

```ts
import { createStarPath, Path } from "@crc/core";
```

[`StarPathOptions`](#/api/types/elements-components#starpathoptions) is accepted by `createStarPath(options): Path2D`, which validates integer points and
nonnegative inner/outer radii, then returns a fresh concave star outline. It is
pure and owns no render state, event target, or cache.

```tsx
<Path
  style={{
    d: createStarPath({ points: 5, outerRadius: 54, innerRadius: 24 }),
    fill: "#f59e0b",
  }}
/>
```

Try the [Star live example](#/examples/drawing/star).
