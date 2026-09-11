---
id: api-function-create-webgl-geometry
title: createWebGLGeometry
summary: Validates and copies triangle data into an immutable WebGL geometry descriptor.
kind: api
slug: create-webgl-geometry
apiCategory: function
symbols: [createWebGLGeometry]
relatedTypes: [CRCWebGLGeometry, CRCWebGLGeometryInput]
---

# createWebGLGeometry

```ts
import { createWebGLGeometry } from "@crc/webgl";
```

`createWebGLGeometry({ positions, indices? })` returns an opaque immutable
[`CRCWebGLGeometry`](#/api/types/webgl#crcwebglgeometry). It copies positions to
finite `Float32` values and optional indices to unsigned 32-bit values, so
later caller-array mutation cannot affect rendering or picking.

```ts
const quad = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
  indices: [0, 1, 2, 0, 2, 3],
});
```

Positions must be a nonempty finite XYZ list. Without indices, the vertex count
must be divisible by three. With indices, the index count must be divisible by
three and each item must be a nonnegative integer below `vertexCount`.
The descriptor exposes readonly `vertexCount` and `triangleCount`; its copied
arrays and bounds remain private.
