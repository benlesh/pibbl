---
id: api-hook-use-memo
title: useMemo
summary: Memoizes a render-time value by shallow dependency identity.
kind: api
slug: use-memo
apiCategory: hook
symbols: [useMemo]
---

# useMemo

```ts
import { Path, useMemo } from "@crc/core";
```

`useMemo(create, deps)` is render-only. It invokes `create` on mount and again
when the dependency array changes by shallow identity; otherwise it returns the
same slot value. Keep hook order stable, and use it for derived values rather
than synchronous lifecycle cleanup.

```tsx
function Mark() {
  const svgData = "M10 10h90v60H10z";
  const path = useMemo(() => new Path2D(svgData), [svgData]);
  return <Path style={{ d: path, fill: "#38bdf8" }} />;
}
```

For cleanup on changes, use [`useWhenChanged`](#/api/hooks/use-when-changed).
