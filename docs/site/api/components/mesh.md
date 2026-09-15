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
CRC's Lambert-lit pipeline and registers the same geometry/model snapshot for
ray picking. `lit` defaults to `true`; a lit non-emissive mesh is black when the
scene has no illumination. Set `lit: false` for a direct unlit base color.
Its public surface is [`MeshProps`](#/api/types/webgl#meshprops) with
[`MeshStyle`](#/api/types/webgl#meshstyle), including the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

```tsx
const geometry = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 0, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
});

<Mesh
  geometry={geometry}
  style={{
    color: "#f97316",
    material: {
      type: "lambert",
      emissiveColor: "#7c2d12",
      emissiveIntensity: 0.1,
    },
  }}
/>;
```

Its style accepts the shared 3D transform fields, `color`, `opacity`, and
`cursor`, plus `lit`, local `material`, `castShadow`, and `receiveShadow`.
Color defaults to `"#ffffff"`; opacity defaults to `1` and must be finite from
`0` through `1`. The default material is `{ type: "lambert" }`; optional
`emissiveColor` defaults to black and finite nonnegative `emissiveIntensity`
defaults to `1`. Material and lighting affect RGB only. Final raster alpha is
color alpha multiplied by opacity.

Zero-alpha geometry never casts a shadow. Fully opaque geometry casts by
default, including unlit/emissive geometry; partial-alpha geometry casts only
when `castShadow: true`. Nonzero-alpha lit geometry receives by default, while
unlit geometry never receives even when requested. Shadow flags do not change
paint order, picking, or focus. Lit custom geometry must provide one finite,
nonzero normal per vertex.

Default `pointerEvents="auto"` makes the geometry a logical target even without
handlers, including when alpha is zero. Use `pointerEvents="none"` for
decorative pass-through. It is valid only inside
[`WebGLLayer`](#/api/components/webgl-layer).
