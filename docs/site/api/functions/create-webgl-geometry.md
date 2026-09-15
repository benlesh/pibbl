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

`createWebGLGeometry({ positions, normals?, indices? })` returns an opaque immutable
[`CRCWebGLGeometry`](#/api/types/webgl#crcwebglgeometry). It copies positions to
finite `Float32` values, optional normals to finite `Float32` values, and
optional indices to unsigned 32-bit values, so later caller-array mutation
cannot affect lighting, rendering, or picking.
The accepted source object is
[`CRCWebGLGeometryInput`](#/api/types/webgl#crcwebglgeometryinput).

```ts
const quad = createWebGLGeometry({
  positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
  normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  indices: [0, 1, 2, 0, 2, 3],
});
```

Positions must be a nonempty finite XYZ list. Without indices, the vertex count
must be divisible by three. With indices, the index count must be divisible by
three and each item must be a nonnegative integer below `vertexCount`.
When supplied, normals must have exactly `positions.length` finite entries and
every XYZ normal must be nonzero. Lit geometry without normals rejects during
scene settlement; unlit geometry does not require them. Each numeric position
or normal must also remain finite when represented as `Float32`.
The descriptor exposes readonly `vertexCount` and `triangleCount`; its copied
arrays and bounds remain private.
