---
id: api-component-mesh
title: Mesh
summary: Draws and ray-picks one immutable triangle geometry in a WebGL island.
kind: api
slug: mesh
apiCategory: component
symbols: [Mesh]
relatedTypes: [CRCWebGLGeometry, CRCWebGLTransformStyle, MeshProps, MeshStyle]
---

# Mesh

```ts
import { Mesh, createWebGLGeometry } from "@crc/webgl";
```

`Mesh` draws one [`CRCWebGLGeometry`](#/api/types/webgl#crcwebglgeometry) through
CRC's unlit solid-color pipeline and registers the same geometry/model snapshot
for ray picking.
Its public surface is [`MeshProps`](#/api/types/webgl#meshprops) with
[`MeshStyle`](#/api/types/webgl#meshstyle), including the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

```tsx
const geometry = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
});

<Mesh geometry={geometry} style={{ color: "#f97316", opacity: 0.8 }} />;
```

Its style accepts the shared 3D transform fields, `color`, `opacity`, and
`cursor`. Color defaults to `"#ffffff"`; opacity defaults to `1` and must be
finite from `0` through `1`. Default `pointerEvents="auto"` makes the geometry
a logical target even without handlers. Use `pointerEvents="none"` for
decorative pass-through. It is valid only inside
[`WebGLLayer`](#/api/components/webgl-layer).
