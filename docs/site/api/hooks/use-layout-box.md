---
id: api-hook-use-layout-box
title: useLayoutBox
summary: Returns the current child-local allocated layout box.
kind: api
slug: use-layout-box
apiCategory: hook
symbols: [useLayoutBox]
relatedTypes: [LayoutBox]
---

# useLayoutBox

```ts
import { useLayoutBox, Rectangle } from "@crc/core";
```

`useLayoutBox()` returns a readonly [`LayoutBox`](#/api/types/layout#layoutbox) and is render-only, returning the stable
allocation supplied by the current layout parent. It schedules no work and does
not measure. Read it during render to adapt local drawing, rather than retaining
it beyond the current render.

```tsx
function FillAllocation() {
  const { width, height } = useLayoutBox();
  return <Rectangle style={{ width, height, fill: "#2563eb" }} />;
}
```

Try the [Flex live example](#/examples/layout/flex).
