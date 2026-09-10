---
id: api-component-layer
title: Layer
summary: Caches recursive children in a persistent offscreen CRC instance.
kind: api
slug: layer
apiCategory: component
symbols: [Layer]
---

# Layer

```ts
import { Layer } from "@crc/core";
```

`Layer` uses `LayerProps` and `LayerStyle` to render recursive `CRCNode`
children through a persistent offscreen CRC instance. It shares root
interaction and global paint order, and requires browser `OffscreenCanvas`.
It is a composition boundary, not a retained scene graph.

```tsx
<Layer style={{ x: 24, y: 24, width: 160, height: 100 }}>
  <Rectangle style={{ width: 160, height: 100, fill: "#1d4ed8" }} />
</Layer>
```

See [Layers].
