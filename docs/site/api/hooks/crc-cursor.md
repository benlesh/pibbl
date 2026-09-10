---
id: api-hook-crc-cursor
title: crcCursor
summary: Wires a CSS cursor to a component or a logical Path2D region.
kind: api
slug: crc-cursor
apiCategory: hook
symbols: [crcCursor]
---

# crcCursor

```ts
import { crcCursor } from "@crc/core";
```

`crcCursor({ path?, style?, fill?, lineInteractionWidth? })` is render-only.
With a path, it follows the same logical targeting geometry as mouse events;
without one it supplies a component-level default. Re-render updates it, and
replacement or unmount releases its region and cursor ownership.

```tsx
function Link() {
  crcCursor({
    path: new Path2D("M0 0h120v36H0z"),
    style: "pointer",
    fill: true,
  });
  return <Text style={{ fill: "#2563eb" }}>Open</Text>;
}
```

See [Cursor interaction].
