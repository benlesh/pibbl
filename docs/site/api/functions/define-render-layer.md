---
id: api-function-define-render-layer
title: defineRenderLayer
summary: Defines one composited external raster lifecycle component.
kind: api
slug: define-render-layer
apiCategory: function
symbols: [defineRenderLayer]
relatedTypes: [PibblRenderLayerDefinition, PibblRenderLayerComponentProps]
---

# defineRenderLayer

```ts
import { defineRenderLayer } from "@pibbl/core";
```

`defineRenderLayer()` creates a Pibbl component from a
[`PibblRenderLayerDefinition`](#/api/types/canvas-runtime#pibblrenderlayerdefinition)
that owns one external
`OffscreenCanvas` lifecycle for each mounted component identity. Its callbacks
create resources, receive updates and size changes, render synchronously, and
dispose resources on unmount. The returned component accepts
[`PibblRenderLayerComponentProps`](#/api/types/canvas-runtime#pibblrenderlayercomponentprops)
alongside its custom props.
