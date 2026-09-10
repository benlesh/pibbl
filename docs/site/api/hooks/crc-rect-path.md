---
id: api-hook-crc-rect-path
title: crcRectPath
summary: Memoizes a rectangular Path2D with optional rounding and pixel alignment.
kind: api
slug: crc-rect-path
apiCategory: hook
symbols: [crcRectPath]
---

# crcRectPath

```ts
import { crcRectPath } from "@crc/core";
```

`crcRectPath(x, y, width, height, config?)` is render-only. It memoizes a
numeric rectangle path using its geometry and resolved numeric radii; optional
pixel-grid alignment incorporates `lineWidth`. It has no separate cleanup and
must be called in stable hook order.

```tsx
function Button() {
  const path = crcRectPath(0, 0, 140, 40, { cornerRadius: 8 });
  crcEvent("click", activate, path, true);
  return <Path d={path} style={{ fill: "#2563eb" }} />;
}
```

See [Rectangle].
