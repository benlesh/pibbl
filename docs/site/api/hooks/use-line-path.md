---
id: api-hook-use-line-path
title: useLinePath
summary: Memoizes a Path2D for numeric line coordinates.
kind: api
slug: use-line-path
apiCategory: hook
symbols: [useLinePath]
---

# useLinePath

```ts
import { useLinePath, Path } from "@crc/core";
```

`useLinePath(coords, { closePath? }?)` is render-only and memoizes a fresh
numeric line path while its flattened coordinates and close flag are unchanged.
It has no separate cleanup; normal component slot teardown owns the memo.

```tsx
function Sparkline() {
  const path = useLinePath([
    [0, 24],
    [30, 8],
    [60, 18],
  ]);
  return <Path style={{ d: path, stroke: "#2563eb" }} />;
}
```

See the [Line live example](#/examples/drawing/line).
