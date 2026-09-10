---
id: api-hook-crc-memo
title: crcMemo
summary: Memoizes a render-time value by shallow dependency identity.
kind: api
slug: crc-memo
apiCategory: hook
symbols: [crcMemo]
---

# crcMemo

```ts
import { Path, crcMemo } from "@crc/core";
```

`crcMemo(create, deps)` is render-only. It invokes `create` on mount and again
when the dependency array changes by shallow identity; otherwise it returns the
same slot value. Keep hook order stable, and use it for derived values rather
than synchronous lifecycle cleanup.

```tsx
function Mark() {
  const svgData = "M10 10h90v60H10z";
  const path = crcMemo(() => new Path2D(svgData), [svgData]);
  return <Path style={{ d: path, fill: "#38bdf8" }} />;
}
```

For cleanup on changes, use [`crcWhenChanged`](#/api/hooks/crc-when-changed).
