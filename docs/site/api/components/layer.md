---
id: api-component-layer
title: Layer
summary: Caches recursive children in a persistent offscreen Pibbl instance.
kind: api
slug: layer
apiCategory: component
symbols: [Layer]
relatedTypes: [PibblNode, LayerProps, LayerStyle]
---

# Layer

```ts
import { Group, Layer, Rectangle } from "@pibbl/core";
```

`Layer` uses [`LayerProps`](#/api/types/elements-components#layerprops) and [`LayerStyle`](#/api/types/styles#layerstyle) to render recursive [`PibblNode`](#/api/types/elements-components#pibblnode)
children through a persistent offscreen Pibbl instance. It shares root
interaction and global paint order, and requires browser `OffscreenCanvas`.
It is a composition boundary, not a retained scene graph.

```tsx
<Group style={{ translateX: 24, translateY: 24 }}>
  <Layer style={{ width: 160, height: 100 }}>
    <Rectangle style={{ width: 160, height: 100, fill: "#1d4ed8" }} />
  </Layer>
</Group>
```

See the [Layer live example](#/examples/composition/layer).
