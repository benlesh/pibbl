---
id: api-component-webgl-layer
title: WebGLLayer
summary: Composites one private WebGL2 CRC subtree into Canvas paint order.
kind: api
slug: webgl-layer
apiCategory: component
symbols: [WebGLLayer]
relatedTypes:
  [CRCNode, CRCWebGLPerspectiveCamera, WebGLLayerProps, WebGLLayerStyle]
---

# WebGLLayer

```ts
import { WebGLLayer } from "@crc/webgl";
```

`WebGLLayer` is a Canvas composition primitive whose recursive `children` run
under the WebGL backend. Each omitted `style.width` or `style.height` uses the
current logical Canvas allocation. Compatible box/layout fields and core
`style.filter` apply at the completed bitmap boundary.

```tsx
<WebGLLayer style={{ width: 480, height: 300 }}>
  <Cube style={{ size: 1.5, color: "#8b5cf6" }} />
</WebGLLayer>
```

The optional `camera` is one [`CRCWebGLPerspectiveCamera`](#/api/types/webgl#crcwebglperspectivecamera).
Omitting it uses position `[0, 0, 5]`, look-at `[0, 0, 0]`, up `[0, 1, 0]`, a
50-degree field of view, near `0.1`, and far `1000`.

Handler props are propagation listeners; the layer rectangle is not an
independent target. Transparent island background passes through to lower
Canvas content. `pointerEvents="none"` disables the complete nested picker
without changing paint.

One mounted layer owns one persistent WebGL2 `OffscreenCanvas`, private CRC
instance, context generation, bitmap transaction, pick ledger, cache, and
context-loss listeners. It requires WebGL2, `OffscreenCanvas`, and
`transferToImageBitmap()`. See [Add WebGL islands](#/learn/guides/webgl-islands).
