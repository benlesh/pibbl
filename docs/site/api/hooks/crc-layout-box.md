---
id: api-hook-crc-layout-box
title: crcLayoutBox
summary: Returns the current child-local allocated layout box.
kind: api
slug: crc-layout-box
apiCategory: hook
symbols: [crcLayoutBox]
---

# crcLayoutBox

```ts
import { crcLayoutBox, Rectangle } from "@crc/core";
```

`crcLayoutBox(): Readonly<LayoutBox>` is render-only and returns the stable
allocation supplied by the current layout parent. It schedules no work and does
not measure. Read it during render to adapt local drawing, rather than retaining
it beyond the current render.

```tsx
function FillAllocation() {
  const { width, height } = crcLayoutBox();
  return <Rectangle style={{ width, height, fill: "#2563eb" }} />;
}
```

Try the [Flex live example](#/examples/layout/flex).
