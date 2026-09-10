---
id: api-component-overlay
title: Overlay
summary: Places direct children on a shared declared box.
kind: api
slug: overlay
apiCategory: component
symbols: [Overlay]
---

# Overlay

```ts
import { Overlay, Rectangle, Text } from "@crc/core";
```

`Overlay` uses `OverlayProps` and `OverlayStyle` to allocate recursive direct
children against one declared box. Source order remains paint order, so later
children appear over earlier children. It performs no drawing-command retention
or implicit intrinsic measurement.

```tsx
<Overlay style={{ width: 180, height: 100 }}>
  <Rectangle style={{ width: 180, height: 100, fill: "#1d4ed8" }} />
  <Text style={{ x: 18, y: 58, fill: "white", font: "20px sans-serif" }}>
    Overlay
  </Text>
</Overlay>
```

See the [Absolute and Overlay live example](#/examples/layout/absolute-and-overlay).
