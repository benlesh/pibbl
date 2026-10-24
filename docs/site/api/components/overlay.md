---
id: api-component-overlay
title: Overlay
summary: Places direct children on a shared declared box.
kind: api
slug: overlay
apiCategory: component
symbols: [Overlay]
relatedTypes: [OverlayProps, OverlayStyle]
---

# Overlay

```ts
import { Overlay, Rectangle, Text } from "@pibbl/core";
```

`Overlay` uses [`OverlayProps`](#/api/types/elements-components#overlayprops) and [`OverlayStyle`](#/api/types/layout#overlaystyle) to allocate recursive direct
children against one declared box. Source order remains paint order, so later
children appear over earlier children. It performs no drawing-command retention
or implicit intrinsic measurement.

```tsx
<Overlay style={{ width: 180, height: 100 }}>
  <Rectangle style={{ width: 180, height: 100, fill: "#1d4ed8" }} />
  <Text style={{ left: 18, top: 58, fill: "white", font: "20px sans-serif" }}>
    Overlay
  </Text>
</Overlay>
```

See the [Absolute and Overlay live example](#/examples/layout/absolute-and-overlay).

Experimental mounted own-style resolution also accepts percentage `padding` from
the established containing-owner width, including top/bottom. A 200px owner keeps
10% at 20px when this container narrows to 160px. Upstream parent admission remains
authoritative; this does not add a pure measurement provider or infer an owner
from constraints. Try [allocated padding](#/examples/layout/wasm-flow-padding).
