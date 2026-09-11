---
id: api-component-group-3d
title: Group3D
summary: Composes a 3D model transform and listener ancestry inside a WebGL island.
kind: api
slug: group-3d
apiCategory: component
symbols: [Group3D]
relatedTypes: [CRCNode, CRCWebGLTransformStyle, Group3DProps, Group3DStyle]
---

# Group3D

```ts
import { Cube, Group3D } from "@crc/webgl";
```

`Group3D` is a nonpainting WebGL structural component. It composes translation,
X/Y/Z degree rotation, and scale for recursive children in the fixed order
translation × Z × Y × X × scale. Translation and rotation default to zero;
scale defaults to one, supports negative values, and rejects zero.
Its recursive [`CRCNode`](#/api/types/elements-components#crcnode) children are
declared by [`Group3DProps`](#/api/types/webgl#group3dprops), and
[`Group3DStyle`](#/api/types/webgl#group3dstyle) uses the shared
[`CRCWebGLTransformStyle`](#/api/types/webgl#crcwebgltransformstyle).

```tsx
<Group3D
  style={{ translateX: 1, rotationYDegrees: 30, scaleY: 1.5 }}
  onClick={() => console.log("a descendant was selected")}
>
  <Cube style={{ color: "#38bdf8" }} />
</Group3D>
```

Handler props are listener-only propagation ancestry. `Group3D` has no geometry
or independent target, so empty projected space never selects it. It is valid
only inside [`WebGLLayer`](#/api/components/webgl-layer).
