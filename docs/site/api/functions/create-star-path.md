---
id: api-function-create-star-path
title: createStarPath
summary: Creates a fresh alternating-tip star Path2D.
kind: api
slug: create-star-path
apiCategory: function
symbols: [createStarPath]
---

# createStarPath

```ts
import { createStarPath } from "@crc/core";
```

`createStarPath(options: StarPathOptions): Path2D` validates integer points and
nonnegative inner/outer radii, then returns a fresh concave star outline. It is
pure and owns no render state, event target, or cache.

```tsx
<Path
  d={createStarPath({ points: 5, outerRadius: 54, innerRadius: 24 })}
  style={{ fill: "#f59e0b" }}
/>
```

Try [Stars].
