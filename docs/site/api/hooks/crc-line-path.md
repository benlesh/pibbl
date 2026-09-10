---
id: api-hook-crc-line-path
title: crcLinePath
summary: Memoizes a Path2D for numeric line coordinates.
kind: api
slug: crc-line-path
apiCategory: hook
symbols: [crcLinePath]
---

# crcLinePath

```ts
import { crcLinePath } from "@crc/core";
```

`crcLinePath(coords, { closePath? }?)` is render-only and memoizes a fresh
numeric line path while its flattened coordinates and close flag are unchanged.
It has no separate cleanup; normal component slot teardown owns the memo.

```tsx
function Sparkline() {
  const path = crcLinePath([
    [0, 24],
    [30, 8],
    [60, 18],
  ]);
  return <Path d={path} style={{ stroke: "#2563eb" }} />;
}
```

See [Lines].
