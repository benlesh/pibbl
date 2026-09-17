---
id: api-hook-use-cursor
title: useCursor
summary: Wires a CSS cursor to a component or a logical Path2D region.
kind: api
slug: use-cursor
apiCategory: hook
symbols: [useCursor]
relatedTypes: [CursorStyle]
---

# useCursor

```ts
import { useCursor, Text } from "@crc/core";
```

`useCursor({ path?, style?, fill?, lineInteractionWidth? })` is render-only.
With a path, it follows the same logical targeting geometry as mouse events;
without one it supplies a component-level default. Re-render updates it, and
replacement or unmount releases its region and cursor ownership.

Its `style` uses the local [`CursorStyle`](#/api/types/styles#cursorstyle) vocabulary.

```tsx
function Link() {
  useCursor({
    path: new Path2D("M0 0h120v36H0z"),
    style: "pointer",
    fill: true,
  });
  return <Text style={{ fill: "#2563eb" }}>Open</Text>;
}
```

See the [Hit areas and cursors live example](#/examples/events-and-interaction/hit-areas-and-cursors).
