---
id: api-hook-crc-rect-path
title: crcRectPath
summary: Memoizes a rectangular Path2D with optional rounding and pixel alignment.
kind: api
slug: crc-rect-path
apiCategory: hook
symbols: [crcRectPath]
relatedTypes: [PixelGridAlignment, RoundedCornerPathOptions]
---

# crcRectPath

```ts
import { crcEvent, crcRectPath, Path } from "@crc/core";
```

`crcRectPath(x, y, width, height, config?)` is render-only. It memoizes a
numeric rectangle path using its geometry and resolved numeric radii; optional
pixel-grid alignment incorporates `lineWidth`. It has no separate cleanup and
must be called in stable hook order.

Its numeric rounding fields follow [`RoundedCornerPathOptions`](#/api/types/elements-components#roundedcornerpathoptions), and its alignment uses [`PixelGridAlignment`](#/api/types/styles#pixelgridalignment).

```tsx
function Button() {
  const path = crcRectPath(0, 0, 140, 40, { cornerRadius: 8 });
  crcEvent("click", () => undefined, path, true);
  return <Path style={{ d: path, fill: "#2563eb" }} />;
}
```

See the [Rectangle live example](#/examples/drawing/rectangle).
