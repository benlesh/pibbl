---
id: api-function-define-render-layer
title: defineRenderLayer
summary: Defines one composited external raster lifecycle component.
kind: api
slug: define-render-layer
apiCategory: function
symbols: [defineRenderLayer]
relatedTypes: [CRCRenderLayerDefinition, CRCRenderLayerComponentProps]
---

# defineRenderLayer

```ts
import { defineRenderLayer } from "@crc/core";
```

`defineRenderLayer()` creates a CRC component from a
[`CRCRenderLayerDefinition`](#/api/types/canvas-runtime#crcrenderlayerdefinition)
that owns one external
`OffscreenCanvas` lifecycle for each mounted component identity. Its callbacks
create resources, receive updates and size changes, render synchronously, and
dispose resources on unmount. The returned component accepts
[`CRCRenderLayerComponentProps`](#/api/types/canvas-runtime#crcrenderlayercomponentprops)
alongside its custom props.
