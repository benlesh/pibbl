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
import { Cube, DirectionalLight, WebGLLayer } from "@crc/webgl";
```

`WebGLLayer` is a Canvas composition primitive whose recursive `children` run
under the WebGL backend. Each omitted `style.width` or `style.height` uses the
current logical Canvas allocation. Compatible box/layout fields and core
`style.filter` apply at the completed bitmap boundary.
Those recursive [`CRCNode`](#/api/types/elements-components#crcnode) values are
declared by [`WebGLLayerProps`](#/api/types/webgl#webgllayerprops), while
[`WebGLLayerStyle`](#/api/types/webgl#webgllayerstyle) describes its Canvas
allocation and presentation.

```tsx
<WebGLLayer style={{ width: 480, height: 300, shadows: "medium" }}>
  <DirectionalLight style={{ rotationXDegrees: -45, intensity: 1.2 }} />
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

`style.shadows` accepts `false`, `"low"`, `"medium"`, or `"high"` and defaults
to `"medium"`. The levels request 512/one-comparison, 1024/four-comparison, and
2048/nine-comparison shadow maps respectively, clamped to the device limit.
Directional and spot lights use one 2D depth view; a point light uses six cube
views. `false` disables shadow generation without changing lighting, picking,
or focus. Unchanged light/caster generations can reuse shadow depth across a
camera-only color rerender.

One mounted layer owns one persistent WebGL2 `OffscreenCanvas`, private CRC
instance, context generation, renderer/shadow resources, bitmap transaction,
pick ledger, cache, and context-loss listeners. A dirty scene composes, settles,
executes needed shadow-depth passes and color queues, transfers one bitmap, and
commits bitmap/pick/focus state only after parent Canvas composition succeeds.
Failure publishes no partial Canvas-visible generation. Context loss removes
stale paint/targeting and abandons lost handles; restoration rebuilds from
declarations. Removal and disposal release all still-valid resources exactly
once. It requires WebGL2, `OffscreenCanvas`, and `transferToImageBitmap()`.
See [Add WebGL islands](#/learn/guides/webgl-islands) and
[Light WebGL scenes](#/learn/guides/webgl-lighting).
